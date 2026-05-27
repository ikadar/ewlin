#!/usr/bin/env python3
"""Pipeline d'import : MasterPrint CSV -> Flux API (create + lance).

Transitional sync — MasterPrint is an event source, not a continuous authority.
Two operations only:
  - New dossier in bucket  → CREATE job in Flux
  - isLanced transition    → flip BAT gate to bat_approved (direct DB)

No structure updates, no metadata updates, no deletes.

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


def _request_has_lanced_elements(request: dict) -> bool:
    """True if any non-GLOBAL element in the request has batStatus=bat_approved."""
    return any(
        e.get("batStatus") == "bat_approved"
        for e in request.get("elements", [])
        if e.get("name") != "GLOBAL"
    )


import re

_DSL_ST_RE = re.compile(r'^ST:([\w ]+)\(\d+j\):')


def _extract_provider_names_from_built(built: list) -> dict[str, set[str]]:
    """Scan built job requests for ST: DSL lines. Returns {provider_name: {action_types}}."""
    providers: dict[str, set[str]] = {}
    for req, _trace, _hash in built:
        for element in req.get("elements", []):
            for line in element.get("sequence", "").split("\n"):
                line = line.strip()
                if not line.startswith("ST:"):
                    continue
                m = _DSL_ST_RE.match(line)
                if not m:
                    continue
                provider_raw = m.group(1).replace("_", " ").strip()
                # Extract action_type (everything after the closing paren+colon)
                after_paren = line.split("):", 1)
                action_type = after_paren[1].strip() if len(after_paren) > 1 else "divers"
                if provider_raw not in providers:
                    providers[provider_raw] = set()
                providers[provider_raw].add(action_type)
    return providers


def _sync_providers(built: list, config: dict, token: str, log: logging.Logger) -> list[str]:
    """Ensure all referenced providers exist in Flux. Auto-creates missing ones."""
    api_url = config["api"]["base_url"]
    transit_days = config.get("outsourcing", {}).get("transit_days", 1)

    needed = _extract_provider_names_from_built(built)
    if not needed:
        return []

    try:
        existing = flux_api.list_providers(api_url, token)
    except Exception as e:
        log.warning(f"Provider sync: cannot list existing providers: {e}")
        return []

    existing_names = {p.get("name", "").lower() for p in existing}

    created: list[str] = []
    for provider_name, action_types in sorted(needed.items()):
        if provider_name.lower() in existing_names:
            continue
        try:
            status, body = flux_api.create_provider(
                api_url, token, provider_name, sorted(action_types), transit_days
            )
            if status == 201:
                created.append(provider_name)
                log.info(f"Provider created: '{provider_name}' (actions: {sorted(action_types)}, transit: {transit_days}d)")
            elif status == 409:
                log.info(f"Provider '{provider_name}' already exists (409)")
            else:
                log.warning(f"Provider create failed for '{provider_name}': HTTP {status} {body}")
        except Exception as e:
            log.warning(f"Provider create exception for '{provider_name}': {e}")

    if created:
        log.info(f"Provider sync: {len(created)} new providers created")
    else:
        log.info("Provider sync: all providers already exist")
    return created


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

    # MasterPrint = fact-on-the-wall : propagate to both Prod (canonical wall)
    # and Préprod (sandbox antichambre). Each scenario keeps its own job IDs
    # and masterprint_hash → we run the diff+push loop once per scenario.
    SCENARIOS = ("prod", "preprod")

    token: str | None = None
    existing_jobs_by_scenario: dict[str, dict[str, db_mod.ExistingJob]] = {s: {} for s in SCENARIOS}
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
        for scenario in SCENARIOS:
            try:
                existing_jobs_by_scenario[scenario] = db_mod.load_existing_jobs(scenario)
            except RuntimeError as e:
                log.error(f"DB load failed for scenario={scenario}: {e}")
                return 5
            jobs = existing_jobs_by_scenario[scenario]
            lanced = sum(1 for j in jobs.values() if j.all_elements_lanced)
            log.info(f"Flux DB [{scenario}]: {len(jobs)} jobs ({lanced} fully lanced)")

    # =============== Phase 2 — Transform ===============
    dossiers = csv_db.dossiers[: args.limit] if args.limit else csv_db.dossiers
    built: list[tuple[dict, job_builder.ImportTrace, str]] = []
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

    # =============== Phase 2b — Provider Sync ===============
    # Collect all unique provider names referenced in outsourced DSL lines,
    # fetch existing providers from the API, and auto-create missing ones.
    providers_created: list[str] = []
    if not args.dry_run and token:
        providers_created = _sync_providers(built, config, token, log)

    # =============== Phase 3+4 — Diff + Push (per scenario) ===============
    push_stats_by_scenario: dict[str, Counter] = {}
    diff_stats_by_scenario: dict[str, dict] = {}
    detail: dict[str, list] = {"created": [], "lanced": [], "errors": []}

    for scenario in SCENARIOS:
        existing_jobs = existing_jobs_by_scenario[scenario]

        actions: dict[str, list] = {"create": [], "lance": [], "skip": []}
        for req, trace, mp_hash in built:
            ref = req["reference"]
            if ref not in existing_jobs:
                actions["create"].append((req, trace, mp_hash))
            else:
                existing = existing_jobs[ref]
                if not existing.all_elements_lanced and _request_has_lanced_elements(req):
                    actions["lance"].append((req, trace, existing))
                else:
                    actions["skip"].append(ref)

        log.info(f"Diff [{scenario}]: +{len(actions['create'])} new, "
                 f"^{len(actions['lance'])} lance, "
                 f"={len(actions['skip'])} skip")

        diff_stats_by_scenario[scenario] = {
            "new": len(actions["create"]),
            "lance": len(actions["lance"]),
            "skip": len(actions["skip"]),
        }

        push_stats: Counter = Counter()

        if args.dry_run:
            push_stats["dry_run_create"] = len(actions["create"])
            push_stats["dry_run_lance"] = len(actions["lance"])
        else:
            assert token is not None
            api_url = config["api"]["base_url"]

            for req, trace, mp_hash in actions["create"]:
                ref = req["reference"]
                try:
                    status, body = flux_api.create_job(api_url, token, req, scenario=scenario)
                    if status == 201 and body and "id" in body:
                        db_mod.update_tracking(body["id"], mp_hash)
                        push_stats["created"] += 1
                        detail["created"].append({"reference": ref, "scenario": scenario})
                    else:
                        push_stats["create_error"] += 1
                        detail["errors"].append({"reference": ref, "scenario": scenario, "phase": "create", "status": status, "body": body})
                except Exception as e:
                    push_stats["create_exception"] += 1
                    detail["errors"].append({"reference": ref, "scenario": scenario, "phase": "create", "error": str(e)})

            for req, trace, existing in actions["lance"]:
                ref = req["reference"]
                try:
                    flipped = db_mod.flip_elements_to_lanced(existing.id)
                    push_stats["lanced"] += 1
                    detail["lanced"].append({"reference": ref, "scenario": scenario, "elements_flipped": flipped})
                except Exception as e:
                    push_stats["lance_exception"] += 1
                    detail["errors"].append({"reference": ref, "scenario": scenario, "phase": "lance", "error": str(e)})

            if push_stats["lanced"] > 0 or push_stats["created"] > 0:
                try:
                    flux_api.trigger_recompute(api_url, token, scenario=scenario)
                    log.info(f"Recompute triggered [{scenario}]")
                except Exception as e:
                    log.warning(f"Recompute trigger failed [{scenario}]: {e}")

        push_stats["skip"] = len(actions["skip"])
        push_stats_by_scenario[scenario] = push_stats
        log.info(f"Stats [{scenario}]: {dict(push_stats)}")

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
        "providers_created": providers_created,
        "skipped_operations_by_reason": dict(skipped_ops_counter),
        "rejected_dossiers": rejected_dossiers,
        "diff_by_scenario": diff_stats_by_scenario,
        "posted_by_scenario": {s: dict(c) for s, c in push_stats_by_scenario.items()},
        "detail": {
            "created": detail["created"],
            "lanced": detail["lanced"],
        },
        "errors": detail["errors"][:50],
        "errors_total": len(detail["errors"]),
    }
    write_report(report_path, report)
    log.info(f"Report written to {report_path}")
    log.info("=== Run end ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
