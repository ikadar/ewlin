mod backward_pass;
pub mod fbi;
mod forward_pass;
mod grid;
pub mod moore;
pub mod pre_split;

use std::collections::HashMap;
use std::time::Instant;

use chrono::Local;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{
    ComputeRequest, ComputedAssignment, OperatorAssignment, ScheduleResult,
    ScheduleStats, Warning,
};
use crate::model::station::StationInput;

use self::forward_pass::Action;

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
    let fbi_max_iterations = options.fbi_max_iterations;

    // Validate concurrent groups (Phase 1 ingestion only — these warnings
    // are informational; the algorithm does not yet use the field).
    let mut concurrent_group_warnings =
        validate_concurrent_groups(&request.operators, &request.stations);

    // Build station masked_time lookup for post-processing
    let station_masked_time: HashMap<String, bool> = request
        .stations
        .iter()
        .map(|s| (s.id.clone(), s.masked_time_enabled))
        .collect();

    // Debug: log station attention values as received
    for s in &request.stations {
        if s.masked_time_enabled {
            eprintln!("[STATION] {} masked=true attention_masked={:?} productivity={:?}",
                s.name, s.attention_masked, s.masked_productivity);
        }
    }

    // Run FBI loop with optional multi-start (TierFirst + EDD orderings)
    let (mut assignments, mut actions, mut stats, mut fbi_iterations) = fbi::run_with_multi_start_fbi(
        &request.jobs,
        &request.stations,
        &request.operators,
        tick_minutes,
        options.horizon_days,
        fbi_max_iterations,
        start_date,
        options.multi_start,
        &request.station_groups,
    );

    // Moore escape hatch: DISABLED for now — adds full FBI re-runs.
    // TODO: re-enable once base performance is validated.
    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    if false && stats.late_job_count > 0 && elapsed_ms < 8000 {
        if let Some((moore_assignments, moore_actions, moore_stats, moore_iters)) = moore::moore_escape(
            &request.jobs,
            &request.stations,
            &request.operators,
            &actions,
            &stats,
            tick_minutes,
            options.horizon_days,
            fbi_max_iterations,
            start_date,
            2, // max_attempts
            &request.station_groups,
        ) {
            assignments = moore_assignments;
            actions = moore_actions;
            stats = moore_stats;
            fbi_iterations += moore_iters;
        }
    }

    // Merge chunks back: only report the ORIGINAL task_id in assignments
    assignments = merge_chunk_assignments(assignments);

    // Post-processing: set is_masked_time flag and fix operator attention.
    // For ALL tasks: if operator has no concurrent work, attention = 1.0
    // (the grid uses lower values for scheduling flexibility, but the operator
    // was fully dedicated — that's what we report).
    {
        // Build operator → list of (assignment_index, op_from, op_to) for overlap detection
        // Uses the OPERATOR's own from/to, not the task's scheduled_start/end
        let mut op_assignments: HashMap<String, Vec<(usize, String, String)>> = HashMap::new();
        for (i, a) in assignments.iter().enumerate() {
            for op in &a.operators {
                op_assignments.entry(op.operator_id.clone()).or_default()
                    .push((i, op.from.clone(), op.to.clone()));
            }
        }

        for i in 0..assignments.len() {
            // Collect per-operator: has concurrent on OTHER tasks? overlaps with sibling on SAME task?
            let num_ops = assignments[i].operators.len();
            let mut op_flags: Vec<(bool, bool)> = Vec::with_capacity(num_ops); // (has_external_concurrent, has_sibling_overlap)

            for op_idx in 0..num_ops {
                let op = &assignments[i].operators[op_idx];
                // Check concurrent work on OTHER tasks
                let mut has_external = false;
                if let Some(op_tasks) = op_assignments.get(&op.operator_id) {
                    for (j, from_j, to_j) in op_tasks {
                        if *j == i { continue; }
                        if op.from < *to_j && *from_j < op.to {
                            has_external = true;
                            break;
                        }
                    }
                }
                // Check overlap with other operators on the SAME task
                let mut has_sibling = false;
                for other_idx in 0..num_ops {
                    if other_idx == op_idx { continue; }
                    let other = &assignments[i].operators[other_idx];
                    if op.from < other.to && other.from < op.to {
                        has_sibling = true;
                        break;
                    }
                }
                op_flags.push((has_external, has_sibling));
            }

            // Apply attention overrides
            for (op_idx, (has_external, has_sibling)) in op_flags.iter().enumerate() {
                if !has_external && !has_sibling {
                    // Sole operator on this task during their period, no external work → 1.0
                    assignments[i].operators[op_idx].attention = 1.0;
                }
            }

            // is_masked_time: on masked stations with a run phase
            let is_on_masked_station = station_masked_time
                .get(&assignments[i].station_id)
                .copied()
                .unwrap_or(false);
            let has_run_phase = match &assignments[i].setup_end {
                Some(setup_end) => setup_end != &assignments[i].scheduled_end,
                None => true,
            };
            assignments[i].is_masked_time = is_on_masked_station && has_run_phase;
            let ops_str: Vec<String> = assignments[i].operators.iter().map(|op| format!("{}@{}", &op.operator_id[..8.min(op.operator_id.len())], op.attention)).collect();
            eprintln!("[ASSIGN] task={} station={} masked={} ops=[{}]", &assignments[i].task_id, &assignments[i].station_id, assignments[i].is_masked_time, ops_str.join(", "));

            // For masked-time tasks: remove operators who are only present during setup
            // (their to <= setup_end). They're not part of the masked run phase.
            if assignments[i].is_masked_time {
                if let Some(setup_end) = &assignments[i].setup_end.clone() {
                    assignments[i].operators.retain(|op| op.to > *setup_end);
                }
            }

            // No degraded-mode filtering needed: find_operators_for_station now
            // returns empty when attention_needed is not met, so all operators
            // in the assignment genuinely contributed.
        }
    }

    let mut warnings = Vec::new();
    warnings.append(&mut concurrent_group_warnings);

    // Check for unplaced tasks
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
        fbi_iterations,
        compute_time_ms,
    }
}

