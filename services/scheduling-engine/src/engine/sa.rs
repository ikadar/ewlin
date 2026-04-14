use std::collections::{HashMap, HashSet};
use std::time::Instant;

use chrono::NaiveDate;
use rand::Rng;
use rand::rngs::StdRng;
use rand::SeedableRng;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::progress::ProgressEvent;
use crate::model::schedule::{ComputedAssignment, ScheduleStats, StationGroupInput};
use crate::model::station::StationInput;

use super::backward_pass::BackwardOrdering;
use super::fbi::run_with_fbi_ordering;
use super::forward_pass::Action;

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

/// Per-station ordered priority list of action indices.
struct SaSolution {
    station_queues: Vec<Vec<usize>>,
}

impl SaSolution {
    fn clone_from(other: &SaSolution) -> Self {
        SaSolution {
            station_queues: other.station_queues.iter().map(|q| q.clone()).collect(),
        }
    }
}

/// Lightweight action info for the SA decode (no mutable state).
struct SaActionInfo {
    idx: usize,
    station_idx: usize,
    duration_ticks: u32,
    predecessor_idx: Option<usize>,
    predecessor_gap_ticks: u32,
    additional_predecessors: Vec<(usize, u32)>,
    successor_indices: Vec<usize>,
    job_deadline_tick: u64,
    deadline_priority: u8,
    is_pinned: bool,
    pinned_start_tick: Option<usize>,
    job_id: String,
}

/// Precomputed immutable context for the SA decode.
struct SaContext {
    actions: Vec<SaActionInfo>,
    station_blocked: Vec<Vec<(usize, usize)>>,
    op_avail: Vec<Vec<bool>>,
    station_operators: Vec<Vec<usize>>,
    tick_minutes: u32,
    now_tick: usize,
    horizon_ticks: usize,
    num_operators: usize,
}

/// Lightweight evaluation result.
struct SaEvaluation {
    late_job_count: u32,
    weighted_lateness_minutes: u64,
    makespan_ticks: usize,
    end_ticks: Vec<Option<usize>>,
}

// ---------------------------------------------------------------------------
// Build context from existing actions
// ---------------------------------------------------------------------------

fn build_sa_context(
    actions: &[Action],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    start_date: NaiveDate,
    now_tick: usize,
    horizon_days: u32,
    station_blocked_ranges: &[Vec<(usize, usize)>],
) -> SaContext {
    let horizon_ticks = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
    let num_operators = operators.len();

    // Build station_id -> idx mapping
    let station_id_to_idx: HashMap<&str, usize> = stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.as_str(), i))
        .collect();

    // Build SA action infos
    let mut sa_actions: Vec<SaActionInfo> = actions
        .iter()
        .map(|a| SaActionInfo {
            idx: a.idx,
            station_idx: a.station_idx,
            duration_ticks: a.setup_ticks + a.run_ticks,
            predecessor_idx: a.predecessor_idx,
            predecessor_gap_ticks: a.predecessor_gap_ticks,
            additional_predecessors: a.additional_predecessors.clone(),
            successor_indices: Vec::new(),
            job_deadline_tick: a.job_deadline_tick,
            deadline_priority: a.deadline_priority,
            is_pinned: a.is_pinned,
            pinned_start_tick: a.pinned_start_tick,
            job_id: a.job_id.clone(),
        })
        .collect();

    // Build successor reverse links
    for i in 0..sa_actions.len() {
        if let Some(pred) = sa_actions[i].predecessor_idx {
            if pred < sa_actions.len() {
                sa_actions[pred].successor_indices.push(i);
            }
        }
        for &(pred, _) in &sa_actions[i].additional_predecessors.clone() {
            if pred < sa_actions.len() {
                sa_actions[pred].successor_indices.push(i);
            }
        }
    }

    // Operator availability grid
    let op_avail: Vec<Vec<bool>> = operators
        .iter()
        .map(|op| {
            let avail = super::forward_pass::OperatorAvailability::new(
                1, horizon_ticks, tick_minutes, start_date,
                vec![op.operating_schedule.clone()],
            );
            (0..horizon_ticks).map(|t| avail.is_available(0, t)).collect()
        })
        .collect();

    // Qualified operators per station
    let mut station_operators: Vec<Vec<usize>> = vec![Vec::new(); stations.len()];
    for (op_idx, op) in operators.iter().enumerate() {
        for skill in &op.skills {
            if let Some(&s_idx) = station_id_to_idx.get(skill.station_id.as_str()) {
                if skill.proficiency > 0.0 {
                    station_operators[s_idx].push(op_idx);
                }
            }
        }
    }

    SaContext {
        actions: sa_actions,
        station_blocked: station_blocked_ranges.to_vec(),
        op_avail,
        station_operators,
        tick_minutes,
        now_tick,
        horizon_ticks,
        num_operators,
    }
}

