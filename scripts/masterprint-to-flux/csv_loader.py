"""Charge les 7 CSV exportés de MasterPrint et construit un objet Db indexé."""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterable


def _opt_str(s: str) -> str | None:
    s = (s or "").strip()
    return s or None


def _opt_int(s: str) -> int | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _opt_float(s: str) -> float | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _opt_date(s: str) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


@dataclass
class Dossier:
    numdo: str
    codec: str | None
    dtodo: date | None
    dtcom: date | None
    dtliv: date | None
    clotu: str | None
    nodev: str | None
    desig: str | None


@dataclass
class Devis:
    nodev: str
    libel: str | None       # = ancien FORMD = libellé devis
    nbfeu: int | None
    nblia: int | None
    qtdev_1: int | None     # = ancien QUANT1
    dtcre: date | None


@dataclass
class Operation:
    nodev: str
    nopap: str
    xno: str
    numop: str | None
    libop: str | None
    nusec: str | None
    typop: str | None
    intss: str | None
    cdmac: str | None
    setup_min: int          # round(TOTFF_4 * 60)
    run_min: int            # round(TOTFV_4 * 60)


@dataclass
class Tirage:
    nodev: str
    nopap: str
    gramm: int | None
    codfa: str | None
    cosor: str | None
    libso: str | None
    ftfou: tuple[float, float] | None
    ftfin: tuple[float, float] | None
    codfo: str | None
    nrepi: int | None


@dataclass
class ElementInfo:
    """Ligne entête de DI_ELEME (1 par couple NUMDO+NOPAP)."""
    numdo_base: str         # LEFT(NUMDO, 11)
    nusec: str | None
    nopap: str
    cid: str | None         # "Couv.", "Inté.", "Enc.", "Dépl."
    pag: int | None         # pagination cahier (0 si non applicable)
    libel: str | None


# HFSQL UInt32.MaxValue sentinel surfaced by the driver in place of NULL.
HFSQL_NULL_SENTINEL = 4294967295


def _normalize_hfsql_int(s: str) -> int:
    """Parse an int field, mapping the 4294967295 NULL sentinel to 0."""
    v = _opt_int(s) or 0
    return 0 if v == HFSQL_NULL_SENTINEL else v


@dataclass
class Impression:
    """Ligne DV_CXIMP : caractéristique impression pour (devis × papier × repiquage)."""
    nodev: str
    nopap: str
    nrepi: str
    cdmac_1: str | None     # presse retenue (vide si insert client / pas d'impression)
    cdmac_alternates: list[str]  # CDMAC_2..4 non vides
    nbcr: int               # nb couleurs recto
    nbcv: int
    quadr: bool
    quadv: bool
    noir_r: bool
    noir_v: bool
    nbchr: int              # changements plaque recto (HFSQL NULL → 0)
    nblavr: int             # lavages recto
    nbchv: int
    nblavv: int
    vernir: bool
    verniv: bool
    nbper: int
    nbnum: int
    massi: bool
    mont: bool

    def to_inking_spec_dict(self) -> dict:
        """Serialize as a structured inking spec for element.spec.inkingSpec.

        Read-only metadata sourced from MasterPrint — surfaced in the JCF
        (and similarity scoring later) but not editable. Excludes nodev/nopap/nrepi
        which are import-internal identifiers.
        """
        return {
            "press": self.cdmac_1,
            "pressAlternates": self.cdmac_alternates,
            "recto": {
                "colors": self.nbcr,
                "quadri": self.quadr,
                "black": self.noir_r,
                "plateChanges": self.nbchr,
                "washes": self.nblavr,
                "varnish": self.vernir,
            },
            "verso": {
                "colors": self.nbcv,
                "quadri": self.quadv,
                "black": self.noir_v,
                "plateChanges": self.nbchv,
                "washes": self.nblavv,
                "varnish": self.verniv,
            },
            "perforations": self.nbper,
            "numbering": self.nbnum,
        }


