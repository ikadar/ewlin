"""Strategic placement mode.

Supports two execution paths:
- Single-window: solve full horizon in one shot (small/medium instances)
- Windowed decomposition: split into overlapping windows for large instances

Both paths use deadline + changeover optimization.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta

from ortools.sat.python import cp_model

from flux_solver.models.snapshot import InternalTask, ScheduleSnapshot, TaskAssignment
from flux_solver.models.solution import SolverResult, SolverScore, TaskAssignmentResult
from flux_solver.solver.builder import SolverContext, build_model, parse_dt, dt_to_minutes
from flux_solver.solver.working_time import DEFAULT_TIMEZONE
from flux_solver.solver.constraints import add_all_constraints
from flux_solver.solver.decomposition import (
    SolveWindow,
    backward_propagate_deadlines,
    create_windows,
)
from flux_solver.solver.objective import add_strategic_objective, _pair_changeover_cost


def solve_strategic(
    snapshot: ScheduleSnapshot,
    time_limit_seconds: int = 60,
    now: datetime | None = None,
    windowed: bool = False,
    window_days: int = 15,
    overlap_days: int = 5,
    time_limit_per_window: int = 20,
    pinned_task_ids: set[str] | None = None,
    movement_weight: int = 0,
    tz_name: str = DEFAULT_TIMEZONE,
) -> SolverResult:
    """Run strategic solver.

    Args:
        windowed: If True, use windowed decomposition for large instances.
        window_days: Size of each window in days.
        overlap_days: Overlap between consecutive windows.
        time_limit_per_window: Time limit per window solve (seconds).
        pinned_task_ids: Tasks that are fixed and cannot be moved.
        movement_weight: If > 0, penalizes displacement from current positions.
    """
    if windowed:
        return _solve_windowed(
            snapshot, now, window_days, overlap_days, time_limit_per_window, tz_name=tz_name
        )
    return _solve_single(snapshot, time_limit_seconds, now, pinned_task_ids, movement_weight, tz_name=tz_name)


def _solve_single(
    snapshot: ScheduleSnapshot,
    time_limit_seconds: int,
    now: datetime | None,
    pinned_task_ids: set[str] | None = None,
    movement_weight: int = 0,
    tz_name: str = DEFAULT_TIMEZONE,
) -> SolverResult:
    """Single-window solve over full horizon."""
    wall_start = time.monotonic()

    ctx = build_model(snapshot, now=now, pinned_task_ids=pinned_task_ids, tz_name=tz_name)
    add_all_constraints(ctx)
    add_strategic_objective(ctx, movement_weight=movement_weight)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.log_search_progress = True
    solver.parameters.num_workers = 8

    status = solver.Solve(ctx.model)
    wall_elapsed = time.monotonic() - wall_start

    status_name = _status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(
            status=status_name,
            solve_time_seconds=solver.WallTime(),
            wall_time_seconds=wall_elapsed,
            num_variables=ctx.model.Proto().variables.__len__(),
        )

    return _extract_result(ctx, solver, status_name, wall_elapsed)


def _solve_windowed(
    snapshot: ScheduleSnapshot,
    now: datetime | None,
    window_days: int,
    overlap_days: int,
    time_limit_per_window: int,
    tz_name: str = DEFAULT_TIMEZONE,
) -> SolverResult:
    """Windowed decomposition: solve horizon in sequential windows."""
    wall_start = time.monotonic()

    if now is None:
        now = parse_dt(snapshot.generated_at)

    # Step 1: Backward deadline propagation
    deadline_bounds = backward_propagate_deadlines(snapshot, now)

    # Compute horizon
    max_deadline = now
    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        try:
            dl = parse_dt(job.workshop_exit_date)
            if dl > max_deadline:
                max_deadline = dl
        except (ValueError, TypeError):
            pass
    horizon_minutes = int((max_deadline + timedelta(days=30) - now).total_seconds() / 60)

    # Step 2: Create windows
    windows = create_windows(
        reference_time=now,
        horizon_minutes=horizon_minutes,
        window_days=window_days,
        overlap_days=overlap_days,
        snapshot=snapshot,
    )

    # Step 3: Solve each window sequentially
    committed_assignments: dict[str, tuple[int, int]] = {}  # task_id → (start_min, end_min)
    all_assignments: list[TaskAssignmentResult] = []
    total_solve_time = 0.0

    for window in windows:
        # Build a modified snapshot with committed tasks as fixed
        window_snapshot = _apply_committed(snapshot, committed_assignments, now)

        ctx = build_model(window_snapshot, now=now, tz_name=tz_name)

        # Inject deadline bounds as upper bounds on start times
        for tid, bound in deadline_bounds.items():
            if tid in ctx.starts and tid in ctx.schedulable_ids:
                ub = min(bound.latest_start, ctx.horizon_minutes - ctx.durations.get(tid, 0))
                if ub >= ctx.now_minutes:
                    ctx.model.Add(ctx.starts[tid] <= ub)

        add_all_constraints(ctx)
        add_strategic_objective(ctx)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_per_window
        solver.parameters.num_workers = 8

        status = solver.Solve(ctx.model)
        total_solve_time += solver.WallTime()

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            # If a window fails, return best effort from prior windows
            break

        # Commit assignments in the commit zone
        for task_id in ctx.schedulable_ids:
            start_min = solver.Value(ctx.starts[task_id])
            end_min = solver.Value(ctx.ends[task_id])

            if start_min < window.commit_end_minute:
                committed_assignments[task_id] = (start_min, end_min)

    # Build final result from all committed assignments
    wall_elapsed = time.monotonic() - wall_start
    return _build_windowed_result(
        snapshot, committed_assignments, now, horizon_minutes,
        total_solve_time, wall_elapsed,
    )


def _apply_committed(
    snapshot: ScheduleSnapshot,
    committed: dict[str, tuple[int, int]],
    reference_time: datetime,
) -> ScheduleSnapshot:
    """Create a modified snapshot where committed tasks have fixed assignments."""
    if not committed:
        return snapshot

    existing = {a.task_id: a for a in snapshot.assignments}
    new_assignments = list(snapshot.assignments)

    for task_id, (start_min, end_min) in committed.items():
        start_dt = reference_time + timedelta(minutes=start_min)
        end_dt = reference_time + timedelta(minutes=end_min)

        if task_id in existing:
            # Update existing assignment
            new_assignments = [a for a in new_assignments if a.task_id != task_id]

        # Find the task's station/provider
        task = next((t for t in snapshot.tasks if t.id == task_id), None)
        if not task:
            continue
        target_id = task.station_id if isinstance(task, InternalTask) else task.provider_id

        new_assignments.append(TaskAssignment(
            id=task_id,
            task_id=task_id,
            target_id=target_id,
            is_outsourced=not isinstance(task, InternalTask),
            scheduled_start=start_dt.isoformat(),
            scheduled_end=end_dt.isoformat(),
            is_completed=False,
            completed_at=None,
            created_at=start_dt.isoformat(),
            updated_at=start_dt.isoformat(),
        ))

    return snapshot.model_copy(update={"assignments": new_assignments})


def _build_windowed_result(
    snapshot: ScheduleSnapshot,
    committed: dict[str, tuple[int, int]],
    reference_time: datetime,
    horizon_minutes: int,
    solve_time: float,
    wall_time: float,
) -> SolverResult:
    """Build final result from all windowed assignments."""
    tasks_by_id = {t.id: t for t in snapshot.tasks}
    assignments: list[TaskAssignmentResult] = []

    for task_id, (start_min, end_min) in committed.items():
        task = tasks_by_id.get(task_id)
        if not task:
            continue
        station_id = task.station_id if isinstance(task, InternalTask) else task.provider_id
        start_dt = reference_time + timedelta(minutes=start_min)
        end_dt = reference_time + timedelta(minutes=end_min)

        assignments.append(TaskAssignmentResult(
            task_id=task_id,
            station_id=station_id,
            start_minutes=start_min,
            end_minutes=end_min,
            start_iso=start_dt.isoformat(),
            end_iso=end_dt.isoformat(),
            is_fixed=False,
        ))

    # Compute score from committed assignments
    score = _compute_score_from_assignments(snapshot, committed, reference_time, horizon_minutes)

    return SolverResult(
        status="FEASIBLE",
        assignments=assignments,
        score=score,
        solve_time_seconds=solve_time,
        wall_time_seconds=wall_time,
    )


def _compute_score_from_assignments(
    snapshot: ScheduleSnapshot,
    committed: dict[str, tuple[int, int]],
    reference_time: datetime,
    horizon_minutes: int,
) -> SolverScore:
    """Compute score from committed assignment map."""
    jobs_by_id = {j.id: j for j in snapshot.jobs}
    elements_by_id = {e.id: e for e in snapshot.elements}
    tasks_by_id = {t.id: t for t in snapshot.tasks}

    # Also include completed task assignments
    known_ends: dict[str, int] = {}
    for a in snapshot.assignments:
        if a.is_completed:
            try:
                known_ends[a.task_id] = dt_to_minutes(parse_dt(a.scheduled_end), reference_time)
            except (ValueError, TypeError):
                pass

    late_count = 0
    total_lateness = 0
    max_lateness = 0
    total_jobs = 0
    earliest_start = horizon_minutes
    latest_end = 0

    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        try:
            deadline = dt_to_minutes(parse_dt(job.workshop_exit_date), reference_time)
        except (ValueError, TypeError):
            continue

        total_jobs += 1
        job_end = 0

        for elem_id in job.element_ids:
            elem = elements_by_id.get(elem_id)
            if not elem:
                continue
            for tid in elem.task_ids:
                if tid in committed:
                    _, end_min = committed[tid]
                    job_end = max(job_end, end_min)
                    earliest_start = min(earliest_start, committed[tid][0])
                elif tid in known_ends:
                    job_end = max(job_end, known_ends[tid])

        latest_end = max(latest_end, job_end)
        if job_end > deadline:
            late_count += 1
            lateness = job_end - deadline
            total_lateness += lateness
            max_lateness = max(max_lateness, lateness)

    makespan = latest_end - earliest_start if latest_end > earliest_start else 0
    on_time_rate = ((total_jobs - late_count) / total_jobs * 100) if total_jobs > 0 else 100.0

    # Changeover metrics
    categories_by_id = {c.id: c for c in snapshot.categories}
    stations_by_id = {s.id: s for s in snapshot.stations}
    station_tasks: dict[str, list[tuple[int, str]]] = {}

    for tid, (start_min, _) in committed.items():
        task = tasks_by_id.get(tid)
        if task and isinstance(task, InternalTask):
            station_tasks.setdefault(task.station_id, []).append((start_min, tid))

    total_changeover = 0
    total_similarity = 0

    element_by_task = {}
    for elem in snapshot.elements:
        for tid in elem.task_ids:
            element_by_task[tid] = elem

    for station_id, task_list in station_tasks.items():
        station = stations_by_id.get(station_id)
        if not station:
            continue
        category = categories_by_id.get(station.category_id)
        if not category or not category.similarity_criteria:
            continue

        sorted_tasks = sorted(task_list)
        num_criteria = len(category.similarity_criteria)

        for i in range(len(sorted_tasks) - 1):
            ti_id = sorted_tasks[i][1]
            tj_id = sorted_tasks[i + 1][1]
            elem_i = element_by_task.get(ti_id)
            elem_j = element_by_task.get(tj_id)
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


def _extract_result(
    ctx: SolverContext,
    solver: cp_model.CpSolver,
    status_name: str,
    wall_elapsed: float,
) -> SolverResult:
    """Extract assignments and compute score from solved model."""
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
                is_fixed=task_id in ctx.fixed_ids,
            )
        )

    score = _compute_score(ctx, solver)

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


def _compute_score(ctx: SolverContext, solver: cp_model.CpSolver) -> SolverScore:
    """Compute quality metrics from the solved model."""
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
        job_start = ctx.horizon_minutes
        for tid in task_ids:
            if tid in ctx.ends:
                end_val = solver.Value(ctx.ends[tid])
                start_val = solver.Value(ctx.starts[tid])
                job_end = max(job_end, end_val)
                job_start = min(job_start, start_val)
            elif tid in ctx.known_ends:
                job_end = max(job_end, ctx.known_ends[tid])
                if tid in ctx.known_starts:
                    job_start = min(job_start, ctx.known_starts[tid])

        if job_end > deadline:
            late_count += 1
            lateness = job_end - deadline
            total_lateness += lateness
            max_lateness = max(max_lateness, lateness)

        earliest_start = min(earliest_start, job_start)
        latest_end = max(latest_end, job_end)

    makespan = latest_end - earliest_start if latest_end > earliest_start else 0
    on_time_rate = ((total_jobs - late_count) / total_jobs * 100) if total_jobs > 0 else 100.0

    changeover_cost, similarity = _compute_changeover_metrics(ctx, solver)

    return SolverScore(
        late_job_count=late_count,
        total_job_count=total_jobs,
        total_lateness_minutes=total_lateness,
        max_lateness_minutes=max_lateness,
        makespan_minutes=makespan,
        on_time_rate=round(on_time_rate, 1),
        total_changeover_cost=changeover_cost,
        similarity_score=similarity,
    )


def _compute_changeover_metrics(
    ctx: SolverContext, solver: cp_model.CpSolver
) -> tuple[int, int]:
    """Compute changeover cost and similarity score from solved schedule."""
    if not ctx.snapshot:
        return 0, 0

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

        solved = []
        for tid in task_ids:
            if tid in ctx.starts:
                solved.append((solver.Value(ctx.starts[tid]), tid))
        solved.sort()

        if len(solved) < 2:
            continue

        num_criteria = len(category.similarity_criteria)
        for i in range(len(solved) - 1):
            ti_id = solved[i][1]
            tj_id = solved[i + 1][1]

            elem_i = ctx.element_by_task.get(ti_id)
            elem_j = ctx.element_by_task.get(tj_id)
            spec_a = elem_i.spec.model_dump(by_alias=True) if elem_i and elem_i.spec else {}
            spec_b = elem_j.spec.model_dump(by_alias=True) if elem_j and elem_j.spec else {}

            cost = _pair_changeover_cost(spec_a, spec_b, category.similarity_criteria)
            total_changeover += cost
            total_similarity += num_criteria - cost

    return total_changeover, total_similarity


def _status_name(status: int) -> str:
    return {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status, "UNKNOWN")
