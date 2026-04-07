use chrono::{Datelike, NaiveDate};

use crate::model::operator::OperatingSchedule;
use crate::model::schedule::{ComputedAssignment, OperatorAssignment};

use super::grid::ScheduleGrid;

/// Station attributes needed during forward pass
pub struct StationAttrs {
    pub attention_full: f64,
    pub attention_run: f64,
    pub max_run_attention: f64,
    pub masked_time_enabled: bool,
    pub attention_masked: f64,
    pub masked_productivity: f64,
    /// Setup peremption threshold in ticks. If operator is absent this many consecutive
    /// ticks during setup, setup expires and must be redone.
    pub peremption_ticks: u32,
}

/// An action to be scheduled (mutable during forward pass)
pub struct Action {
    pub idx: usize,
    pub task_id: String,
    pub job_id: String,
    pub station_idx: usize,
    pub setup_ticks: u32,
    pub run_ticks: u32,
    pub art: u32,  // Action Remaining Time (in ticks)
    pub eat: u32,  // Elapsed Action Time (in ticks)
    pub last: u64, // LAST value in ticks
    pub predecessor_idx: Option<usize>,
    pub predecessor_gap_ticks: u32, // Drying time gap after predecessor (e.g. 4h after printing)
    pub end_tick: Option<usize>,
    pub assigned_operators: Vec<(usize, f64)>, // [(operator_idx, attention)]
    pub start_tick: Option<usize>,
    /// Chunk info: Some((chunk_number, total_chunks, original_task_id)) for pre-split chunks
    pub chunk_info: Option<(u32, u32, String)>,
    /// Deadline priority tier: 0=imperative, 1=important, 2=standard, 3=flexible
    pub deadline_priority: u8,
    /// Job deadline in ticks (for job-level pressure computation)
    pub job_deadline_tick: u64,
    /// Earliest tick at which this action can retry after a LAST safety rollback
    pub earliest_retry_tick: Option<usize>,
    /// Additional predecessor action indices for cross-element / cross-job dependencies.
    /// Each entry is (action_idx, gap_ticks). All must have end_tick + gap <= current tick.
    pub additional_predecessors: Vec<(usize, u32)>,
}

/// Manages operator availability with dynamic extension
pub struct OperatorAvailability {
    data: Vec<Vec<bool>>,
    tick_minutes: u32,
    start_date: NaiveDate,
    schedules: Vec<Option<OperatingSchedule>>,
}

impl OperatorAvailability {
    pub fn new(
        num_operators: usize,
        initial_ticks: usize,
        tick_minutes: u32,
        start_date: NaiveDate,
        schedules: Vec<Option<OperatingSchedule>>,
    ) -> Self {
        let mut avail = Self {
            data: Vec::with_capacity(num_operators),
            tick_minutes,
            start_date,
            schedules,
        };

        // Initialize availability for each operator
        for op_idx in 0..num_operators {
            let op_avail = avail.compute_availability(op_idx, 0, initial_ticks);
            avail.data.push(op_avail);
        }

        avail
    }

    pub fn is_available(&self, op: usize, tick: usize) -> bool {
        if op >= self.data.len() {
            return false;
        }
        if tick >= self.data[op].len() {
            return false;
        }
        self.data[op][tick]
    }

    /// Extend availability arrays for additional ticks
    pub fn extend(&mut self, additional_ticks: usize) {
        let num_operators = self.data.len();
        for op_idx in 0..num_operators {
            let current_len = self.data[op_idx].len();
            let extension = self.compute_availability(op_idx, current_len, additional_ticks);
            self.data[op_idx].extend(extension);
        }
    }

