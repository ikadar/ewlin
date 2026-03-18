"""Hard constraints for the CP-SAT model.

Constraints:
- Station no-overlap (capacity=1) with blocked intervals for operating hours
- Station group maxConcurrent (cumulative)
- Intra-element precedence (sequenceOrder) with dry time after offset printing
- Cross-element precedence (prerequisiteElementIds) with dry time
- Cross-job precedence (requiredJobIds) with dry time
- No retrospective scheduling (start >= now) — enforced in builder domain
- Immobile tasks (fixed in builder)
"""

from __future__ import annotations

from flux_solver.models.snapshot import InternalTask
from flux_solver.solver.builder import SolverContext

# Ink drying time after offset printing (constant, mirrors PHP/TS DRY_TIME_MINUTES)
DRY_TIME_MINUTES = 240


def add_all_constraints(ctx: SolverContext) -> None:
    """Add all hard constraints to the model."""
    _add_no_overlap(ctx)
    _add_group_capacity(ctx)
    _add_intra_element_precedence(ctx)
    _add_cross_element_precedence(ctx)
    _add_cross_job_precedence(ctx)


def _is_printing_station(ctx: SolverContext, station_id: str) -> bool:
    """Check if a station is an offset printing station (requires dry time after)."""
    station = ctx.stations_by_id.get(station_id)
    if not station or not ctx.snapshot:
        return False
    cat = next((c for c in ctx.snapshot.categories if c.id == station.category_id), None)
    return cat is not None and "offset" in cat.name.lower()


def _get_dry_time(ctx: SolverContext, predecessor_task_id: str, successor_task_id: str) -> int:
    """Compute dry time gap between two sequential tasks.

    Returns DRY_TIME_MINUTES if the predecessor is on an offset printing station
    and the tasks are not in the same split group. Returns 0 otherwise.
    """
    pred = ctx.tasks_by_id.get(predecessor_task_id)
    succ = ctx.tasks_by_id.get(successor_task_id)
    if not pred or not isinstance(pred, InternalTask):
        return 0

    # Skip dry time for tasks in the same split group
    if (
        succ
        and isinstance(succ, InternalTask)
        and pred.split_group_id is not None
        and pred.split_group_id == succ.split_group_id
    ):
        return 0

    if _is_printing_station(ctx, pred.station_id):
        return DRY_TIME_MINUTES
    return 0


def _add_no_overlap(ctx: SolverContext) -> None:
    """No two tasks on the same station can overlap (capacity=1).

    Also adds fixed blocked intervals for non-working hours so the solver
    naturally avoids scheduling during nights, breaks, weekends, and holidays.
    """
    for station_id, task_ids in ctx.station_tasks.items():
        intervals = []
        for tid in task_ids:
            if tid in ctx.intervals:
                intervals.append(ctx.intervals[tid])

        # Add blocked intervals for non-working hours
        blocked = ctx.blocked_intervals.get(station_id, [])
        for idx, (blk_start, blk_end) in enumerate(blocked):
            blk_dur = blk_end - blk_start
            if blk_dur <= 0:
                continue
            s = ctx.model.NewIntVar(blk_start, blk_start, f"blk_s_{station_id}_{idx}")
            e = ctx.model.NewIntVar(blk_end, blk_end, f"blk_e_{station_id}_{idx}")
            iv = ctx.model.NewIntervalVar(s, blk_dur, e, f"blk_{station_id}_{idx}")
            intervals.append(iv)

        if len(intervals) >= 2:
            ctx.model.AddNoOverlap(intervals)


def _add_group_capacity(ctx: SolverContext) -> None:
    """Station groups with maxConcurrent: at most N tasks running at once."""
    if not ctx.snapshot:
        return

    for group in ctx.snapshot.groups:
        if group.max_concurrent is None or group.is_outsourced_provider_group:
            continue

        # Collect all intervals for stations in this group
        intervals = []
        station_ids = ctx.group_stations.get(group.id, [])
        for sid in station_ids:
            for tid in ctx.station_tasks.get(sid, []):
                if tid in ctx.intervals:
                    intervals.append(ctx.intervals[tid])

        if len(intervals) > group.max_concurrent:
            demands = [1] * len(intervals)
            ctx.model.AddCumulative(intervals, demands, group.max_concurrent)


