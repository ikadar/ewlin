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
    /// Operators assigned at start_t. Used by find_operators_for_station
    /// as the magnetism hint (preferred_operators) on subsequent ticks.
    pub assigned_operators: Vec<usize>,
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
    // ============================================================
    // Persistent per-action state for the tick-major forward pass.
    // These were previously local variables in schedule_action_to_completion;
    // moving them to the struct lets the main loop run actions in lockstep
    // tick-by-tick, which is required to compute productivity correctly
    // when two actions are paired on the same operator at the same tick.
    // ============================================================
    /// Fractional work accumulated within the current "almost-done" tick.
    /// Each tick adds productivity; when the accumulator reaches >= 1, art
    /// is decremented by floor(accumulator).
    pub work_accumulator: f64,
    /// Consecutive idle ticks (used by the setup peremption rule).
    pub idle_ticks: u32,
    /// Per-tick log of operators assigned to this action's station.
    /// Drives build_operator_assignments and rollback.
    pub tick_operator_log: Vec<(usize, Vec<usize>)>,
    /// Sum of per-tick productivity contributions, used for the
    /// effective_productivity field reported in ComputedAssignment.
    pub total_productivity: f64,
    /// Number of ticks where this action accumulated work (denominator
    /// for the average productivity reported in ComputedAssignment).
    pub ticks_counted: u32,
    /// True if the user has pinned this task. Pre-placed before the
    /// tick-major loop with start_tick/end_tick set and art=0, so the
    /// scoring loop skips it and successors see its fixed end_tick.
    pub is_pinned: bool,
    /// The tick at which the pinned action must start (only meaningful
    /// if `is_pinned`). Used by `pre_place_pinned_actions` to set
    /// start_tick / end_tick before the main loop runs.
    pub pinned_start_tick: Option<usize>,
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
    find_operators_for_station_cached(
        grid, t, station_idx, operator_skills, operator_availability,
        operator_groups, preferred_operators, max_operators, is_setup_phase, None,
    )
}

