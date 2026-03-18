"""Windowed decomposition for strategic mode.

Splits the full horizon into overlapping windows, solving each sequentially.
Committed assignments from earlier windows become fixed in later windows.

Algorithm:
1. Backward deadline propagation — compute latest_start for every task
2. Partition into windows (default: 15 days with 5-day overlap)
3. Solve each window sequentially (time limit per window)
4. Committed assignments from commit zone become fixed in next window
5. Final global score verification
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from flux_solver.models.snapshot import (
    Element,
    InternalTask,
    OutsourcedTask,
    ScheduleSnapshot,
)
from flux_solver.solver.builder import parse_dt


MINUTES_PER_DAY = 1440


@dataclass
class TaskDeadlineBound:
    """Latest start/finish computed by backward propagation."""
    task_id: str
    latest_start: int  # minutes from reference
    latest_finish: int  # minutes from reference


@dataclass
class SolveWindow:
    """A single window in the decomposition."""
    index: int
    start_minute: int  # window start (minutes from reference)
    end_minute: int  # window end
    commit_end_minute: int  # commit zone ends here; overlap starts
    task_ids: list[str]  # tasks active in this window
    fixed_task_ids: list[str]  # tasks committed from prior windows


def backward_propagate_deadlines(
    snapshot: ScheduleSnapshot,
    reference_time: datetime,
) -> dict[str, TaskDeadlineBound]:
    """Compute latest_start for every task via backward deadline propagation.

    For each job (reverse topological order through elements and tasks):
      latest_finish[last_task] = job.workshopExitDate
      For each task (reverse sequence):
        latest_start[task] = latest_finish - duration
        latest_finish[predecessor] = min(latest_finish[predecessor], latest_start[task])
    """
    from flux_solver.solver.working_time import compute_outsourced_wall_minutes

    tasks_by_id = {t.id: t for t in snapshot.tasks}
    elements_by_id = {e.id: e for e in snapshot.elements}
    jobs_by_id = {j.id: j for j in snapshot.jobs}

    bounds: dict[str, TaskDeadlineBound] = {}

    def _task_duration(task) -> int:
        if isinstance(task, InternalTask):
            return task.duration.setup_minutes + task.duration.run_minutes
        return compute_outsourced_wall_minutes(task.duration.open_days)

    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue

        try:
            deadline_dt = parse_dt(job.workshop_exit_date)
        except (ValueError, TypeError):
            continue
        deadline_min = int((deadline_dt - reference_time).total_seconds() / 60)

        # Collect elements for this job in reverse dependency order
        job_elements = [elements_by_id[eid] for eid in job.element_ids if eid in elements_by_id]

        # Topological sort of elements (reverse: leaves first)
        sorted_elements = _reverse_topo_sort(job_elements, elements_by_id)

        # Track latest_finish for each element (propagated from dependents)
        element_latest_finish: dict[str, int] = {}

        for elem in sorted_elements:
            # Element's latest finish = min of what's been propagated from dependents,
            # or the job deadline if no dependents constrain it
            elem_lf = element_latest_finish.get(elem.id, deadline_min)

            # Process tasks in reverse sequenceOrder
            ordered_tids = sorted(
                [tid for tid in elem.task_ids if tid in tasks_by_id],
                key=lambda tid: tasks_by_id[tid].sequence_order,
                reverse=True,
            )

            current_lf = elem_lf
            for tid in ordered_tids:
                task = tasks_by_id[tid]
                if task.status in ("Completed", "Cancelled"):
                    continue
                dur = _task_duration(task)
                ls = current_lf - dur
                bounds[tid] = TaskDeadlineBound(
                    task_id=tid,
                    latest_start=ls,
                    latest_finish=current_lf,
                )
                current_lf = ls  # next predecessor's latest_finish

            # Propagate to prerequisite elements
            for prereq_id in elem.prerequisite_element_ids:
                existing = element_latest_finish.get(prereq_id, deadline_min)
                element_latest_finish[prereq_id] = min(existing, current_lf)

        # Cross-job propagation: if this job depends on required jobs,
        # propagate earliest needed start backward
        if job.required_job_ids:
            earliest_task_ls = min(
                (b.latest_start for b in bounds.values() if b.task_id in {t.id for t in snapshot.tasks if t.job_id == job.id}),
                default=deadline_min,
            )
            for req_job_id in job.required_job_ids:
                req_job = jobs_by_id.get(req_job_id)
                if not req_job:
                    continue
                for eid in req_job.element_ids:
                    elem = elements_by_id.get(eid)
                    if not elem:
                        continue
                    for tid in elem.task_ids:
                        if tid in bounds:
                            bounds[tid] = TaskDeadlineBound(
                                task_id=tid,
                                latest_start=min(bounds[tid].latest_start, earliest_task_ls - _task_duration(tasks_by_id[tid])),
                                latest_finish=min(bounds[tid].latest_finish, earliest_task_ls),
                            )

    return bounds


def create_windows(
    reference_time: datetime,
    horizon_minutes: int,
    window_days: int = 15,
    overlap_days: int = 5,
    snapshot: ScheduleSnapshot | None = None,
    committed: dict[str, int] | None = None,
) -> list[SolveWindow]:
    """Partition the horizon into overlapping windows.

    Window i covers [i*commit_days, i*commit_days + window_days] in days.
    Commit zone: [i*commit_days, (i+1)*commit_days].
    Overlap zone: [(i+1)*commit_days, i*commit_days + window_days].
    """
    commit_days = window_days - overlap_days
    windows: list[SolveWindow] = []
    committed = committed or {}

    tasks_by_id = {t.id: t for t in snapshot.tasks} if snapshot else {}
    assignments_by_task = {a.task_id: a for a in snapshot.assignments} if snapshot else {}

    idx = 0
    window_start_day = 0

    while window_start_day * MINUTES_PER_DAY < horizon_minutes:
        start_min = window_start_day * MINUTES_PER_DAY
        end_min = min((window_start_day + window_days) * MINUTES_PER_DAY, horizon_minutes)
        commit_end_min = min((window_start_day + commit_days) * MINUTES_PER_DAY, horizon_minutes)

        # Determine which tasks fall in this window
        window_task_ids: list[str] = []
        fixed_from_prior: list[str] = []

        if snapshot:
            for task in snapshot.tasks:
                if task.status in ("Completed", "Cancelled"):
                    continue
                tid = task.id

                if tid in committed:
                    # Already committed from prior window — fixed
                    fixed_from_prior.append(tid)
                    continue

                # Check if task is relevant to this window based on assignment
                # or deadline-based latest_start
                assignment = assignments_by_task.get(tid)
                if assignment:
                    try:
                        a_start = int(
                            (parse_dt(assignment.scheduled_start) - reference_time).total_seconds() / 60
                        )
                        if a_start < end_min:
                            window_task_ids.append(tid)
                    except (ValueError, TypeError):
                        window_task_ids.append(tid)
                else:
                    # Unassigned — include if within window range
                    window_task_ids.append(tid)

        windows.append(SolveWindow(
            index=idx,
            start_minute=start_min,
            end_minute=end_min,
            commit_end_minute=commit_end_min,
            task_ids=window_task_ids,
            fixed_task_ids=fixed_from_prior,
        ))

        window_start_day += commit_days
        idx += 1

        if end_min >= horizon_minutes:
            break

    return windows


def _reverse_topo_sort(
    elements: list[Element],
    all_elements: dict[str, Element],
) -> list[Element]:
    """Topological sort of elements, reversed (leaves/dependents first)."""
    elem_ids = {e.id for e in elements}
    visited: set[str] = set()
    result: list[Element] = []

    def visit(eid: str) -> None:
        if eid in visited or eid not in elem_ids:
            return
        visited.add(eid)
        elem = all_elements.get(eid)
        if not elem:
            return
        # Visit dependents first (elements that depend on this one)
        for other in elements:
            if eid in other.prerequisite_element_ids:
                visit(other.id)
        result.append(elem)

    for e in elements:
        visit(e.id)

    return result
