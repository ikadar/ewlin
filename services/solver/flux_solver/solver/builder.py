"""Build a CP-SAT model from a ScheduleSnapshot.

Creates CP-SAT variables for all schedulable tasks and populates a
SolverContext with lookup indices used by constraint/objective builders.

Phase 2: respects station operating hours via blocked intervals,
outsourced tasks use weekend-aware duration approximation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Union

from ortools.sat.python import cp_model

from flux_solver.models.snapshot import (
    Element,
    InternalTask,
    Job,
    OutsourcedTask,
    ScheduleSnapshot,
    Station,
    StationGroup,
    TaskAssignment,
)
from flux_solver.solver.working_time import (
    DEFAULT_TIMEZONE,
    compute_outsourced_wall_minutes,
    generate_blocked_intervals,
)


def parse_dt(s: str) -> datetime:
    """Parse ISO datetime string, stripping timezone to naive UTC-equivalent."""
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


def dt_to_minutes(dt: datetime, ref: datetime) -> int:
    """Convert datetime to integer minutes from reference time."""
    return int((dt - ref).total_seconds() / 60)


def _ceil_quarter_hour(dt: datetime) -> datetime:
    """Round datetime up to the nearest quarter-hour boundary (:00/:15/:30/:45, seconds=0)."""
    if dt.minute % 15 == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt
    result = dt.replace(second=0, microsecond=0) + timedelta(minutes=1)
    remainder = result.minute % 15
    if remainder != 0:
        result += timedelta(minutes=(15 - remainder))
    return result


@dataclass
class SolverContext:
    """All data needed by constraint/objective builders."""

    model: cp_model.CpModel
    reference_time: datetime
    horizon_minutes: int
    now_minutes: int  # minutes from reference_time to "now"

    # CP-SAT variables for schedulable tasks
    starts: dict[str, cp_model.IntVar] = field(default_factory=dict)
    ends: dict[str, cp_model.IntVar] = field(default_factory=dict)
    intervals: dict[str, cp_model.IntervalVar] = field(default_factory=dict)
    durations: dict[str, int] = field(default_factory=dict)  # task_id → minutes

    # Known values for completed/fixed tasks (not variables, just constants)
    known_starts: dict[str, int] = field(default_factory=dict)
    known_ends: dict[str, int] = field(default_factory=dict)

    # Task classification
    schedulable_ids: set[str] = field(default_factory=set)
    fixed_ids: set[str] = field(default_factory=set)
    skipped_ids: set[str] = field(default_factory=set)

    # Station blocked intervals (non-working-time periods)
    # station_id → sorted list of (start_minute, end_minute)
    blocked_intervals: dict[str, list[tuple[int, int]]] = field(default_factory=dict)

    # Index maps
    station_tasks: dict[str, list[str]] = field(default_factory=dict)
    group_stations: dict[str, list[str]] = field(default_factory=dict)
    job_task_ids: dict[str, list[str]] = field(default_factory=dict)
    job_deadlines: dict[str, int] = field(default_factory=dict)

    # Snapshot lookups
    tasks_by_id: dict[str, InternalTask | OutsourcedTask] = field(default_factory=dict)
    elements_by_id: dict[str, Element] = field(default_factory=dict)
    jobs_by_id: dict[str, Job] = field(default_factory=dict)
    stations_by_id: dict[str, Station] = field(default_factory=dict)
    groups_by_id: dict[str, StationGroup] = field(default_factory=dict)
    assignments_by_task: dict[str, TaskAssignment] = field(default_factory=dict)
    element_by_task: dict[str, Element] = field(default_factory=dict)

    # Timezone for operating schedule interpretation
    tz_name: str = DEFAULT_TIMEZONE

    # Snapshot reference
    snapshot: ScheduleSnapshot | None = None

    def get_task_end(self, task_id: str) -> Union[cp_model.IntVar, int, None]:
        """Get end time as variable (schedulable/fixed) or constant (known)."""
        if task_id in self.ends:
            return self.ends[task_id]
        if task_id in self.known_ends:
            return self.known_ends[task_id]
        return None

    def get_task_start(self, task_id: str) -> Union[cp_model.IntVar, int, None]:
        """Get start time as variable or constant."""
        if task_id in self.starts:
            return self.starts[task_id]
        if task_id in self.known_starts:
            return self.known_starts[task_id]
        return None


def _compute_task_duration(task: InternalTask | OutsourcedTask) -> int:
    """Compute task duration in minutes.

    Internal tasks: setupMinutes + runMinutes (working minutes = wall-clock
    minutes within a single operating slot; multi-slot spanning handled by
    blocked-interval NoOverlap).

    Outsourced tasks: approximate wall-clock minutes accounting for weekends.
    """
    if isinstance(task, InternalTask):
        return task.duration.setup_minutes + task.duration.run_minutes
    else:
        return compute_outsourced_wall_minutes(task.duration.open_days)


def build_model(
    snapshot: ScheduleSnapshot,
    now: datetime | None = None,
    pinned_task_ids: set[str] | None = None,
    tz_name: str = DEFAULT_TIMEZONE,
) -> SolverContext:
    """Build CP-SAT model with variables for all schedulable tasks.

    Task classification:
    - Completed/Cancelled → skipped (known_ends recorded for precedence)
    - In-progress (assigned, start < now) → fixed (immobile interval)
    - Pinned by user → fixed (immobile interval, Phase 9)
    - Assigned (start >= now) → movable (solver can reposition)
    - Unassigned (Defined/Ready) → movable (solver places them)
    """
    pinned_task_ids = pinned_task_ids or set()
    model = cp_model.CpModel()

    # Reference time
    if now is None:
        now = parse_dt(snapshot.generated_at)
    reference_time = _ceil_quarter_hour(now)

    # Build lookup maps
    tasks_by_id = {t.id: t for t in snapshot.tasks}
    elements_by_id = {e.id: e for e in snapshot.elements}
    jobs_by_id = {j.id: j for j in snapshot.jobs}
    stations_by_id = {s.id: s for s in snapshot.stations}
    groups_by_id = {g.id: g for g in snapshot.groups}
    assignments_by_task = {a.task_id: a for a in snapshot.assignments}

    # Element lookup by task
    element_by_task: dict[str, Element] = {}
    for elem in snapshot.elements:
        for tid in elem.task_ids:
            element_by_task[tid] = elem

    # Compute horizon: max deadline + 30 day buffer
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

    horizon_end = max_deadline + timedelta(days=30)
    horizon_minutes = dt_to_minutes(horizon_end, reference_time)
    now_minutes = 0  # reference_time == now
    # Round up to nearest quarter-hour boundary for consistency
    now_minutes = ((now_minutes + 14) // 15) * 15

    ctx = SolverContext(
        model=model,
        reference_time=reference_time,
        horizon_minutes=horizon_minutes,
        now_minutes=now_minutes,
        tasks_by_id=tasks_by_id,
        elements_by_id=elements_by_id,
        jobs_by_id=jobs_by_id,
        stations_by_id=stations_by_id,
        groups_by_id=groups_by_id,
        assignments_by_task=assignments_by_task,
        element_by_task=element_by_task,
        tz_name=tz_name,
        snapshot=snapshot,
    )

    # Build station → group mapping + blocked intervals
    for station in snapshot.stations:
        ctx.group_stations.setdefault(station.group_id, []).append(station.id)
        ctx.blocked_intervals[station.id] = generate_blocked_intervals(
            station, reference_time, horizon_minutes, tz_name=tz_name
        )

    # Classify and create variables for each task
    for task in snapshot.tasks:
        job = jobs_by_id.get(task.job_id)
        if job and job.status in ("Completed", "Cancelled"):
            ctx.skipped_ids.add(task.id)
            continue

        if task.status in ("Completed", "Cancelled"):
            # Record known end time from assignment
            assignment = assignments_by_task.get(task.id)
            if assignment:
                try:
                    end_dt = parse_dt(assignment.scheduled_end)
                    ctx.known_ends[task.id] = dt_to_minutes(end_dt, reference_time)
                    start_dt = parse_dt(assignment.scheduled_start)
                    ctx.known_starts[task.id] = dt_to_minutes(start_dt, reference_time)
                except (ValueError, TypeError):
                    pass
            ctx.skipped_ids.add(task.id)
            continue

        duration = _compute_task_duration(task)
        if duration <= 0:
            ctx.skipped_ids.add(task.id)
            continue

        assignment = assignments_by_task.get(task.id)
        is_in_progress = False
        is_pinned = task.id in pinned_task_ids and assignment is not None

        if assignment and not assignment.is_completed:
            try:
                start_dt = parse_dt(assignment.scheduled_start)
                start_min = dt_to_minutes(start_dt, reference_time)
                if start_min < now_minutes:
                    is_in_progress = True
            except (ValueError, TypeError):
                pass

        if is_in_progress or is_pinned:
            # Fixed (immobile) task — create fixed interval
            start_min = dt_to_minutes(
                parse_dt(assignment.scheduled_start), reference_time
            )
            end_min = start_min + duration

            start_var = model.NewIntVar(start_min, start_min, f"start_{task.id}")
            end_var = model.NewIntVar(end_min, end_min, f"end_{task.id}")
            interval_var = model.NewIntervalVar(
                start_var, duration, end_var, f"interval_{task.id}"
            )
            model.Add(start_var == start_min)

            ctx.starts[task.id] = start_var
            ctx.ends[task.id] = end_var
            ctx.intervals[task.id] = interval_var
            ctx.durations[task.id] = duration
            ctx.fixed_ids.add(task.id)
            ctx.known_starts[task.id] = start_min
            ctx.known_ends[task.id] = end_min
        else:
            # Movable task — solver decides start time
            # Quarter-hour snapping: constrain start to multiples of 15
            qh_start = ((now_minutes + 14) // 15) * 15
            domain = cp_model.Domain.FromIntervals(
                [[t, t] for t in range(qh_start, horizon_minutes - duration + 1, 15)]
            )
            start_var = model.NewIntVarFromDomain(domain, f"start_{task.id}")
            end_var = model.NewIntVar(
                qh_start + duration, horizon_minutes, f"end_{task.id}"
            )
            interval_var = model.NewIntervalVar(
                start_var, duration, end_var, f"interval_{task.id}"
            )

            ctx.starts[task.id] = start_var
            ctx.ends[task.id] = end_var
            ctx.intervals[task.id] = interval_var
            ctx.durations[task.id] = duration
            ctx.schedulable_ids.add(task.id)

            # Warm start: hint current position if assigned
            if assignment:
                try:
                    hint_start = dt_to_minutes(
                        parse_dt(assignment.scheduled_start), reference_time
                    )
                    if hint_start >= now_minutes:
                        model.AddHint(start_var, hint_start)
                except (ValueError, TypeError):
                    pass

        # Index: station → tasks (only for internal tasks)
        if isinstance(task, InternalTask):
            ctx.station_tasks.setdefault(task.station_id, []).append(task.id)

        # Index: job → tasks
        ctx.job_task_ids.setdefault(task.job_id, []).append(task.id)

    # Compute job deadlines
    for job in snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        try:
            dl = parse_dt(job.workshop_exit_date)
            ctx.job_deadlines[job.id] = dt_to_minutes(dl, reference_time)
        except (ValueError, TypeError):
            pass

    return ctx
