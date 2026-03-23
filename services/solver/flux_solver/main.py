"""FastAPI service for the CP-SAT solver.

Endpoints:
  POST /solve/strategic — full horizon placement (SSE stream)
  POST /solve/compact   — short window compaction (SSE stream)
  GET  /health          — health check
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, ValidationError
from pydantic.alias_generators import to_camel

from flux_solver.models.snapshot import ScheduleSnapshot
from flux_solver.modes.strategic import solve_strategic
from flux_solver.modes.compact import solve_compact
from flux_solver.streaming import complete_event, error_event, keepalive_comment, progress_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("flux_solver")

app = FastAPI(title="Flux Solver Service", version="0.1.0")


@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Log FastAPI request validation errors with full detail for debugging."""
    errors = exc.errors()
    logger.error("Request validation failed (%d errors):", len(errors))
    for err in errors[:20]:
        logger.error("  %s: %s", err.get("loc"), err.get("msg"))
    return JSONResponse(status_code=422, content={"detail": errors[:20]})


# --- Request models ---


class StrategicConfig(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    time_limit_per_window: int = 20
    window_days: int = 15
    overlap_days: int = 5
    windowed: bool = False
    pinned_task_ids: list[str] = []
    movement_weight: int = 0
    timezone: str = "Europe/Paris"


class CompactConfig(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    horizon_hours: int = 8
    max_solve_seconds: int = 3
    pinned_task_ids: list[str] = []
    timezone: str = "Europe/Paris"


class StrategicRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    snapshot: ScheduleSnapshot
    config: StrategicConfig = StrategicConfig()


class CompactRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    snapshot: ScheduleSnapshot
    config: CompactConfig = CompactConfig()


# --- Endpoints ---


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "flux-solver"}


@app.post("/solve/strategic")
async def solve_strategic_endpoint(request: StrategicRequest) -> StreamingResponse:
    """Run strategic solver with SSE progress streaming."""

    async def generate() -> AsyncGenerator[str, None]:
        yield progress_event("init", "Starting strategic solver...", 0)

        try:
            # Run solver in thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(
                None,
                lambda: solve_strategic(
                    request.snapshot,
                    time_limit_seconds=request.config.time_limit_per_window,
                    windowed=request.config.windowed,
                    window_days=request.config.window_days,
                    overlap_days=request.config.overlap_days,
                    time_limit_per_window=request.config.time_limit_per_window,
                    pinned_task_ids=set(request.config.pinned_task_ids),
                    movement_weight=request.config.movement_weight,
                    tz_name=request.config.timezone,
                ),
            )

            # Send keepalive comments while solver runs to prevent proxy/browser timeouts
            while True:
                try:
                    result = await asyncio.wait_for(asyncio.shield(future), timeout=15.0)
                    break
                except asyncio.TimeoutError:
                    yield keepalive_comment()

            yield progress_event(
                "solving",
                f"Solve complete: {result.status}",
                1,
            )
            yield complete_event(result)

        except Exception as e:
            yield error_event(str(e))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/solve/compact")
async def solve_compact_endpoint(request: CompactRequest) -> StreamingResponse:
    """Run compaction solver with SSE progress streaming."""

    async def generate() -> AsyncGenerator[str, None]:
        yield progress_event("init", "Starting compaction solver...", 0)

        try:
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(
                None,
                lambda: solve_compact(
                    request.snapshot,
                    horizon_hours=request.config.horizon_hours,
                    max_solve_seconds=request.config.max_solve_seconds,
                    tz_name=request.config.timezone,
                ),
            )

            # Send keepalive comments while solver runs to prevent proxy/browser timeouts
            while True:
                try:
                    result = await asyncio.wait_for(asyncio.shield(future), timeout=15.0)
                    break
                except asyncio.TimeoutError:
                    yield keepalive_comment()

            yield progress_event(
                "solving",
                f"Solve complete: {result.status}",
                1,
            )
            yield complete_event(result)

        except Exception as e:
            yield error_event(str(e))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
