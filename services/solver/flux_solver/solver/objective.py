"""Objective function for the CP-SAT model.

Strategic objective:
  Minimize W1 * late_job_count
         + W2 * total_lateness_minutes
         + W3 * changeover_cost
         + W4 * movement_penalty  (Phase 9 — optional)

Changeover cost uses AddCircuit to determine task adjacency on stations
with similarity criteria, penalizing transitions where spec fields differ.
"""

from __future__ import annotations

from ortools.sat.python import cp_model

from flux_solver.solver.builder import SolverContext, parse_dt, dt_to_minutes

# Objective weights
W_LATE_COUNT = 10_000  # Heavily penalize each late job
W_LATENESS = 1  # 1 unit per minute of lateness
W_CHANGEOVER = 10  # Per non-matching criterion between adjacent tasks
W_MOVEMENT = 0  # Movement penalty (0 = disabled by default, set > 0 to enable)


def add_strategic_objective(
    ctx: SolverContext,
    movement_weight: int = 0,
) -> None:
    """Add strategic objective: minimize late jobs + lateness + changeover + movement.

    Args:
        movement_weight: If > 0, adds a penalty per minute of displacement from
            each task's current position. Useful to minimize disruption.
    """
    if not ctx.snapshot:
        return

    objective_terms: list[cp_model.LinearExpr] = []

    # Deadline terms
    _add_deadline_terms(ctx, objective_terms)

    # Changeover terms (circuit-based adjacency on printing stations)
    _add_changeover_circuits(ctx, objective_terms)

    # Movement penalty (Phase 9): penalize displacement from current positions
    effective_weight = movement_weight or W_MOVEMENT
    if effective_weight > 0:
        _add_movement_penalty(ctx, objective_terms, effective_weight)

    if objective_terms:
        ctx.model.Minimize(sum(objective_terms))


def _add_deadline_terms(
    ctx: SolverContext,
    terms: list[cp_model.LinearExpr],
) -> None:
    """Add late-job-count and total-lateness terms."""
    for job in ctx.snapshot.jobs:
        if job.status in ("Completed", "Cancelled"):
            continue
        if job.id not in ctx.job_deadlines:
            continue

        deadline = ctx.job_deadlines[job.id]
        task_ids = ctx.job_task_ids.get(job.id, [])
        if not task_ids:
            continue

        end_exprs: list[cp_model.IntVar] = []
        max_known_end = 0

        for tid in task_ids:
            if tid in ctx.ends:
                end_exprs.append(ctx.ends[tid])
            elif tid in ctx.known_ends:
                max_known_end = max(max_known_end, ctx.known_ends[tid])

        if not end_exprs and max_known_end == 0:
            continue

        completion = ctx.model.NewIntVar(
            0, ctx.horizon_minutes, f"completion_{job.id}"
        )
        all_ends = list(end_exprs)
        if max_known_end > 0:
            const = ctx.model.NewIntVar(
                max_known_end, max_known_end, f"known_end_{job.id}"
            )
            all_ends.append(const)

        if len(all_ends) == 1:
            ctx.model.Add(completion == all_ends[0])
        else:
            ctx.model.AddMaxEquality(completion, all_ends)

        lateness = ctx.model.NewIntVar(
            0, ctx.horizon_minutes, f"lateness_{job.id}"
        )
        ctx.model.Add(lateness >= completion - deadline)
        ctx.model.Add(lateness >= 0)

        is_late = ctx.model.NewBoolVar(f"is_late_{job.id}")
        ctx.model.Add(completion > deadline).OnlyEnforceIf(is_late)
        ctx.model.Add(completion <= deadline).OnlyEnforceIf(is_late.Not())

        terms.append(W_LATE_COUNT * is_late)
        terms.append(W_LATENESS * lateness)


