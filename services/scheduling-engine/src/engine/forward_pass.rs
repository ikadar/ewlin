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
    /// Setup peremption threshold in ticks. If operator is absent this many consecutive
    /// ticks during setup, setup expires and must be redone.
    pub peremption_ticks: u32,
    pub max_operators: u32,
}

/// A pair of stations an operator can supervise simultaneously, prepared
/// for fast lookup during scheduling. station_pair is sorted (min, max).
/// productivity is aligned: productivity[0] is for station_pair[0],
/// productivity[1] is for station_pair[1].
#[derive(Debug, Clone)]
pub struct PreparedConcurrentGroup {
    pub station_pair: [usize; 2],
    pub productivity: [f64; 2],
}

impl PreparedConcurrentGroup {
    /// Lookup productivity for a specific station within this pair.
    /// Returns None if the station isn't part of the pair.
    pub fn productivity_for(&self, station: usize) -> Option<f64> {
        if self.station_pair[0] == station {
            Some(self.productivity[0])
        } else if self.station_pair[1] == station {
            Some(self.productivity[1])
        } else {
            None
        }
    }
}

/// Translate the operators' string-keyed concurrent groups into the
/// idx-keyed PreparedConcurrentGroup form used by the hot loop.
///
/// Groups whose stations don't all map to known indices (e.g., the
/// snapshot doesn't include those stations) are silently dropped — the
/// validation pass at engine entry already emits warnings for those.
pub fn build_prepared_groups(
    operators: &[crate::model::operator::OperatorInput],
    station_id_to_idx: &std::collections::HashMap<String, usize>,
) -> Vec<Vec<PreparedConcurrentGroup>> {
    operators
        .iter()
        .map(|op| {
            op.concurrent_groups
                .iter()
                .filter_map(|g| {
                    if g.station_ids.len() != 2 {
                        return None;
                    }
                    let a = *station_id_to_idx.get(&g.station_ids[0])?;
                    let b = *station_id_to_idx.get(&g.station_ids[1])?;
                    let pa = *g.effective_productivity.get(&g.station_ids[0])?;
                    let pb = *g.effective_productivity.get(&g.station_ids[1])?;
                    let (pair, prod) = if a < b {
                        ([a, b], [pa, pb])
                    } else {
                        ([b, a], [pb, pa])
                    };
                    Some(PreparedConcurrentGroup {
                        station_pair: pair,
                        productivity: prod,
                    })
                })
                .collect()
        })
        .collect()
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
///
/// The new (Phase 2b) selection model:
/// - **Priority A** (always allowed): operators currently idle (load == 0).
///   They will be assigned solo with productivity = their proficiency.
/// - **Priority B** (run phase only): operators currently on exactly one
///   station, where {their current station, station_idx} forms one of
///   their declared concurrent groups. They will be paired, and
///   productivity for both stations comes from the group definition.
///
/// Setup phase blocks priority B — setup is always solo (no pairing during
/// setup phase, regardless of operator skill).
///
/// **Magnetism / continuity**: `preferred_operators` is the list of op
/// indices the caller wants to keep across ticks (typically the action's
/// `assigned_operators` from the start tick). Within Priority A, preferred
/// ops sort BEFORE non-preferred ops regardless of proficiency — so a
/// once-assigned op is preserved across ticks even if a higher-prof idle
/// op is available. This prevents operator-flipping mid-task. Within
/// Priority B, the same `is_pref` tiebreak applies. See
/// `selection_tests::preferred_operator_beats_higher_proficiency_idle_op`.
///
/// Returns up to `max_operators` operator indices. The caller is
/// responsible for actually assigning them via grid.assign_operator.
pub fn find_operators_for_station(
    grid: &ScheduleGrid,
    t: usize,
    station_idx: usize,
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    preferred_operators: &[usize],
    max_operators: u32,
    is_setup_phase: bool,
) -> Vec<usize> {
    // Cache (op, proficiency) for all qualified ops once. This function
    // is called once per tick per in-progress action — caching avoids
    // re-scanning operator_skills[op] twice (Priority A + Priority B).
    let qualified_ops: Vec<(usize, f64)> = (0..operator_skills.len())
        .filter_map(|op| {
            let prof = operator_skills[op]
                .iter()
                .find(|(s, _)| *s == station_idx)
                .map(|(_, p)| *p)?;
            if prof > 0.0 { Some((op, prof)) } else { None }
        })
        .collect();

    let is_pref = |op_idx: usize| preferred_operators.contains(&op_idx);

    // Priority A — idle solo. Sort by preferred → proficiency desc.
    let mut idle_candidates: Vec<(usize, f64)> = qualified_ops
        .iter()
        .copied()
        .filter(|(op, _)| operator_availability.is_available(*op, t))
        .filter(|(op, _)| grid.operator_is_idle(*op, t))
        .collect();
    idle_candidates.sort_by(|a, b| {
        is_pref(b.0)
            .cmp(&is_pref(a.0))
            .then(b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal))
    });

    let mut result: Vec<usize> = Vec::new();
    for (op, _) in &idle_candidates {
        if result.len() >= max_operators as usize {
            break;
        }
        result.push(*op);
    }

    // Setup is always solo. Skip pairing.
    if is_setup_phase {
        return result;
    }

    // If we already filled max_operators with idle ones, no need to pair.
    if (result.len() as u32) >= max_operators {
        return result;
    }

    // Priority B — pairing with an operator already on one station whose
    // current_station + station_idx forms a declared group. We can drop
    // the `result.contains(&op)` check that was here previously: ops in
    // `result` were sourced from `idle_candidates` (load == 0), and pair
    // candidates require load == 1 — the two sets are disjoint.
    let mut pair_candidates: Vec<usize> = qualified_ops
        .iter()
        .copied()
        .filter(|(op, _)| operator_availability.is_available(*op, t))
        .filter(|(op, _)| grid.operator_load_count(*op, t) == 1)
        .filter_map(|(op, _)| {
            let current = grid.operator_stations_at(op, t);
            let other_station = current[0].or(current[1])?;
            if other_station == station_idx {
                // Already on this station — adding the same station is a no-op.
                return None;
            }
            let pair = if other_station < station_idx {
                [other_station, station_idx]
            } else {
                [station_idx, other_station]
            };
            if operator_groups[op].iter().any(|g| g.station_pair == pair) {
                Some(op)
            } else {
                None
            }
        })
        .collect();
    pair_candidates.sort_by(|&a, &b| is_pref(b).cmp(&is_pref(a)));

    for op in pair_candidates {
        if result.len() >= max_operators as usize {
            break;
        }
        result.push(op);
    }

    result
}