    /// Compute availability for a range of ticks
    fn compute_availability(
        &self,
        op_idx: usize,
        start_tick: usize,
        num_ticks: usize,
    ) -> Vec<bool> {
        let schedule = match self.schedules.get(op_idx) {
            Some(Some(s)) => s,
            _ => {
                // No schedule means always available (default work hours: M-F 8-17)
                return (0..num_ticks)
                    .map(|i| {
                        let tick = start_tick + i;
                        let total_minutes = tick as u64 * self.tick_minutes as u64;
                        let day_minutes = total_minutes % (24 * 60);
                        let days = total_minutes / (24 * 60);
                        let date = self.start_date + chrono::Duration::days(days as i64);
                        let weekday = date.weekday();
                        // Default: Mon-Fri 8:00-17:00
                        matches!(
                            weekday,
                            chrono::Weekday::Mon
                                | chrono::Weekday::Tue
                                | chrono::Weekday::Wed
                                | chrono::Weekday::Thu
                                | chrono::Weekday::Fri
                        ) && day_minutes >= 8 * 60
                            && day_minutes < 17 * 60
                    })
                    .collect();
            }
        };

        (0..num_ticks)
            .map(|i| {
                let tick = start_tick + i;
                let total_minutes = tick as u64 * self.tick_minutes as u64;
                let day_minutes = (total_minutes % (24 * 60)) as u32;
                let days = total_minutes / (24 * 60);
                let date = self.start_date + chrono::Duration::days(days as i64);
                let weekday = date.weekday();

                if let Some(day_sched) = schedule.day_schedule(weekday) {
                    // Check if this tick falls within any slot
                    day_sched.slots.iter().any(|slot| {
                        let slot_start = slot.start_minutes();
                        let slot_end = slot.end_minutes();
                        day_minutes >= slot_start && day_minutes < slot_end
                    })
                } else {
                    false
                }
            })
            .collect()
    }
}

/// Deadline priority tier weights: imperative jobs get 4x urgency, flexible get 0.5x.
/// This ensures imperative jobs approaching their LAST beat flexible jobs past theirs.
const TIER_WEIGHT: [f64; 4] = [4.0, 2.0, 1.0, 0.5];

/// Scored action for priority sorting
struct ScoredAction {
    action_idx: usize,
    score: i64,
}

/// Find operators capable of staffing a station at tick t.
/// Returns Vec<(operator_idx, attention_to_give)> or empty if insufficient.
/// `preferred_operators` enables operator continuity: preferred operators sort first
/// at equal proficiency, reducing context-switching waste.
pub fn find_operators_for_station(
    grid: &ScheduleGrid,
    t: usize,
    station_idx: usize,
    attention_needed: f64,
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &OperatorAvailability,
    preferred_operators: &[(usize, f64)],
) -> Vec<(usize, f64)> {
    // Collect all qualified, available operators with remaining attention
    let mut candidates: Vec<(usize, f64, f64, bool)> = Vec::new(); // (op_idx, proficiency, remaining_attention, is_preferred)

    for (op_idx, skills) in operator_skills.iter().enumerate() {
        // Check if this operator has the skill for this station
        let proficiency = skills
            .iter()
            .find(|(s_idx, _)| *s_idx == station_idx)
            .map(|(_, p)| *p);

        if let Some(prof) = proficiency {
            if prof <= 0.0 {
                continue;
            }
            // Check availability
            if !operator_availability.is_available(op_idx, t) {
                continue;
            }
            // Check remaining attention
            let remaining = grid.operator_remaining_attention(op_idx, t);
            if remaining > 0.001 {
                let is_preferred = preferred_operators.iter().any(|(op, _)| *op == op_idx);
                candidates.push((op_idx, prof, remaining, is_preferred));
            }
        }
    }

    // Sort by: preferred first, then composite score (availability + proficiency)
    const PROFICIENCY_WEIGHT: f64 = 0.5;
    let score = |prof: f64, remaining: f64| -> f64 {
        remaining * (1.0 - PROFICIENCY_WEIGHT) + prof * PROFICIENCY_WEIGHT
    };
    candidates.sort_by(|a, b| {
        b.3.cmp(&a.3)
            .then(score(b.1, b.2).partial_cmp(&score(a.1, a.2)).unwrap_or(std::cmp::Ordering::Equal))
    });

    // Greedily pick operators until attention_needed is met
    let mut result: Vec<(usize, f64)> = Vec::new();
    let mut attention_remaining = attention_needed;

    for (op_idx, _prof, remaining_attn, _pref) in &candidates {
        if attention_remaining <= 0.001 {
            break;
        }
        let give = remaining_attn.min(attention_remaining);
        result.push((*op_idx, give));
        attention_remaining -= give;
    }

    if attention_remaining > 0.001 {
        // Not enough operators to meet attention requirement
        // Return what we have anyway -- degraded mode
        if result.is_empty() {
            return Vec::new();
        }
    }

    result
}