def _add_changeover_circuits(
    ctx: SolverContext,
    terms: list[cp_model.LinearExpr],
) -> None:
    """Add circuit constraints for task sequencing on stations with similarity criteria.

    For each such station, AddCircuit determines adjacency. Changeover cost is
    incurred when adjacent tasks differ on spec fields defined by the category's
    similarity criteria.
    """
    if not ctx.snapshot:
        return

    categories_by_id = {c.id: c for c in ctx.snapshot.categories}

    for station_id, task_ids in ctx.station_tasks.items():
        station = ctx.stations_by_id.get(station_id)
        if not station:
            continue
        category = categories_by_id.get(station.category_id)
        if not category or not category.similarity_criteria:
            continue

        active_ids = [tid for tid in task_ids if tid in ctx.intervals]
        if len(active_ids) < 2:
            continue

        # Pre-compute spec dicts for fast field lookup
        spec_cache: dict[str, dict] = {}
        for tid in active_ids:
            elem = ctx.element_by_task.get(tid)
            if elem and elem.spec:
                spec_cache[tid] = elem.spec.model_dump(by_alias=True)
            else:
                spec_cache[tid] = {}

        n = len(active_ids)
        depot = n
        arcs: list[tuple[int, int, cp_model.IntVar]] = []

        for i, ti_id in enumerate(active_ids):
            # Depot → i (first in sequence)
            arcs.append(
                (depot, i, ctx.model.NewBoolVar(f"co_d{station_id[:6]}_{i}"))
            )
            # i → depot (last in sequence)
            arcs.append(
                (i, depot, ctx.model.NewBoolVar(f"co_{station_id[:6]}_{i}d"))
            )

            for j, tj_id in enumerate(active_ids):
                if i == j:
                    continue

                arc_lit = ctx.model.NewBoolVar(
                    f"co_{station_id[:6]}_{i}_{j}"
                )
                arcs.append((i, j, arc_lit))

                # Temporal link: if arc active, ti finishes before tj starts
                ctx.model.Add(
                    ctx.ends[ti_id] <= ctx.starts[tj_id]
                ).OnlyEnforceIf(arc_lit)

                # Changeover cost for this transition
                cost = _pair_changeover_cost(
                    spec_cache.get(ti_id, {}),
                    spec_cache.get(tj_id, {}),
                    category.similarity_criteria,
                )
                if cost > 0:
                    terms.append(W_CHANGEOVER * cost * arc_lit)

        ctx.model.AddCircuit(arcs)


def _add_movement_penalty(
    ctx: SolverContext,
    terms: list[cp_model.LinearExpr],
    weight: int,
) -> None:
    """Penalize displacement of tasks from their current (hinted) positions.

    For each schedulable task with an existing assignment, adds
    weight * |start[t] - original_start[t]| to the objective.
    """
    if not ctx.snapshot:
        return

    for tid in ctx.schedulable_ids:
        assignment = ctx.assignments_by_task.get(tid)
        if not assignment:
            continue
        try:
            original_start = dt_to_minutes(
                parse_dt(assignment.scheduled_start), ctx.reference_time
            )
        except (ValueError, TypeError):
            continue

        if original_start < ctx.now_minutes:
            continue

        # |start[t] - original| via auxiliary variable
        displacement = ctx.model.NewIntVar(
            0, ctx.horizon_minutes, f"move_{tid}"
        )
        ctx.model.Add(displacement >= ctx.starts[tid] - original_start)
        ctx.model.Add(displacement >= original_start - ctx.starts[tid])
        terms.append(weight * displacement)


def _pair_changeover_cost(
    spec_a: dict,
    spec_b: dict,
    criteria: list,
) -> int:
    """Count non-matching criteria between two element specs.

    Rules (BR-CATEGORY-003):
    - Both non-null and equal → match (0 cost)
    - Either null or different → mismatch (1 cost per criterion)
    """
    cost = 0
    for c in criteria:
        fp = c.field_path
        val_a = spec_a.get(fp)
        val_b = spec_b.get(fp)
        if val_a is None or val_b is None or val_a != val_b:
            cost += 1
    return cost