/// Compute the productivity contribution of an operator on a station at a tick.
///
/// - If the operator is on this station alone (load == 1): productivity equals
///   the operator's proficiency on this station.
/// - If the operator is on this station as part of a known pair: productivity
///   comes from the matching PreparedConcurrentGroup.
/// - Otherwise (operator not on station, or load doesn't match any group):
///   returns 0.0.
pub fn productivity_at_tick(
    op: usize,
    station: usize,
    t: usize,
    grid: &ScheduleGrid,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_skills: &[Vec<(usize, f64)>],
) -> f64 {
    let load = grid.operator_stations_at(op, t);
    let count = load.iter().filter(|s| s.is_some()).count();

    let on_station = load[0] == Some(station) || load[1] == Some(station);
    if !on_station {
        return 0.0;
    }

    if count == 1 {
        return operator_skills[op]
            .iter()
            .find(|(s, _)| *s == station)
            .map(|(_, p)| *p)
            .unwrap_or(0.0);
    }

    // count == 2 → look up the matching group.
    let s0 = load[0].unwrap();
    let s1 = load[1].unwrap();
    let pair = if s0 < s1 { [s0, s1] } else { [s1, s0] };

    for g in &operator_groups[op] {
        if g.station_pair == pair {
            return g.productivity_for(station).unwrap_or(0.0);
        }
    }

    // Should not happen: a load of 2 stations on an operator that doesn't
    // have a matching group is an algorithm bug. Panic in debug builds to
    // catch it during dev/test, log unconditionally in release so production
    // telemetry surfaces it instead of silently returning 0 productivity.
    eprintln!(
        "[ALGO BUG] operator {op} has stations {pair:?} at tick {t} but no matching concurrent group; productivity = 0",
    );
    debug_assert!(
        false,
        "operator {op} has stations {pair:?} but no matching group at tick {t}"
    );
    0.0
}

