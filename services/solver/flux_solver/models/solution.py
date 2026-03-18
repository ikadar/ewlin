"""Solution output models for the CP-SAT solver."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TaskAssignmentResult:
    task_id: str
    station_id: str
    start_minutes: int  # from reference time
    end_minutes: int
    start_iso: str  # ISO datetime
    end_iso: str
    is_fixed: bool  # Was this task fixed (immobile) during solve?


@dataclass
class SolverScore:
    late_job_count: int
    total_job_count: int
    total_lateness_minutes: int
    max_lateness_minutes: int
    makespan_minutes: int
    on_time_rate: float  # percentage 0-100
    total_changeover_cost: int = 0  # sum of non-matching criteria across all transitions
    similarity_score: int = 0  # sum of matching criteria across all transitions


@dataclass
class SolverResult:
    status: str  # 'OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'MODEL_INVALID', 'UNKNOWN'
    assignments: list[TaskAssignmentResult] = field(default_factory=list)
    score: SolverScore | None = None
    solve_time_seconds: float = 0.0
    wall_time_seconds: float = 0.0
    num_variables: int = 0
    num_constraints: int = 0
    objective_value: float = 0.0
    best_bound: float = 0.0
    gap_percent: float = 0.0