/// Inner implementation that accepts an optional pre-computed qualified_ops cache.
/// The hot path in run_forward_pass passes `Some(&station_qualified_ops[station_idx])`.
fn find_operators_for_station_cached(
    grid: &ScheduleGrid,
    t: usize,
    station_idx: usize,
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    preferred_operators: &[usize],
    max_operators: u32,
    is_setup_phase: bool,
    cached_qualified_ops: Option<&[(usize, f64)]>,
) -> Vec<usize> {
    let owned: Vec<(usize, f64)>;
    let qualified_ops: &[(usize, f64)] = match cached_qualified_ops {
        Some(cached) => cached,
        None => {
            owned = (0..operator_skills.len())
                .filter_map(|op| {
                    let prof = operator_skills[op]
                        .iter()
                        .find(|(s, _)| *s == station_idx)
                        .map(|(_, p)| *p)?;
                    if prof > 0.0 { Some((op, prof)) } else { None }
                })
                .collect();
            &owned
        }
    };

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

/// Outcome of a per-tick assignment attempt for a single action.
enum AssignOutcome {
    /// Operators were assigned on the grid for this action at this tick.
    Assigned(Vec<usize>),
    /// No operators available — the action stalls (station reserved but no work).
    Stalled,
    /// No qualified operator on schedule for the foreseeable future — caller
    /// should advance current_t. The included tick is the new earliest tick
    /// to retry.
    SkipTo(usize),
    /// Another action occupies this station at this tick — the calling
    /// action should not advance work but should re-try at next tick.
    StationOccupied,
}

/// Main forward pass: schedule all actions onto the grid.
/// `station_to_group` maps station_idx → Option<(group_idx, max_concurrent)> for group capacity.
/// `operator_groups[op_idx]` is the list of concurrent station pairs that
/// operator can supervise simultaneously (Phase 2b masked time model).
///
/// **Tick-major scheduling (CRITICAL refactor)**: the loop iterates over
/// ticks, and for each tick processes all active actions in two phases:
///
/// 1. **Phase 1 — assignment**: for every active action, compute which
///    operators can take the station this tick and write the assignment
///    to the grid. This happens for ALL actions before any productivity
///    is computed. As a result, when two actions form a pair on the same
///    operator, both stations end up on the operator's slots BEFORE
///    `productivity_at_tick` is called for either.
///
/// 2. **Phase 2 — productivity & advance**: for every action assigned in
///    Phase 1, read productivity from the now-final grid state for tick
///    t and advance the action's `work_accumulator`. Mark done if the
///    accumulated work covers the action's `art`.
///
/// The previous monolithic `schedule_action_to_completion` ran one action
/// from start to finish before processing the next, which caused a
/// productivity bug: the first paired action saw the operator as solo
/// because the second hadn't been assigned yet. The tick-major split fixes
/// that.
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

    // Pre-place user-pinned actions before the main scheduling loop. They
    // become "already done" (art=0, end_tick set) so the scoring loop skips
    // them and successors see their fixed end_tick when checking precedence.
    // The grid is marked occupied for the pinned interval so other actions
    // don't try to use the same station slot.
    pre_place_pinned_actions(grid, actions, grow_ticks, &mut assignments, tick_minutes, start_date);

    let mut t: usize = 0;

    // Pre-build station-to-pending-actions index for LAST safety check
    let mut station_to_actions: Vec<Vec<usize>> = vec![Vec::new(); station_attrs.len()];
    for (i, action) in actions.iter().enumerate() {
        if action.station_idx < station_to_actions.len() {
            station_to_actions[action.station_idx].push(i);
        }
    }
    // station_to_actions silences unused-warning if LAST safety check stays disabled
    let _ = &station_to_actions;

    // Per-action minimum-retry tick (used when an action stalls due to no
    // qualified operator at all — jump ahead instead of polling each tick).
    let mut earliest_retry: Vec<usize> = vec![0; actions.len()];

    // Pre-compute: which stations have at least ONE operator with a non-zero
    // skill on them? Actions on stations without any qualified operator can
    // NEVER be scheduled — mark them impossible immediately so the loop
    // doesn't waste time on the SkipTo dance forever.
    let mut station_has_qualified_op: Vec<bool> = vec![false; station_attrs.len()];
    for skills in operator_skills.iter() {
        for &(s_idx, prof) in skills.iter() {
            if prof > 0.0 && s_idx < station_has_qualified_op.len() {
                station_has_qualified_op[s_idx] = true;
            }
        }
    }
    // Mark unscheduleable actions: zero out their art so they're filtered
    // by the main loop's `total_art == 0` and the `art > 0` candidate filter.
    // Their assignment is omitted; the unplaced-tasks warning at the end
    // of compute() reports them.
    if grid.num_operators > 0 {
        let mut impossible_count = 0;
        for action in actions.iter_mut() {
            if action.station_idx < station_has_qualified_op.len()
                && !station_has_qualified_op[action.station_idx]
            {
                action.art = 0;
                impossible_count += 1;
            }
        }
        if impossible_count > 0 {
            eprintln!(
                "[FORWARD-PASS] {} actions are unschedulable (no qualified operator on their station)",
                impossible_count
            );
        }
    }

    // Cache: last completed action per station, used by compute_calage_bonus
    // to avoid the previous O(t) backward grid scan. Updated when an action
    // is emitted as done.
    let mut last_action_per_station: Vec<Option<usize>> = vec![None; station_attrs.len()];

    // Hard cap on the outer tick to prevent runaway loops. The previous
    // SkipTo path could push t to absurd values (millions of ticks) when
    // chasing impossible actions; the impossibility filter above should
    // catch those, but the cap is a defensive guard.
    let max_outer_t: usize = 100_000;

    let forward_pass_deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);

    let horizon_ticks = grid.num_ticks as i64;

    // Pre-compute per-job remaining ART ONCE, then update incrementally
    // when actions complete. Previously rebuilt every tick = O(A) × O(T).
    let mut job_remaining_art: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    for action in actions.iter() {
        if action.art > 0 {
            *job_remaining_art.entry(action.job_id.clone()).or_insert(0) += action.art as i64;
        }
    }

    // Pre-compute per-station qualified operators ONCE (avoids O(O×S) per
    // find_operators_for_station call). Index: station_idx → Vec<(op_idx, proficiency)>.
    let mut station_qualified_ops: Vec<Vec<(usize, f64)>> = vec![Vec::new(); station_attrs.len()];
    for (op_idx, skills) in operator_skills.iter().enumerate() {
        for &(s_idx, prof) in skills {
            if prof > 0.0 && s_idx < station_qualified_ops.len() {
                station_qualified_ops[s_idx].push((op_idx, prof));
            }
        }
    }

    loop {
        // Hard cap on outer tick — defensive guard against runaway loops
        if t >= max_outer_t {
            eprintln!("[FORWARD-PASS] hit max_outer_t={}, exiting", max_outer_t);
            break;
        }

        // Check if all actions are done (use pre-computed job_remaining_art sum)
        let total_art: i64 = job_remaining_art.values().sum();
        if total_art <= 0 {
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

        // ============================================================
        // Score actions eligible TO START at this tick (predecessors
        // satisfied, station free, group not full, retry cooldown OK).
        // ============================================================
        let mut scored: Vec<ScoredAction> = Vec::new();
        for i in 0..actions.len() {
            let action = &actions[i];

            if action.art == 0 { continue; }
            if action.start_tick.is_some() { continue; }  // already started
            if t < earliest_retry[i] { continue; }
            if let Some(retry_tick) = action.earliest_retry_tick {
                if t < retry_tick { continue; }
            }
            if let Some(pred_idx) = action.predecessor_idx {
                let gap = actions[i].predecessor_gap_ticks as usize;
                match actions[pred_idx].end_tick {
                    Some(pred_end) if pred_end + gap <= t => {}
                    _ => continue,
                }
            }
            if !action.additional_predecessors.is_empty() {
                let all_done = action.additional_predecessors.iter().all(|&(pred_idx, gap)| {
                    match actions[pred_idx].end_tick {
                        Some(pred_end) => pred_end + gap as usize <= t,
                        None => false,
                    }
                });
                if !all_done { continue; }
            }
            if !grid.is_station_free(action.station_idx, t) { continue; }
            if action.station_idx < station_to_group.len() {
                if let Some((group_idx, max_concurrent)) = station_to_group[action.station_idx] {
                    if grid.group_active_count(group_idx, t) >= max_concurrent {
                        continue;
                    }
                }
            }

            let slack = action.last as i64 - t as i64 - action.art as i64;
            let raw_urgency: i64 = if slack <= 0 {
                10000 + (-slack) as i64
            } else {
                let ratio = 1.0 - (slack as f64 / horizon_ticks as f64);
                (ratio * 1000.0) as i64
            };
            let tier_w = TIER_WEIGHT[action.deadline_priority.min(3) as usize];
            let weighted_urgency = (raw_urgency as f64 * tier_w) as i64;

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

            let calage_bonus = compute_calage_bonus(&last_action_per_station, &actions, i);
            let score = weighted_urgency + job_boost + calage_bonus;

            scored.push(ScoredAction { action_idx: i, score });
        }
        scored.sort_by(|a, b| b.score.cmp(&a.score));

        // ============================================================
        // Build the candidate list for this tick:
        //   1) Already-active actions (start_tick set, end_tick not) —
        //      these are continuing across ticks. They are processed
        //      first (in start-tick order) so their continuity wins.
        //   2) Newly-eligible actions in score order — trying to START.
        //      Their start_tick is set ONLY IF assignment in Phase 1
        //      succeeds; a stall does not "start" the action.
        // ============================================================
        let mut already_active: Vec<usize> = (0..actions.len())
            .filter(|&i| {
                let a = &actions[i];
                a.start_tick.is_some() && a.end_tick.is_none() && a.art > 0
            })
            .collect();
        already_active.sort_by_key(|&i| actions[i].start_tick.unwrap_or(usize::MAX));

        // ============================================================
        // PHASE 1A — preferred-operator preservation pass.
        //
        // For each already-active action, if the operator who was working
        // it on previous ticks (action.assigned_operators) is currently
        // available AND idle, lock that operator onto the action BEFORE
        // any other action gets a chance to grab them.
        //
        // Without this pass, two parallel long tasks competing for the
        // same operator pool would alternate operators every tick at
        // shift boundaries: e.g. when Halim's shift ends at 12:00, both
        // TEST-PAIR-A (preferred Ludovic) and TEST-PAIR-B (preferred
        // Halim, now unavailable) would race for Ludovic. The first task
        // processed wins for one tick, the second wins the next, and the
        // operator-view schedule shows a 15-minute "blip" of Ludovic on
        // TEST-PAIR-B that's instantly reverted. With this pass,
        // TEST-PAIR-A's preference is enforced HARD: Ludovic is locked
        // to it before TEST-PAIR-B's processing even starts, and
        // TEST-PAIR-B simply stalls (cleanly) until a fresh operator
        // appears (e.g. Christophe at 13:00). This is what the user
        // intuitively expects from "magnetism" — continuity of operator
        // assignment across ticks, not just a soft sort tiebreaker.
        // ============================================================
        let mut handled_in_phase_1a: std::collections::HashSet<usize> =
            std::collections::HashSet::new();
        let mut tick_outcomes: Vec<(usize, AssignOutcome)> = Vec::with_capacity(
            already_active.len() + scored.len(),
        );

        for &action_idx in &already_active {
            // The action's "preferred ops" come from its most recent
            // successful assignment. If empty AND the action is a chunk
            // 2+ of a longer task, inherit from the previous chunk's
            // assigned_operators — that's how the magnetism survives
            // chunk boundaries (without this, every chunk transition
            // resets the preferred set and the next-tick pre-pass falls
            // through to Phase 1B, allowing competing tasks to grab the
            // op back for one tick before the chunk reclaims them).
            let mut preferred: Vec<usize> = actions[action_idx].assigned_operators.clone();
            if preferred.is_empty() {
                if let Some((chunk_n, _, _)) = &actions[action_idx].chunk_info {
                    if *chunk_n > 1 {
                        if let Some(pred_idx) = actions[action_idx].predecessor_idx {
                            if pred_idx < actions.len() {
                                preferred = actions[pred_idx].assigned_operators.clone();
                            }
                        }
                    }
                }
            }
            if preferred.is_empty() {
                continue;
            }
            // ALL preferred ops must be both available AND idle (load 0)
            // at this tick. Partial-availability falls through to the
            // normal phase, which can pick replacements.
            let all_locked_in = preferred.iter().all(|&op| {
                operator_availability.is_available(op, t)
                    && grid.operator_load_count(op, t) == 0
            });
            if !all_locked_in {
                continue;
            }
            // Run the normal assignment path, which uses preferred_op_indices
            // (= action.assigned_operators) as its first-pass hint. Since the
            // ops are locked-in idle, find_operators_for_station will return
            // exactly them, and the assignment commits.
            let outcome = assign_action_at_tick(
                grid,
                actions,
                action_idx,
                t,
                station_attrs,
                operator_skills,
                operator_availability,
                operator_groups,
                station_to_group,
                tick_minutes,
                grow_ticks,
            );
            if matches!(outcome, AssignOutcome::Assigned(_)) {
                handled_in_phase_1a.insert(action_idx);
                tick_outcomes.push((action_idx, outcome));
            }
            // If the assign call somehow didn't take (Stalled / SkipTo),
            // do NOT add it to handled — let Phase 1B retry it.
        }

        // ============================================================
        // PHASE 1A.5 — predecessor magnetism for newborn chunks.
        //
        // A chunk K of a long task becomes eligible the very tick chunk
        // K-1 ends. At that exact tick, the operator who finished K-1
        // is idle (load = 0) for one tick before the engine re-assigns
        // them. Without intervention, ANOTHER stalled task that's also
        // looking for an operator at this tick can grab them — exactly
        // the "Ludovic borrowed for one tick to finish a stranded TEST-
        // PAIR-B chunk before resuming his own TEST-PAIR-A chunk 2"
        // pathology that produces 15-minute cosmetic flips in the
        // operator-view schedule.
        //
        // Phase 1A.5 enforces the natural successor relationship: when
        // a brand-new chunk K is processed at the tick its predecessor
        // ended, lock in the predecessor's last operator(s) BEFORE any
        // other action gets a turn. This is the chunk-boundary
        // equivalent of Phase 1A's tick-boundary lock-in.
        // ============================================================
        for c in &scored {
            let action_idx = c.action_idx;
            // Only consider chunks (chunk_n > 1 means there's a real
            // predecessor inside the same task).
            let chunk_n = match &actions[action_idx].chunk_info {
                Some((n, _, _)) if *n > 1 => *n,
                _ => continue,
            };
            let _ = chunk_n;
            let pred_idx = match actions[action_idx].predecessor_idx {
                Some(p) if p < actions.len() => p,
                _ => continue,
            };
            // Predecessor must have just ended at-or-before this tick.
            // (If it ended earlier, the operator has likely moved on
            // already, so the magnetism is no longer "natural".)
            let pred_ended_recently = match actions[pred_idx].end_tick {
                Some(end_t) => end_t == t,
                None => false,
            };
            if !pred_ended_recently {
                continue;
            }
            let preferred: Vec<usize> = actions[pred_idx].assigned_operators.clone();
            if preferred.is_empty() {
                continue;
            }
            let all_locked_in = preferred.iter().all(|&op| {
                operator_availability.is_available(op, t)
                    && grid.operator_load_count(op, t) == 0
            });
            if !all_locked_in {
                continue;
            }
            // Seed assigned_operators so assign_action_at_tick uses them
            // as the preferred set (it copies from the action's field).
            actions[action_idx].assigned_operators = preferred.clone();
            // Reset per-action accumulators for the brand-new chunk
            // (mirrors Phase 1B's "was_new" path).
            actions[action_idx].work_accumulator = 0.0;
            actions[action_idx].idle_ticks = 0;
            actions[action_idx].tick_operator_log.clear();
            actions[action_idx].total_productivity = 0.0;
            actions[action_idx].ticks_counted = 0;
            apply_chunk_re_setup(actions, action_idx, t, grid);
            let outcome = assign_action_at_tick(
                grid,
                actions,
                action_idx,
                t,
                station_attrs,
                operator_skills,
                operator_availability,
                operator_groups,
                station_to_group,
                tick_minutes,
                grow_ticks,
            );
            if let AssignOutcome::Assigned(_) = &outcome {
                actions[action_idx].start_tick = Some(t);
                handled_in_phase_1a.insert(action_idx);
                tick_outcomes.push((action_idx, outcome));
            }
        }

        let mut candidates: Vec<usize> = already_active
            .into_iter()
            .filter(|i| !handled_in_phase_1a.contains(i))
            .collect();
        for c in &scored {
            if !handled_in_phase_1a.contains(&c.action_idx) {
                candidates.push(c.action_idx);
            }
        }

        // ============================================================
        // PHASE 1B — normal assignment for the remaining candidates.
        // ============================================================
        for action_idx in candidates {
            let was_new = actions[action_idx].start_tick.is_none();
            if was_new {
                // Reset per-action accumulators (chunked / replanned actions
                // might carry stale values from a previous attempt).
                actions[action_idx].work_accumulator = 0.0;
                actions[action_idx].idle_ticks = 0;
                actions[action_idx].tick_operator_log.clear();
                actions[action_idx].total_productivity = 0.0;
                actions[action_idx].ticks_counted = 0;
                // Apply chunk re-setup BEFORE assignment so setup_ticks
                // reflects the corrected value during this tick's logic.
                apply_chunk_re_setup(actions, action_idx, t, grid);
            }
            let outcome = assign_action_at_tick(
                grid,
                actions,
                action_idx,
                t,
                station_attrs,
                operator_skills,
                operator_availability,
                operator_groups,
                station_to_group,
                tick_minutes,
                grow_ticks,
            );
            // Only mark new actions as started when assignment SUCCEEDED.
            // A stall keeps the action eligible for retry next tick.
            if was_new {
                if let AssignOutcome::Assigned(_) = &outcome {
                    actions[action_idx].start_tick = Some(t);
                }
            }
            tick_outcomes.push((action_idx, outcome));
        }

        // ============================================================
        // PHASE 2 — productivity & advance.
        // For each action that got assigned (Stalled/SkipTo do not advance
        // work), read productivity from the now-final grid state and
        // update work_accumulator. Mark done if art reaches 0.
        // ============================================================
        let mut newly_done: Vec<usize> = Vec::new();
        // Earliest tick at which ANY skipped action wants to retry. The
        // outer loop jumps t directly to this tick when nothing else is
        // active, instead of inching forward one tick at a time. We use
        // MIN (not max) so that an action ready early (e.g. an op working
        // from 5h00) isn't delayed by a sibling whose first op only
        // arrives at 10h00 — that was the bug behind "everything starts
        // at 10h Monday even when half the operators are there at dawn".
        let mut next_skip_t: Option<usize> = None;
        for (action_idx, outcome) in tick_outcomes.into_iter() {
            match outcome {
                AssignOutcome::Assigned(ops) => {
                    let done = advance_action_at_tick(
                        actions,
                        action_idx,
                        t,
                        grid,
                        operator_groups,
                        operator_skills,
                        &ops,
                    );
                    if done {
                        newly_done.push(action_idx);
                    }
                }
                AssignOutcome::Stalled => {
                    // Station was reserved by assign_action_at_tick; nothing
                    // to do at the productivity layer.
                }
                AssignOutcome::SkipTo(new_t) => {
                    // The action wants to jump ahead — record the EARLIEST
                    // such request so the outer loop wakes up as soon as
                    // possible. Other actions whose own retry tick is later
                    // are gated by the per-action `earliest_retry` check at
                    // the top of the scoring loop, so they correctly stay
                    // dormant until their own tick arrives.
                    next_skip_t = Some(match next_skip_t {
                        Some(prev) => prev.min(new_t),
                        None => new_t,
                    });
                    earliest_retry[action_idx] = new_t;
                }
                AssignOutcome::StationOccupied => {
                    // Should not happen for active actions whose station
                    // they themselves are occupying; defensive only.
                }
            }
        }

        // Emit ComputedAssignments for done actions
        for action_idx in newly_done {
            // Update calage cache: this is now the latest action on its station
            let station_idx = actions[action_idx].station_idx;
            if station_idx < last_action_per_station.len() {
                last_action_per_station[station_idx] = Some(action_idx);
            }
            // Decrement job ART (incremental update — avoids full rebuild each tick)
            if let Some(entry) = job_remaining_art.get_mut(&actions[action_idx].job_id) {
                // The action's art was decremented to 0 in advance_action_at_tick;
                // subtract what it contributed at the start (its original total ticks).
                // Since we can't easily track the original, just recompute for this job.
                *entry = actions.iter()
                    .filter(|a| a.job_id == actions[action_idx].job_id && a.art > 0)
                    .map(|a| a.art as i64)
                    .sum();
            }
            let assignment = build_assignment_for(
                actions,
                action_idx,
                grid,
                tick_minutes,
                start_date,
            );
            assignments.push(assignment);
        }

        // Advance time. Skip ahead when no action is actively running.
        // "Active" = start_tick set, end_tick not set, art > 0.
        // Previously this only skipped when no active action remained,
        // but with outsourcing gaps (768+ ticks), there are long stretches
        // where actions are pending but not active. Counting actives once
        // per tick is O(A) — use a counter instead.
        let active_count = actions.iter().filter(|a| {
            a.start_tick.is_some() && a.end_tick.is_none() && a.art > 0
        }).count();
        if active_count == 0 && next_skip_t.map_or(false, |st| st > t + 1) {
            t = next_skip_t.unwrap();
        } else {
            t += 1;
        }
    }

    assignments
}