// ---------------------------------------------------------------------------
// Extract initial solution from FBI result
// ---------------------------------------------------------------------------

fn extract_initial_solution(actions: &[Action], num_stations: usize) -> SaSolution {
    let mut queues: Vec<Vec<(usize, usize)>> = vec![Vec::new(); num_stations];
    for (i, action) in actions.iter().enumerate() {
        let start = action.start_tick.unwrap_or(usize::MAX);
        if action.station_idx < num_stations {
            queues[action.station_idx].push((i, start));
        }
    }
    for q in &mut queues {
        q.sort_by_key(|&(_, start)| start);
    }
    SaSolution {
        station_queues: queues.into_iter().map(|q| q.into_iter().map(|(i, _)| i).collect()).collect(),
    }
}

// ---------------------------------------------------------------------------
// SA decode — ready-set list scheduling
// ---------------------------------------------------------------------------

fn sa_decode(solution: &SaSolution, ctx: &SaContext) -> SaEvaluation {
    let n = ctx.actions.len();
    let mut end_ticks: Vec<Option<usize>> = vec![None; n];

    // Track how many unresolved predecessors each action has
    let mut pred_remaining: Vec<u32> = vec![0; n];
    for info in &ctx.actions {
        if info.predecessor_idx.is_some() {
            pred_remaining[info.idx] += 1;
        }
        pred_remaining[info.idx] += info.additional_predecessors.len() as u32;
    }

    // Ready set: actions with all predecessors resolved
    let mut ready: HashSet<usize> = HashSet::new();

    // Place pinned actions first
    for info in &ctx.actions {
        if info.is_pinned {
            if let Some(start) = info.pinned_start_tick {
                end_ticks[info.idx] = Some(start + info.duration_ticks as usize);
            } else {
                end_ticks[info.idx] = Some(ctx.now_tick + info.duration_ticks as usize);
            }
            // Mark predecessors as resolved for successors
            for &succ in &info.successor_indices {
                pred_remaining[succ] = pred_remaining[succ].saturating_sub(1);
            }
        }
    }

    // Initialize ready set
    for info in &ctx.actions {
        if !info.is_pinned && pred_remaining[info.idx] == 0 {
            ready.insert(info.idx);
        }
    }

    // Per-station tracking
    let mut station_free_after: Vec<usize> = vec![ctx.now_tick; solution.station_queues.len()];
    // Per-operator interval list: tracks all (start, end) assignments
    let mut op_intervals: Vec<Vec<(usize, usize)>> = vec![Vec::new(); ctx.num_operators];

    // Round-robin decoder: iterate rounds over all stations until no progress.
    // Each round tries to place one ready action per station. Cross-station
    // dependencies resolve naturally across rounds (predecessor placed in
    // round N → successor becomes ready in round N+1).
    // Typically converges in ~10-20 rounds (max chain depth).
    let num_stations = solution.station_queues.len();
    let mut placed_count = 0;
    let total_to_place = ctx.actions.iter().filter(|a| !a.is_pinned).count();

    loop {
        let mut round_progress = false;

        for station_idx in 0..num_stations {
            let queue = &solution.station_queues[station_idx];

            // Try to place as many ready actions on this station as possible
            loop {
                let mut placed_this_scan = false;

                for scan_pos in 0..queue.len() {
                    let action_idx = queue[scan_pos];
                    let info = &ctx.actions[action_idx];

                    if info.is_pinned || end_ticks[action_idx].is_some() {
                        continue; // already placed
                    }

                    if !ready.contains(&action_idx) {
                        continue; // predecessors not done yet
                    }

                    // Compute earliest start
                    let mut earliest = station_free_after[station_idx].max(ctx.now_tick);

                    if let Some(pred) = info.predecessor_idx {
                        if let Some(pred_end) = end_ticks[pred] {
                            earliest = earliest.max(pred_end + info.predecessor_gap_ticks as usize);
                        }
                    }
                    for &(ap, gap) in &info.additional_predecessors {
                        if let Some(ap_end) = end_ticks[ap] {
                            earliest = earliest.max(ap_end + gap as usize);
                        }
                    }

                    // Skip blocked ranges on this station
                    earliest = skip_blocked(earliest, info.duration_ticks as usize, station_idx, ctx);

                    // Find operator availability
                    earliest = find_operator(earliest, info, ctx, &op_intervals);

                    let end = earliest + info.duration_ticks as usize;
                    end_ticks[action_idx] = Some(end);
                    station_free_after[station_idx] = end;

                    // Assign operator
                    assign_operator(earliest, end, info, ctx, &mut op_intervals);

                    // Update ready set: add successors whose predecessors are all done
                    for &succ in &info.successor_indices {
                        pred_remaining[succ] = pred_remaining[succ].saturating_sub(1);
                        if pred_remaining[succ] == 0 && !ctx.actions[succ].is_pinned {
                            ready.insert(succ);
                        }
                    }

                    placed_count += 1;
                    placed_this_scan = true;
                    round_progress = true;
                    break; // restart scan from beginning for this station (new ready actions may have appeared)
                }

                if !placed_this_scan {
                    break; // no more ready actions on this station this round
                }
            }
        }

        if !round_progress || placed_count >= total_to_place {
            break;
        }
    }

    // Compute metrics
    compute_metrics(&end_ticks, ctx)
}

