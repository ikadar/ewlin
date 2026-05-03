use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::station::StationInput;

use super::forward_pass::{OperatorAvailability, OperatorScheduleData, PreparedConcurrentGroup, StationAttrs};
use super::grid::ScheduleGrid;

/// Ordering strategy for the backward pass.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BackwardOrdering {
    /// Tier-by-tier (0 → 3), intra-tier sort by deadline ascending (EDD).
    TierFirst,
    /// Tier-by-tier (0 → 3), intra-tier sort by slack
    /// (`effective_deadline − remaining_chain_work`). Critical path first.
    SlackFirst,
    /// Globally by deadline ascending, ignoring tiers.
    EarliestDeadline,
}

/// Intra-tier sort strategy used by `run_backward_tier`.
#[derive(Debug, Clone, Copy, PartialEq)]
enum IntraTierSort {
    Deadline,
    Slack,
}

/// Compute LAST values using a reverse forward pass.
///
/// Runs backward from each task's deadline toward t=0, using the same grid,
/// operator availability, and attention mechanics as the forward pass.
///
/// - `TierFirst`: tier-by-tier (0 → 3), intra-tier sort by deadline (EDD).
/// - `SlackFirst`: tier-by-tier, intra-tier sort by slack (critical path first).
/// - `EarliestDeadline`: globally by deadline, ignoring tiers.
///
/// `station_blocked_ranges` and `occupied_slots` seed the backward grid with
/// the same constraints the forward grid will enforce, so LAST values respect
/// maintenance and existing assignments across all FBI iterations. Cross-element
/// (`prerequisite_element_ids`) and cross-job (`required_job_ids`) edges are
/// wired as `additional_successors` for same-tier pairs so a prerequisite's
/// last task is tightened by the consumer's first-task `last_tick - gap`.
///
/// Returns `HashMap<task_id, LAST_tick>` for use by the forward pass.
pub fn compute_last_values(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<crate::engine::forward_pass::SkillEntry>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    horizon_ticks: usize,
    ordering: BackwardOrdering,
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
) -> HashMap<String, u64> {
    let station_id_to_idx: HashMap<String, usize> = stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    // Build backward actions: one per task, with successor links instead of predecessor links
    let mut backward_actions: Vec<BackwardAction> = Vec::new();
    let mut task_id_to_ba_idx: HashMap<String, usize> = HashMap::new();

    // Compute the actual horizon needed: max deadline across all jobs + margin.
    // The caller's horizon_ticks may be too small (e.g. 14 days) while deadlines
    // extend much further. The backward pass grid must cover all deadlines.
    let max_deadline_ticks: usize = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref()
                .and_then(|d| parse_deadline_to_ticks(d, tick_minutes, start_date))
                .map(|t| t as usize)
        })
        .max()
        .unwrap_or(horizon_ticks);
    let effective_horizon = horizon_ticks.max(max_deadline_ticks + 1);

    // Group jobs by deadline priority tier
    let mut tiered_jobs: Vec<(u8, &JobInput)> = jobs.iter().map(|j| (j.deadline_priority, j)).collect();
    tiered_jobs.sort_by_key(|(tier, _)| *tier);

    for (_, job) in &tiered_jobs {
        let deadline_ticks = job
            .deadline
            .as_ref()
            .and_then(|d| parse_deadline_to_ticks(d, tick_minutes, start_date))
            .unwrap_or(effective_horizon as u64);

        for element in &job.elements {
            let mut sorted_tasks = element.tasks.clone();
            sorted_tasks.sort_by_key(|t| t.sequence_order);

            // Build successor links: task[i]'s successor is task[i+1]
            for (ti, task) in sorted_tasks.iter().enumerate() {
                let station_idx = match station_id_to_idx.get(&task.station_id) {
                    Some(&idx) => idx,
                    None => continue,
                };

                let setup_ticks = minutes_to_ticks(task.setup_minutes, tick_minutes);
                // V2 progress capture : prefer the realistic run when a saisie has produced one.
                // `effective_run_minutes()` falls back to the JCF planned `run_minutes` otherwise,
                // so pre-V2 behaviour is preserved.
                let run_ticks = minutes_to_ticks(task.effective_run_minutes(), tick_minutes);
                let total_ticks = setup_ticks + run_ticks;

                // Successor gap: if THIS station is a press, add drying time to successor
                let successor_gap_ticks = if station_idx < stations.len() && stations[station_idx].is_press {
                    minutes_to_ticks(stations[station_idx].drying_time_minutes, tick_minutes)
                } else {
                    0
                };

                let idx = backward_actions.len();
                backward_actions.push(BackwardAction {
                    idx,
                    task_id: task.id.clone(),
                    job_id: job.id.clone(),
                    station_idx,
                    setup_ticks,
                    run_ticks,
                    total_ticks,
                    deadline_ticks,
                    deadline_priority: job.deadline_priority,
                    successor_idx: None, // filled below
                    successor_gap_ticks,
                    remaining_chain_work: 0, // computed below
                    last_tick: None,
                    additional_successors: Vec::new(),
                    is_pinned: task.is_pinned,
                    pinned_start_tick: task.pinned_start_tick.map(|t| t as u64),
                });

                task_id_to_ba_idx.insert(task.id.clone(), idx);

                // Link predecessor to this as successor
                if ti > 0 {
                    let pred_task_id = &sorted_tasks[ti - 1].id;
                    if let Some(&pred_idx) = task_id_to_ba_idx.get(pred_task_id) {
                        backward_actions[pred_idx].successor_idx = Some(idx);
                    }
                }
            }
        }
    }

    // Compute remaining_chain_work: this task + all predecessors.
    compute_chain_work(&mut backward_actions);

    // Wire cross-element (`prerequisite_element_ids`) and cross-job
    // (`required_job_ids`) edges as `additional_successors` so the effective
    // deadline of a prerequisite's last task is tightened by the consumer's
    // first-task `last_tick - gap`. Same-tier restriction keeps
    // tier-stratified processing well-ordered; cross-tier dependencies rely
    // on the forward pass for coordination.
    {
        let mut elem_first: HashMap<String, usize> = HashMap::new();
        let mut elem_last: HashMap<String, usize> = HashMap::new();
        let mut job_first: HashMap<String, usize> = HashMap::new();
        let mut job_last: HashMap<String, usize> = HashMap::new();
        for (i, ba) in backward_actions.iter().enumerate() {
            if let Some(eid) = task_id_to_element_id(&ba.task_id, jobs) {
                elem_first.entry(eid.clone()).or_insert(i);
                elem_last.insert(eid, i);
            }
            job_first.entry(ba.job_id.clone()).or_insert(i);
            job_last.insert(ba.job_id.clone(), i);
        }

        for job in jobs {
            for element in &job.elements {
                if element.prerequisite_element_ids.is_empty() {
                    continue;
                }
                let Some(&consumer_first) = elem_first.get(&element.id) else {
                    continue;
                };
                for prereq_id in &element.prerequisite_element_ids {
                    let Some(&prereq_last) = elem_last.get(prereq_id) else {
                        continue;
                    };
                    if backward_actions[prereq_last].deadline_priority
                        != backward_actions[consumer_first].deadline_priority
                    {
                        continue;
                    }
                    let pred_station = backward_actions[prereq_last].station_idx;
                    let gap = if pred_station < stations.len()
                        && stations[pred_station].is_press
                    {
                        minutes_to_ticks(
                            stations[pred_station].drying_time_minutes,
                            tick_minutes,
                        )
                    } else {
                        0
                    };
                    backward_actions[prereq_last]
                        .additional_successors
                        .push((consumer_first, gap));
                }
            }
        }

        for job in jobs {
            if job.required_job_ids.is_empty() {
                continue;
            }
            let Some(&consumer_first) = job_first.get(&job.id) else {
                continue;
            };
            for req_id in &job.required_job_ids {
                let Some(&prereq_last) = job_last.get(req_id) else {
                    continue;
                };
                if backward_actions[prereq_last].deadline_priority
                    != backward_actions[consumer_first].deadline_priority
                {
                    continue;
                }
                backward_actions[prereq_last]
                    .additional_successors
                    .push((consumer_first, 0));
            }
        }
    }

    // Build grid and operator availability for backward pass
    let num_stations = stations.len();
    let num_operators = operators.len();
    let schedules: Vec<OperatorScheduleData> = operators
        .iter()
        .map(|op| OperatorScheduleData {
            schedules: op.operating_schedules.clone(),
            reference_week: op.schedule_rotation_reference_week,
            absences: op.absences.clone(),
            overtimes: op.overtimes.clone(),
        })
        .collect();

    let mut grid = ScheduleGrid::new(num_stations, num_operators, effective_horizon, tick_minutes);
    let station_capacities: Vec<u32> =
        stations.iter().map(|s| s.effective_capacity()).collect();
    grid.init_station_capacities(&station_capacities);
    let operator_availability = OperatorAvailability::new(
        num_operators, effective_horizon, tick_minutes, start_date, schedules,
    );

    // Seed the backward grid with the same pre-blocks the forward grid will
    // enforce. Without this, LAST values would be optimistic and propose
    // positions later invalidated by maintenance or existing assignments.
    for (station_idx, ranges) in station_blocked_ranges.iter().enumerate() {
        if station_idx >= num_stations {
            continue;
        }
        for &(start_t, end_t) in ranges {
            let clamped_end = end_t.min(effective_horizon);
            for t in start_t..clamped_end {
                grid.assign_station(station_idx, t, usize::MAX);
            }
        }
    }
    for &(station_idx, ref op_indices, start_t, end_t) in occupied_slots {
        let clamped_end = end_t.min(effective_horizon);
        for t in start_t..clamped_end {
            if station_idx < num_stations {
                grid.assign_station(station_idx, t, usize::MAX);
            }
            for &op_idx in op_indices {
                if op_idx < num_operators {
                    grid.assign_operator(op_idx, t, station_idx, 0.0);
                }
            }
        }
    }

    match ordering {
        BackwardOrdering::TierFirst => {
            for tier in &[0u8, 1, 2, 3] {
                run_backward_tier(
                    *tier,
                    &mut backward_actions,
                    &mut grid,
                    station_attrs,
                    operator_skills,
                    operator_groups,
                    &operator_availability,
                    effective_horizon,
                    IntraTierSort::Deadline,
                );
            }
        }
        BackwardOrdering::SlackFirst => {
            for tier in &[0u8, 1, 2, 3] {
                run_backward_tier(
                    *tier,
                    &mut backward_actions,
                    &mut grid,
                    station_attrs,
                    operator_skills,
                    operator_groups,
                    &operator_availability,
                    effective_horizon,
                    IntraTierSort::Slack,
                );
            }
        }
        BackwardOrdering::EarliestDeadline => {
            run_backward_edd(
                &mut backward_actions,
                &mut grid,
                station_attrs,
                operator_skills,
                operator_groups,
                &operator_availability,
                effective_horizon,
            );
        }
    }

    // Collect LAST values
    let mut last_values: HashMap<String, u64> = HashMap::new();
    for ba in &backward_actions {
        let last = ba.last_tick.unwrap_or(0);
        last_values.insert(ba.task_id.clone(), last);
    }

    last_values
}