/// Main forward pass: schedule all actions onto the grid.
/// `station_to_group` maps station_idx → Option<(group_idx, max_concurrent)> for group capacity.
pub fn run_forward_pass(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    tick_minutes: u32,
    start_date: NaiveDate,
    station_to_group: &[Option<(usize, u32)>],
) -> Vec<ComputedAssignment> {
    let mut assignments: Vec<ComputedAssignment> = Vec::new();
    let grow_ticks = 7 * 24 * 60 / tick_minutes as usize; // 7 days of ticks

    let mut t: usize = 0;
    let horizon_ticks = grid.num_ticks as i64;

    // Pre-build station-to-pending-actions index for LAST safety check
    let mut station_to_actions: Vec<Vec<usize>> = vec![Vec::new(); station_attrs.len()];
    for (i, action) in actions.iter().enumerate() {
        if action.station_idx < station_to_actions.len() {
            station_to_actions[action.station_idx].push(i);
        }
    }

    loop {
        // Check if all actions are done
        let total_art: u64 = actions.iter().map(|a| a.art as u64).sum();
        if total_art == 0 {
            break;
        }

        // DYNAMIC GRID: extend if we've reached the end
        if t >= grid.num_ticks {
            grid.grow(grow_ticks);
            operator_availability.extend(grow_ticks);
        }

        // Pre-compute per-job remaining ART for job_boost scoring (O(n) per tick)
        let mut job_remaining_art: std::collections::HashMap<String, i64> =
            std::collections::HashMap::new();
        for action in actions.iter() {
            if action.art > 0 {
                *job_remaining_art.entry(action.job_id.clone()).or_insert(0) += action.art as i64;
            }
        }

        // Inner loop: score and assign at current tick
        let mut assigned_something = true;
        while assigned_something {
            assigned_something = false;

            // Find eligible actions at tick t
            let mut scored: Vec<ScoredAction> = Vec::new();

            for i in 0..actions.len() {
                let action = &actions[i];

                // Must have remaining work
                if action.art == 0 {
                    continue;
                }

                // Must not already be in progress (start_tick set but end_tick not yet)
                if action.start_tick.is_some() && action.end_tick.is_none() {
                    continue;
                }

                // Respect LAST safety rollback cooldown
                if let Some(retry_tick) = action.earliest_retry_tick {
                    if t < retry_tick {
                        continue;
                    }
                }

                // Predecessor must be done (end_tick set) and finished by now
                if let Some(pred_idx) = action.predecessor_idx {
                    let gap = actions[i].predecessor_gap_ticks as usize;
                    match actions[pred_idx].end_tick {
                        Some(pred_end) if pred_end + gap <= t => {} // OK (including drying time)
                        _ => continue,                              // Not ready
                    }
                }

                // Cross-element / cross-job dependencies: all additional predecessors
                // must be done AND their end_tick + gap must be <= current tick
                if !action.additional_predecessors.is_empty() {
                    let all_done = action.additional_predecessors.iter().all(|&(pred_idx, gap)| {
                        match actions[pred_idx].end_tick {
                            Some(pred_end) => pred_end + gap as usize <= t,
                            None => false,
                        }
                    });
                    if !all_done { continue; }
                }

                // Station must be free at tick t
                if !grid.is_station_free(action.station_idx, t) {
                    continue;
                }

                // Group concurrency: check if station's group allows another active task
                if action.station_idx < station_to_group.len() {
                    if let Some((group_idx, max_concurrent)) = station_to_group[action.station_idx] {
                        if grid.group_active_count(group_idx, t) >= max_concurrent {
                            continue; // group at capacity
                        }
                    }
                }

                // Compute score using continuous urgency weighted by deadline priority tier
                let slack = action.last as i64 - t as i64 - action.art as i64;
                let raw_urgency: i64 = if slack <= 0 {
                    10000 + (-slack) as i64
                } else {
                    let ratio = 1.0 - (slack as f64 / horizon_ticks as f64);
                    (ratio * 1000.0) as i64
                };

                // Weight urgency by deadline priority tier:
                // imperative(×4) > important(×2) > standard(×1) > flexible(×0.5)
                let tier_w = TIER_WEIGHT[action.deadline_priority.min(3) as usize];
                let weighted_urgency = (raw_urgency as f64 * tier_w) as i64;

                // Job-level pressure: when the entire job is behind schedule,
                // boost all its tasks so they get scheduled sooner
                let job_boost: i64 = if action.job_deadline_tick < u64::MAX {
                    let job_art = job_remaining_art.get(&action.job_id).copied().unwrap_or(0);
                    let job_slack = action.job_deadline_tick as i64 - t as i64 - job_art;
                    if job_slack < 0 {
                        ((-job_slack) as f64 * 50.0 * tier_w) as i64
                    } else {
                        0
                    }
                } else {
                    0
                };

                // Calage bonus: if last action on this station is from same job
                let calage_bonus = compute_calage_bonus(grid, &actions, i, t);

                let score = weighted_urgency + job_boost + calage_bonus;

                scored.push(ScoredAction {
                    action_idx: i,
                    score,
                });
            }

            // Sort by score DESC
            scored.sort_by(|a, b| b.score.cmp(&a.score));

            // Try to assign highest-scoring action
            for candidate in &scored {
                let action_idx = candidate.action_idx;
                let station_idx = actions[action_idx].station_idx;

                // Determine attention needed
                let attrs = &station_attrs[station_idx];
                let attention_needed = attrs.attention_full; // Start with setup attention

                // Find operators (no preference for initial assignment)
                let operators = find_operators_for_station(
                    grid,
                    t,
                    station_idx,
                    attention_needed,
                    operator_skills,
                    operator_availability,
                    &[], // no preferred operators for initial pick
                );

                if operators.is_empty() && grid.num_operators > 0 {
                    // No operators available, try next candidate
                    continue;
                }

                // Found operators (or no operators needed) -- schedule to completion
                let assignment = schedule_action_to_completion(
                    grid,
                    actions,
                    action_idx,
                    t,
                    &operators,
                    station_attrs,
                    operator_skills,
                    operator_availability,
                    tick_minutes,
                    start_date,
                    grow_ticks,
                    &station_to_actions,
                    horizon_ticks,
                    station_to_group,
                );

                if let Some(a) = assignment {
                    assignments.push(a);
                    assigned_something = true;
                    break; // Re-score at same tick
                }
            }
        }

        t += 1;
    }

    assignments
}