/// Apply chunk re-setup logic at start: if this is chunk 2+ and a
/// different job ran on this station before, restore the original setup time.
fn apply_chunk_re_setup(actions: &mut Vec<Action>, action_idx: usize, start_t: usize, grid: &ScheduleGrid) {
    let station_idx = actions[action_idx].station_idx;
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
}

/// Phase 1 of tick-major scheduling: decide which operators take this
/// action's station at tick t and write the assignment to the grid.
///
/// Side effects on the grid: assigns the station to this action, increments
/// the station-group active count if applicable, and adds the assigned
/// operators to their operator_stations slots at tick t.
///
/// Side effects on Action state: increments idle_ticks on stall, may
/// reset eat on peremption.
fn assign_action_at_tick(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    action_idx: usize,
    t: usize,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_availability: &mut OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    station_to_group: &[Option<(usize, u32)>],
    tick_minutes: u32,
    grow_ticks: usize,
) -> AssignOutcome {
    let station_idx = actions[action_idx].station_idx;
    let attrs = &station_attrs[station_idx];

    // Group concurrency: skip this tick if the station's group is at capacity
    let group_idx = if station_idx < station_to_group.len() {
        station_to_group[station_idx].map(|(g, _)| g)
    } else {
        None
    };

    // Station occupied by another action? (rare — only if the algorithm
    // failed to coordinate; we don't reserve here.)
    if let Some(occupant) = grid.station_action_at(station_idx, t) {
        if occupant != action_idx {
            return AssignOutcome::StationOccupied;
        }
    }

    let setup_ticks = actions[action_idx].setup_ticks;
    let in_setup = actions[action_idx].eat < setup_ticks;

    // Build the magnetism preference list. Start from this action's own
    // assigned_operators (set on first successful assign). If it's empty
    // AND the action is part of a chunk chain (chunk 2+), inherit the
    // previous chunk's assigned_operators via the predecessor link — that
    // way the operator who worked the previous chunk is preferred for the
    // next one, instead of the new chunk re-discovering an op from
    // scratch and possibly picking a different one (which produces visible
    // flips at chunk boundaries in the operator-view schedule).
    let mut preferred_op_indices: Vec<usize> = actions[action_idx].assigned_operators.clone();
    if preferred_op_indices.is_empty() {
        if let Some((chunk_n, _, _)) = &actions[action_idx].chunk_info {
            if *chunk_n > 1 {
                if let Some(pred_idx) = actions[action_idx].predecessor_idx {
                    if pred_idx < actions.len() {
                        preferred_op_indices = actions[pred_idx].assigned_operators.clone();
                    }
                }
            }
        }
    }

    // Try preferred (magnetism) first, then any fresh selection.
    let mut operators = find_operators_for_station(
        grid,
        t,
        station_idx,
        operator_skills,
        operator_availability,
        operator_groups,
        &preferred_op_indices,
        attrs.max_operators,
        in_setup,
    );
    if operators.is_empty() && !preferred_op_indices.is_empty() {
        operators = find_operators_for_station(
            grid,
            t,
            station_idx,
            operator_skills,
            operator_availability,
            operator_groups,
            &[],
            attrs.max_operators,
            in_setup,
        );
    }

    if grid.num_operators > 0 && operators.is_empty() {
        // Stall path
        actions[action_idx].idle_ticks += 1;
        grid.assign_station(station_idx, t, action_idx);
        if let Some(g) = group_idx {
            grid.increment_group(g, t);
        }
        // Peremption: if setup stalls too long, reset setup progress
        if attrs.peremption_ticks > 0
            && actions[action_idx].idle_ticks >= attrs.peremption_ticks
            && actions[action_idx].eat > 0
            && actions[action_idx].eat < setup_ticks
        {
            actions[action_idx].art += actions[action_idx].eat;
            actions[action_idx].eat = 0;
            actions[action_idx].idle_ticks = 0;
        }

        // Skip ahead if NO qualified operator is available at all
        let any_qualified_available = operator_skills.iter().enumerate().any(|(op_idx, skills)| {
            skills.iter().any(|(s_idx, p)| *s_idx == station_idx && *p > 0.0)
                && operator_availability.is_available(op_idx, t)
        });
        if !any_qualified_available {
            let max_skip = 7 * 24 * 60 / tick_minutes as usize;
            let mut skip_to = t + 1;
            while skip_to < t + max_skip {
                if skip_to >= grid.num_ticks {
                    grid.grow(grow_ticks);
                    operator_availability.extend(grow_ticks);
                }
                let any_avail = operator_skills.iter().enumerate().any(|(op_idx, skills)| {
                    skills.iter().any(|(s_idx, p)| *s_idx == station_idx && *p > 0.0)
                        && operator_availability.is_available(op_idx, skip_to)
                });
                if any_avail { break; }
                grid.assign_station(station_idx, skip_to, action_idx);
                if let Some(g) = group_idx { grid.increment_group(g, skip_to); }
                skip_to += 1;
            }
            return AssignOutcome::SkipTo(skip_to);
        }
        return AssignOutcome::Stalled;
    }

    // Successful assignment
    actions[action_idx].idle_ticks = 0;
    grid.assign_station(station_idx, t, action_idx);
    if let Some(g) = group_idx {
        grid.increment_group(g, t);
    }
    for &op_idx in &operators {
        grid.assign_operator(op_idx, t, station_idx, 0.0);
    }
    // Update the action's "current operators" so the next tick's
    // Phase 1A preemptive reservation pass can lock them in. We
    // ALWAYS replace (not "set if empty") — that's the magnetism
    // contract: at tick t+1, "preferred" means "ops who were doing
    // the work at tick t", not "ops who originally started the
    // action 6 hours ago". Otherwise an op who took over a stalled
    // action would be silently dropped at the next tick because the
    // original starter (now unavailable) is still considered the
    // preferred op.
    actions[action_idx].assigned_operators = operators.clone();
    AssignOutcome::Assigned(operators)
}