/// A backward action: represents a task being placed backward from its deadline.
struct BackwardAction {
    idx: usize,
    task_id: String,
    job_id: String,
    station_idx: usize,
    setup_ticks: u32,
    run_ticks: u32,
    total_ticks: u32,
    deadline_ticks: u64,
    deadline_priority: u8,
    successor_idx: Option<usize>,
    successor_gap_ticks: u32,
    remaining_chain_work: u32,
    last_tick: Option<u64>,
    /// Cross-element + cross-job successor links (B1 fix). Each entry is
    /// `(successor_ba_idx, gap_ticks)`. A task is backward-eligible when
    /// every additional successor has `last_tick` set, mirroring how the
    /// intra-element `successor_idx` is handled. The effective deadline
    /// is tightened by `min(own deadline, succ.last_tick - gap)` over all
    /// main + additional successors.
    additional_successors: Vec<(usize, u32)>,
    /// User-pinned anchor: when true, `last_tick` must be fixed at
    /// `pinned_start_tick` rather than computed ALAP, so the propagation
    /// `predecessor.effective_deadline = succ.last_tick - gap` correctly
    /// squeezes predecessors to end before the pin, not before the
    /// unconstrained ALAP value.
    is_pinned: bool,
    pinned_start_tick: Option<u64>,
}