/// Schedule an action from start_t to completion.
fn schedule_action_to_completion(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    action_idx: usize,
    start_t: usize,
    initial_operators: &[(usize, f64)],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    tick_minutes: u32,
    start_date: NaiveDate,
    grow_ticks: usize,
    station_to_actions: &[Vec<usize>],
    horizon_ticks: i64,
    station_to_group: &[Option<(usize, u32)>],
) -> Option<ComputedAssignment> {
    let station_idx = actions[action_idx].station_idx;
    let setup_ticks = actions[action_idx].setup_ticks;
    let attrs = &station_attrs[station_idx];

    // Resolve station's group for concurrency tracking
    let group_idx = if station_idx < station_to_group.len() {
        station_to_group[station_idx].map(|(g, _)| g)
    } else {
        None
    };

    // Store operator assignments across all ticks
    let mut tick_operator_log: Vec<(usize, Vec<(usize, f64)>)> = Vec::new();

    let mut current_t = start_t;
    let mut is_degraded = false;
    let mut total_productivity = 0.0;
    let mut ticks_counted = 0u32;
    let mut idle_ticks: u32 = 0; // SPR: consecutive ticks without operator

    actions[action_idx].start_tick = Some(start_t);
    actions[action_idx].assigned_operators = initial_operators.to_vec();

    let mut work_accumulator: f64 = 0.0;

    while actions[action_idx].art > 0 {
        // Ensure grid is large enough
        if current_t >= grid.num_ticks {
            grid.grow(grow_ticks);
            operator_availability.extend(grow_ticks);
        }

        // Check station is still free (should be, we're in the sub-loop)
        if !grid.is_station_free(station_idx, current_t) && current_t != start_t {
            // Station got occupied (shouldn't happen in single-pass, but safety)
            rollback_action_with_operators(grid, actions, action_idx, start_t, current_t, &tick_operator_log, group_idx);
            return None;
        }

        // LAST safety check: DISABLED for now — O(actions²) per tick causes timeout
        // on large instances. TODO: re-enable with a cheaper check (e.g., only at start_t).
        if false && station_idx < station_to_actions.len() {
            let remaining_art = actions[action_idx].art as usize;
            let current_tier_w = TIER_WEIGHT[actions[action_idx].deadline_priority.min(3) as usize];
            let current_slack = actions[action_idx].last as i64 - current_t as i64 - remaining_art as i64;
            let current_raw_urgency: i64 = if current_slack <= 0 {
                10000 + (-current_slack)
            } else {
                ((1.0 - current_slack as f64 / horizon_ticks as f64) * 1000.0) as i64
            };
            let current_weighted = (current_raw_urgency as f64 * current_tier_w) as i64;

            let mut should_yield = false;
            for &other_idx in &station_to_actions[station_idx] {
                if other_idx == action_idx { continue; }
                let other = &actions[other_idx];
                if other.art == 0 || other.start_tick.is_some() { continue; }

                // Would the other action's LAST be exceeded while we're running?
                if other.last <= (current_t + remaining_art) as u64 {
                    let other_tier_w = TIER_WEIGHT[other.deadline_priority.min(3) as usize];
                    let other_slack = other.last as i64 - current_t as i64 - other.art as i64;
                    let other_raw_urgency: i64 = if other_slack <= 0 {
                        10000 + (-other_slack)
                    } else {
                        ((1.0 - other_slack as f64 / horizon_ticks as f64) * 1000.0) as i64
                    };
                    let other_weighted = (other_raw_urgency as f64 * other_tier_w) as i64;

                    if other_weighted > current_weighted {
                        should_yield = true;
                        // Set retry tick to after the other action would finish
                        actions[action_idx].earliest_retry_tick = Some(current_t + other.art as usize);
                        break;
                    }
                }
            }
            if should_yield {
                rollback_action_with_operators(grid, actions, action_idx, start_t, current_t, &tick_operator_log, group_idx);
                return None;
            }
        }

        // Find operators for this tick
        let in_setup = actions[action_idx].eat < setup_ticks;

        let is_masked_run = !in_setup && attrs.masked_time_enabled;

        let attention_needed = if in_setup {
            attrs.attention_full
        } else if is_masked_run {
            attrs.attention_masked
        } else {
            attrs.max_run_attention
        };

        let operators_this_tick = if attention_needed > 0.001 {
            // Prefer operators already assigned to this action (continuity)
            let ops = find_operators_for_station(
                grid,
                current_t,
                station_idx,
                attention_needed,
                operator_skills,
                operator_availability,
                &actions[action_idx].assigned_operators,
            );
            if ops.is_empty() && grid.num_operators > 0 {
                // No operator available at this tick - skip tick (don't decrement ART)
                // BUT keep station reserved: the job is physically on the machine
                idle_ticks += 1;
                grid.assign_station(station_idx, current_t, action_idx);
                if let Some(g) = group_idx {
                    grid.increment_group(g, current_t);
                }
                // SPR: if idle too long, setup expires and must be redone
                if attrs.peremption_ticks > 0
                    && idle_ticks >= attrs.peremption_ticks
                    && actions[action_idx].eat > 0
                    && actions[action_idx].eat < setup_ticks
                {
                    // Setup has expired — must redo from scratch
                    actions[action_idx].art += actions[action_idx].eat;
                    actions[action_idx].eat = 0;
                    idle_ticks = 0;
                    is_degraded = true;
                }
                current_t += 1;
                continue;
            }
            // Masked-time run: machine runs autonomously, one operator max
            if is_masked_run && ops.len() > 1 {
                vec![ops[0]]
            } else {
                ops
            }
        } else {
            Vec::new()
        };

        // Compute productivity for this tick
        let total_attention: f64 = operators_this_tick.iter().map(|(_, a)| a).sum();
        let productivity = if in_setup {
            (total_attention / attrs.attention_full.max(0.001)).min(1.0)
        } else if is_masked_run {
            attrs.masked_productivity
        } else {
            // Speed scales with operators, capped at max_run_attention / attention_run
            (total_attention / attrs.attention_run.max(0.001))
                .min(attrs.max_run_attention / attrs.attention_run.max(0.001))
        };

        if productivity < 0.001 && attention_needed > 0.001 {
            // Can't make progress, skip — but keep station reserved
            idle_ticks += 1;
            grid.assign_station(station_idx, current_t, action_idx);
            if let Some(g) = group_idx {
                grid.increment_group(g, current_t);
            }
            current_t += 1;
            continue;
        }

        let min_attention = if is_masked_run { attrs.attention_masked } else { attrs.attention_run };
        if total_attention < min_attention - 0.001 {
            is_degraded = true;
        }

        // Work is happening — reset SPR idle counter
        idle_ticks = 0;

        // Assign station tick
        grid.assign_station(station_idx, current_t, action_idx);

        // Increment group active count
        if let Some(g) = group_idx {
            grid.increment_group(g, current_t);
        }

        // Assign operator ticks
        for &(op_idx, attention) in &operators_this_tick {
            grid.assign_operator(op_idx, current_t, station_idx, attention);
        }

        tick_operator_log.push((current_t, operators_this_tick));

        // Decrement ART: speed > 1.0 on parallelizable stations (multiple operators)
        work_accumulator += productivity;
        let work_done = work_accumulator.floor() as u32;
        work_accumulator -= work_done as f64;
        actions[action_idx].art = actions[action_idx].art.saturating_sub(work_done);
        actions[action_idx].eat += 1; // wall-clock ticks still +1
        total_productivity += productivity;
        ticks_counted += 1;

        if actions[action_idx].art == 0 {
            break; // Completed
        }

        current_t += 1;
    }

    let end_t = current_t + 1; // end_tick is exclusive (first free tick after)
    actions[action_idx].end_tick = Some(end_t);

    let avg_productivity = if ticks_counted > 0 {
        total_productivity / ticks_counted as f64
    } else {
        1.0
    };

    // Build operator assignments for the result
    let operator_assignments = build_operator_assignments(
        &tick_operator_log,
        tick_minutes,
        start_date,
    );

    let start_minutes = start_t as u64 * tick_minutes as u64;
    let end_minutes = end_t as u64 * tick_minutes as u64;
    let setup_end_minutes = if setup_ticks > 0 {
        Some((start_t as u64 + setup_ticks as u64) * tick_minutes as u64)
    } else {
        None
    };

    Some(ComputedAssignment {
        task_id: actions[action_idx].task_id.clone(),
        station_id: format!("station_idx:{}", station_idx),
        scheduled_start: super::format_minutes(start_minutes, start_date),
        scheduled_end: super::format_minutes(end_minutes, start_date),
        operators: operator_assignments,
        setup_end: setup_end_minutes.map(|m| super::format_minutes(m, start_date)),
        is_degraded,
        effective_productivity: (avg_productivity * 100.0).round() / 100.0,
        is_masked_time: false, // Set in post-processing by compute()
    })
}

