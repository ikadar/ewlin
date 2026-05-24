"""Tests des règles de mapping NUSEC -> station."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from csv_loader import ElementInfo, Operation, Tirage
from station_resolver import ResolverContext, resolve, to_dsl_line


CONFIG = {
    "skip_nusec": ["CTP", "TRANS", "*ENC", "PAO"],
    "outsourcing": {
        "trigger_nusec": "ST",
        "provider_name": "Inconnu",
        "default_days": 3,
        "action_type": "divers",
    },
    "mapping": {
        "MASSI": {
            "rule": "duration_threshold",
            "threshold_minutes": 20,
            "le": "P137",
            "gt": "P137N",
        },
        "CONDI": {"rule": "fixed", "station": "Conditionnement"},
        "PLIAG": {
            "rule": "composite",
            "branches": [
                {"if": {"pagination_eq": 16}, "choose": "Stahl"},
                {"if": {"grammage_gte": 150}, "choose": "MBO"},
                {"default": "Stahl"},
            ],
        },
        "ASSDU": {
            "rule": "postes_threshold",
            "threshold": 5,
            "le": "Duplo 10P",
            "gt": "Duplo 20P",
        },
        "ENCA": {"rule": "fixed", "station": "Heidelberg"},
        "CYLIN": {
            "rule": "format_threshold",
            "max_small_cm": [35, 49],
            "small": "Typo Petit Format",
            "large": "Typo Grand Format",
        },
        "FACO": {"rule": "fixed", "station": "Table"},
    },
}


def _op(nusec: str, setup: int = 5, run: int = 10) -> Operation:
    return Operation(
        nodev="NV001", nopap="001", xno="01", numop="X", libop="lib",
        nusec=nusec, typop="F", intss="I", cdmac=None,
        setup_min=setup, run_min=run,
    )


def _ctx(*, tirage: Tirage | None = None, element: ElementInfo | None = None, nb_postes: int = 1) -> ResolverContext:
    return ResolverContext(tirage=tirage, element=element, nb_postes=nb_postes)


# ============ SKIPs ============

def test_skip_ctp():
    r = resolve(_op("CTP"), _ctx(), CONFIG)
    assert r.kind == "skip"
    assert "CTP" in r.skip_reason


def test_skip_trans():
    r = resolve(_op("TRANS", 0, 0), _ctx(), CONFIG)
    assert r.kind == "skip"


def test_skip_zero_duration():
    r = resolve(_op("MASSI", 0, 0), _ctx(), CONFIG)
    assert r.kind == "skip"
    assert r.skip_reason == "zero_duration"


def test_skip_unmapped_nusec():
    r = resolve(_op("INCONNU"), _ctx(), CONFIG)
    assert r.kind == "skip"
    assert "unmapped" in r.skip_reason


# ============ FIXED ============

def test_fixed_condi():
    r = resolve(_op("CONDI"), _ctx(), CONFIG)
    assert r.kind == "station"
    assert r.station_name == "Conditionnement"


def test_fixed_enca():
    r = resolve(_op("ENCA"), _ctx(), CONFIG)
    assert r.station_name == "Heidelberg"


# ============ DURATION_THRESHOLD ============

def test_massi_under_20():
    r = resolve(_op("MASSI", 5, 10), _ctx(), CONFIG)  # 15 total
    assert r.station_name == "P137"


def test_massi_equal_20():
    r = resolve(_op("MASSI", 5, 15), _ctx(), CONFIG)  # 20 total
    assert r.station_name == "P137"  # <= 20 => P137


def test_massi_over_20():
    r = resolve(_op("MASSI", 5, 16), _ctx(), CONFIG)  # 21 total
    assert r.station_name == "P137N"


# ============ POSTES_THRESHOLD ============

def test_assdu_5_postes():
    r = resolve(_op("ASSDU"), _ctx(nb_postes=5), CONFIG)
    assert r.station_name == "Duplo 10P"


def test_assdu_6_postes():
    r = resolve(_op("ASSDU"), _ctx(nb_postes=6), CONFIG)
    assert r.station_name == "Duplo 20P"


# ============ FORMAT_THRESHOLD (CYLIN) ============

def _tirage_format(w: float, h: float) -> Tirage:
    return Tirage(nodev="N", nopap="1", gramm=80, codfa=None, cosor=None, libso=None,
                  ftfou=(w, h), ftfin=None, codfo=None, nrepi=None)


def test_cylin_a4_petit_format():
    # A4 = 21x29.7, both <= 35x49
    r = resolve(_op("CYLIN"), _ctx(tirage=_tirage_format(21, 29.7)), CONFIG)
    assert r.station_name == "Typo Petit Format"


def test_cylin_35x49_petit_format():
    # Exact threshold = petit format
    r = resolve(_op("CYLIN"), _ctx(tirage=_tirage_format(35, 49)), CONFIG)
    assert r.station_name == "Typo Petit Format"


def test_cylin_36x50_grand_format():
    r = resolve(_op("CYLIN"), _ctx(tirage=_tirage_format(36, 50)), CONFIG)
    assert r.station_name == "Typo Grand Format"


def test_cylin_45x64_grand_format():
    r = resolve(_op("CYLIN"), _ctx(tirage=_tirage_format(45, 64)), CONFIG)
    assert r.station_name == "Typo Grand Format"


def test_cylin_no_tirage_fallback_petit():
    r = resolve(_op("CYLIN"), _ctx(tirage=None), CONFIG)
    assert r.station_name == "Typo Petit Format"


# ============ COMPOSITE (PLIAG) ============

def _tirage_g(gramm: int) -> Tirage:
    return Tirage(nodev="N", nopap="1", gramm=gramm, codfa=None, cosor=None, libso="OFFSET",
                  ftfou=None, ftfin=None, codfo=None, nrepi=None)


def _eleme_pag(pag: int) -> ElementInfo:
    return ElementInfo(numdo_base="XX", nusec=None, nopap="1", cid="Inté.", pag=pag, libel=None)


def test_pliag_16_pages_stahl_always():
    # 16 pages -> Stahl même si grammage lourd
    r = resolve(_op("PLIAG"), _ctx(tirage=_tirage_g(300), element=_eleme_pag(16)), CONFIG)
    assert r.station_name == "Stahl"


def test_pliag_heavy_grammage_mbo():
    r = resolve(_op("PLIAG"), _ctx(tirage=_tirage_g(250), element=_eleme_pag(8)), CONFIG)
    assert r.station_name == "MBO"


def test_pliag_light_grammage_stahl():
    r = resolve(_op("PLIAG"), _ctx(tirage=_tirage_g(80), element=_eleme_pag(8)), CONFIG)
    assert r.station_name == "Stahl"


def test_pliag_no_grammage_default_stahl():
    r = resolve(_op("PLIAG"), _ctx(tirage=None, element=_eleme_pag(8)), CONFIG)
    assert r.station_name == "Stahl"


def test_pliag_threshold_150():
    # 150 exact -> MBO (>= 150)
    r = resolve(_op("PLIAG"), _ctx(tirage=_tirage_g(150), element=_eleme_pag(8)), CONFIG)
    assert r.station_name == "MBO"


# ============ OUTSOURCED ============

def test_outsourced_st():
    r = resolve(_op("ST", 0, 0), _ctx(), CONFIG)
    assert r.kind == "outsourced"
    assert r.provider_name == "Inconnu"
    assert r.days == 3
    assert r.action_type == "divers"


# ============ DSL FORMATTING ============

def test_dsl_internal_with_setup():
    op = _op("MASSI", 5, 15)
    r = resolve(op, _ctx(), CONFIG)
    assert to_dsl_line(op, r) == "P137(5+15)"


def test_dsl_internal_zero_setup():
    op = _op("MASSI", 0, 18)
    r = resolve(op, _ctx(), CONFIG)
    assert to_dsl_line(op, r) == "P137(18)"


def test_dsl_outsourced():
    op = _op("ST", 0, 0)
    r = resolve(op, _ctx(), CONFIG)
    assert to_dsl_line(op, r) == "ST:Inconnu(3j):divers"


def test_dsl_station_with_spaces_uses_underscores():
    op = _op("ASSDU", 5, 10)
    r = resolve(op, _ctx(nb_postes=8), CONFIG)
    assert to_dsl_line(op, r) == "Duplo_20P(5+10)"


# ============ NORMALIZE (collapse_to_run + min_total_minutes) ============

CONFIG_WITH_NORMALIZE = {
    **CONFIG,
    "mapping": {
        **CONFIG["mapping"],
        "MASSI": {
            "rule": "duration_threshold",
            "threshold_minutes": 20,
            "le": "P137",
            "gt": "P137N",
            "normalize": {
                "collapse_to_run": True,
                "min_total_minutes": 5,
            },
        },
    },
}


def test_normalize_collapse_sums_setup_into_run():
    """5+15 → 0+20 when collapse_to_run is set."""
    op = _op("MASSI", 5, 15)
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert r.setup_min_override == 0
    assert r.run_min_override == 20
    assert to_dsl_line(op, r) == "P137(0+20)"


def test_normalize_floor_bumps_small_total():
    """1+2 → 0+5 because total 3 < floor 5."""
    op = _op("MASSI", 1, 2)
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert r.run_min_override == 5
    assert to_dsl_line(op, r) == "P137(0+5)"


def test_normalize_keeps_zero_setup_format_with_force_flag():
    """Even when setup is naturally 0, collapse_to_run forces 0+X format."""
    op = _op("MASSI", 0, 12)
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert to_dsl_line(op, r) == "P137(0+12)"


def test_normalize_does_not_change_station_decision():
    """Tiny op gets bumped to 5, but station picked from ORIGINAL total (still ≤20)."""
    op = _op("MASSI", 0, 1)  # original total 1, bumped to 5
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert r.station_name == "P137"  # original total 1 ≤ 20
    assert to_dsl_line(op, r) == "P137(0+5)"


def test_normalize_skipped_for_other_nusec():
    """ENCA has no normalize block → durations unchanged, default DSL format."""
    op = _op("ENCA", 5, 15)
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert r.setup_min_override is None
    assert to_dsl_line(op, r) == "Heidelberg(5+15)"


def test_normalize_zero_duration_still_skipped():
    """0+0 MASSI hits the generic skip-if-zero gate BEFORE normalize."""
    op = _op("MASSI", 0, 0)
    r = resolve(op, _ctx(), CONFIG_WITH_NORMALIZE)
    assert r.kind == "skip"
    assert r.skip_reason == "zero_duration"