/// Validate operator concurrent groups against the request snapshot.
///
/// Returns a list of warnings (one per invalid group). Validation is
/// non-blocking: invalid groups are reported but the engine still runs.
/// In Phase 1 the engine ignores the field entirely; Phase 2 will use it
/// to drive operator pairing in masked time.
///
/// Checks performed:
/// - Group shape (delegated to ConcurrentGroupInput::validate)
/// - Both station IDs exist in the request's stations list
/// - Both stations are in the operator's own skills
fn validate_concurrent_groups(
    operators: &[crate::model::operator::OperatorInput],
    stations: &[crate::model::station::StationInput],
) -> Vec<Warning> {
    let mut warnings = Vec::new();

    let station_ids: std::collections::HashSet<&str> =
        stations.iter().map(|s| s.id.as_str()).collect();

    for operator in operators {
        let skill_station_ids: std::collections::HashSet<&str> =
            operator.skills.iter().map(|s| s.station_id.as_str()).collect();

        for group in &operator.concurrent_groups {
            if let Err(msg) = group.validate(&operator.id) {
                warnings.push(Warning { task_id: None, message: msg });
                continue;
            }

            for station_id in &group.station_ids {
                if !station_ids.contains(station_id.as_str()) {
                    warnings.push(Warning {
                        task_id: None,
                        message: format!(
                            "operator {}: concurrent group references unknown station {}",
                            operator.id, station_id
                        ),
                    });
                }
                if !skill_station_ids.contains(station_id.as_str()) {
                    warnings.push(Warning {
                        task_id: None,
                        message: format!(
                            "operator {}: concurrent group references station {} but operator has no skill on it",
                            operator.id, station_id
                        ),
                    });
                }
            }
        }
    }

    warnings
}

/// Merge chunk assignments back into single assignments per original task.
/// Chunks share the same original_task_id via chunk_info. We merge by:
/// - Using the earliest scheduled_start across chunks
/// - Using the latest scheduled_end across chunks
/// - Taking setup_end from chunk 1 only
/// - Merging operator lists
/// - OR-ing is_degraded
/// - Averaging effective_productivity
/// - OR-ing is_masked_time
/// Cross-reference operators across overlapping assignments.
/// For each pair of overlapping assignments (A, B):
///   If A has operator X and B doesn't → add X to B's operators (and vice versa)
/// This ensures that when an operator monitors a masked station while working
/// on another, BOTH assignments list that operator.
fn cross_reference_operators(assignments: &mut Vec<ComputedAssignment>) {
    // Collect operator IDs per assignment index
    let n = assignments.len();
    let mut additions: Vec<(usize, OperatorAssignment)> = Vec::new();

    for i in 0..n {
        for j in (i + 1)..n {
            // Check time overlap
            let overlap = assignments[i].scheduled_start < assignments[j].scheduled_end
                && assignments[j].scheduled_start < assignments[i].scheduled_end;
            if !overlap {
                continue;
            }

            // For each operator in assignment i, check if missing from j
            for op in &assignments[i].operators {
                let already_in_j = assignments[j]
                    .operators
                    .iter()
                    .any(|o| o.operator_id == op.operator_id);
                if !already_in_j {
                    additions.push((j, op.clone()));
                }
            }

            // For each operator in assignment j, check if missing from i
            for op in &assignments[j].operators {
                let already_in_i = assignments[i]
                    .operators
                    .iter()
                    .any(|o| o.operator_id == op.operator_id);
                if !already_in_i {
                    additions.push((i, op.clone()));
                }
            }
        }
    }

    // Apply additions
    for (idx, op) in additions {
        // Avoid duplicates (may have been added from multiple overlaps)
        let already = assignments[idx]
            .operators
            .iter()
            .any(|o| o.operator_id == op.operator_id);
        if !already {
            assignments[idx].operators.push(op);
        }
    }
}

