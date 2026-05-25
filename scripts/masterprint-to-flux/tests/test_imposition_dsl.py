"""Tests _derive_imposition_dsl : couvre les 4 chemins de dérivation."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from csv_loader import ElementInfo, Impression, Tirage
from job_builder import _derive_imposition_dsl


@dataclass
class _Trace:
    warnings: list[str] = field(default_factory=list)


def _imp(ftimp: tuple[float, float] | None = None) -> Impression:
    return Impression(
        nodev="123/00", nopap="001", nrepi="1", cdmac_1="G37",
        cdmac_alternates=[], nbcr=4, nbcv=4, quadr=True, quadv=True,
        noir_r=False, noir_v=False, nbchr=0, nblavr=0, nbchv=0, nblavv=0,
        vernir=False, verniv=False, nbper=0, nbnum=0, massi=False, mont=False,
        ftimp=ftimp,
    )


def _tirage(ftfou: tuple[float, float] | None = None, ftfin: tuple[float, float] | None = None) -> Tirage:
    return Tirage(
        nodev="123/00", nopap="001", gramm=None, codfa=None, cosor=None,
        libso=None, ftfou=ftfou, ftfin=ftfin, codfo=None, nrepi=1,
    )


def _element(nbpas: int | None) -> ElementInfo:
    return ElementInfo(
        numdo_base="123.0000/A", nusec="G37", nopap="001", cid="Couv.",
        pag=4, libel=None, nbpas=nbpas, nbfor=1,
    )


def test_nbpas_with_ftimp_uses_nbpas() -> None:
    """NBPAS authoritative over geometric fit when both inputs available."""
    dsl = _derive_imposition_dsl(
        [_imp(ftimp=(50.0, 70.0))],
        _tirage(ftfin=(21.0, 29.7)),
        _element(nbpas=8),
        _Trace(),
        "001",
    )
    assert dsl == "50x70(8)"


def test_nbpas_with_ftfou_fallback() -> None:
    """FTFOU fills in for missing FTIMP when NBPAS is the poses source."""
    dsl = _derive_imposition_dsl(
        [_imp(ftimp=None)],
        _tirage(ftfou=(64.0, 90.0)),
        _element(nbpas=4),
        _Trace(),
        "001",
    )
    assert dsl == "64x90(4)"


def test_geometric_fit_when_nbpas_missing() -> None:
    """Fall back to geometric fit when ElementInfo carries no NBPAS."""
    dsl = _derive_imposition_dsl(
        [_imp(ftimp=(50.0, 70.0))],
        _tirage(ftfin=(21.0, 29.7)),
        _element(nbpas=None),
        _Trace(),
        "001",
    )
    # 50/21=2, 70/29.7=2 → 4 ; orientation B : 50/29.7=1, 70/21=3 → 3 ; max=4
    assert dsl == "50x70(4)"


def test_returns_none_when_no_sheet_size_available() -> None:
    """No FTIMP and no FTFOU → cannot emit an imposition DSL."""
    dsl = _derive_imposition_dsl(
        [_imp(ftimp=None)],
        _tirage(ftfou=None, ftfin=(21.0, 29.7)),
        _element(nbpas=8),
        _Trace(),
        "001",
    )
    assert dsl is None


def test_nbpas_overrides_geometric_disagreement() -> None:
    """If MasterPrint says NBPAS=1, that wins even though geometry would give 4."""
    dsl = _derive_imposition_dsl(
        [_imp(ftimp=(50.0, 70.0))],
        _tirage(ftfin=(21.0, 29.7)),
        _element(nbpas=1),
        _Trace(),
        "001",
    )
    assert dsl == "50x70(1)"