/// O(sum tasks) lookup of a task's owning element id. Used during the
/// one-shot cross-element wiring pass, so we don't pay the cost of a full
/// HashMap when jobs don't have cross-element prereqs.
fn task_id_to_element_id(task_id: &str, jobs: &[JobInput]) -> Option<String> {
    for job in jobs {
        for element in &job.elements {
            for task in &element.tasks {
                if task.id == task_id {
                    return Some(element.id.clone());
                }
            }
        }
    }
    None
}

/// Compute remaining_chain_work for each action.
/// Chain work = this task's total_ticks + all predecessors' total_ticks.
/// We walk from terminal tasks (no predecessor) and accumulate forward.
fn compute_chain_work(actions: &mut Vec<BackwardAction>) {
    // Build predecessor map from successor links
    let mut predecessor_of: HashMap<usize, usize> = HashMap::new();
    for a in actions.iter() {
        if let Some(succ) = a.successor_idx {
            predecessor_of.insert(succ, a.idx);
        }
    }

    // For each action, walk back through predecessors to sum chain work
    let n = actions.len();
    let mut chain_work = vec![0u32; n];
    for i in 0..n {
        let mut total = actions[i].total_ticks;
        let mut cur = i;
        while let Some(&pred) = predecessor_of.get(&cur) {
            total += actions[pred].total_ticks;
            cur = pred;
        }
        chain_work[i] = total;
    }
    for i in 0..n {
        actions[i].remaining_chain_work = chain_work[i];
    }
}