fn merge_chunk_assignments(assignments: Vec<ComputedAssignment>) -> Vec<ComputedAssignment> {
    // Group chunk assignments by their task_id prefix (chunk 1 keeps the original task_id)
    // We identify chunks by task_id containing "_chunk_"
    let mut chunk_groups: HashMap<String, Vec<ComputedAssignment>> = HashMap::new();

    for a in assignments {
        if a.task_id.contains("_chunk_") {
            // Extract the original task_id (everything before "_chunk_")
            let original_id = a.task_id.split("_chunk_").next().unwrap_or(&a.task_id).to_string();
            chunk_groups.entry(original_id).or_default().push(a);
        } else {
            // Check if there are chunks for this task_id -- this is chunk 1
            // We'll collect it separately and merge later
            chunk_groups.entry(a.task_id.clone()).or_default().insert(0, a);
        }
    }

    let mut result: Vec<ComputedAssignment> = Vec::new();

    for (original_task_id, mut chunks) in chunk_groups {
        if chunks.len() == 1 && !chunks[0].task_id.contains("_chunk_") {
            // Single non-chunk assignment, keep as-is
            result.push(chunks.remove(0));
            continue;
        }

        // Sort chunks by scheduled_start
        chunks.sort_by(|a, b| a.scheduled_start.cmp(&b.scheduled_start));

        let first = &chunks[0];
        let last = &chunks[chunks.len() - 1];

        let mut merged_operators: Vec<OperatorAssignment> = Vec::new();
        let mut is_degraded = false;
        let mut is_masked_time = false;
        let mut total_productivity = 0.0;
        let mut count = 0;

        for chunk in &chunks {
            is_degraded = is_degraded || chunk.is_degraded;
            is_masked_time = is_masked_time || chunk.is_masked_time;
            total_productivity += chunk.effective_productivity;
            count += 1;
            for op in &chunk.operators {
                merged_operators.push(op.clone());
            }
        }

        let avg_productivity = if count > 0 {
            (total_productivity / count as f64 * 100.0).round() / 100.0
        } else {
            1.0
        };

        result.push(ComputedAssignment {
            task_id: original_task_id,
            station_id: first.station_id.clone(),
            scheduled_start: first.scheduled_start.clone(),
            scheduled_end: last.scheduled_end.clone(),
            operators: merged_operators,
            setup_end: first.setup_end.clone(),
            is_degraded,
            effective_productivity: avg_productivity,
            is_masked_time,
        });
    }

    result
}

