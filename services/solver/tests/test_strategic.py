"""Tests for Phase 1 strategic solver with synthetic snapshots."""

from __future__ import annotations

from datetime import datetime

import pytest

from flux_solver.models.snapshot import (
    DaySchedule,
    Element,
    InternalDuration,
    InternalTask,
    Job,
    OperatingSchedule,
    OutsourcedDuration,
    OutsourcedTask,
    ScheduleSnapshot,
    Station,
    StationCategory,
    StationGroup,
    TaskAssignment,
    TimeSlot,
)
from flux_solver.modes.strategic import solve_strategic


def _make_schedule() -> OperatingSchedule:
    """24/7 operating schedule."""
    day = DaySchedule(is_operating=True, slots=[TimeSlot(start="00:00", end="24:00")])
    off = DaySchedule(is_operating=False, slots=[])
    return OperatingSchedule(
        monday=day, tuesday=day, wednesday=day, thursday=day,
        friday=day, saturday=day, sunday=day,
    )


def _make_snapshot(
    stations: list[Station],
    groups: list[StationGroup],
    categories: list[StationCategory],
    jobs: list[Job],
    elements: list[Element],
    tasks: list,
    assignments: list[TaskAssignment] | None = None,
    generated_at: str = "2026-03-18T08:00:00",
) -> ScheduleSnapshot:
    return ScheduleSnapshot(
        version=1,
        generated_at=generated_at,
        stations=stations,
        categories=categories,
        groups=groups,
        providers=[],
        jobs=jobs,
        elements=elements,
        tasks=tasks,
        assignments=assignments or [],
        conflicts=[],
        late_jobs=[],
    )