fn skip_blocked(mut earliest: usize, duration: usize, station_idx: usize, ctx: &SaContext) -> usize {
    if station_idx >= ctx.station_blocked.len() {
        return earliest;
    }
    for &(block_start, block_end) in &ctx.station_blocked[station_idx] {
        // If our window [earliest, earliest+duration) overlaps [block_start, block_end)
        if earliest < block_end && earliest + duration > block_start {
            earliest = block_end;
        }
    }
    earliest
}

/// Check if an operator is free during [start, end) given their interval list.
fn is_op_free_in_intervals(intervals: &[(usize, usize)], start: usize, end: usize) -> bool {
    for &(s, e) in intervals {
        if start < e && s < end {
            return false; // overlap
        }
    }
    true
}

fn find_operator(earliest: usize, info: &SaActionInfo, ctx: &SaContext, op_intervals: &[Vec<(usize, usize)>]) -> usize {
    let qualified = &ctx.station_operators[info.station_idx];
    if qualified.is_empty() {
        return earliest; // automated station
    }

    let duration = info.duration_ticks as usize;

    // Try to find an operator free for the full duration starting at earliest
    for attempt in 0..2000 {
        let t = earliest + attempt;
        let end = t + duration;
        for &op in qualified {
            // Check schedule availability at start tick
            if t < ctx.op_avail[op].len() && ctx.op_avail[op][t] {
                // Check no overlap with existing intervals
                if is_op_free_in_intervals(&op_intervals[op], t, end) {
                    return t;
                }
            }
        }
    }
    // Fallback: place anyway at a far-future tick (will count as very late)
    earliest + 2000
}

fn assign_operator(start: usize, end: usize, info: &SaActionInfo, ctx: &SaContext, op_intervals: &mut [Vec<(usize, usize)>]) {
    let qualified = &ctx.station_operators[info.station_idx];
    for &op in qualified {
        if start < ctx.op_avail[op].len() && ctx.op_avail[op][start] {
            if is_op_free_in_intervals(&op_intervals[op], start, end) {
                op_intervals[op].push((start, end));
                return;
            }
        }
    }
    // No operator found — action placed without operator assignment.
    // This is a degraded state that will naturally produce a late schedule.
}

