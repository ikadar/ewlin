#!/usr/bin/env python3
"""Pipeline d'import : MasterPrint CSV -> Flux API.

Phases :
1. Load    : lit les CSV, login Flux, récupère les références existantes
2. Transform : construit les CreateJobRequest en mémoire
3. Push    : POST les nouveaux jobs (sauf --dry-run)
4. Report  : écrit un JSON de bilan + log

Usage :
    FLUX_API_PASSWORD=... python3 masterprint_to_flux.py [--dry-run] [--config FILE]

Le fichier de config (--config) par défaut = masterprint-mapping.yaml dans le même dossier.
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

# Import des modules locaux (le script doit être exécuté depuis son dossier ou le dossier dans PYTHONPATH)
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import csv_loader
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
    parser = argparse.ArgumentParser(description="Import MasterPrint dossiers into Flux")
    parser.add_argument("--config", default=str(SCRIPT_DIR / "masterprint-mapping.yaml"))
    parser.add_argument("--inbox", help="Override inbox directory (otherwise from config)")
    parser.add_argument("--report", help="Override report path (otherwise from config)")
    parser.add_argument("--dry-run", action="store_true", help="Skip Phase 3 (no POST)")
    parser.add_argument("--limit", type=int, help="Process only N dossiers (debugging)")
    args = parser.parse_args()

    config = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    paths = config.get("paths", {})
    inbox = Path(args.inbox or paths.get("inbox", "."))
    report_path = Path(args.report or paths.get("report", "report.json"))
    log_path = paths.get("log")
    setup_logging(log_path)
    log = logging.getLogger("mp2flux")

    log.info(f"=== Run start {'(DRY-RUN)' if args.dry_run else ''} ===")
    log.info(f"Inbox: {inbox}")
    log.info(f"Config: {args.config}")

    # Phase 1 — Load
    try:
        db = csv_loader.load_all(inbox)
    except FileNotFoundError as e:
        log.error(f"Missing CSV: {e}")
        return 2
    log.info(f"Loaded: {len(db.dossiers)} dossiers, "
             f"{sum(len(o) for o in db.ops_by_nodev.values())} operations, "
             f"{sum(len(t) for t in db.tirages_by_nodev.values())} tirages")

    token = None
    existing_refs: set[str] = set()
    if not args.dry_run:
        api_cfg = config["api"]
        password = os.environ.get(api_cfg["auth"]["password_env"], "")
        if not password:
            log.error(f"Missing env var {api_cfg['auth']['password_env']}")
            return 3
        try:
            token = flux_api.login(api_cfg["base_url"], api_cfg["auth"]["email"], password)
            existing_refs = flux_api.list_existing_references(api_cfg["base_url"], token)
        except (flux_api.AuthError, flux_api.ApiError) as e:
            log.error(f"API init failed: {e}")
            return 4
        log.info(f"API OK, {len(existing_refs)} existing references in Flux")

    # Phase 2 — Transform
    dossiers = db.dossiers[: args.limit] if args.limit else db.dossiers
    requests: list[tuple[dict, job_builder.ImportTrace]] = []
    skipped_dossiers: list[dict] = []
    skipped_ops_counter: Counter = Counter()

    for d in dossiers:
        req, trace = job_builder.build(d, db, config)
        for op_skip in trace.skipped_operations:
            skipped_ops_counter[op_skip["reason"]] += 1
        if req is None:
            skipped_dossiers.append({"numdo": d.numdo, "warnings": trace.warnings})
            continue
        requests.append((req, trace))

    log.info(f"Transformed: {len(requests)} jobs built, {len(skipped_dossiers)} dossiers rejected")

    # Phase 3 — Push
    push_stats: Counter = Counter()
    errors: list[dict] = []
    if not args.dry_run:
        for req, trace in requests:
            ref = req["reference"]
            if ref in existing_refs:
                push_stats["already_existing"] += 1
                continue
            assert token is not None
            try:
                status, body = flux_api.create_job(config["api"]["base_url"], token, req)
            except Exception as e:
                push_stats["server_error"] += 1
                errors.append({"reference": ref, "phase": "post", "error": str(e)})
                continue
            if status == 201:
                push_stats["created"] += 1
            elif status == 400:
                push_stats["validation_error"] += 1
                errors.append({"reference": ref, "status": 400, "body": body})
            elif status in (401, 403):
                push_stats["auth_error"] += 1
                errors.append({"reference": ref, "status": status, "body": body})
            else:
                push_stats["server_error"] += 1
                errors.append({"reference": ref, "status": status, "body": body})
    else:
        push_stats["dry_run_skipped"] = len(requests)

    # Phase 4 — Report
    report = {
        "ranAt": dt.datetime.now().isoformat(timespec="seconds"),
        "mode": "dry-run" if args.dry_run else "live",
        "input": {
            "dossiers": len(db.dossiers),
            "operations": sum(len(o) for o in db.ops_by_nodev.values()),
            "tirages": sum(len(t) for t in db.tirages_by_nodev.values()),
        },
        "transformed": {
            "jobs_built": len(requests),
            "dossiers_rejected": len(skipped_dossiers),
            "internal_tasks": sum(
                sum(1 for line in e["sequence"].split("\n") if not line.startswith("ST:"))
                for req, _ in requests for e in req["elements"]
            ),
            "outsourced_tasks": sum(
                sum(1 for line in e["sequence"].split("\n") if line.startswith("ST:"))
                for req, _ in requests for e in req["elements"]
            ),
        },
        "skipped_operations_by_reason": dict(skipped_ops_counter),
        "skipped_dossiers": skipped_dossiers,
        "posted": dict(push_stats),
        "errors": errors[:50],  # limite pour ne pas exploser le fichier
        "errors_total": len(errors),
    }
    write_report(report_path, report)
    log.info(f"Report written to {report_path}")
    log.info(f"Stats: transformed={len(requests)} posted={dict(push_stats)} errors={len(errors)}")
    log.info("=== Run end ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
