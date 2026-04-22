use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::station::StationInput;

use super::forward_pass::{OperatorAvailability, OperatorScheduleData, PreparedConcurrentGroup, StationAttrs};
use super::grid::ScheduleGrid;

/// A placement produced by the backward pass for ALAP scheduling.
#[derive(Debug, Clone)]
pub struct BackwardPlacement {
    pub task_id: String,
    pub job_id: String,
    pub station_idx: usize,
    pub start_tick: usize,
    pub end_tick: usize,
    pub operator_indices: Vec<usize>,
    pub deadline_priority: u8,
}

/// Ordering strategy for the backward pass.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BackwardOrdering {
    /// Process jobs by deadline priority tier first (imperative before flexible).
    TierFirst,
    /// Process jobs by earliest deadline first (EDD).
    EarliestDeadline,
}

/// Compute LAST values using a reverse forward pass.
///
/// Runs backward from each task's deadline toward t=0, using the same grid,
/// operator availability, and attention mechanics as the forward pass.
///
/// With `TierFirst` ordering, jobs are processed by deadline priority tier
/// (imperative first, flexible last), then EDD within each tier.
/// With `EarliestDeadline` ordering, all jobs are processed globally by
/// deadline ascending, ignoring tiers. This can produce different LAST
/// values because capacity is reserved in a different order.
///
/// Returns HashMap<task_id, LAST_tick> for use by the forward pass.
pub fn compute_last_values(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    horizon_ticks: usize,
    ordering: BackwardOrdering,
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
                let run_ticks = minutes_to_ticks(task.run_minutes, tick_minutes);
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

    // Compute remaining_chain_work: this task + all predecessors not yet placed
    // Walk predecessor chains (since we stored successor links, we need to invert)
    compute_chain_work(&mut backward_actions);

    // Build grid and operator availability for backward pass
    let num_stations = stations.len();
    let num_operators = operators.len();
    let schedules: Vec<OperatorScheduleData> = operators
        .iter()
        .map(|op| OperatorScheduleData {
            schedules: op.operating_schedules.clone(),
            reference_week: op.schedule_rotation_reference_week,
            absences: op.absences.clone(),
        })
        .collect();

    let mut grid = ScheduleGrid::new(num_stations, num_operators, effective_horizon, tick_minutes);
    let operator_availability = OperatorAvailability::new(
        num_operators, effective_horizon, tick_minutes, start_date, schedules,
    );

    match ordering {
        BackwardOrdering::TierFirst => {
            // Process by tier: imperative first, then important, standard, flexible
            let tiers = [0u8, 1, 2, 3];
            for tier in &tiers {
                run_backward_tier(
                    *tier,
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
        BackwardOrdering::EarliestDeadline => {
            // Process ALL actions globally by deadline ascending, ignoring tiers.
            // This produces different LAST values because capacity reservation
            // order changes: a tight-deadline flexible job can reserve capacity
            // before a loose-deadline imperative job.
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

/// Like `compute_last_values`, but also returns ALAP placements for jobs
/// in the specified priority tiers (e.g., [0, 1] for imperative + important).
/// These placements can be converted to occupied_slots for a second FBI pass.
pub fn compute_last_values_with_placements(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    horizon_ticks: usize,
    alap_tiers: &[u8],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
) -> (HashMap<String, u64>, Vec<BackwardPlacement>) {
    let station_id_to_idx: HashMap<String, usize> = stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    let mut backward_actions: Vec<BackwardAction> = Vec::new();
    let mut task_id_to_ba_idx: HashMap<String, usize> = HashMap::new();

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

            for (ti, task) in sorted_tasks.iter().enumerate() {
                let station_idx = match station_id_to_idx.get(&task.station_id) {
                    Some(&idx) => idx,
                    None => continue,
                };

                let setup_ticks = minutes_to_ticks(task.setup_minutes, tick_minutes);
                let run_ticks = minutes_to_ticks(task.run_minutes, tick_minutes);
                let total_ticks = setup_ticks + run_ticks;

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
                    successor_idx: None,
                    successor_gap_ticks,
                    remaining_chain_work: 0,
                    last_tick: None,
                    additional_successors: Vec::new(),
                });

                task_id_to_ba_idx.insert(task.id.clone(), idx);

                if ti > 0 {
                    let pred_task_id = &sorted_tasks[ti - 1].id;
                    if let Some(&pred_idx) = task_id_to_ba_idx.get(pred_task_id) {
                        backward_actions[pred_idx].successor_idx = Some(idx);
                    }
                }
            }
        }
    }

    compute_chain_work(&mut backward_actions);

    // B1 fix: wire cross-element and cross-job successors.
    //
    // `successor_idx` above captures only the intra-element chain. For ALAP
    // to correctly order elements whose first task depends on a prerequisite
    // element's last task, we attach cross-element / cross-job edges as
    // `additional_successors` on the predecessor's last-task BackwardAction.
    //
    // Restriction: both endpoints must share the same tier. Cross-tier
    // dependencies don't fit ALAP's tier-by-tier scheduling — they are
    // handled by the forward pass. In practice cross-element within a job
    // is always same-tier (tier is a job attribute), so this only restricts
    // cross-job `required_job_ids`.
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

    let num_stations = stations.len();
    let num_operators = operators.len();
    let schedules: Vec<OperatorScheduleData> = operators
        .iter()
        .map(|op| OperatorScheduleData {
            schedules: op.operating_schedules.clone(),
            reference_week: op.schedule_rotation_reference_week,
            absences: op.absences.clone(),
        })
        .collect();

    let mut grid = ScheduleGrid::new(num_stations, num_operators, effective_horizon, tick_minutes);
    let operator_availability = OperatorAvailability::new(
        num_operators, effective_horizon, tick_minutes, start_date, schedules,
    );

    // Bugs A+B fix: seed the backward grid with the same pre-blocks the
    // forward grid will receive. Without this, ALAP may reserve cells that
    // later get overwritten by pinned tasks, existing assignments, or
    // station maintenance windows — a silent desync that can create
    // invalid placements.
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

    // Build task_id → element_id map for per-element rollback tracking (B3 fix).
    // ALAP may succeed on the terminal task of an element and fail on its
    // intra-element predecessor, which would leave the terminal's placement
    // orphaned while its predecessor falls through to forward_pass with a
    // crushed deadline. B3 fix: if ANY task in an element chain fails ALAP,
    // roll back ALL of that element's ALAP placements so the entire element
    // goes through forward_pass uniformly.
    let mut task_to_element: HashMap<String, String> = HashMap::new();
    for job in jobs {
        for element in &job.elements {
            for task in &element.tasks {
                task_to_element.insert(task.id.clone(), element.id.clone());
            }
        }
    }

    // Phase 1: Place ALAP tiers only (e.g., imperative + important)
    let mut placements: Vec<BackwardPlacement> = Vec::new();
    let mut failed_elements: HashSet<String> = HashSet::new();

    for &tier in alap_tiers {
        let mut placed = vec![false; backward_actions.len()];

        loop {
            let eligible: Vec<usize> = (0..backward_actions.len())
                .filter(|&i| {
                    if placed[i] || backward_actions[i].deadline_priority != tier {
                        return false;
                    }
                    let main_ok = match backward_actions[i].successor_idx {
                        None => true,
                        Some(succ) => placed[succ],
                    };
                    if !main_ok {
                        return false;
                    }
                    // B1: cross-element / cross-job successors must all be
                    // placed before this predecessor can be ALAP-placed.
                    backward_actions[i]
                        .additional_successors
                        .iter()
                        .all(|&(succ, _)| placed[succ])
                })
                .collect();

            if eligible.is_empty() {
                break;
            }

            for &ai in &eligible {
                // Compute effective deadline from ALL successors (intra +
                // cross-element + cross-job). The tightest succ.last_tick - gap
                // wins — the predecessor must finish before ANY of them starts.
                let mut effective_deadline = backward_actions[ai].deadline_ticks;
                if let Some(succ) = backward_actions[ai].successor_idx {
                    if let Some(succ_last) = backward_actions[succ].last_tick {
                        let gap = backward_actions[ai].successor_gap_ticks as u64;
                        effective_deadline =
                            effective_deadline.min(succ_last.saturating_sub(gap));
                    }
                }
                let extras = backward_actions[ai].additional_successors.clone();
                for (succ, gap) in extras {
                    if let Some(succ_last) = backward_actions[succ].last_tick {
                        effective_deadline =
                            effective_deadline.min(succ_last.saturating_sub(gap as u64));
                    }
                }
                backward_actions[ai].deadline_ticks = effective_deadline;
            }

            let mut sorted_eligible = eligible.clone();
            sorted_eligible.sort_by_key(|&i| backward_actions[i].deadline_ticks);

            for &ai in &sorted_eligible {
                let (last, ticks, ops) = place_backward(
                    ai,
                    &backward_actions,
                    &mut grid,
                    station_attrs,
                    operator_skills,
                    operator_groups,
                    &operator_availability,
                    effective_horizon,
                );
                backward_actions[ai].last_tick = Some(last);
                placed[ai] = true;

                // Collect placement if ticks were actually assigned
                if !ticks.is_empty() {
                    let start_tick = *ticks.iter().min().unwrap();
                    let end_tick = *ticks.iter().max().unwrap() + 1;
                    placements.push(BackwardPlacement {
                        task_id: backward_actions[ai].task_id.clone(),
                        job_id: backward_actions[ai].job_id.clone(),
                        station_idx: backward_actions[ai].station_idx,
                        start_tick,
                        end_tick,
                        operator_indices: ops,
                        deadline_priority: backward_actions[ai].deadline_priority,
                    });
                } else if let Some(elem_id) = task_to_element.get(&backward_actions[ai].task_id) {
                    // Partial failure (no ticks collected) → mark element for rollback.
                    failed_elements.insert(elem_id.clone());
                }
            }
        }
    }

    // B3 rollback: drop every ALAP placement that belongs to an element with
    // at least one task that failed ALAP. These elements will go through the
    // forward_pass uniformly; their intra-element precedence is enforced
    // there via predecessor_idx.
    if !failed_elements.is_empty() {
        placements.retain(|p| {
            task_to_element
                .get(&p.task_id)
                .map(|eid| !failed_elements.contains(eid))
                .unwrap_or(true)
        });
    }

    // Phase 2: Place remaining tiers (for LAST values only, placements discarded)
    let remaining_tiers: Vec<u8> = (0..=3u8).filter(|t| !alap_tiers.contains(t)).collect();
    for &tier in &remaining_tiers {
        run_backward_tier(
            tier,
            &mut backward_actions,
            &mut grid,
            station_attrs,
            operator_skills,
            operator_groups,
            &operator_availability,
            effective_horizon,
        );
    }

    // Collect LAST values for all actions
    let mut last_values: HashMap<String, u64> = HashMap::new();
    for ba in &backward_actions {
        let last = ba.last_tick.unwrap_or(0);
        last_values.insert(ba.task_id.clone(), last);
    }

    (last_values, placements)
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
/// Process terminal tasks first (last in element chain), then their predecessors.
fn run_backward_tier(
    tier: u8,
    actions: &mut Vec<BackwardAction>,
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
) {
    // Collect terminal actions for this tier (those with no successor, or whose successor is placed)
    // Process iteratively: place terminal tasks, then their predecessors become terminal, etc.
    let mut placed = vec![false; actions.len()];

    loop {
        // Find eligible actions: this tier, not placed, either terminal or successor already placed
        let mut eligible: Vec<usize> = Vec::new();
        for i in 0..actions.len() {
            if placed[i] || actions[i].deadline_priority != tier {
                continue;
            }
            match actions[i].successor_idx {
                None => eligible.push(i), // terminal task
                Some(succ) => {
                    if placed[succ] {
                        eligible.push(i); // predecessor of a placed task
                    }
                }
            }
        }

        if eligible.is_empty() {
            break;
        }

        // For each eligible action, compute its effective deadline
        // (either job deadline or successor's LAST - gap)
        for &ai in &eligible {
            let effective_deadline = match actions[ai].successor_idx {
                Some(succ) => {
                    let succ_last = actions[succ].last_tick.unwrap_or(actions[succ].deadline_ticks);
                    succ_last.saturating_sub(actions[ai].successor_gap_ticks as u64)
                }
                None => actions[ai].deadline_ticks,
            };
            // Update deadline to effective (may be tighter than job deadline)
            // We store it back for scoring
            actions[ai].deadline_ticks = effective_deadline.min(actions[ai].deadline_ticks);
        }

        // Sort eligible by deadline ascending (EDD within tier)
        eligible.sort_by_key(|&i| actions[i].deadline_ticks);

        // Place each eligible action backward from its effective deadline
        for &ai in &eligible {
            let (last, _ticks, _ops) = place_backward(
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
/// iteration of the loop, eligible actions (terminal or successor placed)
/// are sorted by effective deadline and placed.
fn run_backward_edd(
    actions: &mut Vec<BackwardAction>,
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
) {
    let mut placed = vec![false; actions.len()];

    loop {
        // Find eligible actions: not placed, either terminal or successor already placed
        // No tier filter — all actions compete globally
        let mut eligible: Vec<usize> = Vec::new();
        for i in 0..actions.len() {
            if placed[i] {
                continue;
            }
            match actions[i].successor_idx {
                None => eligible.push(i),
                Some(succ) => {
                    if placed[succ] {
                        eligible.push(i);
                    }
                }
            }
        }

        if eligible.is_empty() {
            break;
        }

        // Compute effective deadlines (same logic as run_backward_tier)
        for &ai in &eligible {
            let effective_deadline = match actions[ai].successor_idx {
                Some(succ) => {
                    let succ_last = actions[succ].last_tick.unwrap_or(actions[succ].deadline_ticks);
                    succ_last.saturating_sub(actions[ai].successor_gap_ticks as u64)
                }
                None => actions[ai].deadline_ticks,
            };
            actions[ai].deadline_ticks = effective_deadline.min(actions[ai].deadline_ticks);
        }

        // Sort eligible globally by deadline ascending (EDD)
        eligible.sort_by_key(|&i| actions[i].deadline_ticks);

        // Place each eligible action backward from its effective deadline
        for &ai in &eligible {
            let (last, _ticks, _ops) = place_backward(
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

/// Place a single action backward from its deadline.
/// Walk backward tick by tick, finding operators at each tick.
/// Uses proficiency-aware work tracking: each tick contributes the operator's
/// proficiency (not a flat 1.0), so tasks with lower-proficiency operators
/// correctly require more ticks. Setup phase uses solo operators; run phase
/// allows paired operators via concurrent groups.
/// Returns (LAST_tick, occupied_ticks, operator_indices_used).
fn place_backward(
    action_idx: usize,
    actions: &[BackwardAction],
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    operator_availability: &OperatorAvailability,
    horizon_ticks: usize,
) -> (u64, Vec<usize>, Vec<usize>) {
    let station_idx = actions[action_idx].station_idx;
    let setup_ticks = actions[action_idx].setup_ticks;
    let run_ticks = actions[action_idx].run_ticks;
    let total_work = (setup_ticks + run_ticks) as f64;
    let deadline = actions[action_idx].deadline_ticks as usize;

    if total_work <= 0.0 {
        return (deadline.min(horizon_ticks) as u64, Vec::new(), Vec::new());
    }

    let attrs = if station_idx < station_attrs.len() {
        &station_attrs[station_idx]
    } else {
        return (0, Vec::new(), Vec::new());
    };

    // Walk backward from deadline, collecting ticks where this task can run.
    let mut work_remaining = total_work;
    let mut occupied_ticks: Vec<usize> = Vec::new();
    let mut all_operators: Vec<usize> = Vec::new();
    let mut t = deadline.min(horizon_ticks);

    // Peremption bookkeeping: track consecutive skipped ticks during the
    // backward walk. If we skip >= peremption_ticks ticks while still
    // consuming run work (i.e., forward view = run interrupted by a long
    // idle window), add setup_ticks back to work_remaining. This mirrors
    // the forward-pass post-setup peremption rule so that LAST estimates
    // account for re-calage cost across weekends/off-shifts.
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
            // Only applies while we still have run work to go (work_remaining
            // exceeds setup_ticks in the backward perspective = run phase).
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

        // Productive tick — reset skip counter.
        consecutive_skipped = 0;

        let productivity: f64 = if operators.is_empty() {
            1.0
        } else if in_run_phase {
            operators.iter().map(|&op| {
                super::forward_pass::productivity_at_tick(
                    op, station_idx, t, grid, operator_groups, operator_skills,
                )
            }).sum()
        } else {
            1.0
        };

        grid.assign_station(station_idx, t, action_idx);
        for &op_idx in &operators {
            grid.assign_operator(op_idx, t, station_idx, 0.0);
            if !all_operators.contains(&op_idx) {
                all_operators.push(op_idx);
            }
        }

        occupied_ticks.push(t);
        work_remaining -= productivity;
    }

    // Bug D fix: if the backward walk exited with work still remaining,
    // the placement is incomplete — its `occupied_ticks` span doesn't
    // cover the task's full duration. Returning it as a success silently
    // emits a BackwardPlacement whose window is too short and tricks the
    // caller into thinking the task is safely scheduled. Treat it as a
    // clean failure so the element-rollback logic (B3 fix) removes it
    // and the task goes through forward_pass uniformly.
    if work_remaining > 0.001 {
        return (0, Vec::new(), Vec::new());
    }

    if let Some(&earliest) = occupied_ticks.last() {
        (earliest as u64, occupied_ticks, all_operators)
    } else {
        (0, Vec::new(), Vec::new())
    }
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
