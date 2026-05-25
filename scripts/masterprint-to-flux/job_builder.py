"""Construit un CreateJobRequest à partir d'un dossier MasterPrint."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from csv_loader import Db, Dossier
from press_resolver import (
    get_estimate_for_impression,
    get_launches_for_impression,
    get_machine_for_impression,
    resolve_press,
    resolve_press_from_estimate,
)
from station_resolver import Resolution, ResolverContext, resolve, to_dsl_line


@dataclass
class ImportTrace:
    numdo: str
    skipped_operations: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    # Legacy flag — kept for back-compat with downstream readers. Since the
    # 2026-05-24 isLanced-driven import, press_no_launch is no longer a
    # dossier-level rejection : the dossier is still imported with degraded
    # gate statuses (waiting_files / to_order) and the press task is built
    # from dv_press_estimate when available, or skipped otherwise.
    rejected_for_missing_press_time: bool = False


def _format_int(v: float) -> int:
    return int(round(v))


def _derive_autres(impressions) -> str | None:
    """Derive JCF "autres" free-text spec from dv_cximp ancillary flags.

    Only emits tokens that represent a *product* spec the operator must not
    forget (perforation). Process flags like MASSI / MONT are intentionally
    excluded — they appear in 80% of elements as standard ops and would create
    noise. NBNUM (numbering) is never set in the current bucket.
    """
    if not impressions:
        return None
    imp = impressions[0]
    tokens: list[str] = []
    if imp.nbper > 0:
        tokens.append("perforation")
    return ", ".join(tokens) or None


def _derive_surfacage_dsl(impressions) -> str | None:
    """Derive JCF surfacage DSL "recto/verso" from dv_cximp.VERNIR / VERNIV.

    MasterPrint only flags press-side varnish presence (O/N) without specifying
    the type (UV / acrylique / sélectif). We emit the generic "V" token — the
    operator refines (UV / mat / sélectif…) in the JCF if needed. Pelliculage
    (mat/satin/brillant) is a post-press operation not modelled in dv_cximp,
    so we never infer it.
    """
    if not impressions:
        return None
    imp = impressions[0]
    if not imp.vernir and not imp.verniv:
        return None
    recto = "V" if imp.vernir else ""
    verso = "V" if imp.verniv else ""
    return f"{recto}/{verso}"


def _derive_imposition_dsl(impressions, tirage, element_info, trace, nopap: str) -> str | None:
    """Derive JCF imposition DSL "LxH(poses)" from MasterPrint sources.

    Poses precedence (most authoritative first):
      1. `di_eleme.NBPAS` — operator-entered poses count, source canonique
         (92% coverage on real data, vs 33% for FTIMP).
      2. Geometric tile-fit of `dv_tirdv.FTFIN` inside `dv_cximp.FTIMP`
         — fallback when NBPAS is missing.

    Sheet size precedence:
      1. `dv_cximp.FTIMP` — actual printing sheet (post-cut for press).
      2. `dv_tirdv.FTFOU` — supplier paper sheet, used when FTIMP is empty
         (covers the 67% of press rows where MasterPrint didn't fill FTIMP).

    Returns None when no usable sheet size + poses combination is available.
    """
    ftimp = None
    if impressions:
        ftimp = next((imp.ftimp for imp in impressions if imp.ftimp), None)
    sheet = ftimp or (tirage.ftfou if tirage and tirage.ftfou else None)
    if sheet is None:
        return None
    sheet_w, sheet_h = min(sheet), max(sheet)

    nbpas = element_info.nbpas if element_info else None
    if nbpas and nbpas > 0:
        return f"{_format_int(sheet_w)}x{_format_int(sheet_h)}({nbpas})"

    if tirage is None or not tirage.ftfin:
        trace.warnings.append(f"imposition_no_finished_format NOPAP={nopap}")
        return f"{_format_int(sheet_w)}x{_format_int(sheet_h)}(1)"
    fin_w, fin_h = min(tirage.ftfin), max(tirage.ftfin)
    if fin_w <= 0 or fin_h <= 0:
        return None
    poses_a = int(sheet_w // fin_w) * int(sheet_h // fin_h)
    poses_b = int(sheet_w // fin_h) * int(sheet_h // fin_w)
    poses = max(poses_a, poses_b)
    if poses <= 0:
        trace.warnings.append(
            f"imposition_finished_larger_than_sheet NOPAP={nopap} "
            f"sheet={sheet_w}x{sheet_h} fin={fin_w}x{fin_h}"
        )
        return None
    return f"{_format_int(sheet_w)}x{_format_int(sheet_h)}({poses})"


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

    # Spec (papier, format, pagination, imposition, inkingSpec) — seulement pour les éléments papier
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
        # Imposition : `di_eleme.NBPAS` est la source canonique des poses (saisie
        # opérateur, 92% de couverture). Fallback fit géométrique FTIMP × FTFIN
        # quand NBPAS manque. Pour la taille de feuille on prend FTIMP en priorité,
        # FTFOU si FTIMP est vide (67% des lignes presse). JCF DSL = "LxH(poses)".
        impressions_for_imp = db.impressions_by_nodev_nopap.get((dossier.nodev, nopap), [])
        imp_dsl = _derive_imposition_dsl(impressions_for_imp, tirage, element_info, trace, nopap)
        if imp_dsl:
            spec["imposition"] = imp_dsl
        surf_dsl = _derive_surfacage_dsl(impressions_for_imp)
        if surf_dsl:
            spec["surfacage"] = surf_dsl
        autres = _derive_autres(impressions_for_imp)
        if autres:
            spec["autres"] = autres
        if db.devis_by_nodev.get(dossier.nodev) and db.devis_by_nodev[dossier.nodev].nbfeu:
            spec["qteFeuilles"] = db.devis_by_nodev[dossier.nodev].nbfeu
        # inkingSpec : metadata lecture seule depuis dv_cximp (couleurs/vernis/lavages).
        # Aujourd'hui 1 ligne dv_cximp par (NODEV, NOPAP) → objet unique. Si on
        # rencontre des NREPI multiples plus tard, basculer en liste sera trivial.
        impressions = db.impressions_by_nodev_nopap.get((dossier.nodev, nopap), [])
        if impressions:
            spec["inkingSpec"] = impressions[0].to_inking_spec_dict()
            impression_dsl = impressions[0].to_impression_dsl()
            if impression_dsl:
                spec["impression"] = impression_dsl

    # Résolution opération par opération
    ctx = ResolverContext(
        tirage=tirage,
        element=element_info,
        nb_postes=db.nb_postes(dossier.nodev) if dossier.nodev else 0,
    )

    dsl_lines: list[str] = []
    # element_is_lanced tracks whether EVERY press impression in this element
    # has a real di_lance row. False as soon as one impression falls back to
    # dv_press_estimate (or has no press info at all). Drives the per-element
    # batStatus/paperStatus emission below: lanced → ready (bat_approved +
    # delivered), not-lanced → blocking (waiting_files + to_order).
    # GLOBAL elements skip press resolution entirely and keep their default
    # (no-gate) state, so we start True even for them — the gate emission
    # below short-circuits on is_global anyway.
    element_is_lanced = True

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
                element_is_lanced = False
                continue
            launches = get_launches_for_impression(impression, dossier.numdo[:11], machine, db)
            press_res = resolve_press(impression, dossier.numdo[:11], machine, launches, config)
            estimate_used = False
            if press_res is None:
                # Pas de di_lance — fallback sur dv_press_estimate (synthèse
                # upstream sur NBCR/NBCV/NB_FEUILLES). Si pas d'estimate non
                # plus, on saute la press task mais on garde le dossier.
                # L'élément perd son statut "lancé" → batStatus/paperStatus
                # tombent en blocking. Voir memory project_masterprint_no_press_ops.
                element_is_lanced = False
                estimate = get_estimate_for_impression(impression, db)
                if estimate is not None:
                    press_res = resolve_press_from_estimate(impression, machine, estimate, config)
                if press_res is None:
                    trace.warnings.append(
                        f"press_no_launch CDMAC_1={impression.cdmac_1} NOPAP={nopap} NUMDO={dossier.numdo}"
                    )
                    continue
                estimate_used = True
            press_token = press_res.station_name or "?"
            source_tag = " [ESTIMATE]" if estimate_used else ""
            dsl_lines.append(
                f"# Press {press_token}{source_tag} (CDMAC_1={impression.cdmac_1}, "
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
        # Gate statuses derived from element_is_lanced :
        #   - element_is_lanced=True (every press impression has a real
        #     di_lance row) → upstream proof signed off AND paper physically
        #     present, so batStatus = bat_approved + paperStatus = delivered.
        #   - element_is_lanced=False (at least one press fell back to
        #     dv_press_estimate or skipped entirely) → BAT awaits files,
        #     paper still to order. The dossier is imported anyway so the
        #     planner sees it ; gate state will flip when the upstream
        #     workflow catches up and a di_lance row appears on next sync.
        if element_is_lanced:
            element["batStatus"] = "bat_approved"
            element["paperStatus"] = "delivered"
        else:
            element["batStatus"] = "waiting_files"
            element["paperStatus"] = "to_order"
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
