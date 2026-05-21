"""Construit un CreateJobRequest à partir d'un dossier MasterPrint."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from csv_loader import Db, Dossier
from press_resolver import get_launches_for_impression, get_machine_for_impression, resolve_press
from station_resolver import Resolution, ResolverContext, resolve, to_dsl_line


@dataclass
class ImportTrace:
    numdo: str
    skipped_operations: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    # Set to True when a press impression has no di_lance time → user decision is to
    # reject the dossier entirely (cleaned at the bucket source but defensive here).
    rejected_for_missing_press_time: bool = False


def _format_int(v: float) -> int:
    return int(round(v))


def _build_element(
    db: Db,
    dossier: Dossier,
    nopap: str,
    ops: list,
    config: dict,
    trace: ImportTrace,
) -> dict | None:
    """Construit un dict element ; renvoie None si aucune opération valide."""
    defaults = config.get("defaults", {})
    is_global = nopap == "000"

    # Nom + label
    if is_global:
        name = defaults.get("element_global_name", "GLOBAL")
        label = "Operations transversales"
    else:
        # NOPAP "001" -> n=1, "PAP1"
        try:
            n = int(nopap)
        except ValueError:
            n = nopap
        name = defaults.get("element_paper_name_template", "PAP{n}").format(n=n)
        label = f"Papier {n}"

    # Spec (papier, format, pagination, inkingSpec) — seulement pour les éléments papier
    spec: dict = {}
    tirage = None
    element_info = None
    if not is_global and dossier.nodev:
        tirage = db.tirages_by_nodev_nopap.get((dossier.nodev, nopap))
        if tirage:
            if tirage.libso and tirage.gramm:
                spec["papier"] = defaults.get("papier_template", "{LIBSO}:{GRAMM}").format(
                    LIBSO=tirage.libso, GRAMM=tirage.gramm
                )
            if tirage.ftfin:
                w_mm = _format_int(min(tirage.ftfin) * 10)
                h_mm = _format_int(max(tirage.ftfin) * 10)
                spec["format"] = f"{w_mm}x{h_mm}"
        element_info = db.elements_by_numdo_nopap.get((dossier.numdo[:11], nopap))
        if element_info and element_info.pag:
            spec["pagination"] = element_info.pag
        if db.devis_by_nodev.get(dossier.nodev) and db.devis_by_nodev[dossier.nodev].nbfeu:
            spec["qteFeuilles"] = db.devis_by_nodev[dossier.nodev].nbfeu
        # inkingSpec : metadata lecture seule depuis dv_cximp (couleurs/vernis/lavages).
        # Aujourd'hui 1 ligne dv_cximp par (NODEV, NOPAP) → objet unique. Si on
        # rencontre des NREPI multiples plus tard, basculer en liste sera trivial.
        impressions = db.impressions_by_nodev_nopap.get((dossier.nodev, nopap), [])
        if impressions:
            spec["inkingSpec"] = impressions[0].to_inking_spec_dict()

    # Résolution opération par opération
    ctx = ResolverContext(
        tirage=tirage,
        element=element_info,
        nb_postes=db.nb_postes(dossier.nodev) if dossier.nodev else 0,
    )

    dsl_lines: list[str] = []

    # 1. Press tasks (DV_CXIMP × DI_LANCE × DV_MACHF) — non-GLOBAL elements only.
    # Émises EN PREMIER pour qu'elles précèdent les ops de façonnage (massicot, etc.).
    if not is_global and dossier.nodev:
        for impression in db.impressions_by_nodev_nopap.get((dossier.nodev, nopap), []):
            if not impression.cdmac_1:
                continue  # Insert client / pas d'impression : pas de press task à émettre.
            machine = get_machine_for_impression(impression, db)
            if machine is None:
                trace.warnings.append(
                    f"press_machine_unknown CDMAC_1={impression.cdmac_1} NOPAP={nopap}"
                )
                continue
            launches = get_launches_for_impression(impression, dossier.numdo[:11], machine, db)
            press_res = resolve_press(impression, dossier.numdo[:11], machine, launches, config)
            if press_res is None:
                # Pas de di_lance → le dossier ne devrait pas être dans Ordo (cf. décision
                # utilisateur 2026-05-21 : filtrage côté bucket). Rejet défensif ici.
                trace.rejected_for_missing_press_time = True
                trace.warnings.append(
                    f"press_no_launch CDMAC_1={impression.cdmac_1} NOPAP={nopap} NUMDO={dossier.numdo}"
                )
                return None
            press_token = press_res.station_name or "?"
            dsl_lines.append(
                f"# Press {press_token} (CDMAC_1={impression.cdmac_1}, "
                f"NBCR={impression.nbcr}/NBCV={impression.nbcv}, NREPI={impression.nrepi})"
            )
            # to_dsl_line lit op.setup_min / op.run_min uniquement quand l'override est None,
            # donc on peut passer un Operation factice ; mais press_res a déjà les overrides
            # → un op vide suffit.
            from csv_loader import Operation
            fake_op = Operation(
                nodev=dossier.nodev, nopap=nopap, xno="", numop=None, libop=None,
                nusec=None, typop=None, intss=None, cdmac=impression.cdmac_1,
                setup_min=0, run_min=0,
            )
            dsl_lines.append(to_dsl_line(fake_op, press_res))

    # 2. Opérations annexes (DV_OPEDV) — façonnage, prepresse, etc.
    for op in ops:
        resolution = resolve(op, ctx, config)
        if resolution.kind == "skip":
            trace.skipped_operations.append({
                "xno": op.xno,
                "nopap": op.nopap,
                "nusec": op.nusec,
                "libop": op.libop,
                "reason": resolution.skip_reason,
            })
            continue
        # Commentaire human-readable avec l'origine MasterPrint, ignoré par le parser DSL
        libop_clean = (op.libop or "").replace("\n", " ").replace("\r", " ").strip() or "(sans libellé)"
        dsl_lines.append(f"# {libop_clean} (XNO={op.xno}, NUSEC={op.nusec or '-'})")
        dsl_lines.append(to_dsl_line(op, resolution))

    if not dsl_lines:
        return None

    # Gates : GLOBAL n'a rien à attendre ; PAP* a BAT + papier obligatoires,
    # forme si CYLIN dans les ops d'origine, plaques si DSL produit du offset
    # (toutes les presses sauf Ricoh 9500 / numérique).
    if is_global:
        needs_bat = needs_paper = needs_forme = needs_plates = False
    else:
        needs_bat = True
        needs_paper = "papier" in spec
        needs_forme = any(op.nusec == "CYLIN" for op in ops)
        offset_tokens = ("G37(", "G37-5(", "754(", "GTO(", "928-2(")
        needs_plates = any(line.startswith(offset_tokens) for line in dsl_lines)

    element: dict = {
        "name": name,
        "label": label,
        "sequence": "\n".join(dsl_lines),
        "needsBat": needs_bat,
        "needsPaper": needs_paper,
        "needsForme": needs_forme,
        "needsPlates": needs_plates,
    }
    if not is_global:
        element["prerequisiteNames"] = []
    element.update(spec)
    return element


def build(dossier: Dossier, db: Db, config: dict) -> tuple[dict | None, ImportTrace]:
    """Construit le CreateJobRequest ; renvoie (None, trace) si dossier rejeté."""
    trace = ImportTrace(numdo=dossier.numdo)
    defaults = config.get("defaults", {})

    if not dossier.nodev or dossier.nodev not in db.devis_by_nodev:
        trace.warnings.append("nodev_missing_or_unknown")
        return None, trace

    devis = db.devis_by_nodev[dossier.nodev]
    client_name = db.clients_by_codec.get(dossier.codec or "")
    if not client_name:
        trace.warnings.append(f"client_unknown_codec={dossier.codec}")
        client_name = dossier.codec or "(client inconnu)"

    # Description = dossier-specific REFTR_1 — REFTR_2 (added to aa_dossi 2026-05-21).
    # These are unique per-job descriptions ("CARNET DE LIAISON REF…", "JOURNAL DE LA
    # CLASSE") vs DESIG which is a generic category ("INTERIEUR DE CLASSEUR" repeats
    # across dozens of dossiers). Fallback chain preserves legacy behavior when both
    # REFTR_x are empty.
    reftr_parts = [p for p in (dossier.reftr_1, dossier.reftr_2) if p]
    if reftr_parts:
        description = " — ".join(reftr_parts)
    else:
        description = dossier.desig or (devis.libel if devis else None) or "(sans description)"

    request: dict = {
        "reference": dossier.numdo,
        "client": client_name[:100],
        "description": description[:200],
        "quantity": devis.qtdev_1 if devis and devis.qtdev_1 else 0,
        "deadlinePriority": 2,
        "status": "planned",
        "referent": "MasterPrint",
        "elements": [],
    }

    if dossier.dtliv:
        request["workshopExitDate"] = dossier.dtliv.isoformat()
    else:
        request["deadlineRelativeWorkingDays"] = defaults.get("deadline_relative_working_days_fallback", 10)

    # Quantity 0 invalide côté API : on enlève le champ pour qu'il soit considéré comme absent
    if request["quantity"] == 0:
        del request["quantity"]

    # Groupe opérations par NOPAP
    ops = db.ops_by_nodev.get(dossier.nodev, [])
    ops_by_nopap: dict[str, list] = defaultdict(list)
    for op in ops:
        ops_by_nopap[op.nopap].append(op)

    # Tri NOPAP : 000 d'abord, puis 001, 002...
    sorted_nopap = sorted(ops_by_nopap.keys(), key=lambda n: (0 if n == "000" else 1, n))

    elements: list[dict] = []
    for nopap in sorted_nopap:
        element = _build_element(db, dossier, nopap, ops_by_nopap[nopap], config, trace)
        if trace.rejected_for_missing_press_time:
            # Décision utilisateur 2026-05-21 : un dossier dont une presse n'a pas de
            # di_lance n'a rien à faire dans Ordo. Le bucket les filtre normalement ;
            # on rejette défensivement ici.
            return None, trace
        if element is not None:
            elements.append(element)

    if not elements:
        trace.warnings.append("no_valid_element_after_filtering")
        return None, trace

    # Précédence : le GLOBAL (faconnage transversal, conditionnement, transport,
    # sous-traitance) ne peut commencer qu'une fois TOUS les papiers produits.
    pap_names = [e["name"] for e in elements if e["name"] != defaults.get("element_global_name", "GLOBAL")]
    for e in elements:
        if e["name"] == defaults.get("element_global_name", "GLOBAL") and pap_names:
            e["prerequisiteNames"] = pap_names

    request["elements"] = elements
    return request, trace