/// Phase 2 of tick-major scheduling: read productivity from the (now final)
/// grid state at tick t and advance the action's `work_accumulator`.
/// Returns true if the action is now done.
fn advance_action_at_tick(
    actions: &mut Vec<Action>,
    action_idx: usize,
    t: usize,
    grid: &ScheduleGrid,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_skills: &[Vec<(usize, f64)>],
    operators_this_tick: &[usize],
) -> bool {
    let station_idx = actions[action_idx].station_idx;

    // Productivity is the sum across operators currently on this station.
    // For solo: each operator contributes their proficiency.
    // For paired: each operator contributes their group's productivity for
    // this station.
    let productivity: f64 = operators_this_tick
        .iter()
        .map(|&op| productivity_at_tick(op, station_idx, t, grid, operator_groups, operator_skills))
        .sum();

    actions[action_idx].tick_operator_log.push((t, operators_this_tick.to_vec()));

    actions[action_idx].work_accumulator += productivity;
    let work_done = actions[action_idx].work_accumulator.floor() as u32;
    actions[action_idx].work_accumulator -= work_done as f64;
    actions[action_idx].art = actions[action_idx].art.saturating_sub(work_done);
    actions[action_idx].eat += 1;
    actions[action_idx].total_productivity += productivity;
    actions[action_idx].ticks_counted += 1;

    if actions[action_idx].art == 0 {
        actions[action_idx].end_tick = Some(t + 1);
        true
    } else {
        false
    }
}

