use chrono::{Datelike, NaiveDate};

use crate::model::operator::OperatingSchedule;
use crate::model::schedule::{ComputedAssignment, OperatorAssignment};

use super::grid::ScheduleGrid;

/// Station attributes needed during forward pass
pub struct StationAttrs {
    pub attention_full: f64,
    pub attention_run: f64,
    pub masked_time_enabled: bool,
    pub masked_productivity: f64,
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

/// Scored action for priority sorting
struct ScoredAction {
    action_idx: usize,
    score: i64,
}

/// Find operators capable of staffing a station at tick t.
/// Returns Vec<(operator_idx, attention_to_give)> or empty if insufficient.
fn find_operators_for_station(
    grid: &ScheduleGrid,
    t: usize,
    station_idx: usize,
    attention_needed: f64,
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &OperatorAvailability,
) -> Vec<(usize, f64)> {
    // Collect all qualified, available operators with remaining attention
    let mut candidates: Vec<(usize, f64, f64)> = Vec::new(); // (op_idx, proficiency, remaining_attention)

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
                candidates.push((op_idx, prof, remaining));
            }
        }
    }

    // Sort by proficiency DESC
    candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Greedily pick operators until attention_needed is met
    let mut result: Vec<(usize, f64)> = Vec::new();
    let mut attention_remaining = attention_needed;

    for (op_idx, _prof, remaining_attn) in &candidates {
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
pub fn run_forward_pass(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    tick_minutes: u32,
    start_date: NaiveDate,
) -> Vec<ComputedAssignment> {
    let mut assignments: Vec<ComputedAssignment> = Vec::new();
    let grow_ticks = 7 * 24 * 60 / tick_minutes as usize; // 7 days of ticks

    let mut t: usize = 0;
    let horizon_ticks = grid.num_ticks as i64;

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

                // Predecessor must be done (end_tick set) and finished by now
                if let Some(pred_idx) = action.predecessor_idx {
                    let gap = actions[i].predecessor_gap_ticks as usize;
                    match actions[pred_idx].end_tick {
                        Some(pred_end) if pred_end + gap <= t => {} // OK (including drying time)
                        _ => continue,                              // Not ready
                    }
                }

                // Station must be free at tick t
                if !grid.is_station_free(action.station_idx, t) {
                    continue;
                }

                // Compute score using continuous urgency
                let slack = action.last as i64 - t as i64 - action.art as i64;
                let urgency: i64 = if slack <= 0 {
                    10000 + (-slack) as i64
                } else {
                    let ratio = 1.0 - (slack as f64 / horizon_ticks as f64);
                    (ratio * 1000.0) as i64
                };

                // Calage bonus: if last action on this station is from same job
                let calage_bonus = compute_calage_bonus(grid, &actions, i, t);

                let score = urgency + calage_bonus;

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

                // Find operators
                let operators = find_operators_for_station(
                    grid,
                    t,
                    station_idx,
                    attention_needed,
                    operator_skills,
                    operator_availability,
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
) -> Option<ComputedAssignment> {
    let station_idx = actions[action_idx].station_idx;
    let setup_ticks = actions[action_idx].setup_ticks;
    let attrs = &station_attrs[station_idx];

    // Store operator assignments across all ticks
    let mut tick_operator_log: Vec<(usize, Vec<(usize, f64)>)> = Vec::new();

    let mut current_t = start_t;
    let mut is_degraded = false;
    let mut total_productivity = 0.0;
    let mut ticks_counted = 0u32;

    actions[action_idx].start_tick = Some(start_t);
    actions[action_idx].assigned_operators = initial_operators.to_vec();

    while actions[action_idx].art > 0 {
        // Ensure grid is large enough
        if current_t >= grid.num_ticks {
            grid.grow(grow_ticks);
            operator_availability.extend(grow_ticks);
        }

        // Check station is still free (should be, we're in the sub-loop)
        if !grid.is_station_free(station_idx, current_t) && current_t != start_t {
            // Station got occupied (shouldn't happen in single-pass, but safety)
            // Rollback
            rollback_action(grid, actions, action_idx, start_t, current_t);
            return None;
        }

        // Find operators for this tick
        let in_setup = actions[action_idx].eat < setup_ticks;
        let attention_needed = if in_setup {
            attrs.attention_full
        } else if attrs.masked_time_enabled {
            0.0 // Masked time: no operator needed during run
        } else {
            attrs.attention_run
        };

        let operators_this_tick = if attention_needed > 0.001 {
            let ops = find_operators_for_station(
                grid,
                current_t,
                station_idx,
                attention_needed,
                operator_skills,
                operator_availability,
            );
            if ops.is_empty() && grid.num_operators > 0 {
                // No operator available at this tick - skip tick (don't decrement ART)
                current_t += 1;
                continue;
            }
            ops
        } else {
            Vec::new()
        };

        // Compute productivity for this tick
        let total_attention: f64 = operators_this_tick.iter().map(|(_, a)| a).sum();
        let productivity = if in_setup {
            (total_attention / attrs.attention_full.max(0.001)).min(1.0)
        } else if attrs.masked_time_enabled {
            attrs.masked_productivity
        } else {
            (total_attention / attrs.attention_run.max(0.001)).min(1.0)
        };

        if productivity < 0.001 && attention_needed > 0.001 {
            // Can't make progress, skip
            current_t += 1;
            continue;
        }

        if productivity < 0.99 {
            is_degraded = true;
        }

        // Assign station tick
        grid.assign_station(station_idx, current_t, action_idx);

        // Assign operator ticks
        for &(op_idx, attention) in &operators_this_tick {
            grid.assign_operator(op_idx, current_t, station_idx, attention);
        }

        tick_operator_log.push((current_t, operators_this_tick));

        // Decrement ART (1 tick of work done if productivity > 0)
        actions[action_idx].art -= 1;
        actions[action_idx].eat += 1;
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
fn build_operator_assignments(
    tick_operator_log: &[(usize, Vec<(usize, f64)>)],
    tick_minutes: u32,
    start_date: NaiveDate,
) -> Vec<OperatorAssignment> {
    if tick_operator_log.is_empty() {
        return Vec::new();
    }

    // Collect per-operator: find first and last tick, average attention
    let mut op_ranges: std::collections::HashMap<usize, (usize, usize, f64, u32)> =
        std::collections::HashMap::new();

    for (tick, operators) in tick_operator_log {
        for &(op_idx, attention) in operators {
            let entry = op_ranges.entry(op_idx).or_insert((*tick, *tick, 0.0, 0));
            if *tick < entry.0 {
                entry.0 = *tick;
            }
            if *tick > entry.1 {
                entry.1 = *tick;
            }
            entry.2 += attention;
            entry.3 += 1;
        }
    }

    op_ranges
        .into_iter()
        .map(|(op_idx, (first_tick, last_tick, total_attn, count))| {
            let from_minutes = first_tick as u64 * tick_minutes as u64;
            let to_minutes = (last_tick + 1) as u64 * tick_minutes as u64;
            let avg_attention = total_attn / count as f64;

            OperatorAssignment {
                operator_id: format!("op_idx:{}", op_idx),
                from: super::format_minutes(from_minutes, start_date),
                to: super::format_minutes(to_minutes, start_date),
                attention: (avg_attention * 100.0).round() / 100.0,
            }
        })
        .collect()
}

/// Rollback a partially-scheduled action
fn rollback_action(
    grid: &mut ScheduleGrid,
    actions: &mut [Action],
    action_idx: usize,
    from_t: usize,
    to_t: usize,
) {
    let station_idx = actions[action_idx].station_idx;
    for t in from_t..to_t {
        grid.clear_station(station_idx, t);
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