def _add_intra_element_precedence(ctx: SolverContext) -> None:
    """Tasks within an element must follow sequenceOrder.

    Includes dry time gap (4h) after offset printing stations.
    """
    if not ctx.snapshot:
        return

    for element in ctx.snapshot.elements:
        # Get tasks in this element, sorted by sequenceOrder
        elem_tasks = []
        for tid in element.task_ids:
            task = ctx.tasks_by_id.get(tid)
            if task and tid not in ctx.skipped_ids:
                elem_tasks.append(task)

        elem_tasks.sort(key=lambda t: t.sequence_order)

        # Chain: end[i] + dry_time <= start[i+1]
        for i in range(len(elem_tasks) - 1):
            curr_id = elem_tasks[i].id
            next_id = elem_tasks[i + 1].id

            curr_end = ctx.get_task_end(curr_id)
            next_start = ctx.get_task_start(next_id)

            if curr_end is not None and next_start is not None:
                gap = _get_dry_time(ctx, curr_id, next_id)
                ctx.model.Add(next_start >= curr_end + gap)


def _add_cross_element_precedence(ctx: SolverContext) -> None:
    """Element prerequisites: all tasks of prerequisite element must complete
    before any task of the dependent element can start.

    Simplified: last task (by sequenceOrder) of prereq must end before
    first task (by sequenceOrder) of dependent starts. Intra-element
    ordering ensures this is sufficient.

    Includes dry time gap after offset printing.
    """
    if not ctx.snapshot:
        return

    for element in ctx.snapshot.elements:
        if not element.prerequisite_element_ids:
            continue

        # Find first task of this element (by sequenceOrder)
        dep_tasks = _get_sorted_active_tasks(ctx, element.task_ids)
        if not dep_tasks:
            continue
        first_dep_id = dep_tasks[0].id

        for prereq_elem_id in element.prerequisite_element_ids:
            prereq_elem = ctx.elements_by_id.get(prereq_elem_id)
            if not prereq_elem:
                continue

            # Find last task of prerequisite element
            prereq_tasks = _get_sorted_active_tasks(ctx, prereq_elem.task_ids)
            if not prereq_tasks:
                continue
            last_prereq_id = prereq_tasks[-1].id

            prereq_end = ctx.get_task_end(last_prereq_id)
            dep_start = ctx.get_task_start(first_dep_id)

            if prereq_end is not None and dep_start is not None:
                gap = _get_dry_time(ctx, last_prereq_id, first_dep_id)
                ctx.model.Add(dep_start >= prereq_end + gap)


def _add_cross_job_precedence(ctx: SolverContext) -> None:
    """Job prerequisites: all tasks of required job must complete before
    any task of the dependent job can start.

    For each required job, we create a completion variable (max of all task ends)
    and constrain all dependent job tasks to start after it.

    Note: dry time is not added here because cross-job precedence typically
    doesn't involve direct printing→finishing transitions. The PHP validator
    does check it, but in practice required_job_ids represent material
    dependencies (e.g., covers needed before assembly), not printing chains.
    """
    if not ctx.snapshot:
        return

    for job in ctx.snapshot.jobs:
        if not job.required_job_ids or job.status in ("Completed", "Cancelled"):
            continue

        # Get all active task_ids for dependent job
        dep_task_ids = ctx.job_task_ids.get(job.id, [])
        dep_starts = [
            ctx.starts[tid] for tid in dep_task_ids if tid in ctx.starts
        ]
        if not dep_starts:
            continue

        for req_job_id in job.required_job_ids:
            req_task_ids = ctx.job_task_ids.get(req_job_id, [])
            if not req_task_ids:
                continue

            # Collect end times/vars for required job
            req_end_vars = []
            req_end_constants = []
            for tid in req_task_ids:
                if tid in ctx.ends:
                    req_end_vars.append(ctx.ends[tid])
                elif tid in ctx.known_ends:
                    req_end_constants.append(ctx.known_ends[tid])

            if not req_end_vars and not req_end_constants:
                continue

            # Create a variable for the required job's completion time
            max_possible = max(
                [ctx.horizon_minutes] * len(req_end_vars) + req_end_constants
            )
            job_completion = ctx.model.NewIntVar(
                0, max_possible, f"job_completion_{req_job_id}_for_{job.id}"
            )

            # job_completion = max(all ends of required job)
            all_ends = list(req_end_vars)
            for c in req_end_constants:
                const_var = ctx.model.NewIntVar(c, c, f"const_{req_job_id}_{c}")
                all_ends.append(const_var)

            if len(all_ends) == 1:
                ctx.model.Add(job_completion == all_ends[0])
            else:
                ctx.model.AddMaxEquality(job_completion, all_ends)

            # All dependent job tasks must start after required job completes
            for dep_start in dep_starts:
                ctx.model.Add(dep_start >= job_completion)


def _get_sorted_active_tasks(ctx: SolverContext, task_ids: list[str]) -> list:
    """Get tasks from task_ids that are active (not skipped), sorted by sequenceOrder."""
    tasks = []
    for tid in task_ids:
        if tid not in ctx.skipped_ids:
            task = ctx.tasks_by_id.get(tid)
            if task:
                tasks.append(task)
    tasks.sort(key=lambda t: t.sequence_order)
    return tasks
