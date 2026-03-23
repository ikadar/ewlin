"""CLI entry point for running the CP-SAT solver against a ScheduleSnapshot JSON.

Usage:
    python -m flux_solver.cli snapshot.json [--time-limit 60]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from flux_solver.models.snapshot import ScheduleSnapshot
from flux_solver.models.solution import SolverResult
from flux_solver.modes.strategic import solve_strategic


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Flux Scheduler CP-SAT Solver (Phase 1 PoC)"
    )
    parser.add_argument(
        "snapshot",
        type=Path,
        help="Path to ScheduleSnapshot JSON file",
    )
    parser.add_argument(
        "--time-limit",
        type=int,
        default=60,
        help="Solver time limit in seconds (default: 60)",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=None,
        help="Write solution assignments to JSON file",
    )
    parser.add_argument(
        "--windowed",
        action="store_true",
        help="Use windowed decomposition for large instances",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=15,
        help="Window size in days (default: 15)",
    )
    parser.add_argument(
        "--overlap-days",
        type=int,
        default=5,
        help="Overlap between windows in days (default: 5)",
    )
    args = parser.parse_args()

    # Read snapshot
    snapshot_path: Path = args.snapshot
    if not snapshot_path.exists():
        print(f"Error: File not found: {snapshot_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading snapshot from {snapshot_path}...")
    with open(snapshot_path) as f:
        data = json.load(f)

    snapshot = ScheduleSnapshot.model_validate(data)
    _print_snapshot_summary(snapshot)

    # Solve
    mode = "windowed" if args.windowed else "single-window"
    print(f"\nSolving ({mode}) with {args.time_limit}s time limit...")
    print("=" * 60)

    result = solve_strategic(
        snapshot,
        time_limit_seconds=args.time_limit,
        windowed=args.windowed,
        window_days=args.window_days,
        overlap_days=args.overlap_days,
        time_limit_per_window=args.time_limit,
    )

    # Output
    print("=" * 60)
    _print_result(result)

    # Optionally write JSON output
    if args.output_json:
        _write_json_output(result, args.output_json)


def _print_snapshot_summary(snapshot: ScheduleSnapshot) -> None:
    """Print a summary of the loaded snapshot."""
    active_jobs = [j for j in snapshot.jobs if j.status not in ("Completed", "Cancelled")]
    internal_tasks = [t for t in snapshot.tasks if t.type == "Internal"]
    outsourced_tasks = [t for t in snapshot.tasks if t.type == "Outsourced"]
    assigned = len(snapshot.assignments)
    completed = sum(1 for a in snapshot.assignments if a.is_completed)

    print(f"\nSnapshot Summary:")
    print(f"  Generated: {snapshot.generated_at}")
    print(f"  Stations:  {len(snapshot.stations)}")
    print(f"  Jobs:      {len(active_jobs)} active / {len(snapshot.jobs)} total")
    print(f"  Elements:  {len(snapshot.elements)}")
    print(f"  Tasks:     {len(internal_tasks)} internal + {len(outsourced_tasks)} outsourced")
    print(f"  Assigned:  {assigned} ({completed} completed)")
    print(f"  Late jobs: {len(snapshot.late_jobs)} (current)")


def _print_result(result: SolverResult) -> None:
    """Print solver results."""
    print(f"\n{'=' * 40}")
    print(f" CP-SAT Solver Results")
    print(f"{'=' * 40}")
    print(f"  Status:     {result.status}")
    print(f"  Solve time: {result.solve_time_seconds:.1f}s")
    print(f"  Wall time:  {result.wall_time_seconds:.1f}s")
    print(f"  Variables:  {result.num_variables}")

    if result.status in ("OPTIMAL", "FEASIBLE"):
        print(f"  Objective:  {result.objective_value:.0f}")
        print(f"  Best bound: {result.best_bound:.0f}")
        print(f"  Gap:        {result.gap_percent:.1f}%")

    if result.score:
        s = result.score
        print(f"\n  Score:")
        print(f"    Late jobs:      {s.late_job_count} / {s.total_job_count}")
        print(f"    On-time rate:   {s.on_time_rate}%")
        print(f"    Total lateness: {s.total_lateness_minutes} min ({s.total_lateness_minutes / 60:.1f} hrs)")
        print(f"    Max lateness:   {s.max_lateness_minutes} min ({s.max_lateness_minutes / 60:.1f} hrs)")
        print(f"    Makespan:       {s.makespan_minutes} min ({s.makespan_minutes / 1440:.1f} days)")

    # Print first few movable assignments
    movable = [a for a in result.assignments if not a.is_fixed]
    if movable:
        print(f"\n  Movable assignments: {len(movable)}")
        for a in movable[:10]:
            print(f"    {a.task_id[:8]}... → {a.start_iso} – {a.end_iso}")
        if len(movable) > 10:
            print(f"    ... and {len(movable) - 10} more")

    fixed = [a for a in result.assignments if a.is_fixed]
    if fixed:
        print(f"  Fixed assignments:   {len(fixed)}")


def _write_json_output(result: SolverResult, path: Path) -> None:
    """Write solution to JSON file."""
    output = {
        "status": result.status,
        "solveTimeSeconds": result.solve_time_seconds,
        "objectiveValue": result.objective_value,
        "gap_percent": result.gap_percent,
        "score": {
            "lateJobCount": result.score.late_job_count,
            "totalJobCount": result.score.total_job_count,
            "totalLatenessMinutes": result.score.total_lateness_minutes,
            "maxLatenessMinutes": result.score.max_lateness_minutes,
            "makespanMinutes": result.score.makespan_minutes,
            "onTimeRate": result.score.on_time_rate,
        }
        if result.score
        else None,
        "assignments": [
            {
                "taskId": a.task_id,
                "stationId": a.station_id,
                "scheduledStart": a.start_iso,
                "scheduledEnd": a.end_iso,
                "isFixed": a.is_fixed,
            }
            for a in result.assignments
        ],
    }
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSolution written to {path}")


if __name__ == "__main__":
    main()