class TestBasicPlacement:
    """Test that the solver places tasks without overlaps."""

    def test_two_tasks_same_station_no_overlap(self):
        """Two tasks on the same station should not overlap."""
        cat = StationCategory(
            id="cat1", name="Print", description="", similarity_criteria=[]
        )
        grp = StationGroup(
            id="grp1", name="Group1", max_concurrent=None,
            is_outsourced_provider_group=False,
        )
        station = Station(
            id="s1", name="Station1", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=0, operating_schedule=_make_schedule(), exceptions=[],
        )
        job = Job(
            id="j1", reference="J001", client="Test", description="Test job",
            status="Planned", workshop_exit_date="2026-03-20T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=[], element_ids=["e1"],
            task_ids=["t1", "t2"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        elem = Element(
            id="e1", job_id="j1", name="main", prerequisite_element_ids=[],
            task_ids=["t1", "t2"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t1 = InternalTask(
            id="t1", element_id="e1", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=30, run_minutes=90),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t2 = InternalTask(
            id="t2", element_id="e1", job_id="j1", sequence_order=1,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=15, run_minutes=45),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )

        snapshot = _make_snapshot(
            stations=[station], groups=[grp], categories=[cat],
            jobs=[job], elements=[elem], tasks=[t1, t2],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert len(result.assignments) == 2

        # Verify no overlap: one must end before the other starts
        a1 = next(a for a in result.assignments if a.task_id == "t1")
        a2 = next(a for a in result.assignments if a.task_id == "t2")
        assert a1.end_minutes <= a2.start_minutes  # t1 before t2 (precedence)

    def test_precedence_across_elements(self):
        """Tasks in dependent elements must respect element precedence."""
        cat = StationCategory(
            id="cat1", name="Print", description="", similarity_criteria=[]
        )
        grp = StationGroup(
            id="grp1", name="Group1", max_concurrent=None,
            is_outsourced_provider_group=False,
        )
        s1 = Station(
            id="s1", name="Station1", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=0, operating_schedule=_make_schedule(), exceptions=[],
        )
        s2 = Station(
            id="s2", name="Station2", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=1, operating_schedule=_make_schedule(), exceptions=[],
        )
        job = Job(
            id="j1", reference="J001", client="Test", description="",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=[], element_ids=["e1", "e2"],
            task_ids=["t1", "t2"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        # e1 (print) → e2 (finish), e2 depends on e1
        e1 = Element(
            id="e1", job_id="j1", name="print", prerequisite_element_ids=[],
            task_ids=["t1"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        e2 = Element(
            id="e2", job_id="j1", name="finish", prerequisite_element_ids=["e1"],
            task_ids=["t2"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t1 = InternalTask(
            id="t1", element_id="e1", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=30, run_minutes=90),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t2 = InternalTask(
            id="t2", element_id="e2", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s2",
            duration=InternalDuration(setup_minutes=15, run_minutes=45),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )

        snapshot = _make_snapshot(
            stations=[s1, s2], groups=[grp], categories=[cat],
            jobs=[job], elements=[e1, e2], tasks=[t1, t2],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        a1 = next(a for a in result.assignments if a.task_id == "t1")
        a2 = next(a for a in result.assignments if a.task_id == "t2")
        assert a1.end_minutes <= a2.start_minutes

    def test_deadline_pressure_scoring(self):
        """Jobs with tight deadlines should be scored correctly."""
        cat = StationCategory(
            id="cat1", name="Print", description="", similarity_criteria=[]
        )
        grp = StationGroup(
            id="grp1", name="Group1", max_concurrent=None,
            is_outsourced_provider_group=False,
        )
        station = Station(
            id="s1", name="Station1", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=0, operating_schedule=_make_schedule(), exceptions=[],
        )
        # Two jobs competing for same station, one has a very tight deadline
        j1 = Job(
            id="j1", reference="J001", client="Urgent", description="",
            status="Planned", workshop_exit_date="2026-03-18T10:00:00",  # 2 hours from now
            quantity=1, fully_scheduled=False, color="#FF0000",
            shipped=False, required_job_ids=[], element_ids=["e1"],
            task_ids=["t1"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        j2 = Job(
            id="j2", reference="J002", client="Relaxed", description="",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",  # week away
            quantity=1, fully_scheduled=False, color="#0000FF",
            shipped=False, required_job_ids=[], element_ids=["e2"],
            task_ids=["t2"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        e1 = Element(
            id="e1", job_id="j1", name="main", prerequisite_element_ids=[],
            task_ids=["t1"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        e2 = Element(
            id="e2", job_id="j2", name="main", prerequisite_element_ids=[],
            task_ids=["t2"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t1 = InternalTask(
            id="t1", element_id="e1", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=15, run_minutes=45),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t2 = InternalTask(
            id="t2", element_id="e2", job_id="j2", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=15, run_minutes=45),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )

        snapshot = _make_snapshot(
            stations=[station], groups=[grp], categories=[cat],
            jobs=[j1, j2], elements=[e1, e2], tasks=[t1, t2],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.score is not None

        # The urgent job (j1) should be scheduled first to minimize lateness
        a1 = next(a for a in result.assignments if a.task_id == "t1")
        a2 = next(a for a in result.assignments if a.task_id == "t2")
        assert a1.start_minutes < a2.start_minutes

    def test_cross_job_precedence(self):
        """Jobs with requiredJobIds must wait for prerequisite jobs."""
        cat = StationCategory(
            id="cat1", name="Print", description="", similarity_criteria=[]
        )
        grp = StationGroup(
            id="grp1", name="Group1", max_concurrent=None,
            is_outsourced_provider_group=False,
        )
        s1 = Station(
            id="s1", name="Station1", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=0, operating_schedule=_make_schedule(), exceptions=[],
        )
        s2 = Station(
            id="s2", name="Station2", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=1, operating_schedule=_make_schedule(), exceptions=[],
        )
        j1 = Job(
            id="j1", reference="J001", client="Test", description="Prerequisite",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=[], element_ids=["e1"],
            task_ids=["t1"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        j2 = Job(
            id="j2", reference="J002", client="Test", description="Dependent",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=["j1"], element_ids=["e2"],
            task_ids=["t2"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        e1 = Element(
            id="e1", job_id="j1", name="main", prerequisite_element_ids=[],
            task_ids=["t1"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        e2 = Element(
            id="e2", job_id="j2", name="main", prerequisite_element_ids=[],
            task_ids=["t2"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t1 = InternalTask(
            id="t1", element_id="e1", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=30, run_minutes=90),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t2 = InternalTask(
            id="t2", element_id="e2", job_id="j2", sequence_order=0,
            status="Defined", type="Internal", station_id="s2",
            duration=InternalDuration(setup_minutes=15, run_minutes=45),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )

        snapshot = _make_snapshot(
            stations=[s1, s2], groups=[grp], categories=[cat],
            jobs=[j1, j2], elements=[e1, e2], tasks=[t1, t2],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        a1 = next(a for a in result.assignments if a.task_id == "t1")
        a2 = next(a for a in result.assignments if a.task_id == "t2")
        assert a1.end_minutes <= a2.start_minutes

    def test_group_max_concurrent(self):
        """Station group maxConcurrent limits parallel tasks across stations."""
        cat = StationCategory(
            id="cat1", name="Print", description="", similarity_criteria=[]
        )
        grp = StationGroup(
            id="grp1", name="Group1", max_concurrent=1,  # Only 1 at a time across group
            is_outsourced_provider_group=False,
        )
        s1 = Station(
            id="s1", name="Station1", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=0, operating_schedule=_make_schedule(), exceptions=[],
        )
        s2 = Station(
            id="s2", name="Station2", status="Available",
            category_id="cat1", group_id="grp1", capacity=1,
            display_order=1, operating_schedule=_make_schedule(), exceptions=[],
        )
        j1 = Job(
            id="j1", reference="J001", client="Test", description="",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=[], element_ids=["e1"],
            task_ids=["t1"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        j2 = Job(
            id="j2", reference="J002", client="Test", description="",
            status="Planned", workshop_exit_date="2026-03-25T17:00:00",
            quantity=1, fully_scheduled=False, color="#000000",
            shipped=False, required_job_ids=[], element_ids=["e2"],
            task_ids=["t2"], created_at="2026-03-18T08:00:00",
            updated_at="2026-03-18T08:00:00",
        )
        e1 = Element(
            id="e1", job_id="j1", name="main", prerequisite_element_ids=[],
            task_ids=["t1"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        e2 = Element(
            id="e2", job_id="j2", name="main", prerequisite_element_ids=[],
            task_ids=["t2"], paper_status="none", bat_status="none",
            plate_status="none", forme_status="none", is_blocked=False,
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        # Two tasks on DIFFERENT stations, but same group with maxConcurrent=1
        t1 = InternalTask(
            id="t1", element_id="e1", job_id="j1", sequence_order=0,
            status="Defined", type="Internal", station_id="s1",
            duration=InternalDuration(setup_minutes=0, run_minutes=60),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )
        t2 = InternalTask(
            id="t2", element_id="e2", job_id="j2", sequence_order=0,
            status="Defined", type="Internal", station_id="s2",
            duration=InternalDuration(setup_minutes=0, run_minutes=60),
            created_at="2026-03-18T08:00:00", updated_at="2026-03-18T08:00:00",
        )

        snapshot = _make_snapshot(
            stations=[s1, s2], groups=[grp], categories=[cat],
            jobs=[j1, j2], elements=[e1, e2], tasks=[t1, t2],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        a1 = next(a for a in result.assignments if a.task_id == "t1")
        a2 = next(a for a in result.assignments if a.task_id == "t2")

        # Tasks should NOT overlap due to group constraint
        assert a1.end_minutes <= a2.start_minutes or a2.end_minutes <= a1.start_minutes

    def test_empty_snapshot(self):
        """Solver handles empty snapshot gracefully."""
        snapshot = _make_snapshot(
            stations=[], groups=[], categories=[], jobs=[], elements=[], tasks=[],
        )

        result = solve_strategic(snapshot, time_limit_seconds=5)

        # Should solve (trivially) with no assignments
        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert len(result.assignments) == 0
