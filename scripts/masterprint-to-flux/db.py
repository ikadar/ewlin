"""Direct DB access for masterprint tracking fields (via docker exec).

Used for fields not exposed by the Flux REST API:
- masterprint_hash (canonical hash of MP-owned fields)
- masterprint_synced_at (last successful sync timestamp)
- masterprint_changed_after_start (flag for UI banner)
- has_started (derived: any task with recorded_progress > 0 or last_saisie_at set)
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from typing import Iterable


import os

CONTAINER = "flux-mariadb"
ENV_FILE = "/opt/flux/.env.temp"


@dataclass
class ExistingJob:
    id: str
    reference: str
    masterprint_hash: str | None
    masterprint_structure_hash: str | None
    has_started: bool


def _db_password() -> str:
    # Local override: dev machines that don't have /opt/flux/.env.temp can
    # set FLUX_DB_PASSWORD directly. Server-side cron still reads ENV_FILE.
    env_pwd = os.environ.get("FLUX_DB_PASSWORD")
    if env_pwd:
        return env_pwd
    with open(ENV_FILE) as f:
        for line in f:
            if line.startswith("MARIADB_PASSWORD="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError(f"MARIADB_PASSWORD not in {ENV_FILE}")


def _exec_sql(sql: str) -> str:
    """Run SQL inside the mariadb container, returns stdout (TSV with header)."""
    cmd = [
        "docker", "exec", "-i", CONTAINER, "mysql",
        "-uflux_user", f"-p{_db_password()}",
        "--silent", "--skip-column-names", "--raw",
        "flux_scheduler", "-e", sql,
    ]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"SQL failed: {out.stderr.strip()}\nSQL: {sql[:200]}")
    return out.stdout


def load_existing_jobs(scenario_type: str = "prod") -> dict[str, ExistingJob]:
    """Returns {reference: ExistingJob} of all jobs in the given scenario type.

    The import propagates MasterPrint facts to both Prod and Préprod, so the
    caller iterates per scenario and looks up the right IDs. Without the
    scenario filter, the dict comprehension keys by reference and overwrites
    rows across forks — half the IDs end up pointing to the wrong scenario
    → 404 on the subsequent PUT /jobs/{id} which is scenario-scoped.
    """
    # has_started = any task of the job has a TaskWall progress entry
    # (effort_minutes_done > 0, or last_saisie_at / last_setup_at set).
    # TaskWall is keyed by logical_task_id (shared across scenario forks).
    sql = f"""
    SELECT j.id, j.reference, IFNULL(j.masterprint_hash, ''),
      IFNULL(j.masterprint_structure_hash, ''),
      IF(EXISTS(
        SELECT 1 FROM tasks t
        INNER JOIN elements e ON e.id = t.element_id
        INNER JOIN task_walls w ON w.logical_task_id = t.logical_task_id
        WHERE e.job_id = j.id
          AND (w.effort_minutes_done > 0
               OR w.last_saisie_at IS NOT NULL
               OR w.last_setup_at IS NOT NULL)
      ), 1, 0) AS has_started
    FROM jobs j
    INNER JOIN scenarios s ON s.id = j.scenario_id
    WHERE s.type = '{_sql_escape(scenario_type)}';
    """
    result: dict[str, ExistingJob] = {}
    for line in _exec_sql(sql).split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        job_id, ref, hash_val, struct_hash, started = parts[0], parts[1], parts[2], parts[3], parts[4]
        result[ref] = ExistingJob(
            id=job_id,
            reference=ref,
            masterprint_hash=hash_val if hash_val else None,
            masterprint_structure_hash=struct_hash if struct_hash else None,
            has_started=started == "1",
        )
    return result


def _sql_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def update_tracking(job_id: str, mp_hash: str, structure_hash: str, changed_after_start: bool) -> None:
    """Set hashes + synced_at + changed_after_start flag on a job."""
    flag = 1 if changed_after_start else 0
    sql = (
        f"UPDATE jobs SET "
        f"masterprint_hash='{_sql_escape(mp_hash)}', "
        f"masterprint_structure_hash='{_sql_escape(structure_hash)}', "
        f"masterprint_synced_at=NOW(), "
        f"masterprint_changed_after_start={flag} "
        f"WHERE id='{_sql_escape(job_id)}';"
    )
    _exec_sql(sql)


def reset_changed_after_start(job_id: str) -> None:
    """Reset the flag (used after user acknowledges in UI — future feature)."""
    sql = (
        f"UPDATE jobs SET masterprint_changed_after_start=0 "
        f"WHERE id='{_sql_escape(job_id)}';"
    )
    _exec_sql(sql)


def compute_mp_hash(request: dict) -> str:
    """SHA-256 of the canonical MP-owned subset of a CreateJobRequest."""
    canonical = {
        "reference": request["reference"],
        "client": request["client"],
        "description": request["description"],
        "quantity": request.get("quantity"),
        "workshopExitDate": request.get("workshopExitDate"),
        "deadlineRelativeWorkingDays": request.get("deadlineRelativeWorkingDays"),
        "elements": [
            {
                "name": e["name"],
                "label": e.get("label"),
                "sequence": e["sequence"],
                "papier": e.get("papier"),
                "format": e.get("format"),
                "pagination": e.get("pagination"),
                "imposition": e.get("imposition"),
                "impression": e.get("impression"),
                "surfacage": e.get("surfacage"),
                "autres": e.get("autres"),
                "qteFeuilles": e.get("qteFeuilles"),
                "prerequisiteNames": sorted(e.get("prerequisiteNames", [])),
                "needsBat": e["needsBat"],
                "needsPaper": e["needsPaper"],
                "needsForme": e["needsForme"],
                "needsPlates": e["needsPlates"],
            }
            for e in sorted(request["elements"], key=lambda x: x["name"])
        ],
    }
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_mp_structure_hash(request: dict) -> str:
    """SHA-256 of the structural subset only (elements DSL, names, specs, prereqs).

    Excludes job metadata (client, dates, quantity) and gate fields
    (needsBat/Paper/Forme/Plates, batStatus). Used to distinguish
    'MasterPrint changed the structure' from 'MasterPrint changed metadata'.
    """
    canonical = {
        "elements": [
            {
                "name": e["name"],
                "label": e.get("label"),
                "sequence": e["sequence"],
                "papier": e.get("papier"),
                "format": e.get("format"),
                "pagination": e.get("pagination"),
                "imposition": e.get("imposition"),
                "impression": e.get("impression"),
                "surfacage": e.get("surfacage"),
                "autres": e.get("autres"),
                "qteFeuilles": e.get("qteFeuilles"),
                "prerequisiteNames": sorted(e.get("prerequisiteNames", [])),
            }
            for e in sorted(request["elements"], key=lambda x: x["name"])
        ],
    }
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