fn compute_metrics(end_ticks: &[Option<usize>], ctx: &SaContext) -> SaEvaluation {
    const TIER_WEIGHT: [f64; 4] = [4.0, 2.0, 1.0, 0.5];

    let mut late_job_count: u32 = 0;
    let mut weighted_lateness_minutes: u64 = 0;
    let mut makespan_ticks: usize = 0;
    let mut seen_jobs: HashSet<&str> = HashSet::new();

    // Track max end_tick per job for job-level lateness
    let mut job_max_end: HashMap<&str, usize> = HashMap::new();

    for info in &ctx.actions {
        if let Some(end) = end_ticks[info.idx] {
            if end > makespan_ticks {
                makespan_ticks = end;
            }
            let entry = job_max_end.entry(info.job_id.as_str()).or_insert(0);
            if end > *entry {
                *entry = end;
            }
        }
    }

    for info in &ctx.actions {
        if seen_jobs.contains(info.job_id.as_str()) {
            continue;
        }
        if info.job_deadline_tick == u64::MAX {
            seen_jobs.insert(info.job_id.as_str());
            continue;
        }

        let w = TIER_WEIGHT[info.deadline_priority.min(3) as usize];

        match job_max_end.get(info.job_id.as_str()) {
            Some(&max_end) => {
                let end_minutes = max_end as u64 * ctx.tick_minutes as u64;
                let deadline_minutes = info.job_deadline_tick * ctx.tick_minutes as u64;
                if end_minutes > deadline_minutes {
                    late_job_count += 1;
                    let lateness = end_minutes - deadline_minutes;
                    weighted_lateness_minutes += (lateness as f64 * w) as u64;
                }
            }
            None => {
                // Job has NO placed actions → treat as maximally late.
                // This prevents the SA from "improving" by simply not placing jobs.
                late_job_count += 1;
                let horizon_minutes = ctx.horizon_ticks as u64 * ctx.tick_minutes as u64;
                let deadline_minutes = info.job_deadline_tick * ctx.tick_minutes as u64;
                let lateness = horizon_minutes.saturating_sub(deadline_minutes) + 10_000;
                weighted_lateness_minutes += (lateness as f64 * w) as u64;
            }
        }
        seen_jobs.insert(info.job_id.as_str());
    }

    SaEvaluation {
        late_job_count,
        weighted_lateness_minutes,
        makespan_ticks,
        end_ticks: end_ticks.to_vec(),
    }
}

// ---------------------------------------------------------------------------
// Precedence check
// ---------------------------------------------------------------------------

fn violates_precedence(a: usize, b: usize, ctx: &SaContext) -> bool {
    let info_a = &ctx.actions[a];
    let info_b = &ctx.actions[b];
    // a depends on b?
    if info_a.predecessor_idx == Some(b) {
        return true;
    }
    if info_a.additional_predecessors.iter().any(|&(p, _)| p == b) {
        return true;
    }
    // b depends on a?
    if info_b.predecessor_idx == Some(a) {
        return true;
    }
    if info_b.additional_predecessors.iter().any(|&(p, _)| p == a) {
        return true;
    }
    false
}

// ---------------------------------------------------------------------------
// SA loop
// ---------------------------------------------------------------------------

fn eval_score(eval: &SaEvaluation) -> f64 {
    eval.late_job_count as f64
        + eval.weighted_lateness_minutes as f64 * 1e-6
        + eval.makespan_ticks as f64 * 1e-9
}

