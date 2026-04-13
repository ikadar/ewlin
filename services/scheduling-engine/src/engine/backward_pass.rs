use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::station::StationInput;

use super::forward_pass::{OperatorAvailability, PreparedConcurrentGroup, StationAttrs};
use super::grid::ScheduleGrid;

/// Ordering strategy for the backward pass.
#[derive(Debug, Clone, Copy)]
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
/// Jobs are processed by deadline priority tier (imperative first, flexible last).
/// Within each tier, tasks are scored by dynamic critical ratio at each tick.
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
    let schedules: Vec<Option<crate::model::operator::OperatingSchedule>> =
        operators.iter().map(|op| op.operating_schedule.clone()).collect();

    let mut grid = ScheduleGrid::new(num_stations, num_operators, effective_horizon, tick_minutes);
    let operator_availability = OperatorAvailability::new(
        num_operators, effective_horizon, tick_minutes, start_date, schedules,
    );

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

/// Place a single action backward from its deadline.
/// Walk backward tick by tick, finding operators at each tick.
/// Uses proficiency-aware work tracking: each tick contributes the operator's
/// proficiency (not a flat 1.0), so tasks with lower-proficiency operators
/// correctly require more ticks. Setup phase uses solo operators; run phase
/// allows paired operators via concurrent groups.
/// Returns the LAST tick (latest start tick for this action).
fn place_backward(
    action_idx: usize,
    actions: &[BackwardAction],
    grid: &mut ScheduleGrid,
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
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

    // Walk backward from deadline, collecting ticks where this task can run.
    // We track work as a float: setup phase consumes 1.0 per tick (fixed duration),
    // run phase consumes proficiency per tick (scales with operator skill).
    // We place backward: first ticks encountered are run phase, then setup.
    let mut work_remaining = total_work;
    let mut occupied_ticks: Vec<usize> = Vec::new();
    let mut t = deadline.min(horizon_ticks);

    while work_remaining > 0.001 && t > 0 {
        t -= 1;

        // Station must be free
        if !grid.is_station_free(station_idx, t) {
            continue;
        }

        // Determine if we're still in run phase (backward = run first, then setup)
        let in_run_phase = work_remaining > setup_ticks as f64;

        // Find operators — allow pairing during run phase
        let operators = super::forward_pass::find_operators_for_station(
            grid,
            t,
            station_idx,
            operator_skills,
            operator_availability,
            operator_groups,
            &[], // no preferred operators in backward pass
            attrs.max_operators,
            !in_run_phase, // is_setup_phase: solo during setup, allow pairs during run
        );

        if operators.is_empty() && grid.num_operators > 0 {
            continue; // no qualified operator available at this tick
        }

        // Compute productivity for this tick using the same model as forward pass
        let productivity: f64 = if operators.is_empty() {
            // No operators configured (e.g. automated station) — 1.0 per tick
            1.0
        } else if in_run_phase {
            // Run phase: sum productivity across assigned operators
            operators.iter().map(|&op| {
                super::forward_pass::productivity_at_tick(
                    op, station_idx, t, grid, operator_groups, operator_skills,
                )
            }).sum()
        } else {
            // Setup phase: fixed duration, 1.0 per tick regardless of proficiency
            1.0
        };

        // Reserve this tick
        grid.assign_station(station_idx, t, action_idx);
        for &op_idx in &operators {
            grid.assign_operator(op_idx, t, station_idx, 0.0);
        }

        occupied_ticks.push(t);
        work_remaining -= productivity;
    }

    // LAST = the earliest occupied tick (that's when the task must start at the latest)
    if let Some(&earliest) = occupied_ticks.last() {
        earliest as u64
    } else {
        0 // couldn't place at all — infeasible
    }
}

fn parse_deadline_to_ticks(deadline: &str, tick_minutes: u32, start_date: NaiveDate) -> Option<u64> {
    let minutes = parse_deadline_minutes(deadline, start_date)?;
    Some(minutes / tick_minutes as u64)
}

fn parse_deadline_minutes(deadline: &str, start_date: NaiveDate) -> Option<u64> {
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(deadline, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        use chrono::Timelike;
        let minutes = days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64;
        return Some(minutes);
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
        let days = (d - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
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
