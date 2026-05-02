use std::collections::HashMap;

use chrono::{Datelike, NaiveDate};

use crate::model::operator::{Absence, OperatingSchedule, Overtime};
use crate::model::schedule::{ComputedAssignment, OperatorAssignment, Warning};

use super::grid::ScheduleGrid;

/// Per-operator schedule data for rotation resolution and availability computation.
#[derive(Clone)]
pub struct OperatorScheduleData {
    pub schedules: Option<Vec<OperatingSchedule>>,
    pub reference_week: Option<u32>,
    /// Datetime-range absences. A tick falling within any range is marked
    /// unavailable regardless of what the weekly schedule says.
    pub absences: Vec<Absence>,
    /// Datetime-range overtime slots. A tick falling within any range is
    /// marked available even when the weekly schedule says otherwise. The
    /// upstream PHP service guarantees `overtimes` and `absences` are
    /// disjoint, so conflict resolution is unnecessary here.
    pub overtimes: Vec<Overtime>,
}

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
    /// Max chunk size in ticks. Upper bound for chunk decisions — forces the
    /// engine to re-evaluate scheduling at least every this many ticks.
    pub max_chunk_ticks: u32,
    /// Chunk-mini: k factor on setup_ticks. A task must produce at least
    /// `k × setup_ticks` of work in a single contiguous window.
    pub chunk_mini_setup_multiplier: f64,
    /// Chunk-mini: p fraction of the total task duration. A chunk shorter
    /// than `p × total_task_ticks` is forbidden (caps chunk count).
    pub chunk_mini_task_percentage: f64,
    /// Similarity criteria — empty when the station's category has none.
    /// Used by the scoring loop to compute a compatibility_bonus against the
    /// previous action on this station.
    pub similarity_criteria: Vec<crate::model::station::SimilarityCriterion>,
    /// Scoring rules — empty when the category has none (Typographie).
    pub similarity_score_rules: Vec<crate::model::station::SimilarityScoreRule>,
}

impl StationAttrs {
    /// Compute the effective chunk_mini ticks for this station given a task's
    /// total duration. Result = min(max_chunk, max(k × setup, p × task_total)).
    /// Returns a value in ticks, always ≤ max_chunk_ticks.
    pub fn chunk_mini_ticks(&self, setup_ticks: u32, task_total_ticks: u32) -> u32 {
        let setup_floor = (self.chunk_mini_setup_multiplier * setup_ticks as f64).ceil() as u32;
        let task_floor =
            (self.chunk_mini_task_percentage * task_total_ticks as f64).ceil() as u32;
        setup_floor.max(task_floor).min(self.max_chunk_ticks.max(1))
    }
}

/// A station the operator is qualified on, prepared for fast lookup during
/// scheduling. Carries the asymmetric setup vs run proficiency split so the
/// engine can pick the right value depending on the phase being scheduled.
///
/// 0.0 on either field means the operator cannot perform that phase on this
/// station — they are excluded from the candidate pool when the engine is
/// looking for a setup_op (resp. run_op).
#[derive(Debug, Clone, Copy)]
pub struct SkillEntry {
    pub station_idx: usize,
    pub setup_proficiency: f64,
    pub run_proficiency: f64,
}

impl SkillEntry {
    /// Proficiency for the phase currently being scheduled.
    #[inline]
    pub fn proficiency_for(&self, is_setup_phase: bool) -> f64 {
        if is_setup_phase {
            self.setup_proficiency
        } else {
            self.run_proficiency
        }
    }

    /// True when the operator can perform at least one phase on this station.
    /// Used by sites that don't track the phase explicitly (e.g. some pre-checks).
    #[inline]
    pub fn is_qualified_either_phase(&self) -> bool {
        self.setup_proficiency > 0.0 || self.run_proficiency > 0.0
    }
}