/// Run the backward pass for a single priority tier.
/// Process terminal tasks first (last in element chain or whose all successors —
/// intra-element + cross-element + cross-job — are placed), then their
/// predecessors. `sort_mode` selects the intra-tier ordering within each
/// eligibility wave:
///   - `Deadline`: effective deadline ascending (EDD, classical).
///   - `Slack`: `effective_deadline − remaining_chain_work` ascending
///     (critical-path / tight-slack first).
fn run_backward_tier(
    tier: u8,
    actions: &mut Vec<BackwardAction>,
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<crate::engine::forward_pass::SkillEntry>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
    sort_mode: IntraTierSort,
) {
    let mut placed = vec![false; actions.len()];

    loop {
        let mut eligible: Vec<usize> = Vec::new();
        for i in 0..actions.len() {
            if placed[i] || actions[i].deadline_priority != tier {
                continue;
            }
            let main_ok = match actions[i].successor_idx {
                None => true,
                Some(succ) => placed[succ],
            };
            if !main_ok {
                continue;
            }
            // Cross-element / cross-job successors must all be placed too,
            // so their `last_tick` is available for effective-deadline
            // tightening below.
            let extras_ok = actions[i]
                .additional_successors
                .iter()
                .all(|&(succ, _)| placed[succ]);
            if !extras_ok {
                continue;
            }
            eligible.push(i);
        }

        if eligible.is_empty() {
            break;
        }

        // Tighten effective deadline by every successor (intra + cross).
        for &ai in &eligible {
            let mut effective_deadline = actions[ai].deadline_ticks;
            if let Some(succ) = actions[ai].successor_idx {
                let succ_last = actions[succ].last_tick.unwrap_or(actions[succ].deadline_ticks);
                let gap = actions[ai].successor_gap_ticks as u64;
                effective_deadline = effective_deadline.min(succ_last.saturating_sub(gap));
            }
            let extras = actions[ai].additional_successors.clone();
            for (succ, gap) in extras {
                if let Some(succ_last) = actions[succ].last_tick {
                    effective_deadline =
                        effective_deadline.min(succ_last.saturating_sub(gap as u64));
                }
            }
            actions[ai].deadline_ticks = effective_deadline;
        }

        match sort_mode {
            IntraTierSort::Deadline => {
                eligible.sort_by_key(|&i| actions[i].deadline_ticks);
            }
            IntraTierSort::Slack => {
                eligible.sort_by_key(|&i| {
                    actions[i]
                        .deadline_ticks
                        .saturating_sub(actions[i].remaining_chain_work as u64)
                });
            }
        }

        for &ai in &eligible {
            if place_backward_pinned(ai, actions, grid, horizon_ticks) {
                placed[ai] = true;
                continue;
            }
            let last = place_backward(
                ai,
                actions,
                grid,
                station_attrs,
                operator_skills,
                operator_groups,
                operator_availability,
                horizon_ticks,
            );
            actions[ai].last_tick = Some(last);
            placed[ai] = true;
        }
    }
}

/// Run the backward pass with pure EDD ordering (ignoring tiers).
/// All actions are processed globally by deadline ascending. Within each
/// iteration of the loop, eligible actions (terminal or all successors placed)
/// are sorted by effective deadline and placed.
fn run_backward_edd(
    actions: &mut Vec<BackwardAction>,
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<crate::engine::forward_pass::SkillEntry>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
) {
    let mut placed = vec![false; actions.len()];

    loop {
        let mut eligible: Vec<usize> = Vec::new();
        for i in 0..actions.len() {
            if placed[i] {
                continue;
            }
            let main_ok = match actions[i].successor_idx {
                None => true,
                Some(succ) => placed[succ],
            };
            if !main_ok {
                continue;
            }
            let extras_ok = actions[i]
                .additional_successors
                .iter()
                .all(|&(succ, _)| placed[succ]);
            if !extras_ok {
                continue;
            }
            eligible.push(i);
        }

        if eligible.is_empty() {
            break;
        }

        for &ai in &eligible {
            let mut effective_deadline = actions[ai].deadline_ticks;
            if let Some(succ) = actions[ai].successor_idx {
                let succ_last = actions[succ].last_tick.unwrap_or(actions[succ].deadline_ticks);
                let gap = actions[ai].successor_gap_ticks as u64;
                effective_deadline = effective_deadline.min(succ_last.saturating_sub(gap));
            }
            let extras = actions[ai].additional_successors.clone();
            for (succ, gap) in extras {
                if let Some(succ_last) = actions[succ].last_tick {
                    effective_deadline =
                        effective_deadline.min(succ_last.saturating_sub(gap as u64));
                }
            }
            actions[ai].deadline_ticks = effective_deadline;
        }

        eligible.sort_by_key(|&i| actions[i].deadline_ticks);

        for &ai in &eligible {
            if place_backward_pinned(ai, actions, grid, horizon_ticks) {
                placed[ai] = true;
                continue;
            }
            let last = place_backward(
                ai,
                actions,
                grid,
                station_attrs,
                operator_skills,
                operator_groups,
                operator_availability,
                horizon_ticks,
            );
            actions[ai].last_tick = Some(last);
            placed[ai] = true;
        }
    }
}