/// Main forward pass: schedule all actions onto the grid.
/// `station_to_group` maps station_idx → Option<(group_idx, max_concurrent)> for group capacity.
/// `operator_groups[op_idx]` is the list of concurrent station pairs that
/// operator can supervise simultaneously (Phase 2b masked time model).
pub fn run_forward_pass(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
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

    let mut main_loop_idle: usize = 0;
    let forward_pass_deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);

    loop {
        // Check if all actions are done
        let total_art: u64 = actions.iter().map(|a| a.art as u64).sum();
        if total_art == 0 {
            break;
        }

        // Time limit: if forward pass exceeds 30 seconds, stop and return what we have
        if std::time::Instant::now() >= forward_pass_deadline {
            break;
        }

        // DYNAMIC GRID: extend if we've reached the end
        if t >= grid.num_ticks {
            grid.grow(grow_ticks);
            operator_availability.extend(grow_ticks);
        }

        // Quick check: skip scoring entirely if no station has capacity at this tick
        let any_station_free = (0..station_attrs.len()).any(|s| grid.is_station_free(s, t));
        if !any_station_free {
            main_loop_idle += 1;
            t += 1;
            continue;
        }

        // Pre-compute per-job remaining ART for job_boost scoring
        let mut job_remaining_art: std::collections::HashMap<String, i64> =
            std::collections::HashMap::new();
        for action in actions.iter() {
            if action.art > 0 {
                *job_remaining_art.entry(action.job_id.clone()).or_insert(0) += action.art as i64;
            }
        }

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

                let attrs = &station_attrs[station_idx];
                let action_setup = actions[action_idx].setup_ticks;
                let is_setup_phase = action_setup > 0;

                // Find operators (no preference for initial assignment)
                let operators = find_operators_for_station(
                    grid,
                    t,
                    station_idx,
                    operator_skills,
                    operator_availability,
                    operator_groups,
                    &[],
                    attrs.max_operators,
                    is_setup_phase,
                );

                // Don't start if no operator can take this station now.
                if grid.num_operators > 0 && operators.is_empty() {
                    continue;
                }

                // Found operators (or no operators needed) -- schedule to completion
                eprintln!("[START] t={} task={} station_idx={}", t, &actions[action_idx].task_id[..8], station_idx);
                let assignment = schedule_action_to_completion(
                    grid,
                    actions,
                    action_idx,
                    t,
                    &operators,
                    station_attrs,
                    operator_skills,
                    operator_availability,
                    operator_groups,
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
                    main_loop_idle = 0; // A task was placed — reset idle counter
                    break; // Re-score at same tick
                }
            }
        }

        if !assigned_something {
            main_loop_idle += 1;
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
    initial_operators: &[usize],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    grow_ticks: usize,
    station_to_actions: &[Vec<usize>],
    horizon_ticks: i64,
    station_to_group: &[Option<(usize, u32)>],
) -> Option<ComputedAssignment> {
    let station_idx = actions[action_idx].station_idx;
    let attrs = &station_attrs[station_idx];

    // Chunk re-setup: if this is chunk 2+ and a different job ran on this station,
    // the calage is broken — restore the original setup time.
    if let Some((chunk_n, _, _)) = &actions[action_idx].chunk_info {
        if *chunk_n > 1 && actions[action_idx].setup_ticks == 0 {
            let job_id = actions[action_idx].job_id.clone();
            let mut needs_re_setup = false;
            if start_t > 0 {
                for check_t in (0..start_t).rev() {
                    if let Some(prev_action_idx) = grid.station_action_at(station_idx, check_t) {
                        if prev_action_idx < actions.len() && actions[prev_action_idx].job_id != job_id {
                            needs_re_setup = true;
                        }
                        break;
                    }
                }
            }
            if needs_re_setup {
                let mut pred_idx = actions[action_idx].predecessor_idx;
                let mut original_setup = 0u32;
                while let Some(p) = pred_idx {
                    if actions[p].setup_ticks > 0 { original_setup = actions[p].setup_ticks; break; }
                    pred_idx = actions[p].predecessor_idx;
                }
                if original_setup > 0 {
                    actions[action_idx].setup_ticks = original_setup;
                    actions[action_idx].art += original_setup;
                }
            }
        }
    }

    let setup_ticks = actions[action_idx].setup_ticks;

    // Resolve station's group for concurrency tracking
    let group_idx = if station_idx < station_to_group.len() {
        station_to_group[station_idx].map(|(g, _)| g)
    } else {
        None
    };

    // Store operator assignments across all ticks. Phase 2b: stores op
    // indices only — attention is derived from operator_stations load
    // count at report time.
    let mut tick_operator_log: Vec<(usize, Vec<usize>)> = Vec::new();

    let mut current_t = start_t;
    let is_degraded = false; // kept for ComputedAssignment struct compatibility
    let mut total_productivity = 0.0;
    let mut ticks_counted = 0u32;
    let mut idle_ticks: u32 = 0; // SPR: consecutive ticks without operator

    actions[action_idx].start_tick = Some(start_t);
    // assigned_operators preserved as (op, attention) for legacy magnetism
    // logic — attention defaults to 1.0 in the new model.
    actions[action_idx].assigned_operators =
        initial_operators.iter().map(|&op| (op, 1.0)).collect();

    let mut work_accumulator: f64 = 0.0;
    let mut stall_ticks_total: u32 = 0;
    let subloop_start = std::time::Instant::now();
    let mut loop_iterations: u64 = 0;
    let mut find_ops_cumulative = std::time::Duration::ZERO;
    let mut grid_ops_cumulative = std::time::Duration::ZERO;

    while actions[action_idx].art > 0 {
        // Ensure grid is large enough
        if current_t >= grid.num_ticks {
            grid.grow(grow_ticks);
            operator_availability.extend(grow_ticks);
        }

        // Check if another task occupies this station at this tick.
        // Skip forward — do NOT reserve the station, just advance.
        if let Some(occupant) = grid.station_action_at(station_idx, current_t) {
            if occupant != action_idx && current_t != start_t {
                current_t += 1;
                continue; // skip tick occupied by another task
            }
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

        loop_iterations += 1;
        if loop_iterations % 1000 == 0 {
            eprintln!("[TICK-{:>6}] task={} iter={} elapsed={:?} stalls={} find_ops={:?} grid_ops={:?}",
                current_t, &actions[action_idx].task_id[..8.min(actions[action_idx].task_id.len())],
                loop_iterations, subloop_start.elapsed(), stall_ticks_total,
                find_ops_cumulative, grid_ops_cumulative);
        }

        let preferred_op_indices: Vec<usize> = actions[action_idx]
            .assigned_operators
            .iter()
            .map(|(op, _)| *op)
            .collect();

        let find_ops_t0 = std::time::Instant::now();
        // Try preferred operators first (continuity / magnetism), then fall
        // back to a fresh selection if none of the preferred ones can take
        // the station this tick (e.g., they became unavailable).
        let mut operators_this_tick = find_operators_for_station(
            grid,
            current_t,
            station_idx,
            operator_skills,
            operator_availability,
            operator_groups,
            &preferred_op_indices,
            attrs.max_operators,
            in_setup,
        );
        if operators_this_tick.is_empty() && !preferred_op_indices.is_empty() {
            operators_this_tick = find_operators_for_station(
                grid,
                current_t,
                station_idx,
                operator_skills,
                operator_availability,
                operator_groups,
                &[],
                attrs.max_operators,
                in_setup,
            );
        }

        find_ops_cumulative += find_ops_t0.elapsed();

        // No operator → stall.
        let no_operator = grid.num_operators > 0 && operators_this_tick.is_empty();
        if no_operator {
            idle_ticks += 1;
            stall_ticks_total += 1;
            grid.assign_station(station_idx, current_t, action_idx);
            if let Some(g) = group_idx {
                grid.increment_group(g, current_t);
            }
            // Peremption: if setup stalls too long, reset setup progress
            if attrs.peremption_ticks > 0
                && idle_ticks >= attrs.peremption_ticks
                && actions[action_idx].eat > 0
                && actions[action_idx].eat < setup_ticks
            {
                actions[action_idx].art += actions[action_idx].eat;
                actions[action_idx].eat = 0;
                idle_ticks = 0;
            }

            // Skip ahead: if no qualified operator is even available (schedule-wise)
            // at this tick, jump to the next tick where any qualified operator is.
            let any_qualified_available = operator_skills.iter().enumerate().any(|(op_idx, skills)| {
                skills.iter().any(|(s_idx, p)| *s_idx == station_idx && *p > 0.0)
                    && operator_availability.is_available(op_idx, current_t)
            });

            if !any_qualified_available {
                let max_skip = 7 * 24 * 60 / tick_minutes as usize;
                let mut skip_to = current_t + 1;
                while skip_to < current_t + max_skip {
                    if skip_to >= grid.num_ticks {
                        grid.grow(grow_ticks);
                        operator_availability.extend(grow_ticks);
                    }
                    let any_avail = operator_skills.iter().enumerate().any(|(op_idx, skills)| {
                        skills.iter().any(|(s_idx, p)| *s_idx == station_idx && *p > 0.0)
                            && operator_availability.is_available(op_idx, skip_to)
                    });
                    if any_avail {
                        break;
                    }
                    grid.assign_station(station_idx, skip_to, action_idx);
                    if let Some(g) = group_idx {
                        grid.increment_group(g, skip_to);
                    }
                    skip_to += 1;
                }
                current_t = skip_to;
            } else {
                current_t += 1;
            }
            continue;
        }

        idle_ticks = 0;

        // Assign station tick
        let grid_t0 = std::time::Instant::now();
        grid.assign_station(station_idx, current_t, action_idx);

        // Increment group active count
        if let Some(g) = group_idx {
            grid.increment_group(g, current_t);
        }

        // Assign operator ticks. Attention recorded in the legacy float
        // bookkeeping is left at 0 in the new model — productivity is
        // derived from operator load count, not attention sum.
        for &op_idx in &operators_this_tick {
            grid.assign_operator(op_idx, current_t, station_idx, 0.0);
        }

        // Compute tick productivity AFTER assignment so the load reflects
        // this tick's pairing decisions.
        let productivity: f64 = operators_this_tick
            .iter()
            .map(|&op| productivity_at_tick(op, station_idx, current_t, grid, operator_groups, operator_skills))
            .sum();

        grid_ops_cumulative += grid_t0.elapsed();

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

    let subloop_elapsed = subloop_start.elapsed();
    let total_ticks = current_t - start_t;
    if subloop_elapsed.as_millis() > 50 || stall_ticks_total > 100 {
        eprintln!("[SUBLOOP] task={} station_idx={} elapsed={:?} total_ticks={} stall_ticks={} start={} end={}",
            &actions[action_idx].task_id, station_idx, subloop_elapsed, total_ticks, stall_ticks_total, start_t, current_t);
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
        grid,
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
///
/// Phase 2b: the log stores op indices only. Attention reported to the
/// frontend is derived from the grid's operator_load_count: 1.0 when
/// solo, 0.5 when paired with another station. The average is computed
/// per contiguous segment.
fn build_operator_assignments(
    tick_operator_log: &[(usize, Vec<usize>)],
    grid: &ScheduleGrid,
    tick_minutes: u32,
    start_date: NaiveDate,
) -> Vec<OperatorAssignment> {
    if tick_operator_log.is_empty() {
        return Vec::new();
    }

    let attention_for = |op_idx: usize, t: usize| -> f64 {
        let load = grid.operator_load_count(op_idx, t);
        if load == 0 {
            0.0
        } else {
            1.0 / load as f64
        }
    };

    // Collect per-operator: sorted list of (tick, attention)
    let mut op_ticks: std::collections::HashMap<usize, Vec<(usize, f64)>> =
        std::collections::HashMap::new();

    for (tick, operators) in tick_operator_log {
        for &op_idx in operators {
            op_ticks
                .entry(op_idx)
                .or_default()
                .push((*tick, attention_for(op_idx, *tick)));
        }
    }

    let mut result: Vec<OperatorAssignment> = Vec::new();

    for (op_idx, mut ticks) in op_ticks {
        ticks.sort_by_key(|(t, _)| *t);

        let mut seg_start = ticks[0].0;
        let mut seg_end = ticks[0].0;
        let mut seg_attn = ticks[0].1;
        let mut seg_count: u32 = 1;

        for i in 1..ticks.len() {
            let (t, attn) = ticks[i];
            if t == seg_end + 1 {
                seg_end = t;
                seg_attn += attn;
                seg_count += 1;
            } else {
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

/// Rollback a partially-scheduled action.
///
/// Phase 2b: tick_operator_log stores plain op indices. We unassign each
/// op from THIS specific station at the logged tick — leaving any other
/// stations the operator might have been on intact (which is the new
/// model's invariant: an operator can be on at most 2 stations at a tick,
/// and rolling back one shouldn't drop the other).
fn rollback_action_with_operators(
    grid: &mut ScheduleGrid,
    actions: &mut [Action],
    action_idx: usize,
    from_t: usize,
    to_t: usize,
    tick_operator_log: &[(usize, Vec<usize>)],
    group_idx: Option<usize>,
) {
    let station_idx = actions[action_idx].station_idx;
    for t in from_t..to_t {
        grid.clear_station(station_idx, t);
        if let Some(g) = group_idx {
            grid.decrement_group(g, t);
        }
    }
    for (tick, operators) in tick_operator_log {
        for &op_idx in operators {
            grid.unassign_operator_from_station(op_idx, *tick, station_idx);
        }
    }
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

#[cfg(test)]
mod selection_tests {
    use super::*;
    use crate::model::operator::OperatingSchedule;
    use chrono::NaiveDate;

    /// Helper: build an availability where all ops are available at all ticks
    /// (uses the default schedule fallback path).
    fn always_available(num_ops: usize, num_ticks: usize) -> OperatorAvailability {
        // Force all-true by giving each op a schedule with one big slot covering all ticks.
        let schedules: Vec<Option<OperatingSchedule>> = (0..num_ops).map(|_| None).collect();
        let mut avail = OperatorAvailability::new(
            num_ops,
            num_ticks,
            15,
            NaiveDate::from_ymd_opt(2026, 4, 9).unwrap(),
            schedules,
        );
        // Override with all-true (the schedule path may say false outside business hours)
        for op in 0..num_ops {
            for t in 0..num_ticks {
                while avail.data.get(op).map_or(0, |v| v.len()) <= t {
                    avail.data.get_mut(op).map(|v| v.push(true));
                }
                if let Some(v) = avail.data.get_mut(op) {
                    v[t] = true;
                }
            }
        }
        avail
    }

    fn make_grid(num_stations: usize, num_ops: usize, num_ticks: usize) -> ScheduleGrid {
        ScheduleGrid::new(num_stations, num_ops, num_ticks, 15)
    }

    #[test]
    fn idle_solo_priority_a_picks_idle_operator() {
        let grid = make_grid(2, 2, 10);
        let avail = always_available(2, 10);
        // Op 0 has skill on station 0, op 1 on station 1.
        let skills = vec![vec![(0, 1.0)], vec![(1, 1.0)]];
        let groups = vec![vec![]; 2];

        let result = find_operators_for_station(
            &grid, 5, 0, &skills, &avail, &groups, &[], 1, false,
        );
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn setup_phase_blocks_pairing() {
        let mut grid = make_grid(2, 1, 10);
        let avail = always_available(1, 10);
        // Single op skilled on both stations, with a group {0, 1}.
        let skills = vec![vec![(0, 1.0), (1, 1.0)]];
        let groups = vec![vec![PreparedConcurrentGroup {
            station_pair: [0, 1],
            productivity: [0.85, 0.9],
        }]];

        // Op is already on station 0.
        grid.assign_operator(0, 5, 0, 0.0);

        // Setup phase: even though pairing would be valid, setup forces solo.
        let result = find_operators_for_station(
            &grid, 5, 1, &skills, &avail, &groups, &[], 1, true,
        );
        assert!(result.is_empty(), "setup must not pair, got {result:?}");
    }

    #[test]
    fn run_phase_pairs_when_group_matches() {
        let mut grid = make_grid(2, 1, 10);
        let avail = always_available(1, 10);
        let skills = vec![vec![(0, 1.0), (1, 1.0)]];
        let groups = vec![vec![PreparedConcurrentGroup {
            station_pair: [0, 1],
            productivity: [0.85, 0.9],
        }]];

        grid.assign_operator(0, 5, 0, 0.0);

        let result = find_operators_for_station(
            &grid, 5, 1, &skills, &avail, &groups, &[], 1, false,
        );
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn run_phase_does_not_pair_when_group_does_not_match() {
        let mut grid = make_grid(3, 1, 10);
        let avail = always_available(1, 10);
        let skills = vec![vec![(0, 1.0), (1, 1.0), (2, 1.0)]];
        // Operator can pair {0, 1} but NOT {0, 2}.
        let groups = vec![vec![PreparedConcurrentGroup {
            station_pair: [0, 1],
            productivity: [0.85, 0.9],
        }]];

        grid.assign_operator(0, 5, 0, 0.0);

        let result = find_operators_for_station(
            &grid, 5, 2, &skills, &avail, &groups, &[], 1, false,
        );
        assert!(result.is_empty(), "no group {{0,2}} → must reject pairing");
    }

    #[test]
    fn operator_without_groups_never_pairs() {
        let mut grid = make_grid(2, 1, 10);
        let avail = always_available(1, 10);
        let skills = vec![vec![(0, 1.0), (1, 1.0)]];
        let groups: Vec<Vec<PreparedConcurrentGroup>> = vec![vec![]]; // Frédéric: no groups

        grid.assign_operator(0, 5, 0, 0.0);

        let result = find_operators_for_station(
            &grid, 5, 1, &skills, &avail, &groups, &[], 1, false,
        );
        assert!(result.is_empty(), "Frédéric never pairs");
    }

    #[test]
    fn idle_priority_beats_pair_priority() {
        let mut grid = make_grid(2, 2, 10);
        let avail = always_available(2, 10);
        // Both ops can do both stations; op 0 has the group, op 1 is idle.
        let skills = vec![vec![(0, 1.0), (1, 1.0)], vec![(0, 1.0), (1, 1.0)]];
        let groups = vec![
            vec![PreparedConcurrentGroup {
                station_pair: [0, 1],
                productivity: [0.85, 0.9],
            }],
            vec![],
        ];

        // Op 0 is on station 0 (could pair with station 1).
        grid.assign_operator(0, 5, 0, 0.0);

        // Asking for an op for station 1: idle op 1 should be preferred over
        // pairing op 0.
        let result = find_operators_for_station(
            &grid, 5, 1, &skills, &avail, &groups, &[], 1, false,
        );
        assert_eq!(result, vec![1]);
    }

    #[test]
    fn productivity_solo_uses_proficiency() {
        let mut grid = make_grid(2, 1, 10);
        let skills = vec![vec![(0, 0.95)]];
        let groups = vec![vec![]];

        grid.assign_operator(0, 5, 0, 0.0);

        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills);
        assert_eq!(p, 0.95);
    }

    #[test]
    fn productivity_paired_uses_group_value() {
        let mut grid = make_grid(2, 1, 10);
        let skills = vec![vec![(0, 1.0), (1, 1.0)]];
        let groups = vec![vec![PreparedConcurrentGroup {
            station_pair: [0, 1],
            productivity: [0.85, 0.92],
        }]];

        grid.assign_operator(0, 5, 0, 0.0);
        grid.assign_operator(0, 5, 1, 0.0);

        // On station 0 in this pairing → 0.85
        let p0 = productivity_at_tick(0, 0, 5, &grid, &groups, &skills);
        assert_eq!(p0, 0.85);

        // On station 1 in this pairing → 0.92
        let p1 = productivity_at_tick(0, 1, 5, &grid, &groups, &skills);
        assert_eq!(p1, 0.92);
    }

    #[test]
    fn productivity_for_station_not_assigned_is_zero() {
        let grid = make_grid(2, 1, 10);
        let skills = vec![vec![(0, 1.0)]];
        let groups = vec![vec![]];

        // Op is idle, not on station 0.
        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills);
        assert_eq!(p, 0.0);
    }

    /// Magnetism regression test (code review MAJOR #3): a preferred
    /// operator must be returned even when a different idle operator has
    /// higher proficiency. The mechanism is the `is_pref` sort key on
    /// idle_candidates: preferred ops sort before unpreferred ones, then
    /// proficiency tiebreaks within each group.
    ///
    /// Without magnetism, schedule_action_to_completion would re-pick a
    /// fresh higher-prof operator at every tick, creating instability
    /// (operators flipping mid-task on the operator Gantt).
    #[test]
    fn preferred_operator_beats_higher_proficiency_idle_op() {
        let grid = make_grid(1, 2, 10);
        let avail = always_available(2, 10);
        // Op 0: prof 1.0 on station 0. Op 1: prof 1.5 on station 0
        // (the "higher proficiency idle op" that would otherwise win).
        let skills = vec![vec![(0, 1.0)], vec![(0, 1.5)]];
        let groups: Vec<Vec<PreparedConcurrentGroup>> = vec![vec![], vec![]];

        // Op 0 is preferred (e.g., it was the initial pick at start_t).
        let result = find_operators_for_station(
            &grid, 5, 0, &skills, &avail, &groups, &[0], 1, false,
        );
        assert_eq!(
            result,
            vec![0],
            "preferred op (0) must beat higher-prof idle op (1) for magnetism"
        );
    }

    /// Verifies the productivity_at_tick "solo branch" fires when an op
    /// is freshly assigned a single station. Locks in the post-assign
    /// state semantics: after assign_operator, load_count == 1 and the
    /// branch returns proficiency.
    #[test]
    fn productivity_solo_after_fresh_assign_returns_proficiency() {
        let mut grid = make_grid(2, 1, 10);
        let skills = vec![vec![(0, 0.95)]];
        let groups = vec![vec![]];

        // Simulate the algorithm flow: assign_operator then immediately
        // ask for productivity at the same tick.
        grid.assign_operator(0, 5, 0, 0.0);
        let load = grid.operator_load_count(0, 5);
        assert_eq!(load, 1, "load must be 1 after a single assign");

        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills);
        assert_eq!(p, 0.95, "solo branch must return proficiency");
    }

    /// Without a preference hint, the higher-proficiency op wins as before.
    #[test]
    fn no_preference_picks_highest_proficiency() {
        let grid = make_grid(1, 2, 10);
        let avail = always_available(2, 10);
        let skills = vec![vec![(0, 1.0)], vec![(0, 1.5)]];
        let groups: Vec<Vec<PreparedConcurrentGroup>> = vec![vec![], vec![]];

        let result = find_operators_for_station(
            &grid, 5, 0, &skills, &avail, &groups, &[], 1, false,
        );
        assert_eq!(result, vec![1], "no preference → highest prof wins");
    }
}
