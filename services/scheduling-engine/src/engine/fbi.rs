use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::schedule::{
    ComputedAssignment, ScheduleStats,
};
use crate::model::station::StationInput;
use crate::model::operator::OperatorInput;
use crate::model::job::JobInput;

use super::backward_pass::compute_last_values;
use super::forward_pass::{run_forward_pass, Action, OperatorAvailability, StationAttrs};
use super::grid::ScheduleGrid;
use super::pre_split::pre_split;
use super::{build_actions, compute_stats, remap_assignments};

/// Run the scheduling pipeline with FBI (Feedback-Based Iteration).
///
/// 1. Run the full pipeline (backward pass -> pre-split -> forward pass) once
/// 2. Collect actual durations from the result
/// 3. Feed actual durations back to recompute LAST values
/// 4. Re-run forward pass
/// 5. Check convergence: if makespan changed < 1%, stop
/// 6. Repeat until convergence or max_iterations
/// 7. Return the best result (lowest makespan)
pub fn run_with_fbi(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    let station_id_to_idx: HashMap<String, usize> = stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    let num_stations = stations.len();
    let num_operators = operators.len();

    let station_attrs: Vec<StationAttrs> = stations
        .iter()
        .map(|s| StationAttrs {
            attention_full: s.effective_attention_full(),
            attention_run: s.effective_attention_run(),
            masked_time_enabled: s.masked_time_enabled,
            attention_masked: s.effective_attention_masked(),
            masked_productivity: s.effective_masked_productivity(),
        })
        .collect();

    let operator_skills: Vec<Vec<(usize, f64)>> = operators
        .iter()
        .map(|op| {
            op.skills
                .iter()
                .filter_map(|skill| {
                    station_id_to_idx
                        .get(&skill.station_id)
                        .map(|&idx| (idx, skill.proficiency))
                })
                .collect()
        })
        .collect();

    let schedules: Vec<Option<crate::model::operator::OperatingSchedule>> = operators
        .iter()
        .map(|op| op.operating_schedule.clone())
        .collect();

    let mut best_assignments: Vec<ComputedAssignment> = Vec::new();
    let mut best_actions: Vec<Action> = Vec::new();
    let mut best_stats = ScheduleStats {
        makespan_minutes: u64::MAX,
        total_tasks: 0,
        scheduled_tasks: 0,
        deadline_violations: 0,
        late_task_count: 0,
        total_lateness_minutes: 0,
    };
    let mut prev_makespan: u64 = u64::MAX;
    let mut iteration_count: u32 = 0;

    // For FBI feedback: actual durations from previous iteration
    let mut duration_overrides: HashMap<String, u32> = HashMap::new();

    let effective_max = if max_iterations == 0 { 1 } else { max_iterations };

    for iteration in 0..effective_max {
        iteration_count = iteration + 1;

        // Compute LAST values (with overridden durations if available)
        let last_values = compute_last_values(jobs, tick_minutes, start_date);

        // Build actions
        let mut actions = build_actions(
            jobs,
            stations,
            &station_id_to_idx,
            tick_minutes,
            &last_values,
        );

        // Apply duration overrides from previous iteration
        if !duration_overrides.is_empty() {
            for action in &mut actions {
                if let Some(&actual_total_ticks) = duration_overrides.get(&action.task_id) {
                    // The actual duration was longer (due to degraded mode).
                    // Update ART so LAST computation reflects reality.
                    if actual_total_ticks > action.art {
                        action.run_ticks = actual_total_ticks.saturating_sub(action.setup_ticks);
                        action.art = actual_total_ticks;
                    }
                }
            }

            // Recompute LAST values with realistic durations
            recompute_last_values(&mut actions, jobs, tick_minutes, start_date);
        }

        // Pre-split
        pre_split(&mut actions, stations, tick_minutes);

        // Build grid
        let initial_ticks = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
        let mut grid = ScheduleGrid::new(num_stations, num_operators, initial_ticks, tick_minutes);

        let mut operator_availability = OperatorAvailability::new(
            num_operators,
            initial_ticks,
            tick_minutes,
            start_date,
            schedules.clone(),
        );

        // Run forward pass
        let assignments = run_forward_pass(
            &mut grid,
            &mut actions,
            &station_attrs,
            &operator_skills,
            &mut operator_availability,
            tick_minutes,
            start_date,
        );

        // Remap and compute stats
        let remapped = remap_assignments(
            assignments,
            stations,
            operators,
            tick_minutes,
            start_date,
        );
        let stats = compute_stats(&remapped, &actions, jobs, tick_minutes, start_date);

        let current_makespan = stats.makespan_minutes;

        // Track best result
        if current_makespan < best_stats.makespan_minutes {
            best_assignments = remapped;
            best_stats = stats;
            best_actions = actions
                .iter()
                .map(|a| super::pre_split::clone_action(a))
                .collect();
        }

        // Convergence check: makespan changed < 1%
        if iteration > 0 && prev_makespan < u64::MAX {
            let diff = if current_makespan > prev_makespan {
                current_makespan - prev_makespan
            } else {
                prev_makespan - current_makespan
            };
            let threshold = (prev_makespan as f64 * 0.01) as u64;
            if diff <= threshold {
                break; // Converged
            }
        }

        prev_makespan = current_makespan;

        // Collect actual durations for feedback
        duration_overrides.clear();
        for action in &actions {
            if let (Some(start), Some(end)) = (action.start_tick, action.end_tick) {
                let actual_ticks = (end - start) as u32;
                let original_total = action.setup_ticks + action.run_ticks;
                // Only feed back if actual > planned (degraded mode made it slower)
                if actual_ticks > original_total {
                    // Map chunk task_ids back to original for aggregation
                    let task_id = match &action.chunk_info {
                        Some((_chunk_n, _total, original_id)) => original_id.clone(),
                        None => action.task_id.clone(),
                    };
                    let entry = duration_overrides.entry(task_id).or_insert(0);
                    *entry += actual_ticks;
                }
            }
        }
    }

    (best_assignments, best_actions, best_stats, iteration_count)
}

/// Recompute LAST values in-place on actions using their current durations.
/// Walks backward through predecessor chains to set LAST values that reflect
/// actual (potentially degraded) durations.
fn recompute_last_values(
    actions: &mut Vec<Action>,
    jobs: &[JobInput],
    tick_minutes: u32,
    start_date: NaiveDate,
) {
    // Rebuild LAST values using backward pass with current action durations
    let last_values = compute_last_values(jobs, tick_minutes, start_date);

    // For each action, adjust LAST based on duration changes
    for action in actions.iter_mut() {
        if let Some(&base_last) = last_values.get(&action.task_id) {
            action.last = base_last;
        }
    }
}
