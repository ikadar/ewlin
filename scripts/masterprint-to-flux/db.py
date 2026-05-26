"""Direct DB access for masterprint tracking + gate flips (via docker exec).

Used for fields not exposed by the Flux REST API:
- masterprint_hash (canonical hash of MP-owned fields)
- masterprint_synced_at (last successful sync timestamp)
- all_elements_lanced (derived: all non-GLOBAL elements have bat_approved)
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass


import os

CONTAINER = "flux-mariadb"
ENV_FILE = "/opt/flux/.env.temp"


@dataclass
class ExistingJob:
    id: str
    reference: str
    masterprint_hash: str | None
    all_elements_lanced: bool


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

    all_elements_lanced = true when every non-GLOBAL element already has
    bat_status='bat_approved'. Used to detect the isLanced transition:
    if MasterPrint now says lanced but all_elements_lanced is false, we flip.
    """
    sql = f"""
    SELECT j.id, j.reference, IFNULL(j.masterprint_hash, ''),
      IF(NOT EXISTS(
        SELECT 1 FROM elements e
        WHERE e.job_id = j.id
          AND e.name != 'GLOBAL'
          AND e.bat_status != 'bat_approved'
      ), 1, 0) AS all_lanced
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
        if len(parts) < 4:
            continue
        job_id, ref, hash_val, all_lanced = parts[0], parts[1], parts[2], parts[3]
        result[ref] = ExistingJob(
            id=job_id,
            reference=ref,
            masterprint_hash=hash_val if hash_val else None,
            all_elements_lanced=all_lanced == "1",
        )
    return result


def _sql_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def update_tracking(job_id: str, mp_hash: str) -> None:
    """Set hash + synced_at on a newly created job."""
    sql = (
        f"UPDATE jobs SET "
        f"masterprint_hash='{_sql_escape(mp_hash)}', "
        f"masterprint_synced_at=NOW() "
        f"WHERE id='{_sql_escape(job_id)}';"
    )
    _exec_sql(sql)


def flip_elements_to_lanced(job_id: str) -> int:
    """Set bat_status=bat_approved + paper_status=delivered on all non-GLOBAL
    elements of a job. Returns the number of rows affected."""
    sql = (
        f"UPDATE elements SET "
        f"bat_status='bat_approved', paper_status='delivered' "
        f"WHERE job_id='{_sql_escape(job_id)}' "
        f"AND name != 'GLOBAL' "
        f"AND bat_status != 'bat_approved'; "
        f"SELECT ROW_COUNT();"
    )
    out = _exec_sql(sql).strip()
    try:
        return int(out)
    except ValueError:
        return 0


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
