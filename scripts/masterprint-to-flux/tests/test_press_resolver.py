"""Tests press_resolver : résolution dv_cximp + di_lance + dv_machf → press task."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from csv_loader import Impression, Launch, Machine
from press_resolver import _press_nusec, _press_setup_run_minutes, resolve_press


def _machine(cdmac: str, libma: str, nusec_by_index: list[str], type_: str = "O") -> Machine:
    return Machine(cdmac=cdmac, libma=libma, type=type_, nusec_by_index=nusec_by_index)


def _impression(cdmac_1: str | None = "G37") -> Impression:
    return Impression(
        nodev="123/00", nopap="001", nrepi="1", cdmac_1=cdmac_1,
        cdmac_alternates=[], nbcr=4, nbcv=4, quadr=True, quadv=True,
        noir_r=True, noir_v=True, nbchr=0, nblavr=0, nbchv=0, nblavv=0,
        vernir=False, verniv=False, nbper=0, nbnum=0, massi=False, mont=False,
        ftimp1=0, ftimp2=0,
    )


def _launch(
    numdo: str = "202604.0001/A",
    nusec: str = "G37",
    calage_h: float = 0.0,
    roule_h: float = 0.0,
    tps: list[float] | None = None,
) -> Launch:
    return Launch(
        numdo=numdo, nusec=nusec, tache=nusec, nopap="001", pag=4,
        calage_h=calage_h,
        roule_h=roule_h,
        total_h=calage_h + roule_h,
        tps_alloue_h=tps or [0.0] * 10,
        tps_reel_h=[0.0] * 10,
    )


# ============ _press_nusec ============

def test_press_nusec_g37_picks_g37():
    """G37 has many NUSEC_x=G37 entries, prepresse codes filtered out."""
    m = _machine("G37", "G37", ["0", "0", "CTP-2", "G37", "CTP-2", "G37", "G37", "G37", "", "G37", "G37", "G37", "G37", "G37"])
    assert _press_nusec(m) == "G37"


def test_press_nusec_754_picks_754_2():
    """754 references 754-2 as its press NUSEC (different name from CDMAC)."""
    m = _machine("754", "RYOBI 754 G", ["0", "0", "CTP-2", "754-2", "", "754-2", "754-2", "754-2", "", "754-2", "754-2", "754-2", "TABLE", "754-2"])
    assert _press_nusec(m) == "754-2"


def test_press_nusec_all_blacklisted_returns_none():
    """If every NUSEC_x is prepresse/empty, no usable press NUSEC."""
    m = _machine("WEIRD", "Weird", ["CTP", "CTP-2", "TABLE", "PAO", "", "0", "0", "0", "0", "0", "0", "0", "0", "0"])
    assert _press_nusec(m) is None


# ============ _press_setup_run_minutes ============

def test_press_setup_run_uses_canonical_calage_roule_fields():
    """CALAGE_H and ROULE_H from di_lance (2026-05-21 export refresh) drive setup/run."""
    launch = _launch(calage_h=0.87, roule_h=2.50)  # 52 min setup, 150 min run
    assert _press_setup_run_minutes([launch]) == (52, 150)


def test_press_setup_run_aggregates_multiple_launches():
    """/A and /B variants for the same dossier are summed."""
    launches = [
        _launch(calage_h=0.5, roule_h=1.0),
        _launch(numdo="202604.0001/B", calage_h=0.25, roule_h=0.5),
    ]
    # 0.75h * 60 = 45min setup, 1.5h * 60 = 90min run
    assert _press_setup_run_minutes(launches) == (45, 90)


def test_press_setup_run_zero_when_no_launches():
    assert _press_setup_run_minutes([]) == (0, 0)


# ============ resolve_press end-to-end ============

def test_resolve_press_returns_none_when_cdmac_empty():
    """Insert client : pas de presse, retourne None."""
    imp = _impression(cdmac_1=None)
    m = _machine("G37", "G37", ["G37"] * 14)
    assert resolve_press(imp, "202604.0001", m, [_launch(calage_h=0.5, roule_h=0.5)], {}) is None


def test_resolve_press_returns_none_when_no_launches():
    """Pas de di_lance pour cette presse : retourne None (caller rejette le dossier)."""
    imp = _impression(cdmac_1="G37")
    m = _machine("G37", "G37", ["G37"] * 14)
    assert resolve_press(imp, "202604.0001", m, [], {}) is None


def test_resolve_press_returns_none_when_total_zero():
    """Launch existe mais CALAGE + ROULE = 0."""
    imp = _impression(cdmac_1="G37")
    m = _machine("G37", "G37", ["G37"] * 14)
    launch = _launch(calage_h=0.0, roule_h=0.0)
    assert resolve_press(imp, "202604.0001", m, [launch], {}) is None


def test_resolve_press_maps_via_yaml_press_mapping():
    """press_mapping yaml override prend le pas sur LIBMA."""
    imp = _impression(cdmac_1="RICOH")
    m = _machine("RICOH", "RICOH 9500", ["RICOH"] * 14, type_="P")
    launch = _launch(nusec="RICOH", calage_h=0.1, roule_h=0.4)
    config = {"press_mapping": {"RICOH": "Ricoh 9500"}}
    res = resolve_press(imp, "202604.0001", m, [launch], config)
    assert res is not None
    assert res.station_name == "Ricoh 9500"
    assert res.setup_min_override == 6     # 0.1h * 60
    assert res.run_min_override == 24      # 0.4h * 60
    assert res.force_setup_run_format is True


def test_resolve_press_falls_back_to_libma_when_no_mapping():
    """Si press_mapping yaml absent, on prend LIBMA (libellé lisible dv_machf)."""
    imp = _impression(cdmac_1="UNKNOWN")
    m = _machine("UNKNOWN", "Some Press", ["UNKNOWN"] * 14)
    launch = _launch(nusec="UNKNOWN", calage_h=0.5, roule_h=0.5)
    res = resolve_press(imp, "202604.0001", m, [launch], {})
    assert res is not None
    assert res.station_name == "Some Press"


def test_resolve_press_emits_setup_plus_run_separately():
    """Press tasks now keep setup vs run distinct (was 0+total before 2026-05-21)."""
    imp = _impression(cdmac_1="G37")
    m = _machine("G37", "G37", ["G37"] * 14)
    launch = _launch(calage_h=0.87, roule_h=2.50)  # 52 + 150
    res = resolve_press(imp, "202604.0001", m, [launch], {})
    assert res is not None
    assert res.setup_min_override == 52
    assert res.run_min_override == 150
    assert res.force_setup_run_format is True