impl From<(usize, f64)> for SkillEntry {
    /// Convenience for tests and migration paths: a single proficiency value
    /// is mirrored to both setup and run phases.
    fn from((station_idx, proficiency): (usize, f64)) -> Self {
        SkillEntry {
            station_idx,
            setup_proficiency: proficiency,
            run_proficiency: proficiency,
        }
    }
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

/// Count contiguous ticks starting at `t` where the station is
/// workable (station free AND ≥1 qualified operator available) for a
/// specific scoring action, taking **tier-based preemption** into
/// account when the scoring action is overdue.
///
/// Passability rules for each candidate cell:
///   - Station cell is free → pass.
///   - Station cell is owned by `usize::MAX` sentinel (ALAP pre-block
///     or maintenance window) → NOT pass, stop scan.
///   - Station cell is owned by another action L:
///       * If `scoring_priority < L.deadline_priority` (scoring task
///         is in a more-urgent tier) AND `scoring_slack < 0` (already
///         past its LAST target): pass anyway (scoring task will
///         preempt L when it claims the cell productively).
///       * Otherwise: stop scan.
///   - Operator availability fails (no qualified op) → stop scan.
///
/// This is the primitive used by the scoring filter. `scoring_slack`
/// must be `action.last as i64 - t as i64 - action.art as i64` — the
/// same slack used for urgency scoring. Preemption only fires when
/// the scoring action is strictly more prioritary AND already late,
/// matching the "policy B" relaxation pattern already in place.
pub fn available_work_window(
    grid: &ScheduleGrid,
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &OperatorAvailability,
    actions: &[Action],
    scoring_priority: u8,
    scoring_slack: i64,
    station_idx: usize,
    t: usize,
    max_ticks: usize,
) -> usize {
    if station_idx >= grid.num_stations || t >= grid.num_ticks {
        return 0;
    }
    let cap = (grid.num_ticks - t).min(max_ticks);
    let mut run = 0usize;
    while run < cap {
        let tick = t + run;
        match grid.station_action_at(station_idx, tick) {
            None => { /* free — pass */ }
            Some(occupant_idx) if occupant_idx == usize::MAX => {
                // ALAP pre-block / station_blocked_ranges / pinned
                // placement sentinel. Not eligible for tier preemption.
                break;
            }
            Some(occupant_idx) if occupant_idx < actions.len() => {
                let occupant_priority = actions[occupant_idx].deadline_priority;
                let preempt = scoring_priority < occupant_priority && scoring_slack < 0;
                if !preempt {
                    break;
                }
                // Preemption allowed — scoring task will displace L
                // when it claims this cell productively.
            }
            Some(_) => {
                // Unknown action idx; defensive break.
                break;
            }
        }
        let any_op = operator_skills.iter().enumerate().any(|(op, skills)| {
            skills
                .iter()
                .any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
                && operator_availability.is_available(op, tick)
        });
        if !any_op {
            break;
        }
        run += 1;
    }
    run
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
    /// Hard floor on the earliest tick at which this action may start.
    /// Sourced from `TaskInput.earliest_start_tick` (currently driven by
    /// the BAT-deadline rule on the PHP side; see model/job.rs). The
    /// scoring loop refuses placements at `t < earliest_start_tick` and
    /// `pre_place_pinned_actions` degrades pins below this floor.
    pub earliest_start_tick: Option<usize>,
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
    /// Original ART (setup + run ticks) at action creation. Used for
    /// incremental job_remaining_art updates when the action completes.
    pub original_art: u32,
    /// Total work ticks of the ORIGINAL task (before any pre_split
    /// chunking). All chunks of the same task share the same value so
    /// the chunk_mini `p * task_total` computation is stable across
    /// chunks. Non-chunked actions have this equal to `original_art`.
    pub task_total_ticks: u32,
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
    /// True iff `is_pinned` was set by PHP's safety-zone freeze pathway
    /// (i.e. a previously-placed task that sits inside the rolling
    /// working-hours window). Distinct from a user pin, which has the
    /// same `is_pinned: true` flag but originates from an explicit
    /// user choice. `pre_place_pinned_actions` honours safety-zone
    /// pins verbatim (no shift) because Phase 1 already produced a
    /// feasible placement; the contiguous-window check would shift
    /// multi-stint tasks into slots occupied by other actions.
    pub is_frozen_by_safety_zone: bool,
    /// Total remaining work in this action's successor chain (this task + all
    /// successors). Used by the scoring function to prioritize tasks at the
    /// head of long chains where delay cascades.
    pub chain_remaining_art: u32,
    /// The tick at which the pinned action must start (only meaningful
    /// if `is_pinned`). Used by `pre_place_pinned_actions` to set
    /// start_tick / end_tick before the main loop runs.
    pub pinned_start_tick: Option<usize>,
    /// The tick at which the pinned action must end (exclusive; only
    /// meaningful if `is_pinned`). When provided by PHP, takes priority
    /// over the config-derived `pinned_start_tick + setup_ticks +
    /// run_ticks`. Pre-placement uses this to honour the actual extent
    /// of the existing DB assignment, preventing drift accumulation that
    /// otherwise produces pin-pin overlaps after several compute cycles.
    pub pinned_end_tick: Option<usize>,
    /// Number of times this action's setup has expired due to post-setup
    /// peremption (extended idle after setup completion). Each occurrence
    /// re-adds setup_ticks of work to art. Capped to prevent runaway loops.
    pub peremption_count: u32,
    /// True after post-setup peremption fires and until the first productive
    /// tick of the re-setup starts, at which point `current_recalage_start`
    /// is set to that tick and this flag is cleared. Decouples "peremption
    /// occurred" from "re-setup actually began" so the recorded segment
    /// reflects only the productive re-setup window, not the preceding idle.
    pub pending_recalage: bool,
    /// Tick at which the current in-flight re-calage started (first
    /// productive tick after peremption). None outside of a re-calage window.
    pub current_recalage_start: Option<u32>,
    /// Completed re-calage segments (start_tick, end_tick_exclusive). One
    /// entry per post-setup peremption whose re-setup actually ran to
    /// completion. Surfaced in ComputedAssignment so the UI can render a
    /// calage-phase section per event.
    pub recalage_segments: Vec<(u32, u32)>,
    /// Subset of the owning element's spec consulted by similarity rules
    /// (papier / format / impression). Populated once at Action build time
    /// so the scoring hot path doesn't re-parse JSON per tick. See
    /// `crate::engine::similarity::SpecSnapshot`.
    pub spec_snapshot: super::similarity::SpecSnapshot,
    /// Setup work done so far, in units of "config setup ticks". Phase is
    /// `setup` while `setup_progress < setup_ticks as f64`, then `run`.
    /// Tracked separately from `eat` (real ticks elapsed) because the two
    /// diverge whenever the per-tick setup rate isn't exactly 1.0 — e.g.
    /// an under-skilled operator (`prof < attention_full`) makes setup
    /// progress slower than wall clock, and an over-staffed station
    /// (`sum_prof > attention_full`) caps it back to 1.0. Only
    /// `setup_progress` is authoritative for phase membership.
    pub setup_progress: f64,
    /// Tick at which `setup_progress` first reached `setup_ticks`. `None`
    /// while still in setup phase or for actions that bypass the main
    /// loop (e.g. pre-placed pinned tasks). Drives `setupEnd` in the
    /// emitted ComputedAssignment so the UI sees the actual setup/run
    /// boundary instead of the config-derived approximation.
    pub setup_end_tick: Option<u32>,
    /// Outsourced steps inserted (in sequence order) between this action's
    /// internal predecessor and itself. Empty when no ST sits in front of
    /// this action. Walked at predecessor-floor evaluation time:
    /// `floor = compute_chain_return_tick(pred.end_tick, &chain, ...)`.
    /// IDs are intentionally absent — chain emission for the output
    /// payload is done in a second pass over the input `jobs` so trailing
    /// ST steps (no internal successor) are also covered.
    pub outsourced_predecessor_chain: Vec<crate::model::job::OutsourcedParams>,
    /// When true, transparent operator absences (gap typed `OperatorAbsentManaged`)
    /// do NOT accumulate `idle_ticks` toward the peremption threshold — the
    /// calage is preserved across the gap. Default `false` keeps the engine's
    /// historical behaviour (any operator absence eventually fires peremption).
    /// Set to `true` for actions that are deliberately interrupted by the
    /// caleur volant pattern (P3b) or any future pause-managed scenario.
    pub preserve_calage_during_gap: bool,
    /// Latest tick (exclusive) up to which this action's stall is justified
    /// by an operator borrow (the conducteur is calage-volant on another
    /// station). When `Some(t_end)` and current tick < `t_end`, peremption
    /// is gated even if `preserve_calage_during_gap` is false — the borrow
    /// is the explicit reason for the gap, automatically cleared once the
    /// borrow expires so a long unrelated stall would still hit peremption.
    pub borrow_until_tick: Option<u32>,
}

/// Cap on how many times an action can re-setup due to peremption before
/// being rejected. Prevents infinite stalls when an action is repeatedly
/// interrupted mid-run (e.g., chronically understaffed station). Each
/// occurrence adds setup_ticks of work; if the action keeps getting
/// re-pre-empted, the main loop must back off and re-plan.
pub const MAX_PEREMPTION_RETRIES: u32 = 3;

/// True when `succ` is the immediate next chunk of the same task as
/// `pred` (i.e. an internal pre_split chunk continuation, not a
/// user-visible task→task transition). Chunk continuations stay
/// contiguous (gap=0) — to the user, chunks of one task are one
/// continuous block; inserting a forced gap would visually fracture
/// the task and starve the operator-magnetism path in Phase 1A.5
/// (which keys on `pred.end_tick == t`).
fn is_same_task_chunk_continuation(succ: &Action, pred: &Action) -> bool {
    match (&succ.chunk_info, &pred.chunk_info) {
        (Some((sn, _, so)), Some((pn, _, po))) => *sn > 1 && *sn == *pn + 1 && so == po,
        _ => false,
    }
}

/// Manages operator availability with dynamic extension
pub struct OperatorAvailability {
    data: Vec<Vec<bool>>,
    tick_minutes: u32,
    start_date: NaiveDate,
    schedules: Vec<OperatorScheduleData>,
}

impl OperatorAvailability {
    pub fn new(
        num_operators: usize,
        initial_ticks: usize,
        tick_minutes: u32,
        start_date: NaiveDate,
        schedules: Vec<OperatorScheduleData>,
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

    /// Compute availability for a range of ticks.
    ///
    /// Three-step model:
    /// 1. Base availability from operating schedules (rotating, ISO-week-resolved,
    ///    or default M-F 8:00–17:00 when no schedule is defined).
    /// 2. Overtime extension: if any overtime slot covers the tick's naive local
    ///    datetime, the tick is marked available even if step 1 said false.
    /// 3. Absence override: if any absence covers the tick, it is unavailable
    ///    regardless of steps 1 and 2. Overtime and absence ranges are
    ///    guaranteed disjoint by the upstream PHP service; if that invariant
    ///    ever breaks, absence still wins.
    fn compute_availability(
        &self,
        op_idx: usize,
        start_tick: usize,
        num_ticks: usize,
    ) -> Vec<bool> {
        let sched_data = match self.schedules.get(op_idx) {
            Some(sd) => sd,
            None => {
                return vec![false; num_ticks];
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

                // Step 1: base availability from the operating schedule (or the
                // default M-F 8-17 fallback when none is configured).
                let base_available = match &sched_data.schedules {
                    Some(schedules) if !schedules.is_empty() => {
                        let schedule = if schedules.len() == 1 {
                            &schedules[0]
                        } else {
                            let ref_week = sched_data.reference_week.unwrap_or(1);
                            let iso_week = date.iso_week().week();
                            let index = ((iso_week as i64 - ref_week as i64)
                                .rem_euclid(schedules.len() as i64))
                                as usize;
                            &schedules[index]
                        };
                        if let Some(day_sched) = schedule.day_schedule(weekday) {
                            day_sched.slots.iter().any(|slot| {
                                let slot_start = slot.start_minutes();
                                let slot_end = slot.end_minutes();
                                day_minutes >= slot_start && day_minutes < slot_end
                            })
                        } else {
                            false
                        }
                    }
                    _ => {
                        // Default M-F 8:00-17:00 when no schedule is defined.
                        matches!(
                            weekday,
                            chrono::Weekday::Mon
                                | chrono::Weekday::Tue
                                | chrono::Weekday::Wed
                                | chrono::Weekday::Thu
                                | chrono::Weekday::Fri
                        ) && day_minutes >= 8 * 60
                            && day_minutes < 17 * 60
                    }
                };

                // Fast path: no overtime and no absence → base is the answer.
                if sched_data.overtimes.is_empty() && sched_data.absences.is_empty() {
                    return base_available;
                }

                let hour = day_minutes / 60;
                let minute = day_minutes % 60;
                let tick_dt = match date.and_hms_opt(hour, minute, 0) {
                    Some(dt) => dt,
                    None => return base_available,
                };

                // Step 2: overtime extension.
                let extended = base_available
                    || sched_data.overtimes.iter().any(|ot| ot.covers(tick_dt));
                if !extended {
                    return false;
                }

                // Step 3: absence override (absence always wins).
                !sched_data.absences.iter().any(|abs| abs.covers(tick_dt))
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
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    preferred_operators: &[usize],
    max_operators: u32,
    is_setup_phase: bool,
) -> Vec<usize> {
    let qualified_ops: Vec<(usize, f64)> = (0..operator_skills.len())
        .filter_map(|op| {
            let prof = operator_skills[op]
                .iter()
                .find(|s| s.station_idx == station_idx)
                .map(|s| s.proficiency_for(is_setup_phase))?;
            if prof > 0.0 { Some((op, prof)) } else { None }
        })
        .collect();

    let is_pref = |op_idx: usize| preferred_operators.contains(&op_idx);

    // Run-phase specialization rule: when picking a run operator, prefer ops
    // who can ONLY run on this station (setup_proficiency == 0) over versatile
    // ops who could also be used for calage. This frees the versatiles to
    // serve as caleurs volants on stations that need a setup. The check is
    // a tiebreaker between candidates of equal magnetism preference, sorted
    // before the proficiency tiebreaker so the rule fires meaningfully when
    // proficiencies are similar (the common case after the P1 split where
    // most ops keep setup == run = legacy proficiency).
    //
    // Setup phase is unaffected — there's nothing to specialize for, since
    // run-only ops are already excluded by the qualification filter above.
    let is_run_specialist = |op_idx: usize| -> bool {
        if is_setup_phase {
            return false;
        }
        operator_skills[op_idx]
            .iter()
            .find(|s| s.station_idx == station_idx)
            .map(|s| s.setup_proficiency == 0.0 && s.run_proficiency > 0.0)
            .unwrap_or(false)
    };

    // Priority A — idle solo. Sort by preferred → run-specialist → proficiency desc.
    let mut idle_candidates: Vec<(usize, f64)> = qualified_ops
        .iter()
        .copied()
        .filter(|(op, _)| operator_availability.is_available(*op, t))
        .filter(|(op, _)| grid.operator_is_idle(*op, t))
        .collect();
    idle_candidates.sort_by(|a, b| {
        is_pref(b.0)
            .cmp(&is_pref(a.0))
            .then_with(|| is_run_specialist(b.0).cmp(&is_run_specialist(a.0)))
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
///   the operator's proficiency on this station for the phase being scheduled
///   (`setup_proficiency` if `is_setup_phase`, `run_proficiency` otherwise).
/// - If the operator is on this station as part of a known pair: productivity
///   comes from the matching PreparedConcurrentGroup. (Pairing is run-only by
///   construction — the setup phase always runs solo.)
/// - Otherwise (operator not on station, or load doesn't match any group):
///   returns 0.0.
pub fn productivity_at_tick(
    op: usize,
    station: usize,
    t: usize,
    grid: &ScheduleGrid,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_skills: &[Vec<SkillEntry>],
    is_setup_phase: bool,
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
            .find(|s| s.station_idx == station)
            .map(|s| s.proficiency_for(is_setup_phase))
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

/// Look for a viable caleur-volant borrow when a setup-phase action has
/// failed to find any idle qualified operator at tick `t`.
///
/// A donor is another action satisfying ALL of:
/// - in run phase (`setup_progress >= setup_ticks`)
/// - on a different station from the target
/// - at least one of its assigned operators is qualified for `target_station`'s
///   setup phase (`setup_proficiency > 0`)
/// - the donor has logged enough run-phase ticks already to satisfy a
///   conservative chunk-mini floor (we use 25% of `task_total_ticks` so
///   tiny tasks aren't fragmented)
///
/// Returns the first viable donor as `Some((op_idx, source_action_idx))`.
/// The caller is responsible for:
/// - clearing the op's grid state at tick `t` via `grid.clear_operator_at_tick`
/// - setting `actions[source_action_idx].borrow_until_tick` to the tick after
///   the borrow ends, so peremption is gated for the duration
/// - assigning the op to the target station via `grid.assign_operator`
fn try_borrow_setup_op(
    actions: &[Action],
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &OperatorAvailability,
    target_station: usize,
    t: usize,
) -> Option<(usize, usize)> {
    const MIN_RUN_TICKS_FOR_BORROW_RATIO: f64 = 0.25;

    for (source_idx, source) in actions.iter().enumerate() {
        if source.station_idx == target_station {
            continue;
        }
        if source.start_tick.is_none() || source.end_tick.is_some() {
            continue;
        }
        if source.art == 0 {
            continue;
        }
        // Must be past setup
        if source.setup_progress < source.setup_ticks as f64 {
            continue;
        }
        // Run progress so far must satisfy a chunk-mini-ish floor so we don't
        // fragment a task that just started rolling.
        let run_progress = source.eat.saturating_sub(source.setup_ticks);
        let run_floor =
            (source.task_total_ticks as f64 * MIN_RUN_TICKS_FOR_BORROW_RATIO).ceil() as u32;
        if run_progress < run_floor {
            continue;
        }
        // Already in a borrow window? Skip — one borrow at a time per donor.
        if source.borrow_until_tick.is_some() {
            continue;
        }

        // For each of source's currently assigned operators
        for &op in &source.assigned_operators {
            if !operator_availability.is_available(op, t) {
                continue;
            }
            let setup_prof = operator_skills[op]
                .iter()
                .find(|s| s.station_idx == target_station)
                .map(|s| s.setup_proficiency)
                .unwrap_or(0.0);
            if setup_prof <= 0.0 {
                continue;
            }
            return Some((op, source_idx));
        }
    }
    None
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
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &mut OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    station_to_group: &[Option<(usize, u32)>],
    now_tick: usize,
    station_urgency_boost: &HashMap<usize, f64>,
    score_weights: &[f64; 7],
    // Minimum tick gap enforced between predecessor end and successor
    // start (chunk continuations exempted). Sourced from
    // ComputeOptions.precedence_min_gap_ticks. 0 = legacy behaviour
    // (touching boundaries allowed).
    precedence_min_gap_ticks: u32,
    warnings: &mut Vec<Warning>,
) -> Vec<ComputedAssignment> {
    let mut assignments: Vec<ComputedAssignment> = Vec::new();
    let grow_ticks = 7 * 24 * 60 / tick_minutes as usize; // 7 days of ticks

    // Pre-place user-pinned actions before the main scheduling loop. They
    // become "already done" (art=0, end_tick set) so the scoring loop skips
    // them and successors see their fixed end_tick when checking precedence.
    // The grid is marked occupied for the pinned interval so other actions
    // don't try to use the same station slot.
    pre_place_pinned_actions(
        grid,
        actions,
        grow_ticks,
        &mut assignments,
        tick_minutes,
        start_date,
        station_attrs,
        operator_skills,
        operator_availability,
        operator_groups,
        now_tick,
        warnings,
    );

    // Start scheduling from now (rounded up to tick boundary), not midnight.
    // Tasks cannot be placed in the past.
    let mut t: usize = now_tick;

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
        for entry in skills.iter() {
            if entry.is_qualified_either_phase() && entry.station_idx < station_has_qualified_op.len() {
                station_has_qualified_op[entry.station_idx] = true;
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

    // Pre-compute station contention: count of pending (unstarted, non-zero ART)
    // actions per station. Stations with more pending work are bottlenecks —
    // tasks on them get a scoring bonus.
    let mut station_pending_count: Vec<u32> = vec![0; station_attrs.len()];
    for action in actions.iter() {
        if action.art > 0 && action.start_tick.is_none() && action.station_idx < station_pending_count.len() {
            station_pending_count[action.station_idx] += 1;
        }
    }
    let max_pending = *station_pending_count.iter().max().unwrap_or(&1).max(&1);

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
        // VIRTUAL RESERVATION — project each already-active action's
        // remaining PRODUCTIVE run onto the grid before scoring new
        // candidates.
        //
        // Intent: a task B scored at tick T must see grid[T+1..] as
        // busy where already-active task A will claim cells. Without
        // this, B slips in and A stalls later — producing the
        // scoring-race StationConflict pattern.
        //
        // Constraints:
        //   1. We start at `t+1`, not `t`. Cell `t` itself is reserved
        //      for already-active actions via Phase 1A, which runs
        //      right after. Reserving `t` here would block new
        //      candidates from starting at `t` even when the active
        //      action will claim `t` legitimately via 1A.
        //   2. We only mark cells where an operator is *available*.
        //      Operator-idle cells are eventually covered by
        //      skip_ahead at run-time; reserving them ahead of time
        //      would block other tasks from legitimately using the
        //      station during the active action's idle windows.
        //   3. Counting stops once we've reserved `art` productive
        //      cells for the action — that's the remaining work it
        //      needs. Cells beyond that aren't ours to claim.
        //   4. Marking is conditional on the cell being currently
        //      free — we never overwrite another action's or
        //      ALAP-sentinel's cell.
        for action_idx in 0..actions.len() {
            let a = &actions[action_idx];
            if a.start_tick.is_none() || a.end_tick.is_some() || a.art == 0 {
                continue;
            }
            let station = a.station_idx;
            let art = a.art as usize;
            let scan_cap = (grid.num_ticks.saturating_sub(t + 1)).min(art * 5);
            let mut reserved = 0usize;
            for offset in 0..scan_cap {
                if reserved >= art {
                    break;
                }
                let future_t = t + 1 + offset;
                if !grid.is_station_free(station, future_t) {
                    // Another action owns this cell — we can't claim it,
                    // and scanning further for this reservation is
                    // moot because the active action will itself hit
                    // this wall when it runs.
                    break;
                }
                let any_op = operator_skills.iter().enumerate().any(|(op, skills)| {
                    skills
                        .iter()
                        .any(|s| s.station_idx == station && s.is_qualified_either_phase())
                        && operator_availability.is_available(op, future_t)
                });
                if !any_op {
                    continue; // operator-idle; skip_ahead will cover at run-time
                }
                grid.assign_station(station, future_t, action_idx);
                reserved += 1;
            }
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
            // Hard floor sourced from PHP (currently the BAT-deadline
            // rule). The action cannot start before this tick regardless
            // of operator availability or precedence — the gate is more
            // fundamental than the engine's optimisation criteria.
            if let Some(est) = action.earliest_start_tick {
                if t < est { continue; }
            }
            // Precedence guard: predecessor must finish strictly BEFORE the
            // successor's first tick. The strict-gap requirement adds 1
            // tick of mandatory separation on top of any explicit
            // `predecessor_gap_ticks` (drying time / outsourcing). It
            // exists to eliminate the "kissing boundary" case where
            // pred.end == succ.start in wall-clock terms (Frédéric
            // finishing COUV-cut at 10:15 and starting FIN at 10:15 in
            // the same instant), which the half-open tick model accepted
            // but reads as a precedence violation in any UI/validator
            // using closed intervals.
            //
            // Same-task chunks are exempt: chunk N → chunk N+1 must stay
            // contiguous (no gap), since chunks are an internal
            // optimization for breaking long tasks — visually one
            // continuous block to the user, and Phase 1A.5's magnetism
            // keys on `pred.end_tick == t` to lock the operator across
            // the boundary.
            if let Some(pred_idx) = action.predecessor_idx {
                let strict_gap = if is_same_task_chunk_continuation(action, &actions[pred_idx]) {
                    0
                } else {
                    precedence_min_gap_ticks as usize
                };
                match actions[pred_idx].end_tick {
                    Some(pred_end) => {
                        // Floor = the earliest tick this action may start.
                        // - No ST chain: pred_end + drying_gap (existing behaviour).
                        // - ST chain present: walk it in sequence to obtain
                        //   the actual return tick of the last ST step,
                        //   computed from the predecessor's *actual* end
                        //   tick (the very thing the pre-engine
                        //   estimate-based gap could not see — and the
                        //   reason this whole refactor exists).
                        let floor = if actions[i].outsourced_predecessor_chain.is_empty() {
                            pred_end + actions[i].predecessor_gap_ticks as usize
                        } else {
                            let today_midnight = start_date
                                .and_hms_opt(0, 0, 0)
                                .expect("midnight is always valid");
                            super::outsourced::compute_chain_return_tick(
                                pred_end as u64,
                                &actions[i].outsourced_predecessor_chain,
                                today_midnight,
                                tick_minutes,
                            ) as usize
                        };
                        if floor + strict_gap > t {
                            continue;
                        }
                    }
                    _ => continue,
                }
            }
            if !action.additional_predecessors.is_empty() {
                // additional_predecessors only carries cross-element /
                // cross-job edges (set in mod.rs's element/job wiring).
                // None of those are chunk-internal, so the strict gap
                // applies unconditionally here.
                let strict_gap = precedence_min_gap_ticks as usize;
                let all_done = action.additional_predecessors.iter().all(|&(pred_idx, gap)| {
                    match actions[pred_idx].end_tick {
                        Some(pred_end) => pred_end + gap as usize + strict_gap <= t,
                        None => false,
                    }
                });
                if !all_done { continue; }
            }
            if !grid.is_station_free(action.station_idx, t) { continue; }

            // Chunk-mini lookahead — refuse to start this action in a
            // window too short to respect the station's chunk-mini
            // policy. Two bounds:
            //   k × setup  — setup must be amortised (economic floor)
            //   p × task   — no over-fragmentation of the original task
            // Capped by max_chunk_ticks (a chunk can never be required
            // bigger than max_chunk). Then min'd with action.art so a
            // task shorter than the floor is accepted at its natural
            // size (exception courte).
            //
            // Policy B relaxation: when `slack` (last - t - art) is
            // negative, the action is already past its LAST target and
            // we loosen the task-percentage bound to avoid letting an
            // anti-fragmentation rule push a late job even later. The
            // setup multiplier is never relaxed — starting a chunk we
            // can't amortise is wasteful regardless of lateness.
            {
                let station_idx = action.station_idx;
                let attrs = &station_attrs[station_idx];
                let slack_preview = action.last as i64 - t as i64 - action.art as i64;
                let setup_floor =
                    (attrs.chunk_mini_setup_multiplier * action.setup_ticks as f64).ceil() as u32;
                let task_floor = if slack_preview < 0 {
                    0
                } else {
                    (attrs.chunk_mini_task_percentage * action.task_total_ticks as f64).ceil()
                        as u32
                };
                let chunk_mini_ticks = setup_floor
                    .max(task_floor)
                    .min(attrs.max_chunk_ticks.max(1));
                let needed = action.art.min(chunk_mini_ticks) as usize;
                // Work window must cover station freedom, operator
                // availability, AND (if the scoring task is both more
                // urgent and already past its LAST) tier-preempt
                // lower-priority active actions already parked on the
                // grid by the virtual-reservation step.
                if needed > 0 {
                    let scoring_slack = action.last as i64 - t as i64 - action.art as i64;
                    let window = available_work_window(
                        grid,
                        operator_skills,
                        operator_availability,
                        actions,
                        action.deadline_priority,
                        scoring_slack,
                        station_idx,
                        t,
                        needed,
                    );
                    if window < needed { continue; }
                }
            }

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

            // job_boost: reactive penalty when job is already past its deadline estimate.
            // proximity_bonus: proactive boost when job is within 1 day of deadline.
            //
            // The two are calibrated to form a continuous function at job_slack = 0:
            //   job_slack < 0  → job_boost  = |slack| × 50 × tier_w  (grows with lateness)
            //   job_slack = 0  → proximity  = 45 × tier_w              (just below job_boost at -1)
            //   job_slack > 0  → proximity  = ratio × 45 × tier_w      (tapers to 0 at +1 day)
            //
            // Using 45 (< 50) guarantees any negative-slack job always outscores a
            // same-tier job at zero slack, preventing priority inversion.
            let (job_boost, proximity_bonus): (i64, i64) = if action.job_deadline_tick < u64::MAX {
                let job_art = job_remaining_art.get(&action.job_id).copied().unwrap_or(0);
                let job_slack = action.job_deadline_tick as i64 - t as i64 - job_art;
                if job_slack < 0 {
                    (((-job_slack) as f64 * 50.0 * tier_w) as i64, 0)
                } else {
                    let ticks_per_day = (24 * 60 / tick_minutes) as i64;
                    let prox = if job_slack < ticks_per_day {
                        let ratio = 1.0 - (job_slack as f64 / ticks_per_day as f64);
                        (ratio * 45.0 * tier_w) as i64
                    } else {
                        0
                    };
                    (0, prox)
                }
            } else {
                (0, 0)
            };

            let calage_bonus = compute_calage_bonus(&last_action_per_station, &actions, i);

            // Compatibility bonus: reward transitions to a candidate whose
            // spec is compatible with the previous action on the same
            // station. Only fires when the predecessor exists AND is a
            // different job (same-job continuity is already captured by
            // calage_bonus). Score derived from the per-category rules.
            let compatibility_bonus: i64 = {
                let station_idx = action.station_idx;
                match last_action_per_station.get(station_idx).and_then(|o| *o) {
                    Some(prev_idx)
                        if prev_idx < actions.len()
                            && actions[prev_idx].job_id != action.job_id =>
                    {
                        let attrs = &station_attrs[station_idx];
                        if attrs.similarity_score_rules.is_empty() {
                            0
                        } else {
                            let pts = super::similarity::compute_similarity_score(
                                &actions[prev_idx].spec_snapshot,
                                &action.spec_snapshot,
                                &attrs.similarity_criteria,
                                &attrs.similarity_score_rules,
                            );
                            (pts * super::similarity::BONUS_SCALE) as i64
                        }
                    }
                    _ => 0,
                }
            };

            // Chain pressure: tasks at the head of long successor chains get a
            // bonus because any delay cascades to all downstream tasks.
            // Normalized to [0, 500] range based on chain_remaining_art vs own art.
            let chain_pressure: i64 = if action.chain_remaining_art > action.art {
                let chain_ratio = action.chain_remaining_art as f64 / action.art.max(1) as f64;
                // chain_ratio >= 1.0; a task with 5x more work downstream than itself scores ~400
                ((chain_ratio - 1.0).min(5.0) * 100.0) as i64
            } else {
                0
            };

            // Station contention: tasks on bottleneck stations (many pending tasks)
            // get a bonus so they're scheduled when the station is available.
            let contention_bonus: i64 = if action.station_idx < station_pending_count.len() {
                let ratio = station_pending_count[action.station_idx] as f64 / max_pending as f64;
                (ratio * 200.0) as i64
            } else {
                0
            };

            // Station urgency boost (currently unused — infrastructure kept for future)
            let station_boost: i64 = station_urgency_boost
                .get(&action.station_idx)
                .map(|&b| (b * 0.1) as i64)
                .unwrap_or(0);

            // Fast path: when all weights are 1.0 (default/unperturbed),
            // use pure integer arithmetic to avoid float conversion.
            let is_default_weights = score_weights[0] == 1.0
                && score_weights[1] == 1.0
                && score_weights[2] == 1.0
                && score_weights[3] == 1.0
                && score_weights[4] == 1.0
                && score_weights[5] == 1.0
                && score_weights[6] == 1.0;

            let score = if is_default_weights {
                weighted_urgency + job_boost + proximity_bonus
                    + calage_bonus + chain_pressure + contention_bonus
                    + station_boost + compatibility_bonus
            } else {
                (weighted_urgency as f64 * score_weights[0]) as i64
                    + (job_boost as f64 * score_weights[1]) as i64
                    + (proximity_bonus as f64 * score_weights[2]) as i64
                    + (calage_bonus as f64 * score_weights[3]) as i64
                    + (chain_pressure as f64 * score_weights[4]) as i64
                    + (contention_bonus as f64 * score_weights[5]) as i64
                    + (compatibility_bonus as f64 * score_weights[6]) as i64
                    + station_boost
            };

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
                        station_attrs,
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
            // Decrement job ART: O(1) using stored original_art
            if let Some(entry) = job_remaining_art.get_mut(&actions[action_idx].job_id) {
                *entry -= actions[action_idx].original_art as i64;
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

    // ============================================================
    // DIAGNOSTIC: post-hoc analysis of unplaced actions.
    //
    // Gated by FLUX_DIAG_UNPLACED=1 env var so it stays silent
    // by default. Each unplaced action gets one line listing the
    // dominant blocker (BAT floor, predecessor cascade, station
    // occupied, no-window) measured by sampling ~100 candidate
    // ticks against the FINAL grid state.
    //
    // Used to confirm the "tier-0 mutual blocking" hypothesis:
    // if `station_busy_no_preempt` dominates for an impératif
    // (priority=0) action, that action lost the placement race
    // because every candidate slot was held by another tier-0
    // action and preemption refused (priority equal, not strictly
    // higher).
    // ============================================================
    if std::env::var("FLUX_DIAG_UNPLACED").is_ok() {
        let unplaced_indices: Vec<usize> = actions
            .iter()
            .enumerate()
            .filter(|(_, a)| a.start_tick.is_none())
            .map(|(i, _)| i)
            .collect();

        if !unplaced_indices.is_empty() {
            eprintln!(
                "[UNPLACED-DIAG] analyzing {} unplaced actions",
                unplaced_indices.len()
            );
            for i in &unplaced_indices {
                let action = &actions[*i];
                let earliest_t = action
                    .earliest_start_tick
                    .unwrap_or(now_tick)
                    .max(now_tick);
                let scan_horizon = grid.num_ticks.min(earliest_t.saturating_add(20_000));
                let span = scan_horizon.saturating_sub(earliest_t);
                let step = (span / 100).max(1);

                let pred_unplaced = action
                    .predecessor_idx
                    .map(|p| actions[p].start_tick.is_none())
                    .unwrap_or(false);
                let addl_pred_unplaced_count = action
                    .additional_predecessors
                    .iter()
                    .filter(|&&(p, _)| actions[p].start_tick.is_none())
                    .count();

                let mut samples = 0u32;
                let mut bat_blocked = 0u32;
                let mut pred_not_done = 0u32;
                let mut addl_pred_not_done = 0u32;
                let mut station_busy_pin = 0u32;
                let mut station_busy_no_preempt = 0u32;
                let mut station_busy_could_preempt = 0u32;
                let mut window_too_small = 0u32;
                let mut sample_occupant_priorities: std::collections::HashMap<u8, u32> =
                    std::collections::HashMap::new();
                let mut sample_occupant_jobs: std::collections::HashMap<String, u32> =
                    std::collections::HashMap::new();

                let mut t = earliest_t;
                while t < scan_horizon {
                    samples += 1;
                    if let Some(est) = action.earliest_start_tick {
                        if t < est {
                            bat_blocked += 1;
                            t += step;
                            continue;
                        }
                    }
                    if let Some(pred_idx) = action.predecessor_idx {
                        match actions[pred_idx].end_tick {
                            Some(end) => {
                                let floor = end + action.predecessor_gap_ticks as usize;
                                if floor > t {
                                    pred_not_done += 1;
                                    t += step;
                                    continue;
                                }
                            }
                            None => {
                                pred_not_done += 1;
                                t += step;
                                continue;
                            }
                        }
                    }
                    let addl_done = action.additional_predecessors.iter().all(|&(p, gap)| {
                        actions[p]
                            .end_tick
                            .map_or(false, |e| e + gap as usize <= t)
                    });
                    if !addl_done {
                        addl_pred_not_done += 1;
                        t += step;
                        continue;
                    }
                    match grid.station_action_at(action.station_idx, t) {
                        None => {
                            // Station free at this tick — check the chunk-mini window.
                            let scoring_slack = action.last as i64 - t as i64 - action.art as i64;
                            let needed = action.art.max(1) as usize;
                            let probe = needed.min(60);
                            let win = available_work_window(
                                grid,
                                operator_skills,
                                operator_availability,
                                actions,
                                action.deadline_priority,
                                scoring_slack,
                                action.station_idx,
                                t,
                                probe,
                            );
                            if win < probe {
                                window_too_small += 1;
                            }
                        }
                        Some(occ) if occ == usize::MAX => {
                            station_busy_pin += 1;
                        }
                        Some(occ) if occ < actions.len() => {
                            let occ_priority = actions[occ].deadline_priority;
                            *sample_occupant_priorities.entry(occ_priority).or_insert(0) += 1;
                            *sample_occupant_jobs
                                .entry(actions[occ].job_id.clone())
                                .or_insert(0) += 1;
                            if action.deadline_priority < occ_priority {
                                station_busy_could_preempt += 1;
                            } else {
                                station_busy_no_preempt += 1;
                            }
                        }
                        Some(_) => {
                            station_busy_pin += 1;
                        }
                    }
                    t += step;
                }

                let top_occupant_jobs: Vec<String> = {
                    let mut v: Vec<(String, u32)> = sample_occupant_jobs.into_iter().collect();
                    v.sort_by(|a, b| b.1.cmp(&a.1));
                    v.into_iter()
                        .take(3)
                        .map(|(j, c)| format!("{}×{}", j, c))
                        .collect()
                };
                let occupant_priority_hist: Vec<String> = {
                    let mut v: Vec<(u8, u32)> = sample_occupant_priorities.into_iter().collect();
                    v.sort_by_key(|(p, _)| *p);
                    v.into_iter()
                        .map(|(p, c)| format!("p{}={}", p, c))
                        .collect()
                };

                eprintln!(
                    "[UNPLACED-DIAG] task={} job={} station={} priority={} last={} art={} original_art={} pinned={} bat_floor={:?} pred_idx={:?} pred_unplaced={} addl_preds={} addl_pred_unplaced={} | samples={} bat={} pred={} addl_pred={} occ_no_preempt={} occ_could_preempt={} occ_pinned={} window_short={} | occupant_pri_hist=[{}] top_occupants=[{}]",
                    action.task_id,
                    action.job_id,
                    action.station_idx,
                    action.deadline_priority,
                    action.last,
                    action.art,
                    action.original_art,
                    action.is_pinned,
                    action.earliest_start_tick,
                    action.predecessor_idx,
                    pred_unplaced,
                    action.additional_predecessors.len(),
                    addl_pred_unplaced_count,
                    samples,
                    bat_blocked,
                    pred_not_done,
                    addl_pred_not_done,
                    station_busy_no_preempt,
                    station_busy_could_preempt,
                    station_busy_pin,
                    window_too_small,
                    occupant_priority_hist.join(","),
                    top_occupant_jobs.join(","),
                );
            }
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
/// Apply the peremption rule to a stalled action. Returns true if the rule
/// triggered a reset (mid-setup rewind or post-setup re-calage).
///
/// Two regimes, both gated by peremption_ticks consecutive idle ticks and
/// the per-action retry cap (MAX_PEREMPTION_RETRIES):
///
///   1. Mid-setup (0 < eat < setup_ticks): setup progress lost, eat rewinds
///      to 0, art gets the lost ticks back. No run work was done.
///
///   2. Post-setup (eat >= setup_ticks): calage physically expires (in
///      offset printing: ink dries, registration shifts), but run progress
///      is preserved — on resume, operator re-cales then continues from
///      where run was interrupted. art += setup_ticks (re-setup cost),
///      eat = 0 (so the `eat < setup_ticks` gate reports setup-phase
///      again). Run work already done stays accounted for: art only grows
///      by setup_ticks, not by run progress.
pub fn apply_peremption_rule(
    a: &mut Action,
    setup_ticks: u32,
    peremption_ticks: u32,
    current_tick: u32,
) -> bool {
    // Pause-managed actions opt out of peremption: their gaps are tracked
    // explicitly by the engine (e.g. caleur volant emprunts) and the calage
    // is preserved across the absence by construction. Without this gate,
    // any deliberate operator absence would invalidate the calage at the
    // peremption threshold and force a recalage, defeating the purpose of
    // the borrow. Two opt-out paths:
    //   - `preserve_calage_during_gap=true` : long-lived flag (rarely used).
    //   - `borrow_until_tick=Some(t_end)`  : window flag set by the borrow
    //     site itself (P3b). Self-clearing once the borrow expires so an
    //     unrelated long stall after the borrow ends still hits peremption.
    if a.preserve_calage_during_gap {
        return false;
    }
    if let Some(t_end) = a.borrow_until_tick {
        if current_tick < t_end {
            return false;
        }
        // Borrow window has expired — clear the flag so subsequent calls
        // don't keep gating, and let peremption proceed normally below.
        a.borrow_until_tick = None;
    }
    if peremption_ticks == 0 || a.art == 0 || a.idle_ticks < peremption_ticks {
        return false;
    }
    if a.peremption_count >= MAX_PEREMPTION_RETRIES {
        return false;
    }
    if a.eat > 0 && a.eat < setup_ticks {
        a.art += a.eat;
        a.eat = 0;
        a.work_accumulator = 0.0;
        a.idle_ticks = 0;
        a.peremption_count += 1;
        true
    } else if a.eat >= setup_ticks && a.eat < setup_ticks + a.run_ticks {
        a.art += setup_ticks;
        a.eat = 0;
        a.work_accumulator = 0.0;
        a.idle_ticks = 0;
        a.peremption_count += 1;
        // Flag that a re-calage is pending. The actual segment start is
        // recorded later in advance_action_at_tick, at the first productive
        // tick of the re-setup, so the segment reflects only productive
        // work (not the preceding idle that triggered peremption).
        a.pending_recalage = true;
        true
    } else {
        false
    }
}

/// Side effects on Action state: increments idle_ticks on stall, may
/// reset eat on peremption.
fn assign_action_at_tick(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    action_idx: usize,
    t: usize,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<SkillEntry>],
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

    // Continuation chunk-mini guard. The scoring loop's chunk-mini check
    // (~50 lines above the call to this fn) gates *starts*: an action
    // can't begin in a window that won't amortise its setup. The same
    // policy must apply to *resumes* — otherwise an in-progress action
    // can pick up 1-tick fragments in micro-gaps between consecutive
    // pinned tasks on a capacity-1 station, producing physically
    // impossible interleavings (5 min of work between two unrelated
    // pinned tasks holding the press). Concrete case: Komori G40 with
    // three back-to-back safety-zone pins, an in-progress non-pinned
    // task slipped 5-min stints into the 1-tick precedence-gap holes
    // between them and emitted a wall-clock span overlapping all three
    // pins.
    //
    // We can't reuse `available_work_window` directly because it treats
    // any non-`None` station occupant as a wall, including the action's
    // own marks — past ticks already worked, future ticks pre-reserved
    // by the loop just before scoring. For a continuation those *are*
    // the action's window; we walk the run ourselves and ignore
    // self-marks. Other-action marks (pinned or in-progress neighbour)
    // and operator-off ticks still terminate the run, matching the
    // original semantics.
    let is_continuation = actions[action_idx].start_tick.is_some()
        && actions[action_idx].end_tick.is_none()
        && actions[action_idx].art > 0;
    // Only re-evaluate the chunk-mini guard on a *true* resume — a tick
    // that follows a gap (closure, end-of-shift, missing operator). The
    // scoring loop already validated chunk-mini at the start, so a tick
    // that immediately follows a productive one is part of the same
    // accepted chunk and must be allowed to advance. Re-checking on
    // every consecutive tick is broken: the available window shrinks
    // by one tick per advance, so an action that started in a window
    // of exactly `chunk_mini_ticks` would stall its own setup at tick
    // 3 — leaving an orphan partial-setup stint (e.g. Ryobi 528 4424
    // posed 10 min of setup at 13:15-13:25 then stalled until next-day
    // 07:00, instead of consuming all 9 ticks up to the shop close at
    // 14:00). The micro-gap-between-pins case the guard was written
    // for is naturally a *resume*: the action stalled while the pin
    // owned the cells, then the gap appeared — `tick_operator_log`'s
    // last entry won't be `t - 1` and the check fires as before.
    let resuming_after_gap = match actions[action_idx].tick_operator_log.last() {
        Some(&(last_t, _)) => last_t + 1 < t,
        None => true,
    };
    if is_continuation && resuming_after_gap {
        let action = &actions[action_idx];
        let setup_floor =
            (attrs.chunk_mini_setup_multiplier * action.setup_ticks as f64).ceil() as u32;
        let task_floor =
            (attrs.chunk_mini_task_percentage * action.task_total_ticks as f64).ceil() as u32;
        let chunk_mini_ticks = setup_floor
            .max(task_floor)
            .min(attrs.max_chunk_ticks.max(1));
        let needed = action.art.min(chunk_mini_ticks) as usize;
        if needed > 1 {
            let cap = (grid.num_ticks.saturating_sub(t)).min(needed);
            let mut window = 0usize;
            while window < cap {
                let tick = t + window;
                match grid.station_action_at(station_idx, tick) {
                    None => {}
                    Some(occupant) if occupant == action_idx => {} // self — pass
                    _ => break,
                }
                let any_op = operator_skills.iter().enumerate().any(|(op, skills)| {
                    skills
                        .iter()
                        .any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
                        && operator_availability.is_available(op, tick)
                });
                if !any_op {
                    break;
                }
                window += 1;
            }
            if window < needed {
                // Stall: leave the action in-progress without consuming
                // this tick. Don't mark the station here — the next
                // pinned task arriving must be free to claim it.
                //
                // Peremption is a physical property (ink dries, register
                // shifts) — calage decays regardless of WHY the resume is
                // blocked. Accumulate idle ticks here too, so a multi-day
                // gap between stints triggers the re-calage rule like any
                // other stall. Without this, the early return silently
                // bypassed the post-setup peremption check, and the engine
                // emitted multi-day spans with zero recalages.
                let setup_ticks = actions[action_idx].setup_ticks;
                actions[action_idx].idle_ticks += 1;
                apply_peremption_rule(
                    &mut actions[action_idx],
                    setup_ticks,
                    attrs.peremption_ticks,
                    t as u32,
                );
                return AssignOutcome::Stalled;
            }
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

    // Caleur-volant borrow (P3b): when a setup phase still has no candidate
    // after the standard election, attempt to borrow a versatile op from
    // another action that is past its setup. The donor's calage is
    // preserved across the absence via `borrow_until_tick` (read by
    // apply_peremption_rule). The op is moved on the grid via
    // clear_operator_at_tick + assign_operator, so the donor's productivity
    // computation at this tick sees no op present and stalls cleanly.
    //
    // The borrow target needs an estimate of the borrow window length: we
    // use the current action's remaining setup ticks (`setup_ticks - eat`
    // when eat < setup_ticks, otherwise the full setup_ticks). This sets
    // `borrow_until_tick` to t + window so the donor's peremption is
    // gated for exactly the duration of the borrow.
    if in_setup && operators.is_empty() && grid.num_operators > 0 {
        let target_setup_ticks = actions[action_idx].setup_ticks;
        let already_done = actions[action_idx].eat.min(target_setup_ticks);
        let window_ticks = target_setup_ticks.saturating_sub(already_done).max(1);
        if let Some((op, source_idx)) = try_borrow_setup_op(
            actions,
            operator_skills,
            operator_availability,
            station_idx,
            t,
        ) {
            // Steal the op from the donor's grid claim (if any) and place
            // them on the target station for this tick.
            grid.clear_operator_at_tick(op, t);
            // Mark the donor for peremption gating during the borrow.
            actions[source_idx].borrow_until_tick =
                Some((t as u32).saturating_add(window_ticks).saturating_add(1));
            // Drop the donor's magnetism for the borrow op so they aren't
            // re-elected mid-borrow if they happen to be re-evaluated
            // before the window ends. They'll re-magnet on return because
            // they'll be the natural pick once available.
            actions[source_idx].assigned_operators.retain(|&o| o != op);
            operators = vec![op];
        }
    }

    // Shift-end guard: don't start a NEW task with an operator who is
    // leaving in less than tick_minutes (i.e., not available at t+1).
    // This prevents wasteful single-tick assignments before shift change
    // (e.g., 5 min of setup that can't finish before handoff).
    // Does NOT apply to continuing tasks (start_tick already set).
    if actions[action_idx].start_tick.is_none() && !operators.is_empty() {
        operators.retain(|&op| operator_availability.is_available(op, t + 1));
    }

    if grid.num_operators > 0 && operators.is_empty() {
        // Stall path
        actions[action_idx].idle_ticks += 1;
        grid.assign_station(station_idx, t, action_idx);
        if let Some(g) = group_idx {
            grid.increment_group(g, t);
        }
        apply_peremption_rule(
            &mut actions[action_idx],
            setup_ticks,
            attrs.peremption_ticks,
            t as u32,
        );

        // Skip ahead if NO qualified operator is available at all
        let any_qualified_available = operator_skills.iter().enumerate().any(|(op_idx, skills)| {
            skills.iter().any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
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
                    skills.iter().any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
                        && operator_availability.is_available(op_idx, skip_to)
                });
                if any_avail { break; }
                // Don't overwrite a cell owned by another action. If
                // we did, the other action's emitted span would
                // overlap ours on those cells and the validator would
                // flag a StationConflict. Breaking here returns
                // `SkipTo(skip_to)` which lets the outer loop retry
                // this action at `skip_to`; if the cell is still
                // claimed next time, the action stalls until the
                // blocker completes. The MAX sentinel (ALAP pre-
                // block, maintenance, pin pre-placement) is also
                // treated as "owned by another" here — we never punch
                // through it during skip_ahead.
                if let Some(occupant) = grid.station_action_at(station_idx, skip_to) {
                    if occupant != action_idx {
                        break;
                    }
                }
                grid.assign_station(station_idx, skip_to, action_idx);
                if let Some(g) = group_idx { grid.increment_group(g, skip_to); }
                // Peremption is a physical property (ink dries, registration
                // shifts) — it keeps running regardless of operator presence,
                // so each skipped tick must count toward idle_ticks. Without
                // this, a task that pauses across a closed station / overnight
                // never accrues idle time, and the engine silently skips the
                // required re-calage on resume. See apply_peremption_rule for
                // the re-calage trigger.
                actions[action_idx].idle_ticks += 1;
                apply_peremption_rule(
                    &mut actions[action_idx],
                    setup_ticks,
                    attrs.peremption_ticks,
                    skip_to as u32,
                );
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
        if !operator_availability.is_available(op_idx, t) {
            eprintln!(
                "[GHOST-OP-DIAG] assign_action_at_tick: op_idx={} action={} task={} tick={} station={}: assigned but is_available=false",
                op_idx, action_idx, actions[action_idx].task_id, t, station_idx
            );
        }
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
    operator_skills: &[Vec<SkillEntry>],
    station_attrs: &[StationAttrs],
    operators_this_tick: &[usize],
) -> bool {
    let station_idx = actions[action_idx].station_idx;
    let attrs = &station_attrs[station_idx];

    let setup_ticks = actions[action_idx].setup_ticks;
    let setup_ticks_f = setup_ticks as f64;
    let eat_before = actions[action_idx].eat;
    // Phase is determined by setup_progress relative to setup_ticks; we lift
    // it before calling productivity_at_tick so each operator contributes
    // their setup or run proficiency consistently for this tick.
    let in_setup_phase = actions[action_idx].setup_progress < setup_ticks_f;

    // Raw productivity = sum across operators currently on this station.
    // For solo: each operator contributes their phase-appropriate proficiency.
    // For paired: each contributes their group's productivity for this station
    // (pairing is run-only by construction).
    let raw_productivity: f64 = operators_this_tick
        .iter()
        .map(|&op| productivity_at_tick(op, station_idx, t, grid, operator_groups, operator_skills, in_setup_phase))
        .sum();

    actions[action_idx].tick_operator_log.push((t, operators_this_tick.to_vec()));

    // First productive tick after a pending peremption: record the re-calage
    // window's actual start here, so the segment spans only productive
    // re-setup work, not the idle period that triggered the peremption.
    if actions[action_idx].pending_recalage {
        actions[action_idx].current_recalage_start = Some(t as u32);
        actions[action_idx].pending_recalage = false;
    }

    // Phase-aware effective rate.
    //
    // Setup phase (setup_progress < setup_ticks): the machine needs
    // `attention_full` op-units of attention to reach baseline setup
    // speed (1 setup-tick per real tick). Extra operators don't help —
    // a second op can't physically speed up "the conducteur threading
    // paper". Cap raw at attention_full, normalise to baseline.
    //   rate ∈ [0, 1]; equals 1 when fully staffed (sum_prof ≥ attention_full),
    //   strictly less when an under-skilled op is alone.
    //
    // Run phase (setup_progress ≥ setup_ticks): productivity divides by
    // `attention_run` — the "operator-units required for baseline speed".
    // Capped at `max_run_attention` so over-staffing past the machine's
    // useful ceiling doesn't keep accelerating linearly.
    //   For Hohner (attention_run=2, max_run_attention=2 implicit): two
    //   ops at proficiency 1 → rate = min(2, 2)/2 = 1 (baseline 60 min,
    //   not the buggy 30 min that the unified-art model produced).
    //   One op solo on the same machine → rate = min(1, 2)/2 = 0.5
    //   (run takes 2× longer, which is the correct under-staffing penalty).
    let setup_progress_before = actions[action_idx].setup_progress;
    let effective_rate = if in_setup_phase {
        let cap = attrs.attention_full.max(f64::MIN_POSITIVE);
        raw_productivity.min(cap) / cap
    } else {
        let cap = attrs.max_run_attention.max(attrs.attention_run);
        let need = attrs.attention_run.max(f64::MIN_POSITIVE);
        raw_productivity.min(cap) / need
    };

    actions[action_idx].work_accumulator += effective_rate;
    let work_done = actions[action_idx].work_accumulator.floor() as u32;
    actions[action_idx].work_accumulator -= work_done as f64;
    actions[action_idx].art = actions[action_idx].art.saturating_sub(work_done);
    actions[action_idx].eat += 1;
    actions[action_idx].total_productivity += effective_rate;
    actions[action_idx].ticks_counted += 1;

    // Advance setup_progress when in setup phase. Use the same
    // effective_rate that drained art so the two stay synchronised:
    // one tick of "art" decremented == one tick of setup_progress
    // accumulated, in unit terms. Saturate at setup_ticks so an
    // accumulator overshoot at the boundary doesn't bleed into the
    // run-phase counter.
    if in_setup_phase {
        let new_progress = (setup_progress_before + effective_rate).min(setup_ticks_f);
        actions[action_idx].setup_progress = new_progress;
        // Mark the setup→run boundary the first time we cross it. Use
        // `t + 1` (exclusive end of the last setup tick) to mirror
        // `end_tick`'s convention — both are "first tick where the
        // phase no longer applies".
        if new_progress >= setup_ticks_f && actions[action_idx].setup_end_tick.is_none() {
            actions[action_idx].setup_end_tick = Some((t + 1) as u32);
            // Clear magnetism at the setup→run boundary so the next tick
            // re-elects operators without bias toward the setup_op. This
            // is what enables setup_op != run_op: the run-phase election
            // sees a clean preference list, the run-specialist tiebreaker
            // (P3a) fires, and a roule-only candidate can take over from
            // a versatile caleur. The setup_op is automatically released
            // by the grid because it isn't reassigned at the next tick.
            actions[action_idx].assigned_operators.clear();
        }
    }

    // Finalize an in-flight re-calage segment when setup re-completes.
    // Detected by eat crossing the setup_ticks threshold while a recalage
    // window is open. Kept on `eat` (not setup_progress) because recalage
    // tracks the real-tick window the user sees, and the existing
    // peremption logic re-adds setup_ticks of art when it fires —
    // setup_progress doesn't need to retrocede in that path.
    if actions[action_idx].current_recalage_start.is_some()
        && eat_before < setup_ticks
        && actions[action_idx].eat >= setup_ticks
    {
        let start = actions[action_idx].current_recalage_start.take().unwrap();
        actions[action_idx].recalage_segments.push((start, (t + 1) as u32));
    }

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
/// - The station is already occupied by a DIFFERENT pre-placed pinned
///   action at one of the requested ticks → reject this pin (log and
///   `continue`) and let the regular forward-pass loop place it elsewhere.
///   First-iteration-wins on conflict — `actions` is iterated in stable
///   order, so the resolution is deterministic across runs. Without this
///   guard, two overlapping pins both write the grid (last-writer-wins)
///   AND both emit a `ComputedAssignment`, producing a station-capacity
///   violation visible as overlapping tiles in the UI on capacity-1
///   stations like Komori G40 / Ryobi 528.
/// Returns true iff at least one qualified-and-available operator exists on
/// `station_idx` for every tick in [start, end). Mirrors the fallback logic
/// inside the placement loop without committing to the grid — used by
/// pre_place to probe candidate windows before deciding where to drop a pin.
fn is_window_operator_feasible(
    start: usize,
    end: usize,
    station_idx: usize,
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &OperatorAvailability,
) -> bool {
    for t in start..end {
        let any_op_here = (0..operator_skills.len()).any(|op| {
            if !operator_availability.is_available(op, t) { return false; }
            operator_skills[op]
                .iter()
                .any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
        });
        if !any_op_here { return false; }
    }
    true
}

/// Returns true iff `station_idx` has no commitments other than `self_action`
/// for every tick in [start, end). Used to verify a candidate window is free
/// before shifting a pin onto it.
fn is_window_station_free(
    grid: &ScheduleGrid,
    start: usize,
    end: usize,
    station_idx: usize,
    self_action: usize,
) -> bool {
    for t in start..end {
        if let Some(prev) = grid.station_action_at(station_idx, t) {
            if prev != self_action { return false; }
        }
    }
    true
}

fn pre_place_pinned_actions(
    grid: &mut ScheduleGrid,
    actions: &mut Vec<Action>,
    grow_ticks: usize,
    assignments: &mut Vec<ComputedAssignment>,
    tick_minutes: u32,
    start_date: NaiveDate,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<SkillEntry>],
    operator_availability: &OperatorAvailability,
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    now_tick: usize,
    warnings: &mut Vec<Warning>,
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
        // Honour PHP's explicit pinned_end_tick (derived from
        // assignment.scheduledEnd) when provided. This eliminates the
        // drift that arises from recomputing end as `start + config
        // duration` while the DB stores `start + actual duration`
        // (productivity ≠ 1.0). Drift was the upstream cause of pin-pin
        // overlaps on capacity-1 stations after several Ctrl+Alt+P
        // cycles via the safety-zone Option A pathway. Fallback to the
        // config derivation when end is missing or malformed (≤ start).
        let original_end_t = match actions[i].pinned_end_tick {
            Some(et) if et > start_t => et,
            _ => start_t + total_ticks,
        };
        if original_end_t == start_t {
            // Zero-duration pinned task — degenerate, skip but emit empty assignment
            actions[i].start_tick = Some(start_t);
            actions[i].end_tick = Some(start_t);
            actions[i].art = 0;
            actions[i].eat = 0;
            continue;
        }
        let actual_ticks = original_end_t - start_t;
        let original_start_t = start_t;
        let station_idx = actions[i].station_idx;

        // Make sure the grid covers the requested window before probing
        // feasibility. Subsequent forward-scan iterations grow the grid
        // again per candidate window as needed.
        while original_end_t > grid.num_ticks {
            grid.grow(grow_ticks);
        }

        // earliest_start_tick guard for ALL pins (user + safety-zone).
        //
        // The earliest_start_tick floor sourced from PHP (currently the
        // BAT-deadline rule) is more fundamental than any pin: a task
        // physically cannot start before BAT is approved, regardless of
        // user or safety-zone intent. When a pin sits below this floor,
        // degrade it and emit a warning so the displacement is visible.
        //
        // In-progress exemption (start_t < now_tick): the work is already
        // happening, the floor was either satisfied earlier or the user
        // has acknowledged the constraint by letting the task run. The
        // engine cannot undo committed physical work.
        if let Some(est) = actions[i].earliest_start_tick {
            let in_progress = start_t < now_tick;
            if !in_progress && start_t < est {
                let pin_minutes = start_t as u64 * tick_minutes as u64;
                let est_minutes = est as u64 * tick_minutes as u64;
                let message = if actions[i].is_frozen_by_safety_zone {
                    format!(
                        "Pin safety-zone retiré pour {} : la tâche ne peut démarrer avant {} (contrainte BAT/earliest-start). Replanification.",
                        super::format_minutes(pin_minutes, start_date),
                        super::format_minutes(est_minutes, start_date),
                    )
                } else {
                    format!(
                        "Pin utilisateur retiré pour {} : la tâche ne peut démarrer avant {} (contrainte BAT/earliest-start). La tâche sera replanifiée par le moteur.",
                        super::format_minutes(pin_minutes, start_date),
                        super::format_minutes(est_minutes, start_date),
                    )
                };
                warnings.push(Warning {
                    task_id: Some(actions[i].task_id.clone()),
                    message,
                });
                actions[i].is_pinned = false;
                actions[i].is_frozen_by_safety_zone = false;
                actions[i].pinned_start_tick = None;
                actions[i].pinned_end_tick = None;
                continue;
            }
        }

        // Chunk-mini guard for safety-zone pins.
        //
        // A safety-zone pin reflects a placement decided by a prior
        // compute and propagated forward through every subsequent
        // recompute. Pre-place bypasses the scoring-loop chunk-mini
        // check, so a placement that violates the station's chunk-mini
        // policy (e.g. a 10-min first stint right before end-of-shift)
        // gets perpetuated indefinitely. Re-validate the constraint
        // here for safety-zone pins only — user pins (`is_pinned` &&
        // `!is_frozen_by_safety_zone`) reflect explicit intent and are
        // out of scope (see `Pin = créneau, pas opérateur`).
        //
        // In-progress exemption: when `start_t < now_tick` the operator
        // has already started the work in the real world. The placement
        // is committed; the engine cannot undo physical setup time.
        // Skip the chunk-mini check — preserving the tile (and its
        // end_tick) is more important than re-validating fragmentation.
        // PHP also routes in-progress assignments through this branch
        // by extending the safety-zone condition to
        // `scheduledStart < now < scheduledEnd && !isCompleted`.
        //
        // Otherwise (upcoming-frozen pin, start_t >= now_tick): eat=0
        // is implicit (pre_place runs before the forward-pass loop has
        // incremented eat) and the operator hasn't started yet, so
        // degrading the pin costs no wasted setup.
        //
        // On chunk-mini fail: degrade the pin (clear flags + tick
        // hints), emit a warning, fall through to the scoring loop
        // which re-places under normal rules.
        let is_in_progress_pin = start_t < now_tick;
        if actions[i].is_frozen_by_safety_zone
            && !is_in_progress_pin
            && station_idx < station_attrs.len()
        {
            let attrs = &station_attrs[station_idx];
            let action_setup = actions[i].setup_ticks;
            let action_total = actions[i].task_total_ticks;
            let chunk_mini_ticks = attrs.chunk_mini_ticks(action_setup, action_total);
            let action_run_total = (action_setup + actions[i].run_ticks) as usize;
            let needed = action_run_total.min(chunk_mini_ticks as usize);
            if needed > 1 {
                let cap = grid.num_ticks.saturating_sub(start_t).min(needed);
                let mut window = 0usize;
                while window < cap {
                    let tick = start_t + window;
                    match grid.station_action_at(station_idx, tick) {
                        None => {}
                        Some(occupant) if occupant == i => {}
                        _ => break,
                    }
                    let any_op = operator_skills.iter().enumerate().any(|(op, skills)| {
                        skills.iter().any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
                            && operator_availability.is_available(op, tick)
                    });
                    if !any_op {
                        break;
                    }
                    window += 1;
                }
                if window < needed {
                    let original_minutes = start_t as u64 * tick_minutes as u64;
                    warnings.push(Warning {
                        task_id: Some(actions[i].task_id.clone()),
                        message: format!(
                            "Pin safety-zone retiré pour {} : fenêtre dispo {} min < chunk-mini {} min. Replanification.",
                            super::format_minutes(original_minutes, start_date),
                            window * tick_minutes as usize,
                            needed * tick_minutes as usize,
                        ),
                    });
                    actions[i].is_pinned = false;
                    actions[i].is_frozen_by_safety_zone = false;
                    actions[i].pinned_start_tick = None;
                    actions[i].pinned_end_tick = None;
                    continue;
                }
            }
        }

        // Pin = start-time PREFERENCE, not a hard constraint. If the
        // requested window has no qualified-and-available operator OR the
        // station cell is occupied by another pre-placed pin, scan forward
        // up to a horizon for the closest window where BOTH conditions
        // hold. When found, slide the pin and emit a warning so the user
        // sees the displacement in the compute modal. When no feasible
        // window exists within the horizon, fall through to the original
        // placement and let the per-tick op-finding loop emit operator-less
        // ticks (the legacy degraded behaviour).
        let original_window_feasible = is_window_station_free(
            grid,
            start_t,
            original_end_t,
            station_idx,
            i,
        ) && is_window_operator_feasible(
            start_t,
            original_end_t,
            station_idx,
            operator_skills,
            operator_availability,
        );

        let mut start_t = start_t;
        let mut end_t = original_end_t;
        // Safety-zone pins skip the shift entirely. They reflect the
        // existing schedule produced by a prior compute that the engine
        // already validated; the shift would only fire because the
        // contiguous-window check fails on multi-stint tasks (operator
        // shift end mid-window, overnight closure, lunch break inside the
        // pin span). Sliding them forward lands them on top of other
        // actions and produces visible station overlaps. The closure-
        // aware per-tick marking below already handles operator-off
        // ticks correctly — leaving the pin at its original instant
        // mirrors what Phase 1 produced.
        let allow_shift = !actions[i].is_frozen_by_safety_zone;
        if !original_window_feasible && allow_shift {
            let max_scan_ticks: usize = 30 * 24 * 60 / tick_minutes as usize;
            let mut shifted_to: Option<usize> = None;
            for offset in 1..=max_scan_ticks {
                let candidate_start = original_start_t + offset;
                let candidate_end = candidate_start + actual_ticks;
                while candidate_end > grid.num_ticks {
                    grid.grow(grow_ticks);
                }
                if is_window_station_free(grid, candidate_start, candidate_end, station_idx, i)
                    && is_window_operator_feasible(
                        candidate_start,
                        candidate_end,
                        station_idx,
                        operator_skills,
                        operator_availability,
                    )
                {
                    shifted_to = Some(candidate_start);
                    break;
                }
            }
            if let Some(new_start) = shifted_to {
                let original_minutes = original_start_t as u64 * tick_minutes as u64;
                let new_minutes = new_start as u64 * tick_minutes as u64;
                warnings.push(Warning {
                    task_id: Some(actions[i].task_id.clone()),
                    message: format!(
                        "Pin déplacé : aucun opérateur disponible à {} ; replanifié au créneau dispo le plus proche ({})",
                        super::format_minutes(original_minutes, start_date),
                        super::format_minutes(new_minutes, start_date),
                    ),
                });
                start_t = new_start;
                end_t = new_start + actual_ticks;
                actions[i].pinned_start_tick = Some(start_t);
                actions[i].pinned_end_tick = Some(end_t);
            }
        }

        // Reserve the station for the whole interval.
        //
        // Per-tick filter: skip ticks where no qualified operator is
        // available. Such ticks fall inside a closure (overnight,
        // weekend, lunch) and are physically unusable regardless of
        // any pin — marking them as "occupied by pin i" would force
        // the forward-pass loop to walk past them with `SkipTo`,
        // burning ticks against the `max_outer_t = 100_000` defensive
        // cap when a long pin straddles a multi-day off-period. With
        // this filter the grid only carries the pin's actual working
        // ticks; the dead window stays untouched and forward-pass
        // jumps over it via the regular operator-availability path.
        //
        // Conflict policy: if any USABLE tick in [start_t, end_t) is
        // already occupied by a DIFFERENT pre-placed pinned action,
        // reject this pin entirely (skip grid write, leave
        // start_tick/end_tick unset, do not emit). The action falls
        // through to the regular forward-pass loop which respects
        // `is_station_free` and will place it on the next free slot.
        //
        // Why reject instead of overwrite: capacity-1 stations
        // physically cannot host two tasks at once. Last-writer-wins
        // on the grid combined with unconditional emission would
        // produce two ComputedAssignments on the same (station,
        // tick) — visible as overlapping tiles in the UI and
        // persisted by PHP, where they accumulate across compute
        // cycles via the safety-zone-frozen pin pathway (Option A in
        // ScheduleComputeController.buildJobs).
        let station_idx = actions[i].station_idx;
        let tick_is_usable = |t: usize| -> bool {
            (0..operator_skills.len()).any(|op| {
                operator_availability.is_available(op, t)
                    && operator_skills[op]
                        .iter()
                        .any(|s| s.station_idx == station_idx && s.is_qualified_either_phase())
            })
        };
        let mut conflict_with: Option<usize> = None;
        for t in start_t..end_t {
            if !tick_is_usable(t) {
                continue;
            }
            if let Some(prev) = grid.station_action_at(station_idx, t) {
                if prev != i {
                    conflict_with = Some(prev);
                    break;
                }
            }
        }
        if let Some(prev) = conflict_with {
            let prev_task_id = actions
                .get(prev)
                .map(|a| a.task_id.as_str())
                .unwrap_or("<unknown>");
            eprintln!(
                "[PRE-PLACE] rejecting pin for task {} on station_idx {} at tick {}: cell already occupied by pre-placed action {} (task {}). Falling through to forward-pass placement.",
                actions[i].task_id, station_idx, start_t, prev, prev_task_id
            );
            continue;
        }
        for t in start_t..end_t {
            if tick_is_usable(t) {
                grid.assign_station(station_idx, t, i);
            }
        }

        // Find and assign a default operator roster over the pinned
        // window. Persistence rule: PHP keeps the user's chosen operators
        // from the DB when present; it only adopts this roster when the
        // DB assignment has an empty operator list (a corrupted-legacy
        // state we are trying to self-heal). Without this pass, the
        // engine used to emit an empty operators array for every pinned
        // task, so any DB row that ever lost its operators had no way
        // of recovering them on subsequent computes.
        let max_ops = if station_idx < station_attrs.len() {
            station_attrs[station_idx].max_operators
        } else {
            1
        };
        let setup_ticks = actions[i].setup_ticks as usize;
        for t in start_t..end_t {
            let in_run_phase = setup_ticks == 0 || (t - start_t) >= setup_ticks;
            let mut ops = find_operators_for_station(
                grid,
                t,
                station_idx,
                operator_skills,
                operator_availability,
                operator_groups,
                &actions[i].assigned_operators,
                max_ops,
                !in_run_phase,
            );
            // Availability fallback: if `find_operators_for_station` came
            // back empty (no idle qualified op), broaden the search to
            // qualified ops who may be busy on another station — but
            // STILL respect `is_available()`. Picking an unavailable op
            // (off-day, on holiday, no overtime declared) silently
            // ghost-assigns work to someone who isn't there, which is
            // worse than leaving the tile operator-less.
            //
            // If no qualified-and-available op exists either, leave `ops`
            // empty: the tile renders without an operator for those ticks,
            // surfacing the gap so the user can add overtime / unpin /
            // shift the task. This was the root cause of "Halim works
            // during his Saturday off / annual leave" tickets — the old
            // fallback ignored availability entirely under the rationale
            // "user-pinned, honour it"; that rationale predates the
            // overtime channel and no longer applies.
            if ops.is_empty() {
                // Fallback: when find_operators_for_station yields nothing
                // (no idle qualified op, no eligible pair candidate), pick
                // a qualified+available op who is ALSO genuinely idle on
                // this tick. The earlier version omitted the idle check,
                // which silently double-booked an operator already
                // running another safety-zone-frozen pin on a different
                // station — the operator-view then rendered overlapping
                // tiles for the same person at the same minute.
                //
                // If even this filtered set is empty, leave `ops` empty:
                // the tile renders operator-less and surfaces the gap so
                // the user can add overtime / unpin / shift the task —
                // strictly better than ghost-assigning a person who is
                // physically busy elsewhere.
                let mut fallback: Vec<(usize, f64)> = operator_skills
                    .iter()
                    .enumerate()
                    .filter(|(op, _)| operator_availability.is_available(*op, t))
                    .filter(|(op, _)| grid.operator_is_idle(*op, t))
                    .filter_map(|(op, skills)| {
                        skills
                            .iter()
                            .find(|s| s.station_idx == station_idx)
                            .and_then(|s| {
                                // Sort by run_proficiency (the dominant phase by duration);
                                // qualification check accepts either phase so a calage-only
                                // op is still a valid fallback for safety-zone pinned tasks.
                                if s.is_qualified_either_phase() {
                                    Some((op, s.run_proficiency.max(s.setup_proficiency)))
                                } else {
                                    None
                                }
                            })
                    })
                    .collect();
                fallback.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                ops = fallback
                    .into_iter()
                    .take(max_ops as usize)
                    .map(|(op, _)| op)
                    .collect();
            }
            for &op_idx in &ops {
                if !operator_availability.is_available(op_idx, t) {
                    eprintln!(
                        "[GHOST-OP-DIAG] pre_place_pinned_actions: op_idx={} action={} task={} tick={} station={}: assigned but is_available=false",
                        op_idx, i, actions[i].task_id, t, station_idx
                    );
                }
                grid.assign_operator(op_idx, t, station_idx, 0.0);
                if !actions[i].assigned_operators.contains(&op_idx) {
                    actions[i].assigned_operators.push(op_idx);
                }
            }
            // `build_assignment_for` builds the `operators` field of the
            // emitted ComputedAssignment from `tick_operator_log`, not
            // from the grid snapshot. We need to push each productive
            // tick's roster here so the emission actually contains the
            // operators we just assigned.
            if !ops.is_empty() {
                actions[i].tick_operator_log.push((t, ops));
            }
        }

        // Mark the action as already-completed for the main loop.
        // `eat` is the actual occupied tick count, which equals the
        // pinned interval length when PHP supplied `pinned_end_tick`,
        // and falls back to the config-derived total otherwise.
        actions[i].start_tick = Some(start_t);
        actions[i].end_tick = Some(end_t);
        actions[i].art = 0;
        actions[i].eat = actual_ticks as u32;

        // Emit the ComputedAssignment. If `find_operators_for_station`
        // produced a roster above, `build_assignment_for` will include
        // them. PHP decides whether to adopt them (repair empty-DB
        // state) or keep its own (user's explicit choice).
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
    // Prefer `setup_end_tick` recorded by `advance_action_at_tick` —
    // that's the actual real-tick boundary where setup_progress hit
    // setup_ticks (which can lag the config-derived boundary when an
    // under-skilled solo op makes setup progress slower than baseline).
    // Fallback paths:
    //   * setup_ticks == 0 → no setup phase → None
    //   * pre-placed pinned task whose work bypassed `advance` → use
    //     the config-derived approximation (start + setup_ticks),
    //     same as before. Pinned tasks are user-locked so the slight
    //     under/over-shoot of the boundary in the output is harmless.
    let setup_end_minutes = if setup_ticks == 0 {
        None
    } else if let Some(et) = action.setup_end_tick {
        Some(et as u64 * tick_minutes as u64)
    } else {
        Some((start_t as u64 + setup_ticks as u64) * tick_minutes as u64)
    };

    let recalages = action
        .recalage_segments
        .iter()
        .map(|&(s, e)| crate::model::schedule::PhaseSegment {
            start: super::format_minutes(s as u64 * tick_minutes as u64, start_date),
            end: super::format_minutes(e as u64 * tick_minutes as u64, start_date),
            // Recalage segments mark active re-setup work — not a gap. The
            // GapType::RecalageForced classification applies to the *gap*
            // that triggered the recalage, not the recalage span itself.
            gap_reason: None,
        })
        .collect();

    // Active-window decomposition: derive from `tick_operator_log` which
    // records exactly which ticks the action was productive on. When the
    // action engulfs a pin or sits across a closure, productive ticks are
    // non-contiguous — we group consecutive ticks into runs and emit one
    // PhaseSegment per run. Single-run actions get `None` (continuous, the
    // envelope already represents them faithfully). Multi-run actions get
    // `Some(...)` so the UI can render one tile per active window and any
    // tile that the engine routed around (pin, etc.) stays visible in the
    // gap.
    //
    // tick_operator_log entries are pushed in tick order by the main
    // forward-pass loop and by pre_place_pinned_actions; sort defensively
    // because additive events from `find_operators_for_station` are not
    // guaranteed monotonic across resume edges.
    let active_windows = derive_active_windows_from_log(
        &action.tick_operator_log,
        tick_minutes,
        start_date,
    );

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
        recalages,
        active_windows,
    }
}

/// Group the ticks in `tick_operator_log` into contiguous runs and emit one
/// `PhaseSegment` per run (start = run-start tick × tick_minutes,
/// end = (run-end+1) × tick_minutes). Two ticks are "contiguous" if they
/// differ by exactly 1 — closure ticks are never recorded, so a closure-
/// induced gap naturally breaks the run.
///
/// Returns `None` when there are 0 or 1 distinct runs (continuous action,
/// retro-compatible behaviour). Returns `Some(runs)` when there are ≥2
/// runs, signalling to the UI that the envelope `[scheduled_start,
/// scheduled_end]` contains gaps where the action was inactive.
fn derive_active_windows_from_log(
    tick_operator_log: &[(usize, Vec<usize>)],
    tick_minutes: u32,
    start_date: NaiveDate,
) -> Option<Vec<crate::model::schedule::PhaseSegment>> {
    if tick_operator_log.is_empty() {
        return None;
    }
    // Collect distinct ticks in sorted order. Defensive: dedup + sort even
    // though the producer typically pushes in monotonic order.
    let mut ticks: Vec<usize> = tick_operator_log.iter().map(|(t, _)| *t).collect();
    ticks.sort_unstable();
    ticks.dedup();

    let mut runs: Vec<(usize, usize)> = Vec::new();
    let mut run_start = ticks[0];
    let mut run_end = ticks[0];
    for &t in &ticks[1..] {
        if t == run_end + 1 {
            run_end = t;
        } else {
            runs.push((run_start, run_end));
            run_start = t;
            run_end = t;
        }
    }
    runs.push((run_start, run_end));

    if runs.len() < 2 {
        return None;
    }
    Some(
        runs.into_iter()
            .map(|(s, e)| crate::model::schedule::PhaseSegment {
                start: super::format_minutes(s as u64 * tick_minutes as u64, start_date),
                // Each tick covers [t, t+1) in tick-space; the assignment's
                // wall-clock end of a productive run is therefore at
                // (run_end + 1) × tick_minutes.
                end: super::format_minutes((e as u64 + 1) * tick_minutes as u64, start_date),
                // Active windows are productive spans by definition — the
                // gap_reason field is reserved for the inactive intervals
                // between them, which today the engine does not emit
                // explicitly (the UI infers them from start/end deltas).
                gap_reason: None,
            })
            .collect(),
    )
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

/// Test helper: convert a `Vec<Vec<(usize, f64)>>` of (station_idx, proficiency)
/// tuples into the engine's `Vec<Vec<SkillEntry>>` shape, mirroring the
/// proficiency value to both setup and run phases. Tests that don't care
/// about the asymmetry stay terse.
#[cfg(test)]
pub fn mk_skills(entries: Vec<Vec<(usize, f64)>>) -> Vec<Vec<SkillEntry>> {
    entries
        .into_iter()
        .map(|row| row.into_iter().map(Into::into).collect())
        .collect()
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
        let schedules: Vec<OperatorScheduleData> = (0..num_ops)
            .map(|_| OperatorScheduleData {
                schedules: None,
                reference_week: None,
                absences: Vec::new(),
                overtimes: Vec::new(),
            })
            .collect();
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
        let skills = mk_skills(vec![vec![(0, 1.0)], vec![(1, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0), (2, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0)], vec![(0, 1.0), (1, 1.0)]]);
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
        let skills = mk_skills(vec![vec![(0, 0.95)]]);
        let groups = vec![vec![]];

        grid.assign_operator(0, 5, 0, 0.0);

        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills, false);
        assert_eq!(p, 0.95);
    }

    #[test]
    fn productivity_paired_uses_group_value() {
        let mut grid = make_grid(2, 1, 10);
        let skills = mk_skills(vec![vec![(0, 1.0), (1, 1.0)]]);
        let groups = vec![vec![PreparedConcurrentGroup {
            station_pair: [0, 1],
            productivity: [0.85, 0.92],
        }]];

        grid.assign_operator(0, 5, 0, 0.0);
        grid.assign_operator(0, 5, 1, 0.0);

        // On station 0 in this pairing → 0.85
        let p0 = productivity_at_tick(0, 0, 5, &grid, &groups, &skills, false);
        assert_eq!(p0, 0.85);

        // On station 1 in this pairing → 0.92
        let p1 = productivity_at_tick(0, 1, 5, &grid, &groups, &skills, false);
        assert_eq!(p1, 0.92);
    }

    #[test]
    fn productivity_for_station_not_assigned_is_zero() {
        let grid = make_grid(2, 1, 10);
        let skills = mk_skills(vec![vec![(0, 1.0)]]);
        let groups = vec![vec![]];

        // Op is idle, not on station 0.
        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills, false);
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
        let skills = mk_skills(vec![vec![(0, 1.0)], vec![(0, 1.5)]]);
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
        let skills = mk_skills(vec![vec![(0, 0.95)]]);
        let groups = vec![vec![]];

        // Simulate the algorithm flow: assign_operator then immediately
        // ask for productivity at the same tick.
        grid.assign_operator(0, 5, 0, 0.0);
        let load = grid.operator_load_count(0, 5);
        assert_eq!(load, 1, "load must be 1 after a single assign");

        let p = productivity_at_tick(0, 0, 5, &grid, &groups, &skills, false);
        assert_eq!(p, 0.95, "solo branch must return proficiency");
    }

    /// Without a preference hint, the higher-proficiency op wins as before.
    #[test]
    fn no_preference_picks_highest_proficiency() {
        let grid = make_grid(1, 2, 10);
        let avail = always_available(2, 10);
        let skills = mk_skills(vec![vec![(0, 1.0)], vec![(0, 1.5)]]);
        let groups: Vec<Vec<PreparedConcurrentGroup>> = vec![vec![], vec![]];

        let result = find_operators_for_station(
            &grid, 5, 0, &skills, &avail, &groups, &[], 1, false,
        );
        assert_eq!(result, vec![1], "no preference → highest prof wins");
    }
}

#[cfg(test)]
mod peremption_tests {
    use super::*;

    /// Helper: build a minimal Action with the given setup/run and state.
    fn make_action(setup_ticks: u32, run_ticks: u32, eat: u32, art: u32, idle_ticks: u32) -> Action {
        Action {
            idx: 0,
            task_id: "t".into(),
            job_id: "j".into(),
            station_idx: 0,
            setup_ticks,
            run_ticks,
            art,
            eat,
            last: u64::MAX,
            predecessor_idx: None,
            predecessor_gap_ticks: 0,
            end_tick: None,
            assigned_operators: Vec::new(),
            start_tick: None,
            chunk_info: None,
            deadline_priority: 2,
            job_deadline_tick: u64::MAX,
            earliest_retry_tick: None,
            earliest_start_tick: None,
            additional_predecessors: Vec::new(),
            work_accumulator: 0.0,
            idle_ticks,
            tick_operator_log: Vec::new(),
            original_art: setup_ticks + run_ticks,
            task_total_ticks: setup_ticks + run_ticks,
            total_productivity: 0.0,
            ticks_counted: 0,
            is_pinned: false,
            is_frozen_by_safety_zone: false,
            chain_remaining_art: setup_ticks + run_ticks,
            pinned_start_tick: None,
            pinned_end_tick: None,
            peremption_count: 0,
            pending_recalage: false,
            current_recalage_start: None,
            recalage_segments: Vec::new(),
            spec_snapshot: crate::engine::similarity::SpecSnapshot::default(),
            setup_progress: 0.0,
            setup_end_tick: None,
            outsourced_predecessor_chain: Vec::new(),
            preserve_calage_during_gap: false,
            borrow_until_tick: None,
        }
    }

    /// Mid-setup peremption: 5 of 15 setup done, stall >= peremption_ticks.
    /// Expected: eat rewinds to 0, art gets the 5 ticks back, count = 1.
    /// Regression guard for the original behavior.
    #[test]
    fn mid_setup_peremption_rewinds_setup_progress() {
        // setup=15, run=10, eat=5 (mid-setup), art=20 (25 total - 5 done), idle=8 >= peremption=8
        let mut a = make_action(15, 10, 5, 20, 8);
        let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
        assert!(triggered);
        assert_eq!(a.eat, 0, "eat rewound to 0");
        assert_eq!(a.art, 25, "art gets the 5 ticks back (setup restart)");
        assert_eq!(a.peremption_count, 1);
        assert_eq!(a.idle_ticks, 0);
    }

    /// Post-setup peremption: setup fully done, 3 run ticks done, then long stall.
    /// Expected: eat resets to 0 (setup-phase again), art += setup_ticks,
    /// run progress (3 ticks) is preserved — i.e. art did NOT grow by run progress too.
    #[test]
    fn post_setup_peremption_re_adds_setup_only() {
        // setup=15, run=10, eat=18 (setup+3 run), art=7 (10-3), idle=10 >= 8
        let mut a = make_action(15, 10, 18, 7, 10);
        let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
        assert!(triggered);
        assert_eq!(a.eat, 0, "eat resets to 0 → in_setup gate triggers again");
        assert_eq!(a.art, 7 + 15, "art += setup_ticks only, run progress preserved");
        assert_eq!(a.peremption_count, 1);
    }

    /// Cap: MAX_PEREMPTION_RETRIES consecutive peremptions are allowed,
    /// then further stalls do not reset the action. Prevents infinite loops
    /// when a station is chronically understaffed.
    #[test]
    fn peremption_cap_stops_further_resets() {
        let mut a = make_action(15, 10, 18, 7, 10);
        for i in 1..=MAX_PEREMPTION_RETRIES {
            a.idle_ticks = 10;
            a.eat = 18;
            a.art = 7;
            let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
            assert!(triggered, "iteration {i} should trigger");
            assert_eq!(a.peremption_count, i);
        }
        // One more attempt should NOT reset.
        a.idle_ticks = 10;
        a.eat = 18;
        a.art = 7;
        let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
        assert!(!triggered, "cap prevents further resets");
        assert_eq!(a.eat, 18, "state unchanged past cap");
        assert_eq!(a.art, 7);
    }

    /// Below threshold: idle_ticks < peremption_ticks → no trigger.
    #[test]
    fn no_trigger_below_threshold() {
        let mut a = make_action(15, 10, 18, 7, 5);
        let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
        assert!(!triggered);
        assert_eq!(a.eat, 18);
        assert_eq!(a.art, 7);
        assert_eq!(a.peremption_count, 0);
    }

    /// Peremption disabled (peremption_ticks = 0): never triggers even on long stall.
    /// Matches the station config peremption_threshold_minutes = null/0 case.
    #[test]
    fn peremption_disabled_never_triggers() {
        let mut a = make_action(15, 10, 18, 7, 10_000);
        let triggered = apply_peremption_rule(&mut a, 15, 0, 100);
        assert!(!triggered);
    }

    /// Edge case: action already complete (art == 0) → no reset.
    #[test]
    fn completed_action_not_perempted() {
        let mut a = make_action(15, 10, 25, 0, 100);
        let triggered = apply_peremption_rule(&mut a, 15, 8, 100);
        assert!(!triggered);
    }

    /// Komori G40 weekend scenario: setup=1 tick (15min at tick=15min),
    /// run=7 ticks, eat=2 (setup done + 1 run tick), long weekend stall.
    /// Friday 17:45 → setup tick; 18:00 run starts; weekend idle ~240 ticks;
    /// Monday tick comes back. Expected: re-calage added before run resume.
    #[test]
    fn komori_g40_weekend_triggers_re_calage() {
        // tick = 15 min. setup=15 min = 1 tick. run=105 min = 7 ticks.
        // eat=2 means setup tick done + 1 run tick done. art=7-1=6.
        // peremption_ticks = 120/15 = 8. Weekend idle ~240 >> 8.
        let mut a = make_action(1, 7, 2, 6, 240);
        let triggered = apply_peremption_rule(&mut a, 1, 8, 100);
        assert!(triggered);
        assert_eq!(a.eat, 0, "re-setup needed after weekend");
        assert_eq!(a.art, 6 + 1, "run progress preserved, setup_ticks re-added");
    }

    /// Regression: the chunk-mini guard's early `Stalled` return inside
    /// `assign_action_at_tick` was bypassing `idle_ticks` accumulation,
    /// so multi-day gaps between two stints of the same continuation
    /// never crossed the peremption threshold. Concrete case: Ryobi 528
    /// task on job 4562 (Michelin) — stint 1 on Thu evening, stint 2 on
    /// Mon morning, total productive time exactly setup+run = 120 min,
    /// `recalages: []`. With the fix, the chunk-mini stall increments
    /// `idle_ticks` and runs `apply_peremption_rule` at every tick where
    /// the resume window is too short, so post-setup peremption fires.
    #[test]
    fn chunk_mini_stall_accumulates_idle_for_peremption() {
        use chrono::NaiveDate;
        // Ryobi-528-shaped: setup=1 tick (15 min), run=7 ticks (105 min),
        // peremption_ticks=8 (120 min).
        let setup_ticks = 1u32;
        let run_ticks = 7u32;
        let peremption_ticks = 8u32;

        // Mid-stint state: stint 1 produced 3 ticks of work (1 setup + 2
        // run), so eat=3 sits in the post-setup regime. art=5 remaining.
        let mut action = make_action(setup_ticks, run_ticks, 3, 5, 0);
        action.start_tick = Some(0);
        action.original_art = setup_ticks + run_ticks;
        action.task_total_ticks = setup_ticks + run_ticks;
        action.chain_remaining_art = action.art;

        let attrs = StationAttrs {
            attention_full: 1.0,
            attention_run: 1.0,
            max_run_attention: 1.0,
            masked_time_enabled: false,
            peremption_ticks,
            max_operators: 1,
            max_chunk_ticks: 24,
            chunk_mini_setup_multiplier: 2.0,
            chunk_mini_task_percentage: 0.5,
            similarity_criteria: Vec::new(),
            similarity_score_rules: Vec::new(),
        };

        // Operator 0 unavailable across the entire test horizon — every
        // chunk-mini `any_op` window check returns false, every tick
        // funnels into the early `Stalled` return path.
        let num_ticks = 50;
        let mut availability = OperatorAvailability::new(
            1,
            num_ticks,
            15,
            NaiveDate::from_ymd_opt(2026, 5, 7).unwrap(),
            vec![OperatorScheduleData {
                schedules: None,
                reference_week: None,
                absences: Vec::new(),
                overtimes: Vec::new(),
            }],
        );
        for t in 0..num_ticks {
            while availability.data.get(0).map_or(0, |v| v.len()) <= t {
                let _ = availability.data.get_mut(0).map(|v| v.push(false));
            }
            if let Some(v) = availability.data.get_mut(0) {
                v[t] = false;
            }
        }

        let mut grid = ScheduleGrid::new(1, 1, num_ticks, 15);
        let mut actions = vec![action];
        let skills = mk_skills(vec![vec![(0usize, 1.0f64)]]);
        let groups = vec![vec![]];
        let station_to_group: Vec<Option<(usize, u32)>> = vec![None];

        for t in 0..(peremption_ticks as usize) {
            let outcome = assign_action_at_tick(
                &mut grid,
                &mut actions,
                0,
                t,
                std::slice::from_ref(&attrs),
                &skills,
                &mut availability,
                &groups,
                &station_to_group,
                15,
                96,
            );
            assert!(
                matches!(outcome, AssignOutcome::Stalled),
                "tick {t} expected Stalled via chunk-mini guard"
            );
        }

        assert!(
            actions[0].peremption_count >= 1,
            "peremption must fire after {} chunk-mini stalls; got count={} idle_ticks={}",
            peremption_ticks,
            actions[0].peremption_count,
            actions[0].idle_ticks,
        );
        assert_eq!(
            actions[0].art,
            5 + setup_ticks,
            "post-setup peremption re-adds setup_ticks to art"
        );
        assert!(
            actions[0].pending_recalage,
            "post-setup peremption flags pending_recalage for the next productive tick"
        );
    }

    /// Regression: the continuation chunk-mini guard was firing on every
    /// consecutive tick of an in-progress action, not just on resumes
    /// after a gap. Concrete failure on Ryobi 528 / job 4424 (Michelin):
    /// scoring accepted a start at 13:15 because the 9-tick window
    /// (13:15-14:00, 5-min ticks) ≥ chunk_mini=8 ticks. After 2 advance
    /// ticks the residual window (7 ticks) dropped below chunk_mini=8,
    /// so the guard stalled the 3rd tick — leaving an orphan 10-min
    /// partial-setup stint that peremption then redid the next morning,
    /// burning 35 minutes of free Tanchot time. With the fix, the guard
    /// only re-evaluates after a real gap (tick_operator_log's last
    /// entry isn't t-1), so consecutive advances are allowed to
    /// consume the entire accepted window.
    #[test]
    fn consecutive_continuation_skips_chunk_mini_guard() {
        use chrono::NaiveDate;
        // Ryobi-528-shaped (5-min ticks): setup=3, run=12, task_total=15.
        // chunk_mini = max(2*3, ceil(0.5*15)) = max(6, 8) = 8 ticks.
        let setup_ticks = 3u32;
        let run_ticks = 12u32;

        let mut action = make_action(setup_ticks, run_ticks, 0, setup_ticks + run_ticks, 0);
        action.task_total_ticks = setup_ticks + run_ticks;
        action.chain_remaining_art = action.art;
        // Mark already-started so subsequent ticks go through the
        // continuation path the guard is supposed to gate.
        action.start_tick = Some(0);

        let attrs = StationAttrs {
            attention_full: 1.0,
            attention_run: 1.0,
            max_run_attention: 1.0,
            masked_time_enabled: false,
            peremption_ticks: 24,
            max_operators: 1,
            max_chunk_ticks: 72,
            chunk_mini_setup_multiplier: 2.0,
            chunk_mini_task_percentage: 0.5,
            similarity_criteria: Vec::new(),
            similarity_score_rules: Vec::new(),
        };

        // Operator 0 available for exactly 9 consecutive ticks (0..=8),
        // then off — mirrors Tanchot's last 9 ticks before end-of-shift.
        let num_ticks = 20;
        let availability_window = 9usize;
        let mut availability = OperatorAvailability::new(
            1, num_ticks, 5,
            NaiveDate::from_ymd_opt(2026, 4, 29).unwrap(),
            vec![OperatorScheduleData {
                schedules: None,
                reference_week: None,
                absences: Vec::new(),
                overtimes: Vec::new(),
            }],
        );
        for t in 0..num_ticks {
            while availability.data.get(0).map_or(0, |v| v.len()) <= t {
                let _ = availability.data.get_mut(0).map(|v| v.push(false));
            }
            if let Some(v) = availability.data.get_mut(0) {
                v[t] = t < availability_window;
            }
        }

        let mut grid = ScheduleGrid::new(1, 1, num_ticks, 5);
        let mut actions = vec![action];
        let skills = mk_skills(vec![vec![(0usize, 1.0f64)]]);
        let groups = vec![vec![]];
        let station_to_group: Vec<Option<(usize, u32)>> = vec![None];

        // Place tick 0 and follow the action through the consecutive
        // window. Every tick in [0, 9) must succeed; ticks at and after
        // the operator-off boundary stall via the empty-operators path,
        // not the chunk-mini guard.
        let mut placed = 0usize;
        for t in 0..availability_window {
            let outcome = assign_action_at_tick(
                &mut grid,
                &mut actions,
                0,
                t,
                std::slice::from_ref(&attrs),
                &skills,
                &mut availability,
                &groups,
                &station_to_group,
                5,
                num_ticks,
            );
            match outcome {
                AssignOutcome::Assigned(ref ops) => {
                    advance_action_at_tick(
                        &mut actions, 0, t, &grid, &groups, &skills,
                        std::slice::from_ref(&attrs), ops,
                    );
                    placed += 1;
                }
                AssignOutcome::Stalled => break,
                _ => break,
            }
        }
        assert_eq!(
            placed, availability_window,
            "expected {} consecutive productive ticks; got {} (chunk-mini guard fired mid-chunk)",
            availability_window, placed
        );
        assert_eq!(actions[0].eat, availability_window as u32);
        assert!(actions[0].setup_end_tick.is_some(), "setup must have completed in-window");
    }
}

#[cfg(test)]
mod attention_capacity_tests {
    //! Regression tests for the phase-aware productivity model. The
    //! pre-fix engine summed per-operator productivity into a unified
    //! `art` counter regardless of phase, and ignored `attention_run`
    //! / `attention_full` entirely. That collapsed FIN-on-Hohner from
    //! its physical 60 min (30 setup + 30 run with 2 ops) down to 30 min
    //! (effective_productivity = 2 applied to setup AND run alike).
    //!
    //! Post-fix model:
    //!   * setup phase: rate = min(sum_prof, attention_full) / attention_full
    //!     → ≤ 1.0; fixed real-time when fully staffed (extra ops can't
    //!     speed setup).
    //!   * run phase: rate = min(sum_prof, max_run_attention) / attention_run
    //!     → 1.0 baseline at exactly attention_run op-units, > 1 when
    //!     over-staffed up to max, < 1 when under-staffed.
    //! Phase transition keyed on `setup_progress`, not `eat`.
    use super::*;

    /// Build a minimal Hohner-shaped StationAttrs: capacity-1 station that
    /// requires 2 op-units for run-phase baseline (one op alone runs at
    /// half speed; two ops at baseline).
    fn hohner_attrs() -> StationAttrs {
        StationAttrs {
            attention_full: 1.0,
            attention_run: 2.0,
            max_run_attention: 2.0,
            masked_time_enabled: false,
            peremption_ticks: 0,
            max_operators: 2,
            max_chunk_ticks: 96,
            chunk_mini_setup_multiplier: 0.0,
            chunk_mini_task_percentage: 0.0,
            similarity_criteria: Vec::new(),
            similarity_score_rules: Vec::new(),
        }
    }

    /// Reuse the make_action helper from the sibling peremption_tests
    /// module, but inlined since modules can't import each other's
    /// private items. Same shape, different default fields adjusted
    /// for the advance path (idle_ticks=0 always; we don't trigger
    /// peremption in these tests).
    fn make_advance_action(setup_ticks: u32, run_ticks: u32) -> Action {
        let total = setup_ticks + run_ticks;
        Action {
            idx: 0,
            task_id: "t".into(),
            job_id: "j".into(),
            station_idx: 0,
            setup_ticks,
            run_ticks,
            art: total,
            eat: 0,
            last: u64::MAX,
            predecessor_idx: None,
            predecessor_gap_ticks: 0,
            end_tick: None,
            assigned_operators: Vec::new(),
            start_tick: Some(0),
            chunk_info: None,
            deadline_priority: 2,
            job_deadline_tick: u64::MAX,
            earliest_retry_tick: None,
            earliest_start_tick: None,
            additional_predecessors: Vec::new(),
            work_accumulator: 0.0,
            idle_ticks: 0,
            tick_operator_log: Vec::new(),
            original_art: total,
            task_total_ticks: total,
            total_productivity: 0.0,
            ticks_counted: 0,
            is_pinned: false,
            is_frozen_by_safety_zone: false,
            chain_remaining_art: total,
            pinned_start_tick: None,
            pinned_end_tick: None,
            peremption_count: 0,
            pending_recalage: false,
            current_recalage_start: None,
            recalage_segments: Vec::new(),
            spec_snapshot: crate::engine::similarity::SpecSnapshot::default(),
            setup_progress: 0.0,
            setup_end_tick: None,
            outsourced_predecessor_chain: Vec::new(),
            preserve_calage_during_gap: false,
            borrow_until_tick: None,
        }
    }

    /// FIN regression: Hohner station, attention_run=2, two ops (Frédéric
    /// + Ludovic), task = setup_ticks=6 + run_ticks=6 (= 30 min + 30 min
    /// at 5-min ticks). Pre-fix engine completed in 6 ticks (productivity
    /// summed to 2.0 → both phases halved). Post-fix: setup runs at the
    /// fixed 6-tick rate (capped at attention_full=1), run runs at
    /// 2.0/2.0 = 1.0 baseline → 6 ticks → 12 ticks total.
    #[test]
    fn fin_with_two_ops_takes_full_60min_not_30min() {
        let attrs = vec![hohner_attrs()];
        let mut grid = ScheduleGrid::new(1, 2, 30, 5);
        // Two operators with proficiency 1.0 on station 0, no concurrent
        // groups (Hohner is solo-station, not paired with anything).
        let operator_skills = mk_skills(vec![vec![(0_usize, 1.0)], vec![(0_usize, 1.0)]]);
        let operator_groups: Vec<Vec<PreparedConcurrentGroup>> = vec![Vec::new(), Vec::new()];

        let mut actions = vec![make_advance_action(6, 6)];
        // Both ops are present at every tick of the planned interval.
        for t in 0..12 {
            grid.assign_operator(0, t, 0, 1.0);
            grid.assign_operator(1, t, 0, 1.0);
        }

        // Drive the loop manually, mirroring what `run_forward_pass` does
        // once the action is assigned each tick.
        let mut completed_at: Option<usize> = None;
        for t in 0..30 {
            let done = advance_action_at_tick(
                &mut actions,
                0,
                t,
                &grid,
                &operator_groups,
                &operator_skills,
                &attrs,
                &[0, 1],
            );
            if done {
                completed_at = Some(t);
                break;
            }
        }

        assert_eq!(
            completed_at,
            Some(11),
            "FIN must complete at the END of tick 11 (12 ticks elapsed = 60 min). \
             Pre-fix bug: completed at tick 5 (6 ticks = 30 min) because productivity \
             summed to 2.0 was applied to a unified setup+run art counter."
        );
        assert_eq!(
            actions[0].setup_end_tick,
            Some(6),
            "Setup must end at tick 6 (= 30 min into the task). The output's \
             setupEnd field reads from this and surfaces the actual setup/run \
             boundary instead of collapsing to scheduledEnd."
        );
        assert_eq!(actions[0].art, 0, "art fully drained");
        assert_eq!(actions[0].eat, 12, "12 real ticks elapsed");
    }

    /// Same Hohner station, but only ONE op present (Frédéric solo —
    /// say Ludovic is unavailable). Pre-fix: completed in 12 ticks
    /// (productivity 1.0 unified, setup_ticks + run_ticks = 12 art at
    /// 1.0/tick). Post-fix: setup is fixed at 6 ticks (one op suffices
    /// for setup, attention_full=1 satisfied), but run phase scales
    /// as 1.0/2.0 = 0.5/tick → run takes 12 ticks → 18 ticks total.
    /// This is the correct under-staffing penalty: a station that wants
    /// 2 ops for run-baseline runs at half speed with only 1.
    #[test]
    fn fin_with_one_op_takes_90min_under_staffing_penalty() {
        let attrs = vec![hohner_attrs()];
        let mut grid = ScheduleGrid::new(1, 1, 30, 5);
        let operator_skills = mk_skills(vec![vec![(0_usize, 1.0)]]);
        let operator_groups: Vec<Vec<PreparedConcurrentGroup>> = vec![Vec::new()];

        let mut actions = vec![make_advance_action(6, 6)];
        for t in 0..20 {
            grid.assign_operator(0, t, 0, 1.0);
        }

        let mut completed_at: Option<usize> = None;
        for t in 0..30 {
            let done = advance_action_at_tick(
                &mut actions,
                0,
                t,
                &grid,
                &operator_groups,
                &operator_skills,
                &attrs,
                &[0],
            );
            if done {
                completed_at = Some(t);
                break;
            }
        }

        assert_eq!(
            completed_at,
            Some(17),
            "Solo run on a 2-op-baseline station must take 18 real ticks \
             (= 6 setup + 12 run at half speed)."
        );
        assert_eq!(
            actions[0].setup_end_tick,
            Some(6),
            "Setup still completes in 6 ticks — under-staffing only \
             penalises the run phase (one op is enough to set up)."
        );
    }

    /// Sanity: a station with attention_run=1 (typical solo-op press)
    /// behaves the same way it always did. Ensures the new model is a
    /// no-op for the common case and doesn't regress existing
    /// placements.
    #[test]
    fn solo_station_attention_run_one_unchanged_baseline() {
        let attrs = vec![StationAttrs {
            attention_full: 1.0,
            attention_run: 1.0,
            max_run_attention: 1.0,
            masked_time_enabled: false,
            peremption_ticks: 0,
            max_operators: 1,
            max_chunk_ticks: 96,
            chunk_mini_setup_multiplier: 0.0,
            chunk_mini_task_percentage: 0.0,
            similarity_criteria: Vec::new(),
            similarity_score_rules: Vec::new(),
        }];
        let mut grid = ScheduleGrid::new(1, 1, 20, 5);
        let operator_skills = mk_skills(vec![vec![(0_usize, 1.0)]]);
        let operator_groups: Vec<Vec<PreparedConcurrentGroup>> = vec![Vec::new()];
        let mut actions = vec![make_advance_action(4, 6)];
        for t in 0..15 {
            grid.assign_operator(0, t, 0, 1.0);
        }
        let mut completed_at: Option<usize> = None;
        for t in 0..30 {
            if advance_action_at_tick(
                &mut actions, 0, t, &grid,
                &operator_groups, &operator_skills, &attrs, &[0],
            ) {
                completed_at = Some(t);
                break;
            }
        }
        assert_eq!(completed_at, Some(9), "10 ticks total = 4 setup + 6 run");
        assert_eq!(actions[0].setup_end_tick, Some(4));
    }
}

#[cfg(test)]
mod availability_tests {
    //! Tests for `OperatorAvailability::compute_availability` absence handling.
    //!
    //! Grid: 15-min ticks, start_date = Monday 2026-04-20.
    //! Base schedule used throughout: Mon-Fri 08:00-17:00.
    //! Ticks of interest (Monday): 32 = 08:00, 56 = 14:00, 68 = 17:00,
    //! 128 = Tuesday 08:00, 224 = Wednesday 08:00.

    use super::*;
    use crate::model::operator::{Absence, DaySchedule, OperatingSchedule, TimeSlot};
    use chrono::{NaiveDate, NaiveDateTime};

    fn mf_8_to_17() -> OperatingSchedule {
        let day = Some(DaySchedule {
            slots: vec![TimeSlot { start: "08:00".into(), end: "17:00".into() }],
        });
        OperatingSchedule {
            monday: day.clone(),
            tuesday: day.clone(),
            wednesday: day.clone(),
            thursday: day.clone(),
            friday: day,
            saturday: None,
            sunday: None,
        }
    }

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
    }

    fn build_availability(
        absences: Vec<Absence>,
        overtimes: Vec<Overtime>,
        num_ticks: usize,
    ) -> OperatorAvailability {
        OperatorAvailability::new(
            1,
            num_ticks,
            15,
            NaiveDate::from_ymd_opt(2026, 4, 20).unwrap(),
            vec![OperatorScheduleData {
                schedules: Some(vec![mf_8_to_17()]),
                reference_week: None,
                absences,
                overtimes,
            }],
        )
    }

    #[test]
    fn no_absence_matches_schedule() {
        let a = build_availability(vec![], vec![], 100);
        assert!(!a.is_available(0, 31), "Monday 07:45 outside schedule");
        assert!(a.is_available(0, 32), "Monday 08:00 in schedule");
        assert!(a.is_available(0, 56), "Monday 14:00 in schedule");
        assert!(!a.is_available(0, 68), "Monday 17:00 end-exclusive");
    }

    #[test]
    fn absence_blocks_ticks_inside_range() {
        // Partial-day absence: Monday 14:00–17:00.
        let absences = vec![Absence {
            start_at: dt("2026-04-20T14:00:00"),
            end_at: dt("2026-04-20T17:00:00"),
            reason: Some("RDV".into()),
        }];
        let a = build_availability(absences, vec![], 100);

        assert!(a.is_available(0, 32), "Monday 08:00 — before absence, still available");
        assert!(a.is_available(0, 55), "Monday 13:45 — 15 min before absence");
        assert!(!a.is_available(0, 56), "Monday 14:00 — absence start (inclusive)");
        assert!(!a.is_available(0, 60), "Monday 15:00 — inside absence");
        // Tick 67 = 16:45 is covered by the absence (still inside 14:00-17:00).
        assert!(!a.is_available(0, 67), "Monday 16:45 — inside absence");
    }

    #[test]
    fn absence_outside_schedule_has_no_extra_effect() {
        // Absence overlaps a non-working period (Monday 18:00-20:00).
        // Schedule already marks these ticks unavailable; the absence check
        // doesn't promote them.
        let absences = vec![Absence {
            start_at: dt("2026-04-20T18:00:00"),
            end_at: dt("2026-04-20T20:00:00"),
            reason: None,
        }];
        let a = build_availability(absences, vec![], 100);
        assert!(!a.is_available(0, 72), "Monday 18:00 — outside schedule");
    }

    #[test]
    fn multi_day_absence_spans_whole_range() {
        // Monday 00:00 through Wednesday 23:59:59 — covers ALL three working days.
        let absences = vec![Absence {
            start_at: dt("2026-04-20T00:00:00"),
            end_at: dt("2026-04-22T23:59:59"),
            reason: Some("Congés".into()),
        }];
        // Horizon long enough to span Thursday too.
        let a = build_availability(absences, vec![], 400);

        assert!(!a.is_available(0, 32), "Monday 08:00 — covered");
        assert!(!a.is_available(0, 128), "Tuesday 08:00 — covered");
        assert!(!a.is_available(0, 224), "Wednesday 08:00 — covered");
        assert!(a.is_available(0, 320), "Thursday 08:00 — outside absence range");
    }

    #[test]
    fn multiple_absences_are_union_of_coverage() {
        let absences = vec![
            Absence {
                start_at: dt("2026-04-20T10:00:00"),
                end_at: dt("2026-04-20T11:00:00"),
                reason: None,
            },
            Absence {
                start_at: dt("2026-04-20T14:00:00"),
                end_at: dt("2026-04-20T15:00:00"),
                reason: None,
            },
        ];
        let a = build_availability(absences, vec![], 100);

        assert!(!a.is_available(0, 40), "Monday 10:00 — first absence");
        assert!(a.is_available(0, 48), "Monday 12:00 — between absences");
        assert!(!a.is_available(0, 56), "Monday 14:00 — second absence");
        assert!(a.is_available(0, 64), "Monday 16:00 — after both absences");
    }

    #[test]
    fn overtime_extends_availability_outside_base_schedule() {
        // Schedule is M-F 8:00–17:00. Overtime Monday 17:00–19:00 extends
        // availability past close. Saturday 10:00–16:00 extends a normally-off day.
        let overtimes = vec![
            Overtime {
                start_at: dt("2026-04-20T17:00:00"),
                end_at: dt("2026-04-20T19:00:00"),
                reason: Some("rush".into()),
            },
            Overtime {
                start_at: dt("2026-04-25T10:00:00"),
                end_at: dt("2026-04-25T16:00:00"),
                reason: None,
            },
        ];
        // Horizon long enough to span Saturday (day 5).
        let a = build_availability(vec![], overtimes, 700);

        // Monday: base 8-17 still green, overtime adds 17-19.
        assert!(a.is_available(0, 56), "Monday 14:00 — base schedule");
        assert!(a.is_available(0, 68), "Monday 17:00 — overtime start (inclusive)");
        assert!(a.is_available(0, 75), "Monday 18:45 — inside overtime");
        assert!(!a.is_available(0, 77), "Monday 19:15 — past overtime end");
        // Saturday: base says off, overtime reopens 10-16.
        // Day 5 starts at tick 5*96 = 480; 10:00 is tick 480+40 = 520.
        assert!(!a.is_available(0, 519), "Saturday 09:45 — before overtime");
        assert!(a.is_available(0, 520), "Saturday 10:00 — overtime start");
        assert!(a.is_available(0, 544), "Saturday 16:00 — overtime end (inclusive)");
        assert!(!a.is_available(0, 545), "Saturday 16:15 — past overtime");
    }

    #[test]
    fn overtime_inside_base_schedule_is_noop() {
        // Overtime Monday 10:00–11:00 sits inside base 8:00–17:00; nothing changes.
        let overtimes = vec![Overtime {
            start_at: dt("2026-04-20T10:00:00"),
            end_at: dt("2026-04-20T11:00:00"),
            reason: None,
        }];
        let a = build_availability(vec![], overtimes, 100);

        assert!(a.is_available(0, 32), "Monday 08:00 — base schedule");
        assert!(a.is_available(0, 40), "Monday 10:00 — was already available");
        assert!(a.is_available(0, 44), "Monday 11:00 — still available");
        assert!(!a.is_available(0, 31), "Monday 07:45 — still before base");
        assert!(!a.is_available(0, 68), "Monday 17:00 — still at base end");
    }

    #[test]
    fn multi_day_overtime_spans_whole_range() {
        // Saturday 00:00 through Sunday 23:59:59 — opens the whole weekend.
        let overtimes = vec![Overtime {
            start_at: dt("2026-04-25T00:00:00"),
            end_at: dt("2026-04-26T23:59:59"),
            reason: Some("weekend rush".into()),
        }];
        let a = build_availability(vec![], overtimes, 700);

        // Saturday: day 5. Any tick in day is covered.
        assert!(a.is_available(0, 480), "Saturday 00:00 — covered");
        assert!(a.is_available(0, 512), "Saturday 08:00 — covered");
        // Sunday: day 6.
        assert!(a.is_available(0, 576), "Sunday 00:00 — covered");
        assert!(a.is_available(0, 671), "Sunday 23:45 — last tick of day, covered");
        // Monday following: back to base schedule only (Monday 00:00 = tick 672).
        assert!(!a.is_available(0, 672), "Monday 00:00 — outside overtime, outside base");
        assert!(!a.is_available(0, 673), "Monday 00:15 — outside overtime, outside base");
    }
}

#[cfg(test)]
mod safety_zone_chunk_mini_tests {
    //! Pre-place chunk-mini guard for safety-zone pins.
    //!
    //! When a previous compute placed an action with a too-short first
    //! stint (e.g. 10 min before end-of-shift), the placement gets
    //! propagated through every recompute via the safety-zone freeze
    //! pathway. Pre-place bypasses the scoring-loop chunk-mini check, so
    //! the bad placement perpetuates indefinitely. The guard re-validates
    //! chunk-mini against the contiguous window starting at
    //! `pinned_start_tick` and degrades the pin when the window is too
    //! short. User pins (`is_pinned && !is_frozen_by_safety_zone`) are
    //! out of scope.
    use super::*;
    use crate::engine::similarity::SpecSnapshot;
    use chrono::NaiveDate;

    fn station_attrs_default() -> StationAttrs {
        StationAttrs {
            attention_full: 1.0,
            attention_run: 1.0,
            max_run_attention: 1.0,
            masked_time_enabled: false,
            peremption_ticks: 0,
            max_operators: 1,
            // 5 ticks max chunk = 75 min at 15 min/tick.
            max_chunk_ticks: 5,
            // Defaults: 2.0 × setup, 0.5 × total.
            chunk_mini_setup_multiplier: 2.0,
            chunk_mini_task_percentage: 0.5,
            similarity_criteria: Vec::new(),
            similarity_score_rules: Vec::new(),
        }
    }

    /// Build an Action with the minimum fields the chunk-mini guard
    /// reads. All scoring-related fields are zeroed.
    fn make_action(
        idx: usize,
        station_idx: usize,
        setup_ticks: u32,
        run_ticks: u32,
        pinned_start_tick: usize,
        is_frozen_by_safety_zone: bool,
    ) -> Action {
        let total = setup_ticks + run_ticks;
        Action {
            idx,
            task_id: format!("task-{idx}"),
            job_id: "job".into(),
            station_idx,
            setup_ticks,
            run_ticks,
            art: total,
            original_art: total,
            task_total_ticks: total,
            eat: 0,
            last: u64::MAX,
            predecessor_idx: None,
            predecessor_gap_ticks: 0,
            end_tick: None,
            assigned_operators: Vec::new(),
            start_tick: None,
            chunk_info: None,
            deadline_priority: 2,
            job_deadline_tick: u64::MAX,
            earliest_retry_tick: None,
            earliest_start_tick: None,
            additional_predecessors: Vec::new(),
            work_accumulator: 0.0,
            idle_ticks: 0,
            tick_operator_log: Vec::new(),
            total_productivity: 0.0,
            ticks_counted: 0,
            chain_remaining_art: total,
            is_pinned: true,
            is_frozen_by_safety_zone,
            pinned_start_tick: Some(pinned_start_tick),
            pinned_end_tick: Some(pinned_start_tick + total as usize),
            peremption_count: 0,
            pending_recalage: false,
            current_recalage_start: None,
            recalage_segments: Vec::new(),
            spec_snapshot: SpecSnapshot::default(),
            setup_progress: 0.0,
            setup_end_tick: None,
            outsourced_predecessor_chain: Vec::new(),
            preserve_calage_during_gap: false,
            borrow_until_tick: None,
        }
    }

    /// Build availability where op 0 is available only on the listed
    /// tick ranges (inclusive of start, exclusive of end). Other ticks
    /// are off (closure / end-of-shift).
    fn restricted_availability(num_ticks: usize, available_ranges: &[(usize, usize)]) -> OperatorAvailability {
        let schedules = vec![OperatorScheduleData {
            schedules: None,
            reference_week: None,
            absences: Vec::new(),
            overtimes: Vec::new(),
        }];
        let mut avail = OperatorAvailability::new(
            1,
            num_ticks,
            15,
            NaiveDate::from_ymd_opt(2026, 4, 28).unwrap(),
            schedules,
        );
        for t in 0..num_ticks {
            while avail.data.get(0).map_or(0, |v| v.len()) <= t {
                avail.data.get_mut(0).map(|v| v.push(false));
            }
            let in_range = available_ranges.iter().any(|(a, b)| t >= *a && t < *b);
            if let Some(v) = avail.data.get_mut(0) {
                v[t] = in_range;
            }
        }
        avail
    }

    /// Convenience: invoke pre_place_pinned_actions on a single-action
    /// scenario and return (actions, warnings) for inspection.
    fn run_pre_place(
        action: Action,
        availability: OperatorAvailability,
        station_attrs: StationAttrs,
        num_ticks: usize,
        now_tick: usize,
    ) -> (Vec<Action>, Vec<Warning>) {
        let mut grid = ScheduleGrid::new(1, 1, num_ticks, 15);
        let mut actions = vec![action];
        let mut assignments = Vec::new();
        let mut warnings = Vec::new();
        let skills = mk_skills(vec![vec![(0usize, 1.0f64)]]); // op 0 skilled on station 0
        let groups = vec![vec![]];
        pre_place_pinned_actions(
            &mut grid,
            &mut actions,
            96, // grow_ticks (1 day)
            &mut assignments,
            15,
            NaiveDate::from_ymd_opt(2026, 4, 28).unwrap(),
            &[station_attrs],
            &skills,
            &availability,
            &groups,
            now_tick,
            &mut warnings,
        );
        (actions, warnings)
    }

    #[test]
    fn safety_zone_pin_with_short_window_is_degraded() {
        // Komori-G40-style scenario: setup=4 ticks (60 min) + run=4 ticks
        // (60 min) = 8 ticks total. chunk_mini_ticks =
        // max(ceil(2.0×4)=8, ceil(0.5×8)=4).min(5) = 5.
        // Operator available only on 2 ticks at the pin start.
        let action = make_action(0, 0, 4, 4, 64, /*is_frozen_by_safety_zone=*/ true);
        // Available ticks 64..66 (2 ticks); rest closed until next day.
        let availability = restricted_availability(200, &[(64, 66), (96, 192)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 60,
        );

        assert!(!actions[0].is_pinned, "safety-zone pin must be degraded");
        assert!(!actions[0].is_frozen_by_safety_zone, "is_frozen flag must be cleared");
        assert!(actions[0].pinned_start_tick.is_none(), "pinned_start_tick cleared");
        assert!(actions[0].pinned_end_tick.is_none(), "pinned_end_tick cleared");
        assert!(actions[0].start_tick.is_none(), "start_tick must remain None — scoring loop will place");
        assert!(
            warnings.iter().any(|w| w.message.contains("safety-zone")),
            "expected a degradation warning, got {warnings:?}"
        );
    }

    #[test]
    fn user_pin_with_short_window_is_kept() {
        // Same window as above but the pin is a user pin (not safety-zone).
        // Per `Pin = créneau, pas opérateur`, user pins are honoured.
        let action = make_action(0, 0, 4, 4, 64, /*is_frozen_by_safety_zone=*/ false);
        let availability = restricted_availability(200, &[(64, 66), (96, 192)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 60,
        );

        // User pin still placed (start_tick set or shifted by the
        // existing shift logic; either way is_pinned stays true and
        // no chunk-mini-degradation warning is emitted).
        assert!(actions[0].is_pinned, "user pin must NOT be degraded");
        assert!(
            !warnings.iter().any(|w| w.message.contains("safety-zone retiré")),
            "user pin should not trigger safety-zone degradation warning"
        );
    }

    #[test]
    fn safety_zone_pin_with_adequate_window_is_kept() {
        // Plenty of room: operator available on 10 contiguous ticks
        // covering the entire pin span.
        let action = make_action(0, 0, 4, 4, 64, /*is_frozen_by_safety_zone=*/ true);
        let availability = restricted_availability(200, &[(64, 80)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 60,
        );

        assert!(actions[0].is_pinned, "pin must be kept when window suffices");
        assert!(actions[0].is_frozen_by_safety_zone, "frozen flag preserved");
        assert!(actions[0].start_tick.is_some(), "pin placed: start_tick set");
        assert!(
            !warnings.iter().any(|w| w.message.contains("safety-zone retiré")),
            "no degradation warning on adequate window"
        );
    }

    #[test]
    fn in_progress_safety_zone_pin_skips_chunk_mini_guard() {
        // In-progress pin: pinned_start_tick (60) is in the past
        // relative to now_tick (66). Operator started at tick 60 and is
        // about to finish at tick 68. Without the in-progress exemption
        // the chunk-mini guard would degrade this pin and the tile
        // would jump elsewhere — wrong: the work is physically
        // committed, the engine cannot undo it.
        //
        // The pin must survive the guard verbatim, end_tick stays at 68.
        let action = make_action(0, 0, 4, 4, 60, /*is_frozen_by_safety_zone=*/ true);
        let availability = restricted_availability(200, &[(60, 68)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 66,
        );

        assert!(actions[0].is_pinned, "in-progress pin must be preserved");
        assert!(actions[0].is_frozen_by_safety_zone, "frozen flag preserved");
        assert_eq!(
            actions[0].start_tick,
            Some(60),
            "start_tick verbatim (no shift on in-progress)"
        );
        assert_eq!(
            actions[0].end_tick,
            Some(68),
            "end_tick verbatim — operator finishes when scheduled"
        );
        assert!(
            !warnings.iter().any(|w| w.message.contains("safety-zone retiré")),
            "no degradation warning on in-progress pin: {warnings:?}"
        );
    }

    #[test]
    fn in_progress_pin_with_short_remaining_window_still_kept() {
        // Pathological case: a tile crossing now with very little time
        // left. Even when only 1 tick remains in the future, the
        // in-progress exemption keeps the pin verbatim — the past 7
        // ticks of work are physically done.
        let action = make_action(0, 0, 4, 4, 60, /*is_frozen_by_safety_zone=*/ true);
        let availability = restricted_availability(200, &[(60, 68)]);

        let (actions, _warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 67,
        );

        assert!(
            actions[0].is_pinned,
            "1-tick-remaining in-progress pin must still be preserved"
        );
        assert_eq!(actions[0].end_tick, Some(68));
    }

    // ============================================================
    // earliest_start_tick (BAT-deadline floor) tests
    // ============================================================

    #[test]
    fn user_pin_before_earliest_start_is_degraded_with_warning() {
        // User pinned a task at tick 50 but earliest_start_tick=80
        // (e.g. BAT not approved until then). Even though the pin
        // reflects explicit intent, the BAT constraint is more
        // fundamental — the task physically can't start before the
        // proof is approved. Pin is degraded with an explicit warning.
        let mut action = make_action(0, 0, 4, 4, 50, /*is_frozen_by_safety_zone=*/ false);
        action.earliest_start_tick = Some(80);
        let availability = restricted_availability(200, &[(0, 200)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 0,
        );

        assert!(!actions[0].is_pinned, "user pin must be degraded below earliest_start");
        assert!(actions[0].pinned_start_tick.is_none());
        assert!(actions[0].pinned_end_tick.is_none());
        assert!(
            warnings.iter().any(|w| w.message.contains("Pin utilisateur retiré")
                && w.message.contains("BAT")),
            "expected an explicit user-pin warning mentioning BAT, got {warnings:?}"
        );
    }

    #[test]
    fn safety_zone_pin_before_earliest_start_is_degraded() {
        // Safety-zone pin at tick 50, earliest_start_tick=80 — pin
        // degraded with safety-zone wording.
        let mut action = make_action(0, 0, 4, 4, 50, /*is_frozen_by_safety_zone=*/ true);
        action.earliest_start_tick = Some(80);
        let availability = restricted_availability(200, &[(0, 200)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 0,
        );

        assert!(!actions[0].is_pinned, "safety-zone pin must be degraded below earliest_start");
        assert!(
            warnings.iter().any(|w| w.message.contains("Pin safety-zone retiré")
                && w.message.contains("BAT")),
            "expected an explicit safety-zone-pin warning mentioning BAT, got {warnings:?}"
        );
    }

    #[test]
    fn pin_at_or_above_earliest_start_is_kept() {
        // Pin exactly at earliest_start_tick is honoured.
        let mut action = make_action(0, 0, 4, 4, 80, /*is_frozen_by_safety_zone=*/ false);
        action.earliest_start_tick = Some(80);
        let availability = restricted_availability(200, &[(0, 200)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 0,
        );

        assert!(actions[0].is_pinned, "pin at earliest_start must be kept");
        assert!(
            !warnings.iter().any(|w| w.message.contains("Pin utilisateur retiré")),
            "no warning when pin honours floor"
        );
    }

    #[test]
    fn in_progress_pin_below_earliest_start_is_kept() {
        // Edge case: a pin whose start is in the past relative to now
        // (in-progress) AND below earliest_start_tick. The in-progress
        // exemption wins — the work is already happening, the engine
        // cannot undo it. The earliest_start floor only applies to
        // FUTURE placements.
        let mut action = make_action(0, 0, 4, 4, 50, /*is_frozen_by_safety_zone=*/ true);
        action.earliest_start_tick = Some(80);
        let availability = restricted_availability(200, &[(0, 200)]);

        let (actions, warnings) = run_pre_place(
            action,
            availability,
            station_attrs_default(),
            200,
            /*now_tick=*/ 55, // 55 > 50, so the pin is in-progress
        );

        assert!(actions[0].is_pinned, "in-progress pin must NOT be degraded by earliest_start");
        assert_eq!(actions[0].start_tick, Some(50), "start_tick verbatim");
        assert!(
            !warnings.iter().any(|w| w.message.contains("retiré")),
            "no degradation warning on in-progress pin: {warnings:?}"
        );
    }
}
