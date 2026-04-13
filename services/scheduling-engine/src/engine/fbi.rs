use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::schedule::{
    ComputedAssignment, ScheduleStats, StationGroupInput,
};
use crate::model::station::StationInput;
use crate::model::operator::OperatorInput;
use crate::model::job::JobInput;

use super::backward_pass::BackwardOrdering;

use super::backward_pass::compute_last_values;
use super::forward_pass::{
    build_prepared_groups, run_forward_pass, Action, OperatorAvailability, PreparedConcurrentGroup,
    StationAttrs,
};
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
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
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
            max_run_attention: s.effective_max_run_attention(),
            masked_time_enabled: s.masked_time_enabled,
            peremption_ticks: if s.effective_peremption() > 0 && tick_minutes > 0 {
                (s.effective_peremption() + tick_minutes - 1) / tick_minutes
            } else {
                0
            },
            max_operators: s.effective_max_operators(),
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

    let operator_groups: Vec<Vec<PreparedConcurrentGroup>> =
        build_prepared_groups(operators, &station_id_to_idx);

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
        late_job_count: 0,
        weighted_lateness_minutes: 0,
        late_job_ids: Vec::new(),
    };
    let mut prev_makespan: u64 = u64::MAX;
    let mut iteration_count: u32 = 0;

    // For FBI feedback: actual durations from previous iteration
    let mut duration_overrides: HashMap<String, u32> = HashMap::new();

    let effective_max = if max_iterations == 0 { 1 } else { max_iterations };

    for iteration in 0..effective_max {
        iteration_count = iteration + 1;

        super::emit(progress, crate::model::progress::ProgressEvent::FbiStart {
            iteration: iteration + 1,
            max_iterations: effective_max,
        });

        // Compute LAST values using reverse forward pass
        let initial_ticks_for_last = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
        let last_values = compute_last_values(
            jobs, stations, operators,
            &station_attrs, &operator_skills, &operator_groups,
            tick_minutes, start_date,
            initial_ticks_for_last,
        );

        super::emit(progress, crate::model::progress::ProgressEvent::BackwardDone {
            iteration: iteration + 1,
        });

        // Build actions
        let mut actions = build_actions(
            jobs,
            stations,
            &station_id_to_idx,
            tick_minutes,
            &last_values,
            start_date,
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
            recompute_last_values(
                &mut actions, jobs, stations, operators,
                &station_attrs, &operator_skills, &operator_groups,
                tick_minutes, start_date, horizon_days,
            );
        }

        // Pre-split
        pre_split(&mut actions, stations, tick_minutes);

        // Build grid
        let initial_ticks = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
        let mut grid = ScheduleGrid::new(num_stations, num_operators, initial_ticks, tick_minutes);

        // Pre-block station ticks for machine unavailability constraints.
        // Uses a sentinel action index (usize::MAX) that no real action has.
        for (station_idx, ranges) in station_blocked_ranges.iter().enumerate() {
            for &(start_t, end_t) in ranges {
                let clamped_end = end_t.min(initial_ticks);
                for t in start_t..clamped_end {
                    grid.assign_station(station_idx, t, usize::MAX);
                }
            }
        }

        // Pre-block occupied slots (existing assignments to preserve).
        // Marks both station ticks AND operator ticks as occupied so the
        // forward pass won't schedule new tasks on top of them.
        for &(station_idx, ref op_indices, start_t, end_t) in occupied_slots {
            let clamped_end = end_t.min(initial_ticks);
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

        let mut operator_availability = OperatorAvailability::new(
            num_operators,
            initial_ticks,
            tick_minutes,
            start_date,
            schedules.clone(),
        );

        // Run forward pass
        // No station groups in base FBI (empty mapping)
        let station_to_group: Vec<Option<(usize, u32)>> = vec![None; num_stations];
        let assignments = run_forward_pass(
            &mut grid,
            &mut actions,
            &station_attrs,
            &operator_skills,
            &mut operator_availability,
            &operator_groups,
            tick_minutes,
            start_date,
            &station_to_group,
            now_tick,
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

        super::emit(progress, crate::model::progress::ProgressEvent::FbiIterationDone {
            iteration: iteration + 1,
            makespan_minutes: current_makespan,
            scheduled_tasks: stats.scheduled_tasks,
            late_job_count: stats.late_job_count,
        });

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
                super::emit(progress, crate::model::progress::ProgressEvent::FbiConverged {
                    iteration: iteration + 1,
                });
                break;
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

/// Recompute LAST values in-place on actions using the reverse forward pass.
fn recompute_last_values(
    actions: &mut Vec<Action>,
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    station_attrs: &[StationAttrs],
    operator_skills: &[Vec<(usize, f64)>],
    operator_groups: &[Vec<PreparedConcurrentGroup>],
    tick_minutes: u32,
    start_date: NaiveDate,
    horizon_days: u32,
) {
    let initial_ticks = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
    let last_values = compute_last_values(
        jobs, stations, operators,
        station_attrs, operator_skills, operator_groups,
        tick_minutes, start_date,
        initial_ticks,
    );

    for action in actions.iter_mut() {
        if let Some(&base_last) = last_values.get(&action.task_id) {
            action.last = base_last;
        }
    }
}

/// Run FBI with a specific backward ordering and station groups.
/// Delegates to `run_with_fbi` (ordering and groups are not yet wired into the
/// backward pass, so this is a thin wrapper that keeps the call-sites compiling).
pub fn run_with_fbi_ordering(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
    _ordering: BackwardOrdering,
    _station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    run_with_fbi(jobs, stations, operators, tick_minutes, horizon_days, max_iterations, start_date, station_blocked_ranges, occupied_slots, progress, now_tick)
}

/// Multi-start FBI: optionally run with both TierFirst and EDD orderings and
/// return the best result.  When `multi_start` is false, behaves like plain FBI.
pub fn run_with_multi_start_fbi(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
    multi_start: bool,
    station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    let (a1, act1, s1, i1) = run_with_fbi_ordering(
        jobs, stations, operators,
        tick_minutes, horizon_days, max_iterations, start_date,
        BackwardOrdering::TierFirst, station_groups, station_blocked_ranges, occupied_slots, progress,
        now_tick,
    );

    if !multi_start {
        return (a1, act1, s1, i1);
    }

    let (a2, act2, s2, i2) = run_with_fbi_ordering(
        jobs, stations, operators,
        tick_minutes, horizon_days, max_iterations, start_date,
        BackwardOrdering::EarliestDeadline, station_groups, station_blocked_ranges, occupied_slots, progress,
        now_tick,
    );

    // Pick the result with fewer late jobs, then less weighted lateness, then shorter makespan
    let score1 = (s1.late_job_count, s1.weighted_lateness_minutes, s1.makespan_minutes);
    let score2 = (s2.late_job_count, s2.weighted_lateness_minutes, s2.makespan_minutes);

    if score2 < score1 {
        (a2, act2, s2, i1 + i2)
    } else {
        (a1, act1, s1, i1 + i2)
    }
}