/// Short-circuit the ALAP search for user-pinned actions: fix `last_tick`
/// at the pinned start so predecessor deadline tightening (via
/// `succ.last_tick - gap`) correctly squeezes upstream tasks before the
/// pin. Also reserves station cells so other ALAP tasks can't book the
/// pin's window.
///
/// Returns `true` when the pin was handled. Returns `false` when the action
/// is not pinned, or is pinned but has no `pinned_start_tick` — the caller
/// must then fall through to the regular `place_backward` ALAP search.
/// Forward pass's `pre_place_pinned_actions` handles the actual placement
/// emission, so we intentionally do NOT emit a `BackwardPlacement` here.
fn place_backward_pinned(
    action_idx: usize,
    actions: &mut [BackwardAction],
    grid: &mut ScheduleGrid,
    horizon_ticks: usize,
) -> bool {
    let (is_pinned, pin_start_opt, station, duration) = {
        let ba = &actions[action_idx];
        (ba.is_pinned, ba.pinned_start_tick, ba.station_idx, ba.total_ticks as u64)
    };
    if !is_pinned {
        return false;
    }
    let Some(pin_start) = pin_start_opt else {
        return false;
    };
    let pin_end = (pin_start + duration).min(horizon_ticks as u64);
    for t in pin_start..pin_end {
        grid.assign_station(station, t as usize, usize::MAX);
    }
    actions[action_idx].last_tick = Some(pin_start);
    true
}

/// Place a single action backward from its deadline, returning its `LAST_tick`.
///
/// Walks backward tick by tick, finding operators at each tick and consuming
/// proficiency-weighted work until `work_remaining` is exhausted. Setup phase
/// uses solo operators; run phase allows paired operators via concurrent
/// groups. Setup re-calage cost across long idle windows is accounted for
/// via the peremption rule (mirrors the forward pass).
///
/// The backward grid is mutated: productive ticks are marked with
/// `action_idx` on the station and with operator load. Grid mutations scope
/// to the backward pass — they do not leak to the forward grid, but they
/// are what makes later tiers see tighter feasibility in the same pass.
///
/// Returns `0` on failure (the walk exited with work still remaining because
/// the feasibility window is too short, or the station index is invalid).
/// A `0` return is a clean sentinel: callers interpret it as "no feasible
/// LAST", which the forward pass absorbs as maximum urgency.
fn place_backward(
    action_idx: usize,
    actions: &[BackwardAction],
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<crate::engine::forward_pass::SkillEntry>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
) -> u64 {
    let station_idx = actions[action_idx].station_idx;
    let setup_ticks = actions[action_idx].setup_ticks;
    let run_ticks = actions[action_idx].run_ticks;
    let total_work = (setup_ticks + run_ticks) as f64;
    let deadline = actions[action_idx].deadline_ticks as usize;

    if total_work <= 0.0 {
        return deadline.min(horizon_ticks) as u64;
    }

    let attrs = if station_idx < station_attrs.len() {
        &station_attrs[station_idx]
    } else {
        return 0;
    };

    let mut work_remaining = total_work;
    let mut earliest_productive: Option<usize> = None;
    let mut t = deadline.min(horizon_ticks);

    // Peremption bookkeeping: see forward-pass post-setup peremption rule.
    let peremption_ticks = attrs.peremption_ticks;
    let mut consecutive_skipped: u32 = 0;
    let mut peremption_applied: u32 = 0;
    let apply_peremption_on_skip =
        |work_remaining: &mut f64, consecutive_skipped: &mut u32, peremption_applied: &mut u32| {
            if setup_ticks == 0 || peremption_ticks == 0 {
                return;
            }
            if *peremption_applied >= super::forward_pass::MAX_PEREMPTION_RETRIES {
                return;
            }
            if *work_remaining <= setup_ticks as f64 {
                return;
            }
            *consecutive_skipped += 1;
            if *consecutive_skipped >= peremption_ticks {
                *work_remaining += setup_ticks as f64;
                *peremption_applied += 1;
                *consecutive_skipped = 0;
            }
        };

    while work_remaining > 0.001 && t > 0 {
        t -= 1;

        if !grid.is_station_free(station_idx, t) {
            apply_peremption_on_skip(
                &mut work_remaining,
                &mut consecutive_skipped,
                &mut peremption_applied,
            );
            continue;
        }

        let in_run_phase = work_remaining > setup_ticks as f64;

        let operators = super::forward_pass::find_operators_for_station(
            grid,
            t,
            station_idx,
            operator_skills,
            operator_availability,
            operator_groups,
            &[],
            attrs.max_operators,
            !in_run_phase,
        );

        if operators.is_empty() && grid.num_operators > 0 {
            apply_peremption_on_skip(
                &mut work_remaining,
                &mut consecutive_skipped,
                &mut peremption_applied,
            );
            continue;
        }

        consecutive_skipped = 0;

        // Productivity computation — direct from skills/groups, NOT via
        // `productivity_at_tick`. The forward-pass helper inspects the
        // grid to decide "on station?" based on already-written load,
        // but at this point in `place_backward` the grid has NOT been
        // updated with our upcoming operator assignment yet — so that
        // helper would always return 0.0 and the walk would never advance.
        let productivity: f64 = if operators.is_empty() {
            1.0
        } else if in_run_phase {
            operators.iter().map(|&op| {
                let load = grid.operator_stations_at(op, t);
                match load[0].or(load[1]) {
                    None => operator_skills[op]
                        .iter()
                        .find(|s| s.station_idx == station_idx)
                        .map(|s| s.run_proficiency)
                        .unwrap_or(0.0),
                    Some(other_station) => {
                        let pair = if other_station < station_idx {
                            [other_station, station_idx]
                        } else {
                            [station_idx, other_station]
                        };
                        operator_groups[op]
                            .iter()
                            .find(|g| g.station_pair == pair)
                            .and_then(|g| g.productivity_for(station_idx))
                            .unwrap_or(0.0)
                    }
                }
            }).sum()
        } else {
            1.0
        };

        grid.assign_station(station_idx, t, action_idx);
        for &op_idx in &operators {
            grid.assign_operator(op_idx, t, station_idx, 0.0);
        }

        earliest_productive = Some(t);
        work_remaining -= productivity;
    }

    // Bug D guard: incomplete backward walk → clean failure sentinel so
    // the forward pass absorbs the task as maximum-urgency ASAP work.
    if work_remaining > 0.001 {
        return 0;
    }

    earliest_productive.map(|t| t as u64).unwrap_or(0)
}

