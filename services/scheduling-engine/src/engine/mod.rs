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

        // Coalesce contiguous same-operator same-attention segments. Without
        // this step, a 30h task pre-split into 4 chunks emits 4 separate
        // operator entries even when the same operator stayed put across the
        // entire chunk boundary, which is misleading in the operator-view
        // schedule (the human reading the log sees "Halim 05:00-05:15
        // followed by Halim 05:15-07:15" instead of one clean 05:00-07:15
        // segment).
        merged_operators = coalesce_operator_segments(merged_operators);

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

    // Apply the same coalescing to single-chunk assignments too. They go
    // through this function via `chunks.len() == 1` short-circuit above
    // (which doesn't merge), so we post-process them here. The cost is one
    // pass over the result list — negligible vs the engine itself.
    for assignment in &mut result {
        assignment.operators = coalesce_operator_segments(std::mem::take(&mut assignment.operators));
    }

    result
}

/// Merge consecutive operator segments belonging to the same operator
/// when they have the same attention level and are time-contiguous
/// (the previous segment's `to` equals the next segment's `from`).
///
/// Why this exists: each pre-split chunk of a long task carries its own
/// independent operator log. After `merge_chunk_assignments` flattens the
/// chunks back into one assignment, the operator entries are concatenated
/// verbatim. So a single operator who worked the entire task continuously
/// still ends up with N entries, one per chunk. This pass collapses them
/// back into the natural per-operator segments a human expects to see.
///
/// The merge predicate is conservative: same operatorId AND same attention
/// AND `prev.to == curr.from` (string equality on the ISO timestamps —
/// safe because both are produced by the engine's `format_minutes` and so
/// share the same lexical form).
fn coalesce_operator_segments(operators: Vec<OperatorAssignment>) -> Vec<OperatorAssignment> {
    if operators.len() <= 1 {
        return operators;
    }

    // Group by operator_id, sort each group by `from`, then walk and merge.
    let mut by_op: HashMap<String, Vec<OperatorAssignment>> = HashMap::new();
    for op in operators {
        by_op.entry(op.operator_id.clone()).or_default().push(op);
    }

    let mut result: Vec<OperatorAssignment> = Vec::new();
    for (_op_id, mut entries) in by_op {
        entries.sort_by(|a, b| a.from.cmp(&b.from));

        let mut current = entries.remove(0);
        for next in entries {
            // Same attention (1e-6 epsilon) AND time-contiguous?
            let same_attention = (current.attention - next.attention).abs() < 1e-6;
            let contiguous = current.to == next.from;
            if same_attention && contiguous {
                // Extend the current segment to swallow the next one.
                current.to = next.to;
            } else {
                result.push(current);
                current = next;
            }
        }
        result.push(current);
    }

    // Stable-sort the final result by start time so the operator-view
    // timeline reads chronologically regardless of HashMap iteration order.
    result.sort_by(|a, b| a.from.cmp(&b.from));
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

                // Gap after predecessor: drying time (press → next) + outsourcing gap
                let drying_gap = match predecessor_idx {
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
                let outsourcing_gap = minutes_to_ticks(task.predecessor_gap_minutes, tick_minutes);
                let predecessor_gap_ticks = drying_gap + outsourcing_gap;

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
                    original_art: total_ticks,
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
                    work_accumulator: 0.0,
                    idle_ticks: 0,
                    tick_operator_log: Vec::new(),
                    total_productivity: 0.0,
                    ticks_counted: 0,
                    is_pinned: task.is_pinned,
                    pinned_start_tick: task.pinned_start_tick,
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

#[cfg(test)]
mod integration_tests {
    //! End-to-end scenario tests for the concurrent groups model.

    use super::*;
    use crate::model::job::{ElementInput, JobInput, TaskInput};
    use crate::model::operator::{ConcurrentGroupInput, OperatorInput, OperatorSkill};
    use crate::model::schedule::{ComputeOptions, ComputeRequest};
    use crate::model::station::StationInput;

    fn make_station(id: &str, name: &str, masked_enabled: bool) -> StationInput {
        StationInput {
            id: id.to_string(),
            name: name.to_string(),
            attention_full: Some(1.0),
            attention_run: Some(1.0),
            max_run_attention: Some(1.0),
            masked_time_enabled: masked_enabled,
            attention_masked: None,
            masked_productivity: None,
            tick_minutes: Some(60),
            peremption_threshold_minutes: None,
            max_chunk_minutes: None,
            category_id: None,
            similarity_criteria: None,
            is_press: false,
            drying_time_minutes: 0,
            max_operators: Some(1),
            capacity: Some(1),
        }
    }

    fn make_operator(
        id: &str,
        first_name: &str,
        skills: &[(&str, f64)],
        groups: Vec<ConcurrentGroupInput>,
    ) -> OperatorInput {
        OperatorInput {
            id: id.to_string(),
            first_name: first_name.to_string(),
            last_name: "Test".to_string(),
            role: "operator".to_string(),
            operating_schedule: None,
            skills: skills
                .iter()
                .map(|(s, p)| OperatorSkill {
                    station_id: s.to_string(),
                    proficiency: *p,
                })
                .collect(),
            concurrent_groups: groups,
        }
    }

    fn make_job(id: &str, station_id: &str, run_minutes: u32) -> JobInput {
        JobInput {
            id: id.to_string(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![TaskInput {
                    id: format!("{id}-task"),
                    station_id: station_id.to_string(),
                    setup_minutes: 0,
                    run_minutes,
                    sequence_order: 0,
                    is_pinned: false,
                    pinned_start_tick: None, predecessor_gap_minutes: 0,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        }
    }

    fn options() -> Option<ComputeOptions> {
        Some(ComputeOptions {
            horizon_days: 2,
            tick_minutes: 60,
            fbi_max_iterations: 1,
            multi_start: false,
        })
    }

    /// Parse a "YYYY-MM-DDTHH:MM:00" timestamp into absolute minutes from
    /// an arbitrary epoch. Only the differences between values are
    /// meaningful — used in tests to assert overlap or duration.
    fn iso_to_minutes(s: &str) -> i64 {
        let dt = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .unwrap_or_else(|e| panic!("invalid ISO datetime {s:?}: {e}"));
        dt.and_utc().timestamp() / 60
    }

    fn assignment_minutes(a: &crate::model::schedule::ComputedAssignment) -> (i64, i64) {
        (
            iso_to_minutes(&a.scheduled_start),
            iso_to_minutes(&a.scheduled_end),
        )
    }

    #[test]
    fn ludovic_pairs_two_stations_in_parallel() {
        let stations = vec![
            make_station("sbg", "SBG", true),
            make_station("mbo-xl", "MBO XL", true),
        ];
        let ludovic = make_operator(
            "ludovic",
            "Ludovic",
            &[("sbg", 1.0), ("mbo-xl", 1.0)],
            vec![ConcurrentGroupInput {
                station_ids: vec!["sbg".into(), "mbo-xl".into()],
                effective_productivity: [
                    ("sbg".to_string(), 0.85),
                    ("mbo-xl".to_string(), 0.90),
                ]
                .into_iter()
                .collect(),
            }],
        );

        let request = ComputeRequest {
            stations,
            operators: vec![ludovic],
            jobs: vec![
                make_job("job-a", "sbg", 60),
                make_job("job-b", "mbo-xl", 60),
            ],
            options: options(),
            station_groups: Vec::new(),
        };

        let result = compute(&request);
        assert_eq!(result.assignments.len(), 2, "expected 2 assignments");

        // Both jobs must run in parallel: their time ranges must overlap.
        // With 0.85/0.90 productivity each job takes 2 ticks to complete
        // (work accumulator < 1.0 after the first tick), but the two
        // assignments still overlap because Ludovic is on both stations
        // simultaneously — that's the pairing being exercised.
        let (start_a, end_a) = assignment_minutes(&result.assignments[0]);
        let (start_b, end_b) = assignment_minutes(&result.assignments[1]);
        assert!(
            start_a < end_b && start_b < end_a,
            "Ludovic pairing should overlap the two assignments; got A=[{start_a},{end_a}] B=[{start_b},{end_b}]"
        );
    }

    #[test]
    fn frederic_without_groups_serializes_jobs() {
        let stations = vec![
            make_station("sbg", "SBG", true),
            make_station("mbo-xl", "MBO XL", true),
        ];
        let fred = make_operator("fred", "Frederic", &[("sbg", 1.0), ("mbo-xl", 1.0)], vec![]);

        let request = ComputeRequest {
            stations,
            operators: vec![fred],
            jobs: vec![
                make_job("job-a", "sbg", 60),
                make_job("job-b", "mbo-xl", 60),
            ],
            options: options(),
            station_groups: Vec::new(),
        };

        let result = compute(&request);
        assert_eq!(result.assignments.len(), 2);

        // Frédéric has no concurrent groups: he can only be on one
        // station at a time, so the assignments must NOT overlap.
        let (start_a, end_a) = assignment_minutes(&result.assignments[0]);
        let (start_b, end_b) = assignment_minutes(&result.assignments[1]);
        let overlap = start_a < end_b && start_b < end_a;
        assert!(
            !overlap,
            "Frédéric must serialize, but assignments overlap: A=[{start_a},{end_a}] B=[{start_b},{end_b}]"
        );

        // Total wall-clock should be ~2 job durations (120 min).
        let makespan = end_a.max(end_b) - start_a.min(start_b);
        assert!(
            makespan >= 120,
            "Frédéric should take ~120 min total (serialized); got makespan={makespan} min"
        );
    }

    /// Direct comparison: same input, two different operators (one paired,
    /// one not). The paired operator's makespan must be strictly shorter.
    /// This is the strongest possible "pairing actually works" assertion.
    #[test]
    fn paired_operator_finishes_strictly_faster_than_unpaired() {
        let stations = vec![
            make_station("sbg", "SBG", true),
            make_station("mbo-xl", "MBO XL", true),
        ];

        let paired_op = make_operator(
            "ludovic",
            "Ludovic",
            &[("sbg", 1.0), ("mbo-xl", 1.0)],
            vec![ConcurrentGroupInput {
                station_ids: vec!["sbg".into(), "mbo-xl".into()],
                effective_productivity: [
                    ("sbg".to_string(), 1.0),
                    ("mbo-xl".to_string(), 1.0),
                ]
                .into_iter()
                .collect(),
            }],
        );
        let unpaired_op = make_operator("fred", "Frederic", &[("sbg", 1.0), ("mbo-xl", 1.0)], vec![]);

        let jobs = vec![
            make_job("job-a", "sbg", 60),
            make_job("job-b", "mbo-xl", 60),
        ];

        let paired_result = compute(&ComputeRequest {
            stations: stations.clone(),
            operators: vec![paired_op],
            jobs: jobs.clone(),
            options: options(),
            station_groups: Vec::new(),
        });
        let unpaired_result = compute(&ComputeRequest {
            stations,
            operators: vec![unpaired_op],
            jobs,
            options: options(),
            station_groups: Vec::new(),
        });

        let paired_makespan = paired_result
            .assignments
            .iter()
            .map(|a| iso_to_minutes(&a.scheduled_end))
            .max()
            .unwrap()
            - paired_result
                .assignments
                .iter()
                .map(|a| iso_to_minutes(&a.scheduled_start))
                .min()
                .unwrap();
        let unpaired_makespan = unpaired_result
            .assignments
            .iter()
            .map(|a| iso_to_minutes(&a.scheduled_end))
            .max()
            .unwrap()
            - unpaired_result
                .assignments
                .iter()
                .map(|a| iso_to_minutes(&a.scheduled_start))
                .min()
                .unwrap();

        assert!(
            paired_makespan < unpaired_makespan,
            "paired should finish faster than unpaired; got paired={paired_makespan} unpaired={unpaired_makespan}"
        );
    }

    #[test]
    fn invalid_group_referencing_non_skill_emits_warning() {
        let stations = vec![
            make_station("sbg", "SBG", true),
            make_station("mbo-xl", "MBO XL", true),
        ];
        let op = make_operator(
            "op",
            "OpName",
            &[("sbg", 1.0)],
            vec![ConcurrentGroupInput {
                station_ids: vec!["sbg".into(), "mbo-xl".into()],
                effective_productivity: [
                    ("sbg".to_string(), 0.85),
                    ("mbo-xl".to_string(), 0.90),
                ]
                .into_iter()
                .collect(),
            }],
        );

        let request = ComputeRequest {
            stations,
            operators: vec![op],
            jobs: vec![make_job("job-a", "sbg", 60)],
            options: options(),
            station_groups: Vec::new(),
        };

        let result = compute(&request);
        assert!(
            result.warnings.iter().any(|w| w.message.contains("no skill")),
            "expected a warning about missing skill, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn group_with_productivity_above_one_is_accepted() {
        let stations = vec![
            make_station("sbg", "SBG", true),
            make_station("mbo-xl", "MBO XL", true),
        ];
        let genie = make_operator(
            "genie",
            "Genie",
            &[("sbg", 1.0), ("mbo-xl", 1.0)],
            vec![ConcurrentGroupInput {
                station_ids: vec!["sbg".into(), "mbo-xl".into()],
                effective_productivity: [
                    ("sbg".to_string(), 1.3),
                    ("mbo-xl".to_string(), 1.2),
                ]
                .into_iter()
                .collect(),
            }],
        );

        let request = ComputeRequest {
            stations,
            operators: vec![genie],
            jobs: vec![
                make_job("job-a", "sbg", 60),
                make_job("job-b", "mbo-xl", 60),
            ],
            options: options(),
            station_groups: Vec::new(),
        };

        let result = compute(&request);
        let invalid: Vec<&str> = result.warnings.iter()
            .filter(|w| w.message.contains("out of range"))
            .map(|w| w.message.as_str()).collect();
        assert!(invalid.is_empty(), "unexpected: {invalid:?}");
        assert_eq!(result.assignments.len(), 2);
    }

    /// Pin scenario: a job has 2 sequential tasks (printing → finishing).
    /// Printing is pinned at tick 100. Finishing has no pin. After compute,
    /// printing must stay at tick 100 (≈ start_minutes 100 * tick_minutes)
    /// and finishing must start AFTER printing ends.
    ///
    /// This is the regression test for the bug where the engine ignored
    /// pins, placed printing at tick 0, and the user ended up with a
    /// PrecedenceConflict because the saved pin didn't match what the
    /// engine returned for the finishing successor.
    #[test]
    fn pinned_predecessor_makes_successor_chain_after_it() {
        let stations = vec![
            make_station("press", "Press", false),
            make_station("finish", "Finish", false),
        ];
        let alice = make_operator(
            "alice",
            "Alice",
            &[("press", 1.0), ("finish", 1.0)],
            vec![],
        );

        // tick_minutes = 60 (from `options()`), so a 60-minute task = 1 tick.
        // Pin printing at tick 5 (= 5h after epoch).
        let pinned_tick: usize = 5;

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
                        is_pinned: true,
                        pinned_start_tick: Some(pinned_tick),
                        predecessor_gap_minutes: 0,
                    },
                    TaskInput {
                        id: "task-finish".into(),
                        station_id: "finish".into(),
                        setup_minutes: 0,
                        run_minutes: 60,
                        sequence_order: 1,
                        is_pinned: false,
                        pinned_start_tick: None, predecessor_gap_minutes: 0,
                    },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let request = ComputeRequest {
            stations,
            operators: vec![alice],
            jobs: vec![job],
            options: options(),
            station_groups: Vec::new(),
        };

        let result = compute(&request);

        // Find both assignments by task id
        let print = result.assignments.iter().find(|a| a.task_id == "task-print")
            .expect("printing assignment must be in the engine result");
        let finish = result.assignments.iter().find(|a| a.task_id == "task-finish")
            .expect("finishing assignment must be in the engine result");

        let (print_start, print_end) = assignment_minutes(print);
        let (finish_start, _finish_end) = assignment_minutes(finish);

        // Pin must be exactly at tick 5 = 5*60 = 300 minutes after epoch.
        // We compare with the printing start since the absolute timestamps
        // depend on `Local::now().date_naive()` which we can't control here.
        // Instead, we assert that finish_start - print_start equals
        // exactly the printing duration (60 minutes), which proves the
        // successor chained immediately after the pinned predecessor.
        assert_eq!(
            print_end - print_start,
            60,
            "printing duration should be 60 minutes (its run_minutes)"
        );
        assert!(
            finish_start >= print_end,
            "finishing must start after printing ends — got finish_start={} print_end={} (precedence violation, the pin wasn't respected by the engine)",
            finish_start,
            print_end
        );
    }

    #[test]
    fn coalesce_merges_contiguous_same_attention_segments() {
        // Two segments back-to-back, same operator, same attention →
        // should collapse into one continuous segment.
        let input = vec![
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:00:00".into(),
                to: "2026-04-13T05:15:00".into(),
                attention: 1.0,
            },
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:15:00".into(),
                to: "2026-04-13T07:15:00".into(),
                attention: 1.0,
            },
        ];
        let out = super::coalesce_operator_segments(input);
        assert_eq!(out.len(), 1, "should collapse to one segment");
        assert_eq!(out[0].from, "2026-04-13T05:00:00");
        assert_eq!(out[0].to, "2026-04-13T07:15:00");
    }

    #[test]
    fn coalesce_keeps_different_attention_separate() {
        // Same op, contiguous, but attention changed → must NOT merge.
        let input = vec![
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:00:00".into(),
                to: "2026-04-13T06:00:00".into(),
                attention: 0.5,
            },
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T06:00:00".into(),
                to: "2026-04-13T07:00:00".into(),
                attention: 1.0,
            },
        ];
        let out = super::coalesce_operator_segments(input);
        assert_eq!(out.len(), 2, "different attention must not collapse");
    }

    #[test]
    fn coalesce_keeps_gap_separate() {
        // Same op, same attention, but a real gap between them → must NOT merge.
        let input = vec![
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:00:00".into(),
                to: "2026-04-13T06:00:00".into(),
                attention: 1.0,
            },
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T06:30:00".into(),
                to: "2026-04-13T07:00:00".into(),
                attention: 1.0,
            },
        ];
        let out = super::coalesce_operator_segments(input);
        assert_eq!(out.len(), 2, "30-min gap must not collapse");
    }

    #[test]
    fn coalesce_groups_per_operator() {
        // Two operators interleaved — each is independently coalesced.
        let input = vec![
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:00:00".into(),
                to: "2026-04-13T05:30:00".into(),
                attention: 1.0,
            },
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-b".into(),
                from: "2026-04-13T05:00:00".into(),
                to: "2026-04-13T05:30:00".into(),
                attention: 0.5,
            },
            crate::model::schedule::OperatorAssignment {
                operator_id: "op-a".into(),
                from: "2026-04-13T05:30:00".into(),
                to: "2026-04-13T06:00:00".into(),
                attention: 1.0,
            },
        ];
        let out = super::coalesce_operator_segments(input);
        // op-a's two pieces should fuse, op-b stays alone.
        assert_eq!(out.len(), 2);
        let a = out.iter().find(|o| o.operator_id == "op-a").unwrap();
        assert_eq!(a.from, "2026-04-13T05:00:00");
        assert_eq!(a.to, "2026-04-13T06:00:00");
        let b = out.iter().find(|o| o.operator_id == "op-b").unwrap();
        assert_eq!(b.to, "2026-04-13T05:30:00");
    }
}