fn run_sa(
    initial: SaSolution,
    ctx: &SaContext,
    time_budget_ms: u64,
    seed: u64,
    progress: &super::ProgressSender,
) -> (SaSolution, SaEvaluation) {
    let mut rng = StdRng::seed_from_u64(seed);
    let start = Instant::now();

    let mut current = initial;
    let mut current_eval = sa_decode(&current, ctx);
    let mut best = SaSolution::clone_from(&current);
    let mut best_score = eval_score(&current_eval);
    let mut best_eval_late_jobs = current_eval.late_job_count;

    let t0: f64 = 5.0;
    let t_min: f64 = 0.01;

    // Estimate iterations from first decode time
    let decode_start = Instant::now();
    let _ = sa_decode(&current, ctx);
    let decode_ms = decode_start.elapsed().as_micros().max(100) as f64 / 1000.0;
    let estimated_iters = (time_budget_ms as f64 / decode_ms) as u64;
    let alpha: f64 = if estimated_iters > 1 {
        (t_min / t0).powf(1.0 / estimated_iters as f64)
    } else {
        0.99
    };

    let mut temperature = t0;
    let mut iteration: u64 = 0;
    let mut accepted: u64 = 0;
    let mut improved: u64 = 0;

    // Hot stations: stations with late jobs
    let mut hot_stations = compute_hot_stations(&current_eval, ctx);

    let placed = current_eval.end_ticks.iter().filter(|e| e.is_some()).count();
    let total = current_eval.end_ticks.len();
    eprintln!("[SA] starting: {} late jobs, {}/{} placed, decode ~{:.1}ms, est. {} iterations, alpha={:.6}",
        current_eval.late_job_count, placed, total, decode_ms, estimated_iters, alpha);

    super::emit(progress, ProgressEvent::SaStart {
        late_job_count: current_eval.late_job_count,
        estimated_iterations: estimated_iters,
        decode_ms,
    });

    loop {
        if start.elapsed().as_millis() as u64 >= time_budget_ms {
            break;
        }

        // Refresh hot stations periodically
        if iteration > 0 && iteration % 200 == 0 {
            hot_stations = compute_hot_stations(&current_eval, ctx);
        }

        // Generate neighbor
        let swap = random_swap(&current, &hot_stations, &mut rng, ctx);
        let (station_idx, pos) = match swap {
            Some(s) => s,
            None => {
                iteration += 1;
                temperature *= alpha;
                continue;
            }
        };

        // Apply swap
        current.station_queues[station_idx].swap(pos, pos + 1);

        // Evaluate
        let new_eval = sa_decode(&current, ctx);
        let new_score = eval_score(&new_eval);
        let current_score = eval_score(&current_eval);
        let delta = new_score - current_score;

        let accept = if delta <= 0.0 {
            true
        } else {
            let p = (-delta / temperature).exp();
            rng.gen_range(0.0..1.0) < p
        };

        if accept {
            current_eval = new_eval;
            accepted += 1;

            let current_s = eval_score(&current_eval);
            if current_s < best_score {
                best = SaSolution::clone_from(&current);
                best_score = current_s;
                best_eval_late_jobs = current_eval.late_job_count;
                improved += 1;
            }
        } else {
            // Undo swap
            current.station_queues[station_idx].swap(pos, pos + 1);
        }

        // Emit progress every 100 iterations
        if iteration % 100 == 0 {
            super::emit(progress, ProgressEvent::SaProgress {
                iteration,
                best_late_jobs: best_eval_late_jobs,
                accepted,
                improved,
                temperature,
            });
        }

        iteration += 1;
        temperature *= alpha;
    }

    eprintln!("[SA] done: {} iterations, {} accepted ({:.0}%), {} improved, best={} late jobs",
        iteration, accepted,
        if iteration > 0 { accepted as f64 / iteration as f64 * 100.0 } else { 0.0 },
        improved, best.station_queues.len()); // placeholder

    let best_eval = sa_decode(&best, ctx);
    eprintln!("[SA] best result: {} late jobs, {} weighted lateness, {} makespan ticks",
        best_eval.late_job_count, best_eval.weighted_lateness_minutes, best_eval.makespan_ticks);

    super::emit(progress, ProgressEvent::SaDone {
        iterations: iteration,
        best_late_jobs: best_eval.late_job_count,
        improved: improved > 0,
    });

    (best, best_eval)
}

fn compute_hot_stations(eval: &SaEvaluation, ctx: &SaContext) -> Vec<usize> {
    let mut hot: HashSet<usize> = HashSet::new();
    for info in &ctx.actions {
        if let Some(end) = eval.end_ticks[info.idx] {
            if info.job_deadline_tick < u64::MAX {
                let end_minutes = end as u64 * ctx.tick_minutes as u64;
                let deadline_minutes = info.job_deadline_tick * ctx.tick_minutes as u64;
                if end_minutes > deadline_minutes {
                    hot.insert(info.station_idx);
                }
            }
        }
    }
    // If no hot stations, use all stations with >1 action as fallback
    if hot.is_empty() {
        for &s_idx in ctx.actions.iter().map(|a| &a.station_idx).collect::<HashSet<_>>().iter() {
            hot.insert(*s_idx);
        }
    }
    hot.into_iter().collect()
}