/// Build consolidated operator assignments from tick-level log.
/// Detects gaps in operator presence and creates separate assignment segments
/// for each contiguous range, avoiding false continuous ranges when an operator
/// is temporarily absent mid-task.
fn build_operator_assignments(
    tick_operator_log: &[(usize, Vec<(usize, f64)>)],
    tick_minutes: u32,
    start_date: NaiveDate,
) -> Vec<OperatorAssignment> {
    if tick_operator_log.is_empty() {
        return Vec::new();
    }

    // Collect per-operator: sorted list of (tick, attention)
    let mut op_ticks: std::collections::HashMap<usize, Vec<(usize, f64)>> =
        std::collections::HashMap::new();

    for (tick, operators) in tick_operator_log {
        for &(op_idx, attention) in operators {
            op_ticks.entry(op_idx).or_default().push((*tick, attention));
        }
    }

    let mut result: Vec<OperatorAssignment> = Vec::new();

    for (op_idx, mut ticks) in op_ticks {
        ticks.sort_by_key(|(t, _)| *t);

        // Split into contiguous segments (gap = tick not consecutive)
        let mut seg_start = ticks[0].0;
        let mut seg_end = ticks[0].0;
        let mut seg_attn = ticks[0].1;
        let mut seg_count: u32 = 1;

        for i in 1..ticks.len() {
            let (t, attn) = ticks[i];
            if t == seg_end + 1 {
                // Contiguous — extend segment
                seg_end = t;
                seg_attn += attn;
                seg_count += 1;
            } else {
                // Gap detected — emit current segment, start new one
                let from_minutes = seg_start as u64 * tick_minutes as u64;
                let to_minutes = (seg_end + 1) as u64 * tick_minutes as u64;
                let avg_attention = seg_attn / seg_count as f64;
                result.push(OperatorAssignment {
                    operator_id: format!("op_idx:{}", op_idx),
                    from: super::format_minutes(from_minutes, start_date),
                    to: super::format_minutes(to_minutes, start_date),
                    attention: (avg_attention * 100.0).round() / 100.0,
                });
                seg_start = t;
                seg_end = t;
                seg_attn = attn;
                seg_count = 1;
            }
        }

        // Emit final segment
        let from_minutes = seg_start as u64 * tick_minutes as u64;
        let to_minutes = (seg_end + 1) as u64 * tick_minutes as u64;
        let avg_attention = seg_attn / seg_count as f64;
        result.push(OperatorAssignment {
            operator_id: format!("op_idx:{}", op_idx),
            from: super::format_minutes(from_minutes, start_date),
            to: super::format_minutes(to_minutes, start_date),
            attention: (avg_attention * 100.0).round() / 100.0,
        });
    }

    result
}