@dataclass
class Launch:
    """Ligne DI_LANCE : temps presse alloués/réels par (NUMDO × NUSEC × XNO)."""
    numdo: str              # avec suffixe /A /B éventuel
    nusec: str              # nom de la machine (G37, 754-2, RICOH, …)
    tache: str | None
    nopap: str | None
    pag: int | None
    tps_alloue_h: list[float]   # 10 valeurs en heures
    tps_reel_h: list[float]

    @property
    def numdo_root(self) -> str:
        """NUMDO sans suffixe /A /B pour join avec aa_dossi."""
        return self.numdo[:11]


@dataclass
class Machine:
    """Ligne DV_MACHF : référentiel des 22 machines."""
    cdmac: str
    libma: str              # libellé lisible (ex 'RYOBI 754 G')
    type: str | None        # 'O'=offset, 'P'=numérique
    nusec_by_index: list[str]   # NUSEC_1..14 (longueur 14, valeurs ou "")


@dataclass
class Db:
    dossiers: list[Dossier] = field(default_factory=list)
    clients_by_codec: dict[str, str] = field(default_factory=dict)  # CODEC -> RAISO
    nomcl_by_codec: dict[str, str] = field(default_factory=dict)   # CODEC -> NOM
    devis_by_nodev: dict[str, Devis] = field(default_factory=dict)
    ops_by_nodev: dict[str, list[Operation]] = field(default_factory=lambda: defaultdict(list))
    tirages_by_nodev_nopap: dict[tuple[str, str], Tirage] = field(default_factory=dict)
    tirages_by_nodev: dict[str, list[Tirage]] = field(default_factory=lambda: defaultdict(list))
    elements_by_numdo_nopap: dict[tuple[str, str], ElementInfo] = field(default_factory=dict)
    # Press extension (2026-05-21): dv_cximp + di_lance + dv_machf
    impressions_by_nodev_nopap: dict[tuple[str, str], list[Impression]] = field(default_factory=lambda: defaultdict(list))
    launches_by_numdo_root_nusec: dict[tuple[str, str], list[Launch]] = field(default_factory=lambda: defaultdict(list))
    machines_by_cdmac: dict[str, Machine] = field(default_factory=dict)

    def nb_postes(self, nodev: str) -> int:
        """Nombre de papiers tirés sur ce devis = nb postes Duplo."""
        return len(self.tirages_by_nodev.get(nodev, []))


def _strip_nul(line: str) -> str:
    """Drop NUL bytes leaked by the HFSQL driver in some columns (dv_cximp etc.)."""
    return line.replace("\x00", "") if "\x00" in line else line


