mod backward_pass;
mod forward_pass;
mod grid;

use std::collections::HashMap;
use std::time::Instant;

use chrono::Local;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{
    ComputeOptions, ComputeRequest, ComputedAssignment, OperatorAssignment, ScheduleResult,
    ScheduleStats, Warning,
};
use crate::model::station::StationInput;

use self::backward_pass::compute_last_values;
use self::forward_pass::{run_forward_pass, Action, OperatorAvailability, StationAttrs};
use self::grid::ScheduleGrid;

/// Format a tick count into an ISO datetime string relative to start_date.
pub fn format_minutes(minutes: u64, start_date: chrono::NaiveDate) -> String {
    let days = (minutes / (24 * 60)) as i64;
    let remaining = minutes % (24 * 60);
    let hours = remaining / 60;
    let mins = remaining % 60;
    let date = start_date + chrono::Duration::days(days);
    format!("{}T{:02}:{:02}:00", date, hours, mins)
}

pub fn compute(request: &ComputeRequest) -> ScheduleResult {
    let start_time = Instant::now();
    let start_date = Local::now().date_naive();

    let options = request.options.clone().unwrap_or_default();
    let tick_minutes = options.tick_minutes;

    // Build index maps
    let station_id_to_idx: HashMap<String, usize> = request
        .stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    let operator_id_to_idx: HashMap<String, usize> = request
        .operators
        .iter()
        .enumerate()
        .map(|(i, o)| (o.id.clone(), i))
        .collect();

    let num_stations = request.stations.len();
    let num_operators = request.operators.len();

    // Build station attribute arrays
    let station_attrs: Vec<StationAttrs> = request
        .stations
        .iter()
        .map(|s| StationAttrs {
            attention_full: s.effective_attention_full(),
            attention_run: s.effective_attention_run(),
            masked_time_enabled: s.masked_time_enabled,
            masked_productivity: s.effective_masked_productivity(),
        })
        .collect();

    // Build operator skill arrays: operator_idx -> Vec<(station_idx, proficiency)>
    let operator_skills: Vec<Vec<(usize, f64)>> = request
        .operators
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

    // Build initial grid
    let initial_ticks = (options.horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
    let mut grid = ScheduleGrid::new(num_stations, num_operators, initial_ticks, tick_minutes);

    // Build operator availability
    let schedules: Vec<Option<crate::model::operator::OperatingSchedule>> = request
        .operators
        .iter()
        .map(|op| op.operating_schedule.clone())
        .collect();

    let mut operator_availability =
        OperatorAvailability::new(num_operators, initial_ticks, tick_minutes, start_date, schedules);

    // Run backward pass to compute LAST values
    let last_values = compute_last_values(&request.jobs, tick_minutes, start_date);

    // Build actions from jobs
    let mut actions = build_actions(
        &request.jobs,
        &station_id_to_idx,
        tick_minutes,
        &last_values,
    );

    // Run forward pass with dynamic grid
    let mut assignments = run_forward_pass(
        &mut grid,
        &mut actions,
        &station_attrs,
        &operator_skills,
        &mut operator_availability,
        tick_minutes,
        start_date,
    );

    // Fill in station/operator IDs on results
    for assignment in &mut assignments {
        // station_id is already set in forward_pass
        // Fill in operator IDs
        for op_assign in &mut assignment.operators {
            // operator_id is already set by index in forward_pass;
            // we need to map index back to real ID
        }
    }

    // Re-map operator indices to real IDs
    let assignments = remap_assignments(
        assignments,
        &request.stations,
        &request.operators,
        tick_minutes,
        start_date,
    );

    // Compute stats
    let stats = compute_stats(&assignments, &actions, &request.jobs, tick_minutes, start_date);

    let mut warnings = Vec::new();

    // Check for unplaced tasks (should be zero with 100% guarantee)
    let unplaced: u32 = actions.iter().filter(|a| a.end_tick.is_none()).count() as u32;
    if unplaced > 0 {
        warnings.push(Warning {
            task_id: None,
            message: format!("{} tasks could not be placed", unplaced),
        });
    }

    let compute_time_ms = start_time.elapsed().as_millis() as u64;

    ScheduleResult {
        assignments,
        stats,
        warnings,
        fbi_iterations: 0,
        compute_time_ms,
    }
}

fn build_actions(
    jobs: &[JobInput],
    station_id_to_idx: &HashMap<String, usize>,
    tick_minutes: u32,
    last_values: &HashMap<String, u64>,
) -> Vec<Action> {
    let mut actions: Vec<Action> = Vec::new();
    let mut task_id_to_action_idx: HashMap<String, usize> = HashMap::new();

    for job in jobs {
        for element in &job.elements {
            // Sort tasks by sequence_order
            let mut sorted_tasks = element.tasks.clone();
            sorted_tasks.sort_by_key(|t| t.sequence_order);

            let mut prev_task_id: Option<String> = None;

            for task in &sorted_tasks {
                let station_idx = match station_id_to_idx.get(&task.station_id) {
                    Some(&idx) => idx,
                    None => continue, // skip unknown stations
                };

                let setup_ticks = minutes_to_ticks(task.setup_minutes, tick_minutes);
                let run_ticks = minutes_to_ticks(task.run_minutes, tick_minutes);
                let total_ticks = setup_ticks + run_ticks;

                let predecessor_idx = prev_task_id
                    .as_ref()
                    .and_then(|pid| task_id_to_action_idx.get(pid).copied());

                let last = last_values.get(&task.id).copied().unwrap_or(u64::MAX);

                let idx = actions.len();
                actions.push(Action {
                    idx,
                    task_id: task.id.clone(),
                    job_id: job.id.clone(),
                    station_idx,
                    setup_ticks,
                    run_ticks,
                    art: total_ticks,
                    eat: 0,
                    last,
                    predecessor_idx,
                    end_tick: None,
                    assigned_operators: Vec::new(),
                    start_tick: None,
                });

                task_id_to_action_idx.insert(task.id.clone(), idx);
                prev_task_id = Some(task.id.clone());
            }
        }
    }

    actions
}

fn minutes_to_ticks(minutes: u32, tick_minutes: u32) -> u32 {
    if tick_minutes == 0 {
        return minutes;
    }
    (minutes + tick_minutes - 1) / tick_minutes // round up
}

fn remap_assignments(
    raw_assignments: Vec<ComputedAssignment>,
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    start_date: chrono::NaiveDate,
) -> Vec<ComputedAssignment> {
    raw_assignments
        .into_iter()
        .map(|mut a| {
            // Remap station ID: forward_pass stores indices as "station_idx:N"
            if let Some(idx_str) = a.station_id.strip_prefix("station_idx:") {
                if let Ok(idx) = idx_str.parse::<usize>() {
                    if idx < stations.len() {
                        a.station_id = stations[idx].id.clone();
                    }
                }
            }
            // Remap operator IDs: forward_pass stores indices as "op_idx:N"
            a.operators = a
                .operators
                .into_iter()
                .map(|mut op| {
                    if let Some(idx_str) = op.operator_id.strip_prefix("op_idx:") {
                        if let Ok(idx) = idx_str.parse::<usize>() {
                            if idx < operators.len() {
                                op.operator_id = operators[idx].id.clone();
                            }
                        }
                    }
                    op
                })
                .collect();
            a
        })
        .collect()
}

fn compute_stats(
    assignments: &[ComputedAssignment],
    actions: &[Action],
    jobs: &[JobInput],
    tick_minutes: u32,
    start_date: chrono::NaiveDate,
) -> ScheduleStats {
    let total_tasks = actions.len() as u32;
    let scheduled_tasks = assignments.len() as u32;

    // Makespan: max end_tick across all actions
    let makespan_ticks = actions
        .iter()
        .filter_map(|a| a.end_tick)
        .max()
        .unwrap_or(0);
    let makespan_minutes = makespan_ticks as u64 * tick_minutes as u64;

    // Deadline violations
    let mut deadline_violations: u32 = 0;
    let mut late_task_count: u32 = 0;
    let mut total_lateness_minutes: u64 = 0;

    // Build job deadline map
    let job_deadlines: HashMap<String, u64> = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref().and_then(|d| {
                parse_deadline_minutes(d, start_date).map(|mins| (j.id.clone(), mins))
            })
        })
        .collect();

    for action in actions {
        if let Some(end_tick) = action.end_tick {
            let end_minutes = end_tick as u64 * tick_minutes as u64;
            if let Some(&deadline_minutes) = job_deadlines.get(&action.job_id) {
                if end_minutes > deadline_minutes {
                    deadline_violations += 1;
                    late_task_count += 1;
                    total_lateness_minutes += end_minutes - deadline_minutes;
                }
            }
        }
    }

    ScheduleStats {
        makespan_minutes,
        total_tasks,
        scheduled_tasks,
        deadline_violations,
        late_task_count,
        total_lateness_minutes,
    }
}

fn parse_deadline_minutes(deadline: &str, start_date: chrono::NaiveDate) -> Option<u64> {
    // Try parsing as "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(deadline, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        let minutes = days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64;
        return Some(minutes);
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
        let days = (d - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        // End of day
        return Some(days as u64 * 24 * 60 + 17 * 60); // 17:00 default
    }
    None
}

use chrono::Timelike;