/// Rollback a partially-scheduled action, clearing station, operator attention, and group counts.
fn rollback_action_with_operators(
    grid: &mut ScheduleGrid,
    actions: &mut [Action],
    action_idx: usize,
    from_t: usize,
    to_t: usize,
    tick_operator_log: &[(usize, Vec<(usize, f64)>)],
    group_idx: Option<usize>,
) {
    let station_idx = actions[action_idx].station_idx;
    for t in from_t..to_t {
        grid.clear_station(station_idx, t);
        if let Some(g) = group_idx {
            grid.decrement_group(g, t);
        }
    }
    // Clear operator attention that was assigned during this action
    for (tick, operators) in tick_operator_log {
        for &(op_idx, _attention) in operators {
            grid.clear_operator(op_idx, *tick);
        }
    }
    // Reset action state
    let total = actions[action_idx].setup_ticks + actions[action_idx].run_ticks;
    actions[action_idx].art = total;
    actions[action_idx].eat = 0;
    actions[action_idx].start_tick = None;
    actions[action_idx].end_tick = None;
    actions[action_idx].assigned_operators.clear();
}

/// Compute calage bonus: +100 if last action on this station belongs to same job.
fn compute_calage_bonus(
    grid: &ScheduleGrid,
    actions: &[Action],
    candidate_idx: usize,
    t: usize,
) -> i64 {
    let station_idx = actions[candidate_idx].station_idx;
    let job_id = &actions[candidate_idx].job_id;

    // Look backward from t to find the last action on this station
    if t == 0 {
        return 0;
    }
    for check_t in (0..t).rev() {
        if let Some(prev_action_idx) = grid.station_action_at(station_idx, check_t) {
            if prev_action_idx < actions.len() && actions[prev_action_idx].job_id == *job_id {
                return 100;
            }
            return 0; // Found a different job
        }
    }
    0
}