fn random_swap(
    solution: &SaSolution,
    hot_stations: &[usize],
    rng: &mut StdRng,
    ctx: &SaContext,
) -> Option<(usize, usize)> {
    if hot_stations.is_empty() {
        return None;
    }

    // Try a few times to find a valid swap
    for _ in 0..5 {
        let station_idx = hot_stations[rng.gen_range(0..hot_stations.len())];
        let queue = &solution.station_queues[station_idx];
        if queue.len() < 2 {
            continue;
        }
        let pos = rng.gen_range(0..queue.len() - 1);

        if !violates_precedence(queue[pos], queue[pos + 1], ctx) {
            return Some((station_idx, pos));
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Convert SA solution to action ranks for full forward pass validation
// ---------------------------------------------------------------------------

fn sa_solution_to_ranks(solution: &SaSolution, num_actions: usize) -> Vec<i64> {
    let mut ranks = vec![0i64; num_actions];
    for queue in &solution.station_queues {
        for (pos, &action_idx) in queue.iter().enumerate() {
            if action_idx < num_actions {
                ranks[action_idx] = (10000 - pos as i64) * 100;
            }
        }
    }
    ranks
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/// Run simulated annealing to improve the schedule.
/// Returns improved result or None if SA finds nothing better.
pub fn sa_improve(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    actions: &[Action],
    stats: &ScheduleStats,
    tick_minutes: u32,
    horizon_days: u32,
    _fbi_max_iterations: u32,
    start_date: NaiveDate,
    station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    now_tick: usize,
    time_budget_ms: u64,
    progress: &super::ProgressSender,
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    if stats.late_job_count == 0 || time_budget_ms < 1000 {
        return None;
    }

    // Build SA context
    let ctx = build_sa_context(
        actions, stations, operators, tick_minutes,
        start_date, now_tick, horizon_days, station_blocked_ranges,
    );

    // Extract initial solution from FBI result
    let initial = extract_initial_solution(actions, stations.len());

    // Run SA (70% of budget for SA, 30% for validation)
    let sa_budget = (time_budget_ms as f64 * 0.7) as u64;
    let (best_solution, best_eval) = run_sa(initial, &ctx, sa_budget, 42, progress);

    // Compare with current stats (using SA decode metrics)
    let current_score = (stats.late_job_count, stats.weighted_lateness_minutes);
    let sa_score = (best_eval.late_job_count, best_eval.weighted_lateness_minutes);

    if sa_score >= current_score {
        eprintln!("[SA] no improvement over FBI: SA={} late vs FBI={} late",
            best_eval.late_job_count, stats.late_job_count);
        return None;
    }

    eprintln!("[SA] SA found better: {} late vs FBI {} late, validating with full forward pass...",
        best_eval.late_job_count, stats.late_job_count);

    // Validate: run full forward pass with SA ordering
    let ranks = sa_solution_to_ranks(&best_solution, actions.len());
    let default_weights: [f64; 6] = [1.0; 6];

    let (val_assignments, val_actions, val_stats, val_iters) = run_with_fbi_ordering(
        jobs, stations, operators,
        tick_minutes, horizon_days, 1, // single FBI iteration for validation
        start_date, BackwardOrdering::TierFirst,
        station_groups, station_blocked_ranges, occupied_slots,
        &None, now_tick, &default_weights,
        Some(&ranks),
    );

    let val_score = (val_stats.late_job_count, val_stats.weighted_lateness_minutes);
    eprintln!("[SA] validation result: {} late jobs (SA decode predicted {})",
        val_stats.late_job_count, best_eval.late_job_count);

    if val_score < current_score {
        Some((val_assignments, val_actions, val_stats, val_iters))
    } else {
        eprintln!("[SA] validation did not confirm improvement, keeping FBI result");
        None
    }
}
