"""Daily compaction mode.

Optimizes task ordering within a short horizon window (default 8 hours)
to minimize changeover costs while preserving deadline compliance.

Zones:
- Primary window: next N hours — tiles are reorderable, similarity objective
- Cascade zone: downstream dependents of primary tiles — movable but penalized
- Fixed context: everything else — immutable, precedence still applies

Hard constraint: no job that's currently on-time may become late.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta

from ortools.sat.python import cp_model

from flux_solver.models.snapshot import InternalTask, ScheduleSnapshot
from flux_solver.models.solution import SolverResult, SolverScore, TaskAssignmentResult
from flux_solver.solver.builder import SolverContext, build_model, parse_dt, dt_to_minutes
from flux_solver.solver.working_time import DEFAULT_TIMEZONE
from flux_solver.solver.constraints import add_all_constraints
from flux_solver.solver.objective import (
    W_CHANGEOVER,
    W_LATE_COUNT,
    W_LATENESS,
    _add_changeover_circuits,
    _add_deadline_terms,
    _pair_changeover_cost,
)

# Movement penalty: cost per minute of displacement from original position
W_MOVEMENT = 1


def solve_compact(
    snapshot: ScheduleSnapshot,
    horizon_hours: int = 8,
    max_solve_seconds: int = 3,
    now: datetime | None = None,
    tz_name: str = DEFAULT_TIMEZONE,
) -> SolverResult:
    """Run compaction solver on a short horizon window.

    Args:
        horizon_hours: Size of the primary optimization window in hours.
        max_solve_seconds: Solver time limit.
    """
    wall_start = time.monotonic()

    if now is None:
        now = parse_dt(snapshot.generated_at)

    horizon_minutes = horizon_hours * 60

    # Classify tasks into zones
    primary_ids, cascade_ids, fixed_ids = _classify_tasks(
        snapshot, now, horizon_minutes
    )

    # Compute current on-time status for each job (before solve)
    original_on_time = _compute_on_time_jobs(snapshot, now)

    # Build model — all tasks get variables
    ctx = build_model(snapshot, now=now, tz_name=tz_name)

    # Add standard constraints
    add_all_constraints(ctx)

    # Add compaction-specific objective and constraints
    _add_compact_objective(ctx, primary_ids, cascade_ids, original_on_time, snapshot, now)

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_solve_seconds
    solver.parameters.num_workers = 8

    status = solver.Solve(ctx.model)
    wall_elapsed = time.monotonic() - wall_start

    status_name = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status, "UNKNOWN")

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(
            status=status_name,
            solve_time_seconds=solver.WallTime(),
            wall_time_seconds=wall_elapsed,
        )

    return _extract_compact_result(
        ctx, solver, status_name, wall_elapsed, primary_ids, cascade_ids
    )


def _classify_tasks(
    snapshot: ScheduleSnapshot,
    now: datetime,
    horizon_minutes: int,
) -> tuple[set[str], set[str], set[str]]:
    """Classify tasks into primary, cascade, and fixed zones.

    Primary: tasks starting within the horizon window.
    Cascade: tasks that are downstream dependents of primary tasks.
    Fixed: everything else.
    """
    assignments_by_task = {a.task_id: a for a in snapshot.assignments}
    tasks_by_id = {t.id: t for t in snapshot.tasks}
    elements_by_id = {e.id: e for e in snapshot.elements}

    primary_ids: set[str] = set()
    cascade_ids: set[str] = set()
    fixed_ids: set[str] = set()

    # Step 1: identify primary tasks (assigned, start within horizon)
    for task in snapshot.tasks:
        if task.status in ("Completed", "Cancelled"):
            continue
        assignment = assignments_by_task.get(task.id)
        if not assignment or assignment.is_completed:
            continue

        try:
            start_dt = parse_dt(assignment.scheduled_start)
            start_min = dt_to_minutes(start_dt, now)
        except (ValueError, TypeError):
            continue

        if 0 <= start_min < horizon_minutes:
            primary_ids.add(task.id)
        else:
            fixed_ids.add(task.id)

    # Step 2: forward-trace cascade from primary tasks through precedence graph
    # Cascade = all downstream dependents of primary tasks
    visited: set[str] = set()

    def _trace_downstream(task_id: str) -> None:
        """Recursively find all downstream dependent tasks."""
        if task_id in visited:
            return
        visited.add(task_id)

        task = tasks_by_id.get(task_id)
        if not task:
            return

        # Find successor tasks in the same element (higher sequenceOrder)
        for elem in snapshot.elements:
            if task_id not in elem.task_ids:
                continue
            for tid in elem.task_ids:
                t = tasks_by_id.get(tid)
                if t and t.sequence_order > task.sequence_order and tid not in primary_ids:
                    cascade_ids.add(tid)
                    fixed_ids.discard(tid)
                    _trace_downstream(tid)

        # Find tasks in dependent elements
        elem = next((e for e in snapshot.elements if task_id in e.task_ids), None)
        if elem:
            for dep_elem in snapshot.elements:
                if elem.id in dep_elem.prerequisite_element_ids:
                    for tid in dep_elem.task_ids:
                        if tid not in primary_ids:
                            cascade_ids.add(tid)
                            fixed_ids.discard(tid)
                            _trace_downstream(tid)

    for pid in list(primary_ids):
        _trace_downstream(pid)

    return primary_ids, cascade_ids, fixed_ids


def _compute_on_time_jobs(
    snapshot: ScheduleSnapshot,
    now: datetime,
) -> set[str]:
    """Compute which jobs are currently on-time (not late)."""
    on_time: set[str] = set()
    assignments_by_task = {a.task_id: a for a in snapshot.assignments}
    elements_by_id = {e.id: e for e in snapshot.elements}

    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue

        try:
            deadline = dt_to_minutes(parse_dt(job.workshop_exit_date), now)
        except (ValueError, TypeError):
            continue

        # Find max end time across all job tasks
        max_end = 0
        for eid in job.element_ids:
            elem = elements_by_id.get(eid)
            if not elem:
                continue
            for tid in elem.task_ids:
                assignment = assignments_by_task.get(tid)
                if assignment:
                    try:
                        end_min = dt_to_minutes(parse_dt(assignment.scheduled_end), now)
                        max_end = max(max_end, end_min)
                    except (ValueError, TypeError):
                        pass

        if max_end <= deadline:
            on_time.add(job.id)

    return on_time


def _add_compact_objective(
    ctx: SolverContext,
    primary_ids: set[str],
    cascade_ids: set[str],
    original_on_time: set[str],
    snapshot: ScheduleSnapshot,
    now: datetime,
) -> None:
    """Add compaction-specific objective.

    Minimize:
      W1_HUGE * sum(became_late[j])       — no deadline degradation
    + W2 * changeover_cost_in_window       — similarity (primary goal)
    + W3_SMALL * sum(|start[t] - original[t]|)  — minimize disruption (cascade)
    """
    terms: list = []

    # 1. Hard constraint: jobs that were on-time must stay on-time
    assignments_by_task = {a.task_id: a for a in snapshot.assignments}
    elements_by_id = {e.id: e for e in snapshot.elements}

    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        if job.id not in original_on_time:
            continue  # Already late, no degradation constraint
        if job.id not in ctx.job_deadlines:
            continue

        deadline = ctx.job_deadlines[job.id]
        task_ids = ctx.job_task_ids.get(job.id, [])
        if not task_ids:
            continue

        # Compute job completion
        end_exprs = [ctx.ends[tid] for tid in task_ids if tid in ctx.ends]
        if not end_exprs:
            continue

        completion = ctx.model.NewIntVar(
            0, ctx.horizon_minutes, f"compact_completion_{job.id}"
        )
        if len(end_exprs) == 1:
            ctx.model.Add(completion == end_exprs[0])
        else:
            ctx.model.AddMaxEquality(completion, end_exprs)

        # Hard constraint: must not become late
        ctx.model.Add(completion <= deadline)

    # 2. Changeover cost (circuit-based)
    _add_changeover_circuits(ctx, terms)

    # 3. Movement penalty for cascade tasks
    for tid in cascade_ids:
        if tid not in ctx.starts:
            continue
        assignment = assignments_by_task.get(tid)
        if not assignment:
            continue
        try:
            original_start = dt_to_minutes(parse_dt(assignment.scheduled_start), now)
        except (ValueError, TypeError):
            continue

        # |start[t] - original[t]| via auxiliary variable
        displacement = ctx.model.NewIntVar(
            0, ctx.horizon_minutes, f"displacement_{tid}"
        )
        ctx.model.Add(displacement >= ctx.starts[tid] - original_start)
        ctx.model.Add(displacement >= original_start - ctx.starts[tid])
        terms.append(W_MOVEMENT * displacement)

    # 4. Also add deadline terms but with huge weight for degradation
    _add_deadline_terms(ctx, terms)

    if terms:
        ctx.model.Minimize(sum(terms))


def _extract_compact_result(
    ctx: SolverContext,
    solver: cp_model.CpSolver,
    status_name: str,
    wall_elapsed: float,
    primary_ids: set[str],
    cascade_ids: set[str],
) -> SolverResult:
    """Extract compaction result with zone annotations."""
    assignments: list[TaskAssignmentResult] = []

    for task_id in list(ctx.schedulable_ids) + list(ctx.fixed_ids):
        start_min = solver.Value(ctx.starts[task_id])
        end_min = solver.Value(ctx.ends[task_id])

        task = ctx.tasks_by_id[task_id]
        station_id = (
            task.station_id if isinstance(task, InternalTask) else task.provider_id
        )

        start_dt = ctx.reference_time + timedelta(minutes=start_min)
        end_dt = ctx.reference_time + timedelta(minutes=end_min)

        assignments.append(
            TaskAssignmentResult(
                task_id=task_id,
                station_id=station_id,
                start_minutes=start_min,
                end_minutes=end_min,
                start_iso=start_dt.isoformat(),
                end_iso=end_dt.isoformat(),
                is_fixed=task_id not in primary_ids and task_id not in cascade_ids,
            )
        )

    # Compute score
    score = _compute_compact_score(ctx, solver)

    return SolverResult(
        status=status_name,
        assignments=assignments,
        score=score,
        solve_time_seconds=solver.WallTime(),
        wall_time_seconds=wall_elapsed,
        num_variables=ctx.model.Proto().variables.__len__(),
        objective_value=solver.ObjectiveValue(),
        best_bound=solver.BestObjectiveBound(),
        gap_percent=(
            abs(solver.ObjectiveValue() - solver.BestObjectiveBound())
            / max(abs(solver.ObjectiveValue()), 1)
            * 100
        ),
    )


def _compute_compact_score(
    ctx: SolverContext, solver: cp_model.CpSolver
) -> SolverScore:
    """Compute score metrics for compaction result."""
    late_count = 0
    total_lateness = 0
    max_lateness = 0
    total_jobs = 0
    earliest_start = ctx.horizon_minutes
    latest_end = 0

    for job in ctx.snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        if job.id not in ctx.job_deadlines:
            continue

        task_ids = ctx.job_task_ids.get(job.id, [])
        if not task_ids:
            continue

        total_jobs += 1
        deadline = ctx.job_deadlines[job.id]

        job_end = 0
        for tid in task_ids:
            if tid in ctx.ends:
                job_end = max(job_end, solver.Value(ctx.ends[tid]))
            elif tid in ctx.known_ends:
                job_end = max(job_end, ctx.known_ends[tid])

        if job_end > deadline:
            late_count += 1
            lateness = job_end - deadline
            total_lateness += lateness
            max_lateness = max(max_lateness, lateness)

        latest_end = max(latest_end, job_end)

    makespan = latest_end if latest_end > 0 else 0
    on_time_rate = ((total_jobs - late_count) / total_jobs * 100) if total_jobs > 0 else 100.0

    # Changeover metrics
    categories_by_id = {c.id: c for c in ctx.snapshot.categories}
    total_changeover = 0
    total_similarity = 0

    for station_id, task_ids in ctx.station_tasks.items():
        station = ctx.stations_by_id.get(station_id)
        if not station:
            continue
        category = categories_by_id.get(station.category_id)
        if not category or not category.similarity_criteria:
            continue

        solved = sorted(
            [(solver.Value(ctx.starts[tid]), tid) for tid in task_ids if tid in ctx.starts]
        )
        if len(solved) < 2:
            continue

        num_criteria = len(category.similarity_criteria)
        for i in range(len(solved) - 1):
            elem_i = ctx.element_by_task.get(solved[i][1])
            elem_j = ctx.element_by_task.get(solved[i + 1][1])
            spec_a = elem_i.spec.model_dump(by_alias=True) if elem_i and elem_i.spec else {}
            spec_b = elem_j.spec.model_dump(by_alias=True) if elem_j and elem_j.spec else {}
            cost = _pair_changeover_cost(spec_a, spec_b, category.similarity_criteria)
            total_changeover += cost
            total_similarity += num_criteria - cost

    return SolverScore(
        late_job_count=late_count,
        total_job_count=total_jobs,
        total_lateness_minutes=total_lateness,
        max_lateness_minutes=max_lateness,
        makespan_minutes=makespan,
        on_time_rate=round(on_time_rate, 1),
        total_changeover_cost=total_changeover,
        similarity_score=total_similarity,
    )