/// Pre-place user-pinned actions onto the grid BEFORE the tick-major loop
/// runs. The contract:
///
/// - The user said: "this task starts at exactly tick T on this station,
///   no matter what". The engine's job is to honour that, even if the
///   timing is awkward (e.g. predecessors might not fit before T).
/// - We mark the action as already-completed (`art = 0`, `end_tick` set)
///   so the scoring loop's `art > 0` and `start_tick.is_none()` filters
///   skip it naturally.
/// - We mark the station occupied across `[pinned_start_tick, end_tick)`
///   in the grid so other actions can't claim the same slot.
/// - We emit a `ComputedAssignment` immediately for each pinned action so
///   the engine output includes it. The assignment has empty operators —
///   the PHP persistence layer will skip applying it (it skips pinned
///   tasks in the unassign loop), so the existing operator assignment is
///   preserved as-is.
///
/// Edge cases handled here:
/// - `pinned_start_tick == None` while `is_pinned == true` → silently
///   ignore the pin (treat as non-pinned). This is a config error and
///   would already be caught by validation upstream.
/// - The pinned interval extends beyond the current grid → grow the grid.
/// - The station is already occupied at one of the pinned ticks (e.g. by
///   a maintenance constraint or another pinned task) → log and overwrite
///   anyway. The user's pin decision wins; collisions are reported as
///   warnings post-compute via the conflict validator.
fn pre_place_pinned_actions(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    grow_ticks: usize,
    assignments: &mut Vec<ComputedAssignment>,
    tick_minutes: u32,
    start_date: NaiveDate,
) {
    for i in 0..actions.len() {
        if !actions[i].is_pinned {
            continue;
        }
        let start_t = match actions[i].pinned_start_tick {
            Some(t) => t,
            None => {
                eprintln!(
                    "[PRE-PLACE] action {} (task {}) is_pinned but has no pinned_start_tick — ignoring pin",
                    i, actions[i].task_id
                );
                continue;
            }
        };
        let total_ticks = (actions[i].setup_ticks + actions[i].run_ticks) as usize;
        if total_ticks == 0 {
            // Zero-duration pinned task — degenerate, skip but emit empty assignment
            actions[i].start_tick = Some(start_t);
            actions[i].end_tick = Some(start_t);
            actions[i].art = 0;
            actions[i].eat = 0;
            continue;
        }
        let end_t = start_t + total_ticks;

        // Make sure the grid covers the pinned interval. Grow in chunks
        // until end_t fits, mirroring the dynamic-grow strategy used in
        // the main loop.
        while end_t > grid.num_ticks {
            grid.grow(grow_ticks);
        }

        // Reserve the station for the whole interval. We overwrite any
        // existing occupancy on these cells — the user's pin decision
        // takes precedence over the engine's earlier choices (which
        // shouldn't have happened anyway since pre-placement runs first).
        let station_idx = actions[i].station_idx;
        for t in start_t..end_t {
            if let Some(prev) = grid.station_action_at(station_idx, t) {
                if prev != i {
                    eprintln!(
                        "[PRE-PLACE] pinned task {} overwrites action {} on station_idx {} at tick {}",
                        actions[i].task_id, prev, station_idx, t
                    );
                }
            }
            grid.assign_station(station_idx, t, i);
        }

        // Mark the action as already-completed for the main loop.
        actions[i].start_tick = Some(start_t);
        actions[i].end_tick = Some(end_t);
        actions[i].art = 0;
        actions[i].eat = total_ticks as u32;

        // Emit the ComputedAssignment now. Operators are intentionally
        // empty — the PHP persistence layer keeps the existing pinned
        // assignment (with its existing operators) instead of applying
        // this one.
        let assignment = build_assignment_for(actions, i, grid, tick_minutes, start_date);
        assignments.push(assignment);
    }
}

