"""SSE event generation for solver progress streaming."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

from flux_solver.models.solution import SolverResult


def sse_event(data: dict[str, Any]) -> str:
    """Format a dict as an SSE event string."""
    return f"data: {json.dumps(data)}\n\n"


def progress_event(
    phase: str,
    message: str,
    steps_completed: int,
    total_steps: int | None = None,
) -> str:
    """Create a progress SSE event."""
    data = {
        "type": "progress",
        "phase": phase,
        "message": message,
        "stepsCompleted": steps_completed,
    }
    if total_steps is not None:
        data["totalSteps"] = total_steps
    return sse_event(data)


def complete_event(result: SolverResult) -> str:
    """Create a completion SSE event with full result."""
    data: dict[str, Any] = {
        "type": "complete",
        "status": result.status,
        "solveTimeSeconds": result.solve_time_seconds,
        "objectiveValue": result.objective_value,
        "gapPercent": result.gap_percent,
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
    if result.score:
        data["score"] = {
            "lateJobCount": result.score.late_job_count,
            "totalJobCount": result.score.total_job_count,
            "totalLatenessMinutes": result.score.total_lateness_minutes,
            "maxLatenessMinutes": result.score.max_lateness_minutes,
            "makespanMinutes": result.score.makespan_minutes,
            "onTimeRate": result.score.on_time_rate,
            "totalChangeoverCost": result.score.total_changeover_cost,
            "similarityScore": result.score.similarity_score,
        }
    return sse_event(data)


def error_event(message: str) -> str:
    """Create an error SSE event."""
    return sse_event({"type": "error", "message": message})


def keepalive_comment() -> str:
    """SSE comment line to keep the connection alive.

    Comments (lines starting with ``:``) are ignored by SSE parsers but
    prevent proxies and browsers from closing idle connections.
    """
    return ": keepalive\n\n"