fn parse_deadline_to_ticks(deadline: &str, tick_minutes: u32, start_date: NaiveDate) -> Option<u64> {
    let minutes = parse_deadline_minutes(deadline, start_date)?;
    Some(minutes / tick_minutes as u64)
}

fn parse_deadline_minutes(deadline: &str, start_date: NaiveDate) -> Option<u64> {
    // Try parsing with timezone offset first (ATOM/RFC 3339: 2026-04-14T17:00:00+02:00)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(deadline) {
        let naive = dt.naive_local();
        let days = (naive.date() - start_date).num_days();
        if days < 0 { return Some(0); }
        use chrono::Timelike;
        return Some(days as u64 * 24 * 60 + naive.time().hour() as u64 * 60 + naive.time().minute() as u64);
    }
    // Try without timezone (YYYY-MM-DDTHH:MM:SS)
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(deadline, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 { return Some(0); }
        use chrono::Timelike;
        return Some(days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64);
    }
    // Try date-only (YYYY-MM-DD)
    if let Ok(d) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
        let days = (d - start_date).num_days();
        if days < 0 { return Some(0); }
        return Some(days as u64 * 24 * 60 + 17 * 60);
    }
    None
}

fn minutes_to_ticks(minutes: u32, tick_minutes: u32) -> u32 {
    if tick_minutes == 0 {
        return minutes;
    }
    (minutes + tick_minutes - 1) / tick_minutes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::job::{ElementInput, JobInput, TaskInput};
    use crate::model::operator::{OperatorInput, OperatorSkill};
    use crate::model::station::StationInput;
    use crate::engine::forward_pass::{build_prepared_groups, StationAttrs};
    use std::collections::HashMap;

    fn station(id: &str) -> StationInput {
        StationInput {
            id: id.to_string(),
            name: id.to_string(),
            attention_full: Some(1.0),
            attention_run: Some(1.0),
            max_run_attention: Some(1.0),
            masked_time_enabled: false,
            attention_masked: None,
            masked_productivity: None,
            tick_minutes: Some(60),
            peremption_threshold_minutes: None,
            max_chunk_minutes: None,
            category_id: None,
            similarity_criteria: None,
            similarity_score_rules: None,
            is_press: false,
            drying_time_minutes: 0,
            max_operators: Some(1),
            capacity: Some(1),
            schedule_exceptions: Vec::new(),
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
        }
    }

    fn operator_all_stations(id: &str, station_ids: &[&str]) -> OperatorInput {
        OperatorInput {
            id: id.to_string(),
            first_name: id.to_string(),
            last_name: "Test".to_string(),
            role: "operator".to_string(),
            operating_schedules: None,
            schedule_rotation_reference_week: None,
            skills: station_ids
                .iter()
                .map(|s| OperatorSkill::uniform(s.to_string(), 1.0))
                .collect(),
            concurrent_groups: vec![],
            absences: vec![],
            overtimes: vec![],
        }
    }

    /// 24/7 operator — used by diagnostics where deadline arithmetic must
    /// match the integration tests' behaviour (which use make_always_on
    /// to dodge the default Mon-Fri 8h-17h schedule).
    fn operator_24_7(id: &str, station_ids: &[&str]) -> OperatorInput {
        use crate::model::operator::{DaySchedule, OperatingSchedule, TimeSlot};
        let full = DaySchedule { slots: vec![TimeSlot { start: "00:00".into(), end: "24:00".into() }] };
        let schedule = OperatingSchedule {
            monday: Some(full.clone()),
            tuesday: Some(full.clone()),
            wednesday: Some(full.clone()),
            thursday: Some(full.clone()),
            friday: Some(full.clone()),
            saturday: Some(full.clone()),
            sunday: Some(full),
        };
        let mut op = operator_all_stations(id, station_ids);
        op.operating_schedules = Some(vec![schedule]);
        op
    }

    /// Regression: pinned MIDDLE task. Before the fix the backward pass
    /// ignored `is_pinned`, so `last_tick` for a pinned mid-job task was
    /// computed via ALAP (or came out as 0 on failure) rather than being
    /// anchored at `pinned_start_tick`. The fix short-circuits the ALAP
    /// search and fixes `last_tick = pinned_start_tick`, which is what
    /// propagates to predecessors via `succ.last - gap`.
    #[test]
    fn compute_last_values_pins_middle_task_at_pinned_start_tick() {
        let stations = vec![station("press"), station("lamin"), station("cut")];
        let alice = operator_all_stations("alice", &["press", "lamin", "cut"]);

        let pinned_tick: usize = 10;

        let job = JobInput {
            id: "job-1".into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            elements: vec![ElementInput {
                id: "elem-1".into(),
                name: None,
                tasks: vec![
                    TaskInput {
                        id: "task-print".into(),
                        station_id: "press".into(),
                        setup_minutes: 0,
                        run_minutes: 60,
                        sequence_order: 0,
                        is_pinned: false,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: None,
                        pinned_end_tick: None,
                        outsourced: None,
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                    },
                    TaskInput {
                        id: "task-laminate".into(),
                        station_id: "lamin".into(),
                        setup_minutes: 0,
                        run_minutes: 60,
                        sequence_order: 1,
                        is_pinned: true,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: Some(pinned_tick),
                        pinned_end_tick: None,
                        outsourced: None,
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                    },
                    TaskInput {
                        id: "task-cut".into(),
                        station_id: "cut".into(),
                        setup_minutes: 0,
                        run_minutes: 60,
                        sequence_order: 2,
                        is_pinned: false,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: None,
                        pinned_end_tick: None,
                        outsourced: None,
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                    },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let station_id_to_idx: HashMap<String, usize> = stations
            .iter()
            .enumerate()
            .map(|(i, s)| (s.id.clone(), i))
            .collect();

        let station_attrs: Vec<StationAttrs> = stations
            .iter()
            .map(|s| StationAttrs {
                attention_full: s.effective_attention_full(),
                attention_run: s.effective_attention_run(),
                max_run_attention: s.effective_max_run_attention(),
                masked_time_enabled: s.masked_time_enabled,
                peremption_ticks: 0,
                max_operators: s.effective_max_operators(),
                max_chunk_ticks: s.effective_max_chunk() / 60u32.max(1),
                chunk_mini_setup_multiplier: s.effective_chunk_mini_setup_multiplier(),
                chunk_mini_task_percentage: s.effective_chunk_mini_task_percentage(),
                similarity_criteria: s.similarity_criteria.clone().unwrap_or_default(),
                similarity_score_rules: s.similarity_score_rules.clone().unwrap_or_default(),
            })
            .collect();

        let operator_skills: Vec<Vec<crate::engine::forward_pass::SkillEntry>> = vec![alice.clone()]
            .iter()
            .map(|op| {
                op.skills
                    .iter()
                    .filter_map(|sk| {
                        station_id_to_idx
                            .get(&sk.station_id)
                            .map(|&idx| crate::engine::forward_pass::SkillEntry {
                                station_idx: idx,
                                setup_proficiency: sk.setup_proficiency,
                                run_proficiency: sk.run_proficiency,
                            })
                    })
                    .collect()
            })
            .collect();

        let operator_groups = build_prepared_groups(&[alice.clone()], &station_id_to_idx);

        let start_date = NaiveDate::from_ymd_opt(2026, 4, 22).unwrap();
        let tick_minutes: u32 = 60;
        let horizon_ticks: usize = 48;

        let last_values = compute_last_values(
            &[job],
            &stations,
            &[alice],
            &station_attrs,
            &operator_skills,
            &operator_groups,
            tick_minutes,
            start_date,
            horizon_ticks,
            BackwardOrdering::TierFirst,
            &[],
            &[],
        );

        // This is the CORE assertion: the pinned task's last_tick is the
        // pinned start, not some ALAP value or 0-on-failure sentinel.
        assert_eq!(
            last_values.get("task-laminate").copied(),
            Some(pinned_tick as u64),
            "pinned middle task must have last_tick == pinned_start_tick (got {:?})",
            last_values.get("task-laminate")
        );
    }

    /// Diagnostic for the proximity_bonus regression: emit LAST values for
    /// two same-tier 2-step jobs with very different deadlines (5h vs 48h).
    /// This is the same scenario as the integration test
    /// `proximity_bonus_prioritises_tight_deadline_job` — if LAST values
    /// here are differentiated, the bug is in forward-pass scoring; if
    /// they collapse to 0 / equal, the bug is in this backward pass.
    #[test]
    fn diag_last_values_for_proximity_scenario() {
        let stations = vec![station("s1"), station("s2")];
        let alice = operator_24_7("alice", &["s1", "s2"]);

        let start_date = NaiveDate::from_ymd_opt(2026, 4, 22).unwrap();
        let day_minutes: u64 = 24 * 60;

        // Deadline at 5h after start_date midnight, in compute_last_values
        // format. parse_deadline_to_ticks uses minutes since start_date 00:00.
        let deadline_a = format!("2026-04-22T05:00:00");
        let deadline_b = format!("2026-04-24T00:00:00"); // 48h later

        let make_job = |id: &str, deadline: String| JobInput {
            id: id.into(),
            reference: None,
            description: None,
            deadline: Some(deadline),
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![
                    TaskInput { id: format!("{id}-s1"), station_id: "s1".into(), setup_minutes: 0, run_minutes: 120, sequence_order: 0, is_pinned: false, is_frozen_by_safety_zone: false, pinned_start_tick: None, pinned_end_tick: None, outsourced: None, earliest_start_tick: None, realistic_run_minutes: None, cumulative_position_pct: None, slot_volume_pct: None },
                    TaskInput { id: format!("{id}-s2"), station_id: "s2".into(), setup_minutes: 0, run_minutes: 120, sequence_order: 1, is_pinned: false, is_frozen_by_safety_zone: false, pinned_start_tick: None, pinned_end_tick: None, outsourced: None, earliest_start_tick: None, realistic_run_minutes: None, cumulative_position_pct: None, slot_volume_pct: None },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let jobs = vec![make_job("B", deadline_b), make_job("A", deadline_a)];

        let station_id_to_idx: HashMap<String, usize> = stations
            .iter()
            .enumerate()
            .map(|(i, s)| (s.id.clone(), i))
            .collect();

        let station_attrs: Vec<StationAttrs> = stations
            .iter()
            .map(|s| StationAttrs {
                attention_full: s.effective_attention_full(),
                attention_run: s.effective_attention_run(),
                max_run_attention: s.effective_max_run_attention(),
                masked_time_enabled: s.masked_time_enabled,
                peremption_ticks: 0,
                max_operators: s.effective_max_operators(),
                max_chunk_ticks: s.effective_max_chunk() / 60u32.max(1),
                chunk_mini_setup_multiplier: s.effective_chunk_mini_setup_multiplier(),
                chunk_mini_task_percentage: s.effective_chunk_mini_task_percentage(),
                similarity_criteria: s.similarity_criteria.clone().unwrap_or_default(),
                similarity_score_rules: s.similarity_score_rules.clone().unwrap_or_default(),
            })
            .collect();

        let operator_skills: Vec<Vec<crate::engine::forward_pass::SkillEntry>> = vec![alice.clone()]
            .iter()
            .map(|op| {
                op.skills
                    .iter()
                    .filter_map(|sk| {
                        station_id_to_idx
                            .get(&sk.station_id)
                            .map(|&idx| crate::engine::forward_pass::SkillEntry {
                                station_idx: idx,
                                setup_proficiency: sk.setup_proficiency,
                                run_proficiency: sk.run_proficiency,
                            })
                    })
                    .collect()
            })
            .collect();

        let operator_groups = build_prepared_groups(&[alice.clone()], &station_id_to_idx);

        let last_values = compute_last_values(
            &jobs, &stations, &[alice], &station_attrs, &operator_skills,
            &operator_groups, 60, start_date, (day_minutes / 60) as usize * 3,
            BackwardOrdering::TierFirst, &[], &[],
        );

        eprintln!("LAST(A-s1) = {:?}", last_values.get("A-s1"));
        eprintln!("LAST(A-s2) = {:?}", last_values.get("A-s2"));
        eprintln!("LAST(B-s1) = {:?}", last_values.get("B-s1"));
        eprintln!("LAST(B-s2) = {:?}", last_values.get("B-s2"));

        // The bug suggested by the integration test is "LAST=0 for all tasks";
        // this diagnostic proved the comment was outdated. With a 24/7
        // operator schedule the backward pass produces correctly differentiated
        // values: A is small (urgent), B is large (loose). The scoring bug
        // therefore lives in the forward pass, not here.
        let last_a_s1 = last_values.get("A-s1").copied().unwrap_or(u64::MAX);
        let last_b_s1 = last_values.get("B-s1").copied().unwrap_or(u64::MAX);
        assert!(
            last_a_s1 < last_b_s1,
            "diag regression guard: backward pass MUST differentiate LAST \
             for same-tier jobs with very different deadlines. \
             Got A-s1={last_a_s1}, B-s1={last_b_s1}"
        );
    }
}