/// Build a ComputedAssignment for an action that has finished.
fn build_assignment_for(
    actions: &[Action],
    action_idx: usize,
    grid: &ScheduleGrid,
    tick_minutes: u32,
    start_date: NaiveDate,
) -> ComputedAssignment {
    let action = &actions[action_idx];
    let station_idx = action.station_idx;
    let start_t = action.start_tick.unwrap_or(0);
    let end_t = action.end_tick.unwrap_or(start_t);
    let setup_ticks = action.setup_ticks;

    let avg_productivity = if action.ticks_counted > 0 {
        action.total_productivity / action.ticks_counted as f64
    } else {
        1.0
    };

    let operator_assignments = build_operator_assignments(
        &action.tick_operator_log,
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

    ComputedAssignment {
        task_id: action.task_id.clone(),
        station_id: format!("station_idx:{}", station_idx),
        scheduled_start: super::format_minutes(start_minutes, start_date),
        scheduled_end: super::format_minutes(end_minutes, start_date),
        operators: operator_assignments,
        setup_end: setup_end_minutes.map(|m| super::format_minutes(m, start_date)),
        is_degraded: false,
        effective_productivity: (avg_productivity * 100.0).round() / 100.0,
        is_masked_time: false, // Set in post-processing by compute()
    }
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
        // Ticks are already in chronological order (appended by tick_operator_log
        // in the main loop's tick-ascending order). Skip the sort.
        debug_assert!(ticks.windows(2).all(|w| w[0].0 <= w[1].0));

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


/// Compute calage bonus: +100 if the LAST action that occupied this
/// station (according to the cache) belongs to the same job as the
/// candidate. The cache is maintained by run_forward_pass and updated
/// each time an assignment completes — this brings the cost from O(t)
/// per call (the previous backward grid scan) down to O(1).
fn compute_calage_bonus(
    last_action_per_station: &[Option<usize>],
    actions: &[Action],
    candidate_idx: usize,
) -> i64 {
    let station_idx = actions[candidate_idx].station_idx;
    if station_idx >= last_action_per_station.len() {
        return 0;
    }
    let prev_idx = match last_action_per_station[station_idx] {
        Some(i) => i,
        None => return 0,
    };
    if prev_idx >= actions.len() {
        return 0;
    }
    if actions[prev_idx].job_id == actions[candidate_idx].job_id {
        100
    } else {
        0
    }
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
