"""Résolution des press tasks depuis dv_cximp + di_lance + dv_machf.

Pipeline :
1. Pour chaque ligne dv_cximp (NODEV × NOPAP × NREPI) avec CDMAC_1 non vide :
   a. Identifier la machine via dv_machf[CDMAC_1] → libellé + NUSEC_x par étape.
   b. Déterminer le "NUSEC presse" de cette machine (cf. _press_nusec).
   c. Récupérer les Launch correspondants dans di_lance (NUMDO root × NUSEC presse).
   d. Sommer les TPSALLOUE_x où NUSEC_x == NUSEC presse.
2. Si pas de Launch ou temps total nul → on retourne None (le caller décide
   ce qu'il en fait : skip la task ou rejet du dossier entier).
3. Sinon : Resolution(kind=station, station=mapped, run=total, force_setup_run_format).

Le mapping CDMAC → station Flux se fait via `press_mapping:` dans le yaml,
avec fallback sur Machine.libma si absent.
"""

from __future__ import annotations

from csv_loader import Impression, Launch, Machine
from station_resolver import Resolution


# NUSEC_x values that represent ancillary work (prepresse / finition), not
# the press itself. Sums for these indices are excluded from press time.
PRESS_NUSEC_PREPRESSE_BLACKLIST = {"CTP", "CTP-2", "PAO", "TABLE", "0", ""}


def _press_nusec(machine: Machine) -> str | None:
    """Identify the machine's own NUSEC (the section reflecting actual press work).

    Heuristic: the most frequent non-blacklisted NUSEC_x in the 14-step list.
    For G37 this resolves to 'G37', for 754 it's '754-2', for RICOH it's 'RICOH'.
    Returns None if all NUSEC_x are blacklisted (unusable machine row).
    """
    counts: dict[str, int] = {}
    for n in machine.nusec_by_index:
        if n in PRESS_NUSEC_PREPRESSE_BLACKLIST:
            continue
        counts[n] = counts.get(n, 0) + 1
    if not counts:
        return None
    return max(counts, key=counts.get)


def _press_setup_run_minutes(launches: list[Launch]) -> tuple[int, int]:
    """Aggregate CALAGE_H + ROULE_H across all launches → (setup_min, run_min).

    Since the 2026-05-21 MasterPrint export refresh, di_lance carries
    pre-aggregated CALAGE_H (setup) and ROULE_H (run) per row, summed from
    the per-step TPSALLOUE_x grid. Use them directly: no more heuristic over
    dv_machf.NUSEC_x indices.

    Multiple launches can exist for the same (numdo_root, nusec) when the
    dossier has /A /B variants — sum across all of them into one press task.
    """
    cal_h = 0.0
    run_h = 0.0
    for launch in launches:
        cal_h += launch.calage_h
        run_h += launch.roule_h
    return round(cal_h * 60), round(run_h * 60)


def resolve_press(
    impression: Impression,
    numdo_root: str,
    machine: Machine | None,
    launches: list[Launch],
    config: dict,
) -> Resolution | None:
    """Build a Resolution for one impression line, or None if no press task should emit.

    Returns None when:
      - CDMAC_1 is empty (insert client / pas d'impression)
      - machine référentiel introuvable
      - aucun Launch dispo (dossier pas encore lancé en prod)
      - setup + run minutes both zero
    """
    if not impression.cdmac_1:
        return None
    if machine is None:
        return None
    press_nusec = _press_nusec(machine)
    if press_nusec is None:
        return None
    setup_min, run_min = _press_setup_run_minutes(launches)
    if setup_min == 0 and run_min == 0:
        return None

    press_mapping: dict[str, str] = config.get("press_mapping", {})
    station_name = press_mapping.get(impression.cdmac_1) or machine.libma

    return Resolution(
        kind="station",
        station_name=station_name,
        setup_min_override=setup_min,
        run_min_override=run_min,
        force_setup_run_format=True,
    )


def get_machine_for_impression(impression: Impression, db) -> Machine | None:
    """Convenience accessor — handles the case where CDMAC_1 isn't in dv_machf."""
    if not impression.cdmac_1:
        return None
    return db.machines_by_cdmac.get(impression.cdmac_1)


def get_launches_for_impression(impression: Impression, numdo_root: str, machine: Machine | None, db) -> list[Launch]:
    """Returns the di_lance rows matching this impression's press NUSEC."""
    if machine is None:
        return []
    press_nusec = _press_nusec(machine)
    if press_nusec is None:
        return []
    return db.launches_by_numdo_root_nusec.get((numdo_root, press_nusec), [])
