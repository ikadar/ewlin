#!/usr/bin/env python3
"""Pipeline d'import : MasterPrint CSV -> Flux API avec gestion du diff.

Phases :
1. Load     : lit les CSV, login Flux, charge l'état existant (id+hash+has_started)
2. Transform : construit les CreateJobRequest en mémoire
3. Diff     : pour chaque dossier — nouveau / inchangé / modifié / disparu
4. Push     : POST / PUT / DELETE selon le cas (sauf --dry-run)
5. Report   : JSON détaillé par job

Usage :
    FLUX_API_PASSWORD=... python3 masterprint_to_flux.py [--dry-run] [--config FILE]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import csv_loader
import db as db_mod
import flux_api
import job_builder


def setup_logging(log_path: str | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_path:
        try:
            Path(log_path).parent.mkdir(parents=True, exist_ok=True)
            handlers.append(logging.FileHandler(log_path))
        except (OSError, PermissionError) as e:
            print(f"WARN: cannot write log to {log_path}: {e}", file=sys.stderr)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=handlers,
        force=True,
    )


def write_report(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False, default=str)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import MasterPrint dossiers into Flux with diff tracking")
    parser.add_argument("--config", default=str(SCRIPT_DIR / "masterprint-mapping.yaml"))
    parser.add_argument("--inbox", help="Override inbox directory")
    parser.add_argument("--report", help="Override report path")
    parser.add_argument("--dry-run", action="store_true", help="Skip Phase 4 (no API calls modifying state)")
    parser.add_argument("--limit", type=int, help="Process only N dossiers (debugging)")
    args = parser.parse_args()

    config = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    paths = config.get("paths", {})
    inbox = Path(args.inbox or paths.get("inbox", "."))
    report_path = Path(args.report or paths.get("report", "report.json"))
    setup_logging(paths.get("log"))
    log = logging.getLogger("mp2flux")

    log.info(f"=== Run start {'(DRY-RUN)' if args.dry_run else ''} ===")
    log.info(f"Inbox: {inbox}")

    # =============== Phase 1 — Load ===============
    try:
        csv_db = csv_loader.load_all(inbox)
    except FileNotFoundError as e:
        log.error(f"Missing CSV: {e}")
        return 2
    log.info(f"Loaded CSV: {len(csv_db.dossiers)} dossiers, "
             f"{sum(len(o) for o in csv_db.ops_by_nodev.values())} operations")

    token: str | None = None
    existing_jobs: dict[str, db_mod.ExistingJob] = {}
    if not args.dry_run:
        api_cfg = config["api"]
        password = os.environ.get(api_cfg["auth"]["password_env"], "")
        if not password:
            log.error(f"Missing env var {api_cfg['auth']['password_env']}")
            return 3
        try:
            token = flux_api.login(api_cfg["base_url"], api_cfg["auth"]["email"], password)
        except flux_api.AuthError as e:
            log.error(f"API auth failed: {e}")
            return 4
        try:
            existing_jobs = db_mod.load_existing_jobs()
        except RuntimeError as e:
            log.error(f"DB load failed: {e}")
            return 5
        log.info(f"Flux DB: {len(existing_jobs)} jobs ({sum(1 for j in existing_jobs.values() if j.has_started)} started, "
                 f"{sum(1 for j in existing_jobs.values() if j.masterprint_hash)} with mp_hash)")

    # =============== Phase 2 — Transform ===============
    dossiers = csv_db.dossiers[: args.limit] if args.limit else csv_db.dossiers
    built: list[tuple[dict, job_builder.ImportTrace, str]] = []  # (request, trace, hash)
    rejected_dossiers: list[dict] = []
    skipped_ops_counter: Counter = Counter()

    for d in dossiers:
        req, trace = job_builder.build(d, csv_db, config)
        for op_skip in trace.skipped_operations:
            skipped_ops_counter[op_skip["reason"]] += 1
        if req is None:
            rejected_dossiers.append({"numdo": d.numdo, "warnings": trace.warnings})
            continue
        mp_hash = db_mod.compute_mp_hash(req)
        built.append((req, trace, mp_hash))

    log.info(f"Transformed: {len(built)} jobs built, {len(rejected_dossiers)} dossiers rejected")

    # =============== Phase 3 — Diff ===============
    new_refs = {r["reference"] for r, _, _ in built}
    actions = {"create": [], "update": [], "unchanged": [], "backfill": [], "delete": []}
    for req, trace, mp_hash in built:
        ref = req["reference"]
        if ref not in existing_jobs:
            actions["create"].append((req, trace, mp_hash))
        else:
            existing = existing_jobs[ref]
            if existing.masterprint_hash is None:
                # First time tracking — silent backfill (assume current = synced)
                actions["backfill"].append((req, trace, mp_hash, existing))
            elif existing.masterprint_hash == mp_hash:
                actions["unchanged"].append((req, existing))
            else:
                actions["update"].append((req, trace, mp_hash, existing))
    # Suppression : jobs en BDD avec mp_hash NON NULL mais absents de l'export
    for ref, info in existing_jobs.items():
        if info.masterprint_hash is not None and ref not in new_refs:
            actions["delete"].append(info)

    log.info(f"Diff: +{len(actions['create'])} new, ~{len(actions['update'])} changed, "
             f"={len(actions['unchanged'])} unchanged, "
             f"backfill={len(actions['backfill'])}, -{len(actions['delete'])} deleted")

    # =============== Phase 4 — Push ===============
    push_stats: Counter = Counter()
    detail = {"created": [], "updated": [], "deleted": [], "modified_after_start": [], "errors": []}

    if args.dry_run:
        push_stats["dry_run_create"] = len(actions["create"])
        push_stats["dry_run_update"] = len(actions["update"])
        push_stats["dry_run_delete"] = len(actions["delete"])
        push_stats["dry_run_backfill"] = len(actions["backfill"])
    else:
        assert token is not None
        api_url = config["api"]["base_url"]

        # CREATE
        for req, trace, mp_hash in actions["create"]:
            ref = req["reference"]
            try:
                status, body = flux_api.create_job(api_url, token, req)
                if status == 201 and body and "id" in body:
                    db_mod.update_tracking(body["id"], mp_hash, changed_after_start=False)
                    push_stats["created"] += 1
                    detail["created"].append({"reference": ref})
                else:
                    push_stats["create_error"] += 1
                    detail["errors"].append({"reference": ref, "phase": "create", "status": status, "body": body})
            except Exception as e:
                push_stats["create_exception"] += 1
                detail["errors"].append({"reference": ref, "phase": "create", "error": str(e)})

        # UPDATE
        for req, trace, mp_hash, existing in actions["update"]:
            ref = req["reference"]
            try:
                status, body = flux_api.update_job(api_url, token, existing.id, req)
                if status in (200, 204):
                    db_mod.update_tracking(existing.id, mp_hash, changed_after_start=existing.has_started)
                    push_stats["updated"] += 1
                    entry = {"reference": ref, "was_started": existing.has_started}
                    detail["updated"].append(entry)
                    if existing.has_started:
                        detail["modified_after_start"].append(entry)
                else:
                    push_stats["update_error"] += 1
                    detail["errors"].append({"reference": ref, "phase": "update", "status": status, "body": body})
            except Exception as e:
                push_stats["update_exception"] += 1
                detail["errors"].append({"reference": ref, "phase": "update", "error": str(e)})

        # BACKFILL (no PUT, just persist current hash)
        for req, trace, mp_hash, existing in actions["backfill"]:
            try:
                db_mod.update_tracking(existing.id, mp_hash, changed_after_start=False)
                push_stats["backfilled"] += 1
            except Exception as e:
                push_stats["backfill_exception"] += 1
                detail["errors"].append({"reference": req["reference"], "phase": "backfill", "error": str(e)})

        # DELETE
        for info in actions["delete"]:
            try:
                status, body = flux_api.delete_job(api_url, token, info.id)
                if status in (200, 204):
                    push_stats["deleted"] += 1
                    detail["deleted"].append({"reference": info.reference, "was_started": info.has_started})
                else:
                    push_stats["delete_error"] += 1
                    detail["errors"].append({"reference": info.reference, "phase": "delete", "status": status, "body": body})
            except Exception as e:
                push_stats["delete_exception"] += 1
                detail["errors"].append({"reference": info.reference, "phase": "delete", "error": str(e)})

        push_stats["unchanged"] = len(actions["unchanged"])

    # =============== Phase 5 — Report ===============
    report = {
        "ranAt": dt.datetime.now().isoformat(timespec="seconds"),
        "mode": "dry-run" if args.dry_run else "live",
        "input": {
            "dossiers": len(csv_db.dossiers),
            "operations": sum(len(o) for o in csv_db.ops_by_nodev.values()),
            "tirages": sum(len(t) for t in csv_db.tirages_by_nodev.values()),
        },
        "transformed": {
            "jobs_built": len(built),
            "dossiers_rejected": len(rejected_dossiers),
        },
        "skipped_operations_by_reason": dict(skipped_ops_counter),
        "rejected_dossiers": rejected_dossiers,
        "diff": {
            "new": len(actions["create"]),
            "changed": len(actions["update"]),
            "unchanged": len(actions["unchanged"]),
            "backfill": len(actions["backfill"]),
            "deleted": len(actions["delete"]),
        },
        "posted": dict(push_stats),
        "detail": {
            "created": detail["created"],
            "updated": detail["updated"],
            "deleted": detail["deleted"],
            "modified_after_start": detail["modified_after_start"],
        },
        "errors": detail["errors"][:50],
        "errors_total": len(detail["errors"]),
    }
    write_report(report_path, report)
    log.info(f"Report written to {report_path}")
    log.info(f"Stats: {dict(push_stats)}")
    log.info("=== Run end ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