def _read_csv(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader((_strip_nul(line) for line in f), delimiter=";", quotechar='"')
        for row in reader:
            yield row


def load_all(inbox: Path) -> Db:
    """Charge les 7 CSV depuis inbox/ et construit l'index Db."""
    db = Db()

    # 1. Clients
    for row in _read_csv(inbox / "ti_clien.csv"):
        codec = (row.get("CODEC") or "").strip()
        if not codec:
            continue
        raiso = (row.get("RAISO") or "").strip()
        nomcl = (row.get("NOMCL") or row.get("NOM") or "").strip()
        if raiso:
            db.clients_by_codec[codec] = raiso
        if nomcl:
            db.nomcl_by_codec[codec] = nomcl

    # 2. Devis
    for row in _read_csv(inbox / "dv_entdv.csv"):
        nodev = (row.get("NODEV") or "").strip()
        if not nodev:
            continue
        db.devis_by_nodev[nodev] = Devis(
            nodev=nodev,
            libel=_opt_str(row.get("FORMD") or row.get("LIBEL") or ""),
            nbfeu=_opt_int(row.get("NBFEU", "")),
            nblia=_opt_int(row.get("NBLIA", "")),
            qtdev_1=_opt_int(row.get("QUANT1") or row.get("QTDEV_1") or ""),
            dtcre=_opt_date(row.get("DTCRE", "")),
        )

    # 3. Dossiers
    for row in _read_csv(inbox / "aa_dossi.csv"):
        numdo = (row.get("NUMDO") or "").strip()
        if not numdo:
            continue
        db.dossiers.append(Dossier(
            numdo=numdo,
            codec=_opt_str(row.get("CODEC", "")),
            dtodo=_opt_date(row.get("DTODO", "")),
            dtcom=_opt_date(row.get("DTCOM", "")),
            dtliv=_opt_date(row.get("DTLIV", "")),
            clotu=_opt_str(row.get("CLOTU", "")),
            nodev=_opt_str(row.get("NODEV", "")),
            desig=_opt_str(row.get("DESIG", "")),
        ))

    # 4. Opérations
    for row in _read_csv(inbox / "dv_opedv.csv"):
        nodev = (row.get("NODEV") or "").strip()
        if not nodev:
            continue
        totff4 = _opt_float(row.get("TOTFF_4", "")) or 0.0
        totfv4 = _opt_float(row.get("TOTFV_4", "")) or 0.0
        op = Operation(
            nodev=nodev,
            nopap=(row.get("NOPAP") or "").strip(),
            xno=(row.get("XNO") or "").strip(),
            numop=_opt_str(row.get("NUMOP", "")),
            libop=_opt_str(row.get("LIBOP", "")),
            nusec=_opt_str(row.get("NUSEC", "")),
            typop=_opt_str(row.get("TYPOP", "")),
            intss=_opt_str(row.get("INTSS", "")),
            cdmac=_opt_str(row.get("CDMAC", "")),
            setup_min=round(totff4 * 60),
            run_min=round(totfv4 * 60),
        )
        db.ops_by_nodev[nodev].append(op)
    # Tri par (NOPAP, XNO) pour avoir le routing dans le bon ordre
    for ops in db.ops_by_nodev.values():
        ops.sort(key=lambda o: (o.nopap, o.xno))

    # 5. Tirages (papiers)
    for row in _read_csv(inbox / "dv_tirdv.csv"):
        nodev = (row.get("NODEV") or "").strip()
        nopap = (row.get("NOPAP") or "").strip()
        if not nodev or not nopap:
            continue
        f1, f2 = _opt_float(row.get("FTFOU_1", "")), _opt_float(row.get("FTFOU_2", ""))
        ftfou = (f1, f2) if f1 is not None and f2 is not None else None
        g1, g2 = _opt_float(row.get("FTFIN1", "")), _opt_float(row.get("FTFIN2", ""))
        ftfin = (g1, g2) if g1 is not None and g2 is not None else None
        tirage = Tirage(
            nodev=nodev,
            nopap=nopap,
            gramm=_opt_int(row.get("GRAMM", "")),
            codfa=_opt_str(row.get("CODFA", "")),
            cosor=_opt_str(row.get("COSOR", "")),
            libso=_opt_str(row.get("LIBSO", "")),
            ftfou=ftfou,
            ftfin=ftfin,
            codfo=_opt_str(row.get("CODFO", "")),
            nrepi=_opt_int(row.get("NREPI", "")),
        )
        db.tirages_by_nodev_nopap[(nodev, nopap)] = tirage
        db.tirages_by_nodev[nodev].append(tirage)

    # 6. Éléments (DI_ELEME — jointure via LEFT(NUMDO,11))
    eleme_path = inbox / "di_eleme.csv"
    if eleme_path.exists():
        for row in _read_csv(eleme_path):
            numdo = (row.get("NUMDO") or "").strip()
            if not numdo:
                continue
            numdo_base = numdo[:11]
            nopap = (row.get("NOPAP") or "").strip()
            db.elements_by_numdo_nopap[(numdo_base, nopap)] = ElementInfo(
                numdo_base=numdo_base,
                nusec=_opt_str(row.get("NUSEC", "")),
                nopap=nopap,
                cid=_opt_str(row.get("CID", "")),
                pag=_opt_int(row.get("PAG", "")),
                libel=_opt_str(row.get("LIBEL", "")),
            )

    # 7. Impressions (DV_CXIMP — la presse retenue + caractéristiques encre/vernis/format)
    cximp_path = inbox / "dv_cximp.csv"
    if cximp_path.exists():
        for row in _read_csv(cximp_path):
            nodev = (row.get("NODEV") or "").strip()
            nopap = (row.get("NOPAP") or "").strip()
            if not nodev or not nopap:
                continue
            alternates = [
                (row.get(f"CDMAC_{i}") or "").strip()
                for i in (2, 3, 4)
                if (row.get(f"CDMAC_{i}") or "").strip()
            ]
            imp = Impression(
                nodev=nodev,
                nopap=nopap,
                nrepi=(row.get("NREPI") or "1").strip(),
                cdmac_1=_opt_str(row.get("CDMAC_1", "")),
                cdmac_alternates=alternates,
                nbcr=_opt_int(row.get("NBCR", "")) or 0,
                nbcv=_opt_int(row.get("NBCV", "")) or 0,
                quadr=(row.get("QUADR") or "").strip().upper() == "O",
                quadv=(row.get("QUADV") or "").strip().upper() == "O",
                noir_r=(row.get("NOIRR") or "").strip().upper() == "O",
                noir_v=(row.get("NOIRV") or "").strip().upper() == "O",
                nbchr=_normalize_hfsql_int(row.get("NBCHR", "")),
                nblavr=_normalize_hfsql_int(row.get("NBLAVR", "")),
                nbchv=_normalize_hfsql_int(row.get("NBCHV", "")),
                nblavv=_normalize_hfsql_int(row.get("NBLAVV", "")),
                vernir=(row.get("VERNIR") or "").strip().upper() == "O",
                verniv=(row.get("VERNIV") or "").strip().upper() == "O",
                nbper=_opt_int(row.get("NBPER", "")) or 0,
                nbnum=_opt_int(row.get("NBNUM", "")) or 0,
                massi=(row.get("MASSI") or "").strip().upper() == "O",
                mont=(row.get("MONT") or "").strip().upper() == "O",
            )
            db.impressions_by_nodev_nopap[(nodev, nopap)].append(imp)

    # 8. Machines (DV_MACHF — référentiel + mapping CDMAC → libellé + NUSEC par étape)
    machf_path = inbox / "dv_machf.csv"
    if machf_path.exists():
        for row in _read_csv(machf_path):
            cdmac = (row.get("CDMAC") or "").strip()
            if not cdmac:
                continue
            nusec_by_index = [
                (row.get(f"NUSEC_{i}") or "").strip()
                for i in range(1, 15)
            ]
            db.machines_by_cdmac[cdmac] = Machine(
                cdmac=cdmac,
                libma=(row.get("LIBMA") or cdmac).strip(),
                type=_opt_str(row.get("TYPE", "")),
                nusec_by_index=nusec_by_index,
            )

    # 9. Lancements (DI_LANCE — temps presse alloués/réels par NUMDO × NUSEC × XNO).
    # Clef d'indexation = (numdo_root, nusec) ; on agrège les /A /B /etc.
    lance_path = inbox / "di_lance.csv"
    if lance_path.exists():
        for row in _read_csv(lance_path):
            numdo = (row.get("NUMDO") or "").strip()
            nusec = (row.get("NUSEC") or "").strip()
            if not numdo or not nusec:
                continue
            tps_alloue = [_opt_float(row.get(f"TPSALLOUE_{i}", "")) or 0.0 for i in range(1, 11)]
            tps_reel = [_opt_float(row.get(f"TPSREEL_{i}", "")) or 0.0 for i in range(1, 11)]
            launch = Launch(
                numdo=numdo,
                nusec=nusec,
                tache=_opt_str(row.get("TACHE", "")),
                nopap=_opt_str(row.get("NOPAP", "")),
                pag=_opt_int(row.get("PAG", "")),
                tps_alloue_h=tps_alloue,
                tps_reel_h=tps_reel,
            )
            db.launches_by_numdo_root_nusec[(launch.numdo_root, nusec)].append(launch)

    return db