pub fn build_actions(
    jobs: &[JobInput],
    stations: &[StationInput],
    station_id_to_idx: &HashMap<String, usize>,
    tick_minutes: u32,
    last_values: &HashMap<String, u64>,
    start_date: chrono::NaiveDate,
) -> Vec<Action> {
    let mut actions: Vec<Action> = Vec::new();
    let mut task_id_to_action_idx: HashMap<String, usize> = HashMap::new();

    for job in jobs {
        // Compute job deadline in ticks for job-level pressure scoring
        let job_deadline_tick = job
            .deadline
            .as_ref()
            .and_then(|d| parse_deadline_minutes(d, start_date))
            .map(|minutes| minutes / tick_minutes as u64)
            .unwrap_or(u64::MAX);

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

                // Drying time: if predecessor is on a press, add drying gap
                let predecessor_gap_ticks = match predecessor_idx {
                    Some(pred_idx) => {
                        let pred_station = actions[pred_idx].station_idx;
                        if pred_station < stations.len() && stations[pred_station].is_press {
                            minutes_to_ticks(stations[pred_station].drying_time_minutes, tick_minutes)
                        } else {
                            0
                        }
                    }
                    None => 0,
                };

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
                    predecessor_gap_ticks,
                    end_tick: None,
                    assigned_operators: Vec::new(),
                    start_tick: None,
                    chunk_info: None,
                    deadline_priority: job.deadline_priority,
                    job_deadline_tick,
                    earliest_retry_tick: None,
                    additional_predecessors: Vec::new(),
                });

                task_id_to_action_idx.insert(task.id.clone(), idx);
                prev_task_id = Some(task.id.clone());
            }
        }
    }

    // Wire up cross-element dependencies (BR-ELEM-004: finish-to-start).
    // For each element with prerequisite_element_ids, link its first action
    // to the last action of each prerequisite element.
    {
        // Build element_id → (first_action_idx, last_action_idx) map
        let mut element_first_action: HashMap<String, usize> = HashMap::new();
        let mut element_last_action: HashMap<String, usize> = HashMap::new();
        for job in jobs {
            for element in &job.elements {
                for task in &element.tasks {
                    if let Some(&action_idx) = task_id_to_action_idx.get(&task.id) {
                        element_last_action.insert(element.id.clone(), action_idx);
                        element_first_action.entry(element.id.clone()).or_insert(action_idx);
                    }
                }
            }
        }

        // Link dependencies
        for job in jobs {
            for element in &job.elements {
                if element.prerequisite_element_ids.is_empty() {
                    continue;
                }
                if let Some(&first_action_idx) = element_first_action.get(&element.id) {
                    for prereq_id in &element.prerequisite_element_ids {
                        if let Some(&last_action_idx) = element_last_action.get(prereq_id) {
                            // Drying time: if the prerequisite's last task is on a press
                            let pred_station = actions[last_action_idx].station_idx;
                            let gap = if pred_station < stations.len() && stations[pred_station].is_press {
                                minutes_to_ticks(stations[pred_station].drying_time_minutes, tick_minutes)
                            } else {
                                0
                            };

                            if actions[first_action_idx].predecessor_idx.is_none() {
                                actions[first_action_idx].predecessor_idx = Some(last_action_idx);
                                // Use max gap (cross-element gap or existing intra-element gap)
                                actions[first_action_idx].predecessor_gap_ticks =
                                    actions[first_action_idx].predecessor_gap_ticks.max(gap);
                            } else {
                                actions[first_action_idx].additional_predecessors.push((last_action_idx, gap));
                            }
                        }
                    }
                }
            }
        }
    }

    // Wire up cross-job dependencies (BR-JOB-006: finish-to-start).
    // For each job with required_job_ids, find its first action and link it to
    // the last actions of all required jobs.
    let mut job_id_to_last_action: HashMap<String, usize> = HashMap::new();
    let mut job_id_to_first_action: HashMap<String, usize> = HashMap::new();
    for (i, action) in actions.iter().enumerate() {
        job_id_to_last_action.insert(action.job_id.clone(), i); // last seen = last action
        job_id_to_first_action.entry(action.job_id.clone()).or_insert(i); // first seen = first action
    }

    for job in jobs {
        if job.required_job_ids.is_empty() {
            continue;
        }
        if let Some(&first_action_idx) = job_id_to_first_action.get(&job.id) {
            for req_job_id in &job.required_job_ids {
                if let Some(&last_action_idx) = job_id_to_last_action.get(req_job_id) {
                    // If the first action already has a predecessor (intra-element),
                    // add as additional predecessor
                    if actions[first_action_idx].predecessor_idx.is_some() {
                        actions[first_action_idx].additional_predecessors.push((last_action_idx, 0));
                    } else {
                        // Use the primary predecessor slot
                        actions[first_action_idx].predecessor_idx = Some(last_action_idx);
                    }
                }
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

pub fn remap_assignments(
    raw_assignments: Vec<ComputedAssignment>,
    stations: &[StationInput],
    operators: &[OperatorInput],
    _tick_minutes: u32,
    _start_date: chrono::NaiveDate,
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

pub fn compute_stats(
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

    // Late job tracking (deduplicated by job_id)
    let mut late_jobs: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut weighted_lateness_minutes: u64 = 0;
    let tier_weights: [f64; 4] = [4.0, 2.0, 1.0, 0.5];

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
                    let lateness = end_minutes - deadline_minutes;
                    total_lateness_minutes += lateness;

                    // Deduplicated late job count + weighted lateness
                    late_jobs.insert(action.job_id.clone());
                    let w = tier_weights[action.deadline_priority.min(3) as usize];
                    weighted_lateness_minutes += (lateness as f64 * w) as u64;
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
        late_job_count: late_jobs.len() as u32,
        weighted_lateness_minutes,
    }
}

pub fn parse_deadline_minutes(deadline: &str, start_date: chrono::NaiveDate) -> Option<u64> {
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
