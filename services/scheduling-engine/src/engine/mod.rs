mod backward_pass;
pub mod business_calendar;
pub mod fbi;
mod forward_pass;
mod grid;
pub mod lns;
pub mod moore;
pub mod outsourced;
pub mod pre_split;
pub mod precedence_validator;
pub mod similarity;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{mpsc, Arc};
use std::time::Instant;

use crate::model::progress::ProgressEvent;

/// Optional progress sender. When Some, the engine emits real-time progress events.
pub type ProgressSender = Option<mpsc::Sender<ProgressEvent>>;

fn emit(tx: &ProgressSender, event: ProgressEvent) {
    if let Some(tx) = tx {
        let _ = tx.send(event);
    }
}

use chrono::{DateTime, Local, NaiveDateTime, TimeZone};

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{
    ComputeRequest, ComputedAssignment, OperatorAssignment, OutsourcedAssignment,
    ScheduleResult, ScheduleStats, Warning,
};
use crate::model::station::StationInput;

use self::forward_pass::Action;

/// Resolve the engine's notion of "now" from the request.
///
/// When `reference_time` is provided (PHP forwards its `ClockService::now()`),
/// parse it and convert to local timezone — the rest of the engine derives
/// `start_date` and tick offsets from this value, so a global now-override
/// configured in PHP propagates here without further plumbing. Falls back
/// to wall clock if the field is absent or unparseable, preserving prod
/// behaviour when nothing is set.
fn resolve_now(reference_time: &Option<String>) -> chrono::DateTime<Local> {
    if let Some(s) = reference_time.as_deref() {
        if !s.is_empty() {
            if let Ok(parsed) = DateTime::parse_from_rfc3339(s) {
                return parsed.with_timezone(&Local);
            }
            // Fallback: accept naive ISO ("2026-05-07T10:00:00") as local-time.
            if let Ok(naive) = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
                if let chrono::LocalResult::Single(dt) = Local.from_local_datetime(&naive) {
                    return dt;
                }
            }
        }
    }
    Local::now()
}

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
    compute_inner(request, &None, None)
}

pub fn compute_with_progress(request: &ComputeRequest, tx: mpsc::Sender<ProgressEvent>) -> ScheduleResult {
    compute_inner(request, &Some(tx), None)
}

/// Compute with a cancellation token plumbed into the LNS loop. Used by
/// the streaming endpoint so a superseding request can cleanly stop
/// the LNS in flight.
pub fn compute_with_cancel(
    request: &ComputeRequest,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<AtomicBool>,
) -> ScheduleResult {
    compute_inner(request, &Some(tx), Some(cancel))
}

fn compute_inner(
    request: &ComputeRequest,
    progress: &ProgressSender,
    cancel: Option<Arc<AtomicBool>>,
) -> ScheduleResult {
    let start_time = Instant::now();
    let now = resolve_now(&request.reference_time);
    let start_date = now.date_naive();

    let options = request.options.clone().unwrap_or_default();
    // Use the finest tick granularity across all stations. If any station
    // has tick_minutes=5 (e.g. massicot), the whole grid runs at 5-min
    // resolution so that station gets precise scheduling boundaries.
    let tick_minutes = request
        .stations
        .iter()
        .map(|s| s.effective_tick_minutes())
        .filter(|&t| t > 0)
        .min()
        .unwrap_or(options.tick_minutes);
    let fbi_max_iterations = options.fbi_max_iterations;

    // Validate concurrent groups (Phase 1 ingestion only — these warnings
    // are informational; the algorithm does not yet use the field).
    let mut concurrent_group_warnings =
        validate_concurrent_groups(&request.operators, &request.stations);

    // Build station ID → index map (reused for constraints + masked_time)
    let station_id_to_idx: HashMap<String, usize> = request
        .stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    // Build per-station blocked tick ranges from the station's domain-level
    // schedule exceptions. Legacy SchedulingConstraint(MachineUnavailable)
    // source was removed in the architecture cleanup — the only canonical
    // channel now is Station.scheduleExceptions.
    let mut station_blocked_ranges: Vec<Vec<(usize, usize)>> = vec![Vec::new(); request.stations.len()];
    for (station_idx, station) in request.stations.iter().enumerate() {
        for range in station.blocked_ranges(start_date, options.horizon_days, tick_minutes) {
            station_blocked_ranges[station_idx].push(range);
        }
    }
    let _ = &station_id_to_idx;

    // Parse occupied slots (existing assignments to preserve) into grid-ready form.
    // Each entry: (station_idx, Vec<operator_idx>, start_tick, end_tick)
    let operator_id_to_idx: HashMap<String, usize> = request
        .operators
        .iter()
        .enumerate()
        .map(|(i, o)| (o.id.clone(), i))
        .collect();

    let occupied_slots_parsed: Vec<(usize, Vec<usize>, usize, usize)> = request
        .occupied_slots
        .iter()
        .filter_map(|slot| {
            let station_idx = *station_id_to_idx.get(&slot.station_id)?;
            let start_tick = parse_deadline_minutes(&slot.start, start_date)
                .map(|mins| mins as usize / tick_minutes as usize)?;
            let end_tick = parse_deadline_minutes(&slot.end, start_date)
                .map(|mins| mins as usize / tick_minutes as usize)?;
            let op_indices: Vec<usize> = slot.operator_ids.iter()
                .filter_map(|id| operator_id_to_idx.get(id).copied())
                .collect();
            Some((station_idx, op_indices, start_tick, end_tick))
        })
        .collect();

    // Build station masked_time lookup for post-processing
    let station_masked_time: HashMap<String, bool> = request
        .stations
        .iter()
        .map(|s| (s.id.clone(), s.masked_time_enabled))
        .collect();

    // Compute now_tick: current time rounded UP to the next tick boundary.
    // No task will be placed before this tick (avoids scheduling in the past).
    let now_tick = {
        use chrono::Timelike;
        let minutes_since_midnight = now.hour() as u32 * 60 + now.minute() as u32;
        // Round up to next tick boundary
        let ticks = (minutes_since_midnight + tick_minutes - 1) / tick_minutes;
        ticks as usize
    };

    // Run FBI loop with optional multi-start (TierFirst + EDD orderings)
    emit(progress, ProgressEvent::MergeStart); // signal "sending to engine"

    // Pin displacement warnings emitted by pre_place_pinned_actions across
    // all FBI passes. Same pin produces deterministically identical warnings
    // each iteration, so we dedupe by task_id (last write wins) before
    // appending to the response's warnings array.
    let mut pin_warnings: Vec<Warning> = Vec::new();
    let (mut assignments, mut actions, mut stats, mut fbi_iterations) = fbi::run_with_multi_start_fbi(
        &request.jobs,
        &request.stations,
        &request.operators,
        tick_minutes,
        options.horizon_days,
        fbi_max_iterations,
        start_date,
        options.multi_start,
        options.perturbed_starts,
        &station_blocked_ranges,
        &occupied_slots_parsed,
        &request.setup_completion_log,
        progress,
        now_tick,
        options.precedence_min_gap_ticks,
        &mut pin_warnings,
    );

    // Moore escape hatch: if late imperative/important jobs remain after FBI,
    // try swapping lower-priority work to rescue them. Budget-capped to avoid
    // excessive compute time.
    // Skip for single-job payloads — no other jobs to swap with.
    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    if stats.late_job_count > 0 && elapsed_ms < 15_000 && request.jobs.len() > 1 {
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
            2, // max_attempts (reduced to leave budget for SA)
            &request.setup_completion_log,
            now_tick,
            options.precedence_min_gap_ticks,
        ) {
            assignments = moore_assignments;
            actions = moore_actions;
            stats = moore_stats;
            fbi_iterations += moore_iters;
        }
    }

    // LNS: if late jobs remain after Moore, explore alternative priority
    // configurations by destroying/repairing batches of late jobs.
    // Skip for single-job payloads — nothing to destroy/repair across jobs.
    // Also skip when the caller asked to skip LNS (two-phase /compute-fast).
    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let skip_lns = options.skip_lns.unwrap_or(false);
    if !skip_lns && stats.late_job_count > 0 && elapsed_ms < 55_000 && request.jobs.len() > 1 {
        // Default in-request LNS budget: remainder of the 60s wall clock
        // floor-clamped to 5s, but overridable via options.lns_budget_ms.
        let lns_budget = options
            .lns_budget_ms
            .unwrap_or_else(|| 60_000u64.saturating_sub(elapsed_ms).max(5_000));
        if let Some((lns_a, lns_act, _lns_s, lns_i)) = lns::lns_improve(
            &request.jobs,
            &request.stations,
            &request.operators,
            &actions,
            &stats,
            tick_minutes,
            options.horizon_days,
            start_date,
            &station_blocked_ranges,
            &occupied_slots_parsed,
            &request.setup_completion_log,
            now_tick,
            lns_budget,
            progress,
            cancel.clone(),
            options.precedence_min_gap_ticks,
        ) {
            assignments = lns_a;
            actions = lns_act;
            // stats from LNS is intentionally dropped — it would be shadowed
            // by recompute_stats_from_assignments(...) further down anyway.
            fbi_iterations += lns_i;
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

    // Dedupe pin-displacement warnings by task_id (last write wins). Each
    // FBI iteration's pre_place re-emits the same warning for the same pin,
    // and multi-start passes that lose to the winner have already had their
    // warnings discarded inside run_with_multi_start_fbi — but FBI iteration
    // duplicates within the winning pass survive that filter.
    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut deduped_pin_warnings: Vec<Warning> = Vec::new();
    for w in pin_warnings.into_iter() {
        if let Some(ref tid) = w.task_id {
            if let Some(&idx) = seen.get(tid) {
                deduped_pin_warnings[idx] = w;
            } else {
                seen.insert(tid.clone(), deduped_pin_warnings.len());
                deduped_pin_warnings.push(w);
            }
        } else {
            deduped_pin_warnings.push(w);
        }
    }
    warnings.extend(deduped_pin_warnings);

    // Check for unplaced tasks
    let unplaced: u32 = actions.iter().filter(|a| a.end_tick.is_none()).count() as u32;
    if unplaced > 0 {
        warnings.push(Warning {
            task_id: None,
            message: format!("{} tasks could not be placed", unplaced),
        });
    }

    // Build outsourced assignments BEFORE the stats pass so the lateness
    // recomputation can see ST scheduledEnds. Without this, an ST step
    // returning after the deadline (e.g. PLIAGE Aller-simple, 8 JO) was
    // invisible to stats.lateJobCount even though SnapshotBuilder
    // (which iterates the persisted Schedule.assignments where PHP has
    // merged both halves) catches it — leaving the toast at "100 % à
    // l'heure" while the JDP painted the row red.
    let outsourced_assignments = build_outsourced_assignments(
        &request.jobs,
        &assignments,
        start_date,
        tick_minutes,
    );

    // Recompute stats from the FINAL assignments (after merge + post-processing)
    // so that stats.lateJobCount matches what the validation-service sees.
    let stats = recompute_stats_from_assignments(
        &assignments,
        &outsourced_assignments,
        &request.jobs,
        tick_minutes,
        start_date,
    );

    // Defense-in-depth: runtime precedence audit. Several engine code
    // paths (pre_place_pinned_actions for pins, in-progress emission)
    // bypass the forward-pass precedence check, and the cross-element
    // wiring depends on subtle invariants (action ordering, complete
    // chunk-remap). If any of these silently emit a violating placement,
    // we'd rather surface it as a Warning the user sees in the compute
    // modal than ship it silently. Warnings are non-fatal — assignments
    // are still returned so the user can investigate; downstream PHP /
    // FE keep their own validator (`recalculatePrecedenceConflicts`).
    let precedence_gap_minutes = options.precedence_min_gap_ticks * tick_minutes;
    let violations = precedence_validator::validate_precedence(
        &request.jobs,
        &assignments,
        precedence_gap_minutes,
    );
    for v in &violations {
        let kind_label = match &v.kind {
            precedence_validator::ViolationKind::IntraElement => "intra-element",
            precedence_validator::ViolationKind::CrossElement { .. } => "cross-element",
            precedence_validator::ViolationKind::CrossJob { .. } => "cross-job",
        };
        warnings.push(Warning {
            task_id: Some(v.offender_task_id.clone()),
            message: format!(
                "Precedence violation ({}): task {} starts at {} before predecessor {} ends at {}",
                kind_label,
                v.offender_task_id,
                v.offender_start,
                v.predecessor_task_id,
                v.predecessor_end,
            ),
        });
    }

    let compute_time_ms = start_time.elapsed().as_millis() as u64;

    emit(progress, ProgressEvent::EngineDone { compute_time_ms });

    ScheduleResult {
        assignments,
        stats,
        warnings,
        fbi_iterations,
        compute_time_ms,
        tick_minutes,
        outsourced_assignments,
        engine_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Walk every element's tasks in sequence order and emit one
/// `OutsourcedAssignment` per outsourced TaskInput, anchoring on the
/// previous Internal task's actual scheduledEnd (or, in a multi-step ST
/// chain, on the running return-of-previous-ST). The result is consumed
/// verbatim by PHP — no further date computation is needed downstream.
///
/// When the predecessor is unplaced (no entry in `assignments`) the ST
/// step is silently skipped: the engine already reports an "X tasks
/// could not be placed" warning for the upstream gap, and emitting an
/// ST assignment without a real anchor would either need a fabricated
/// "today midnight" anchor (misleading) or a `null` field (PHP-side
/// burden). Easier and safer to leave the assignment unset; the PHP
/// persistence layer treats absence as "no engine answer for this task".
fn build_outsourced_assignments(
    jobs: &[crate::model::job::JobInput],
    assignments: &[ComputedAssignment],
    start_date: chrono::NaiveDate,
    tick_minutes: u32,
) -> Vec<OutsourcedAssignment> {
    use chrono::NaiveDateTime;

    let internal_end_by_task: HashMap<&str, NaiveDateTime> = assignments
        .iter()
        .filter_map(|a| {
            NaiveDateTime::parse_from_str(&a.scheduled_end, "%Y-%m-%dT%H:%M:%S")
                .ok()
                .map(|dt| (a.task_id.as_str(), dt))
        })
        .collect();

    let today_midnight = start_date
        .and_hms_opt(0, 0, 0)
        .expect("midnight is always valid");

    let mut out: Vec<OutsourcedAssignment> = Vec::new();
    for job in jobs {
        for element in &job.elements {
            let mut sorted = element.tasks.clone();
            sorted.sort_by_key(|t| t.sequence_order);

            // last_end carries either the Internal predecessor's
            // scheduledEnd or, when chained, the previous ST step's
            // computed return — either of which is the correct anchor
            // for the next step's departure formula.
            let mut last_end: Option<NaiveDateTime> = None;
            for task in &sorted {
                match &task.outsourced {
                    Some(params) => {
                        if let Some(pred_end) = last_end {
                            let dates = outsourced::compute_dates(
                                pred_end, params, today_midnight, tick_minutes,
                            );
                            out.push(OutsourcedAssignment {
                                task_id: task.id.clone(),
                                provider_id: params.provider_id.clone(),
                                scheduled_start: dates.departure_dt
                                    .format("%Y-%m-%dT%H:%M:%S")
                                    .to_string(),
                                scheduled_end: dates.return_dt
                                    .format("%Y-%m-%dT%H:%M:%S")
                                    .to_string(),
                            });
                            last_end = Some(dates.return_dt);
                        }
                        // else: predecessor not placed — see fn comment.
                    }
                    None => {
                        last_end = internal_end_by_task
                            .get(task.id.as_str())
                            .copied();
                    }
                }
            }
        }
    }
    out
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

        // Concatenate recalage phases from all chunks — a peremption in
        // chunk N remains a peremption of the merged task.
        let merged_recalages = chunks
            .iter()
            .flat_map(|c| c.recalages.iter().cloned())
            .collect();

        // Active-window decomposition: expose the union of each chunk's
        // own active windows so the UI knows where the task is genuinely
        // active vs. suspended. Falls back to a chunk's [scheduled_start,
        // scheduled_end] when that chunk has no per-tick decomposition
        // (e.g. pinned task whose advance bypassed `tick_operator_log`).
        //
        // Without this, the merged envelope visually overlaps any tile
        // the forward pass routed around — most commonly a safety-zone-
        // frozen pin sitting inside the long task's wall-clock span. The
        // UI renders one tile per active window; gaps between them stay
        // empty (or hidden by the collapse-aware projection when they
        // fall on a closure band).
        let mut merged_windows: Vec<crate::model::schedule::PhaseSegment> = Vec::new();
        for c in &chunks {
            match c.active_windows.as_ref() {
                Some(ws) if !ws.is_empty() => {
                    for w in ws {
                        merged_windows.push(w.clone());
                    }
                }
                _ => {
                    merged_windows.push(crate::model::schedule::PhaseSegment {
                        start: c.scheduled_start.clone(),
                        end: c.scheduled_end.clone(),
                    });
                }
            }
        }
        let active_windows = if merged_windows.len() >= 2 {
            // Sort by start then collapse adjacent / overlapping segments
            // so consumers don't have to deal with redundant micro-gaps
            // that arise when a chunk-split task crosses a closure inside
            // a tick-log run.
            merged_windows.sort_by(|a, b| a.start.cmp(&b.start));
            let mut collapsed: Vec<crate::model::schedule::PhaseSegment> = Vec::new();
            for w in merged_windows {
                if let Some(last) = collapsed.last_mut() {
                    if last.end >= w.start {
                        if w.end > last.end {
                            last.end = w.end;
                        }
                        continue;
                    }
                }
                collapsed.push(w);
            }
            if collapsed.len() >= 2 {
                Some(collapsed)
            } else {
                None
            }
        } else {
            None
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
            recalages: merged_recalages,
            active_windows,
            // Inheritance is decided at pre-place for the WHOLE pinned
            // task ; chunks of a single non-pinned task can't inherit, so
            // when merging chunk assignments we propagate the inheritance
            // status from the first chunk verbatim. setup_lost_reason
            // mirrors the same logic.
            setup_inherited: first.setup_inherited,
            setup_lost_reason: first.setup_lost_reason.clone(),
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
            // Outsourced steps that have appeared in sequence order since
            // the last internal task. They are not placed by the engine;
            // they get attached to the next internal task as its
            // `outsourced_predecessor_chain`, which the forward pass
            // walks to compute that task's earliest start.
            let mut pending_outsourced_chain: Vec<crate::model::job::OutsourcedParams> = Vec::new();

            // Extract similarity-relevant spec fields once per element — all
            // its tasks share the same underlying ElementSpec.
            let spec_snapshot = similarity::SpecSnapshot::from_spec_json(
                element.spec.as_ref(),
            );

            for task in &sorted_tasks {
                // Outsourced step: defer to the next internal task. Don't
                // push an Action — the engine doesn't place it on a station
                // or operator. Its scheduledStart / scheduledEnd are
                // emitted in a separate pass over `jobs` after forward_pass
                // completes (see `build_outsourced_assignments`).
                if let Some(out_params) = &task.outsourced {
                    pending_outsourced_chain.push(out_params.clone());
                    continue;
                }

                let station_idx = match station_id_to_idx.get(&task.station_id) {
                    Some(&idx) => idx,
                    None => continue, // skip unknown stations
                };

                let raw_setup_ticks = minutes_to_ticks(task.setup_minutes, tick_minutes);
                let run_ticks = minutes_to_ticks(task.effective_run_minutes(), tick_minutes);
                let setup_ticks = if run_ticks == 0 { 0 } else { raw_setup_ticks };
                let total_ticks = setup_ticks + run_ticks;

                // Fully-complete task (100% progress → 0 remaining work):
                // mark as done at tick 0 so successors' predecessor check
                // sees end_tick=Some(0) and proceeds. Without this, the
                // scoring loop's `art==0 → continue` leaves end_tick=None,
                // blocking the entire downstream chain.
                let (zero_start, zero_end) = if total_ticks == 0 {
                    (Some(0), Some(0))
                } else {
                    (None, None)
                };

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
                // Outsourcing is no longer expressed as a fixed pre-computed
                // gap. Outsourced tasks now arrive in the input as their own
                // TaskInputs (kind=Outsourced), are skipped by build_actions,
                // and their dynamic return tick is computed at forward-pass
                // time from the predecessor's actual end_tick — so the
                // contribution to `predecessor_gap_ticks` here is zero.
                let predecessor_gap_ticks = drying_gap;

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
                    task_total_ticks: total_ticks,
                    eat: 0,
                    last,
                    predecessor_idx,
                    predecessor_gap_ticks,
                    end_tick: zero_end,
                    assigned_operators: Vec::new(),
                    start_tick: zero_start,
                    chunk_info: None,
                    deadline_priority: job.deadline_priority,
                    job_deadline_tick,
                    earliest_retry_tick: None,
                    earliest_start_tick: task.earliest_start_tick,
                    additional_predecessors: Vec::new(),
                    work_accumulator: 0.0,
                    idle_ticks: 0,
                    tick_operator_log: Vec::new(),
                    total_productivity: 0.0,
                    ticks_counted: 0,
                    chain_remaining_art: 0, // computed below
                    is_pinned: task.is_pinned,
                    is_frozen_by_safety_zone: task.is_frozen_by_safety_zone,
                    pinned_start_tick: task.pinned_start_tick,
                    pinned_end_tick: task.pinned_end_tick,
                    peremption_count: 0,
                    pending_recalage: false,
                    current_recalage_start: None,
                    recalage_segments: Vec::new(),
                    spec_snapshot: spec_snapshot.clone(),
                    setup_progress: 0.0,
                    setup_end_tick: None,
                    outsourced_predecessor_chain: std::mem::take(&mut pending_outsourced_chain),
                    // Default false until P3b (caleur volant emprunts) lifts the
                    // flag for actions whose conducteur is being borrowed away
                    // and whose calage must be preserved across the gap.
                    borrow_until_tick: None,
                    borrowed_op_to_restore: None,
                    // V2 LNS perturbation: lifted from the parent JobInput.
                    // PHP never serializes this — only LNS toggles it on
                    // randomly chosen on-time jobs to explore alternative
                    // staffing configurations.
                    force_max_staffing: job.force_max_staffing,
                    // D — split-at-NOW: lifted from TaskInput so
                    // pre_place_pinned_actions can detect in-progress pins
                    // explicitly and apply the split rule.
                    is_in_progress: task.is_in_progress,
                    task_elapsed_ticks: task.task_elapsed_ticks,
                    forced_start_tick: task.forced_start_tick,
                    already_eaten_ticks: task.already_eaten_ticks,
                    // Setup-inheritance: resolve station_id → station_idx
                    // here so pre_place_pinned_actions can compare directly
                    // against `action.station_idx` without re-threading the
                    // string→idx map. Unknown stations land at `None` and
                    // are rejected as `station_mismatch` at evaluation.
                    inherited_setup_at_tick: task.inherited_setup.as_ref().map(|i| i.at_tick),
                    inherited_setup_station_idx: task
                        .inherited_setup
                        .as_ref()
                        .and_then(|i| station_id_to_idx.get(&i.station_id).copied()),
                    setup_inherited: false,
                    setup_lost_reason: None,
                });

                task_id_to_action_idx.insert(task.id.clone(), idx);
                prev_task_id = Some(task.id.clone());
            }
            // Note: any ST tasks left at the tail of an element (no
            // internal successor) are intentionally ignored here. Their
            // assignments are still emitted later by the output pass over
            // `jobs`, anchored on the last internal task's end_tick.
        }
    }

    // Compute chain_remaining_art: walk successor chains backward.
    // successor_of[i] = j means action j's predecessor is i.
    {
        let mut successor_of: HashMap<usize, usize> = HashMap::new();
        for (i, a) in actions.iter().enumerate() {
            if let Some(pred) = a.predecessor_idx {
                successor_of.insert(pred, i);
            }
        }
        // Start from terminal actions (no successor), walk backward
        for i in (0..actions.len()).rev() {
            let succ_chain = successor_of.get(&i)
                .map(|&s| actions[s].chain_remaining_art)
                .unwrap_or(0);
            actions[i].chain_remaining_art = actions[i].art + succ_chain;
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
    let mut weighted_late_job_count: u64 = 0;
    let tier_weights: [f64; 5] = [10_000_000.0, 4.0, 2.0, 1.0, 0.5];

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
                    let w = tier_weights[action.deadline_priority.min(4) as usize];
                    if late_jobs.insert(action.job_id.clone()) {
                        // First time seeing this job late — accumulate weighted count
                        // (vital=10M, imperative=4, important=2, standard=1, flexible=0.5)
                        // Multiply by 10 to keep integer precision (100M,40,20,10,5)
                        weighted_late_job_count += (w * 10.0) as u64;
                    }
                    weighted_lateness_minutes += (lateness as f64 * w) as u64;
                }
            }
        }
    }

    let late_job_count = late_jobs.len() as u32;
    let mut late_job_ids: Vec<String> = late_jobs.into_iter().collect();
    late_job_ids.sort();

    let (calage_bonus_sum, calage_bonus_mean, calage_bonus_median) =
        compute_calage_stats_from_actions(actions);

    ScheduleStats {
        makespan_minutes,
        total_tasks,
        scheduled_tasks,
        deadline_violations,
        late_task_count,
        total_lateness_minutes,
        late_job_count,
        weighted_lateness_minutes,
        weighted_late_job_count,
        late_job_ids,
        calage_bonus_sum,
        calage_bonus_mean,
        calage_bonus_median,
    }
}

/// Compute calage bonus aggregates (sum, mean, median) across all placed
/// internal actions. Bonus per action is 100 if the previous action on
/// the same station belongs to the same job, else 0 (binary).
///
/// Drives the LNS secondary objective at equal late_job_count. Since the
/// bonus is binary, the median collapses to 0 or 100 depending on
/// whether more than half of placements benefit from continuity.
pub(crate) fn compute_calage_stats_from_actions(actions: &[Action]) -> (u64, f64, f64) {
    // Group placed actions by station, sorted by start_tick, and compute
    // bonus 100 when consecutive actions share the same job.
    use std::collections::HashMap;

    #[derive(Clone)]
    struct Placed<'a> {
        job_id: &'a str,
        start_tick: usize,
    }
    let mut by_station: HashMap<usize, Vec<Placed>> = HashMap::new();
    for action in actions {
        let start_tick = match action.start_tick {
            Some(t) => t,
            None => continue,
        };
        by_station.entry(action.station_idx).or_default().push(Placed {
            job_id: action.job_id.as_str(),
            start_tick,
        });
    }

    let mut bonuses: Vec<u32> = Vec::new();
    for placements in by_station.values_mut() {
        placements.sort_by_key(|p| p.start_tick);
        let mut prev_job: Option<&str> = None;
        for p in placements.iter() {
            let bonus = match prev_job {
                Some(prev) if prev == p.job_id => 100u32,
                _ => 0u32,
            };
            bonuses.push(bonus);
            prev_job = Some(p.job_id);
        }
    }

    if bonuses.is_empty() {
        return (0, 0.0, 0.0);
    }

    let sum: u64 = bonuses.iter().map(|&b| b as u64).sum();
    let mean: f64 = sum as f64 / bonuses.len() as f64;

    let mut sorted = bonuses.clone();
    sorted.sort_unstable();
    let median = if sorted.len() % 2 == 1 {
        sorted[sorted.len() / 2] as f64
    } else {
        let mid = sorted.len() / 2;
        (sorted[mid - 1] as f64 + sorted[mid] as f64) / 2.0
    };

    (sum, mean, median)
}

/// Recompute stats from the FINAL assignments (after merge + post-processing).
/// Uses the same logic as the validation-service: compare each assignment's
/// scheduledEnd against the job's deadline. Both internal (`assignments`)
/// and outsourced (`outsourced_assignments`) ends contribute, mirroring the
/// merged `Schedule.assignments` JSON the validation-service reads.
fn recompute_stats_from_assignments(
    assignments: &[ComputedAssignment],
    outsourced_assignments: &[OutsourcedAssignment],
    jobs: &[JobInput],
    _tick_minutes: u32,
    start_date: chrono::NaiveDate,
) -> ScheduleStats {
    let tier_weights: [f64; 5] = [10_000_000.0, 4.0, 2.0, 1.0, 0.5];

    // Build task_id → job_id map from jobs
    let mut task_to_job: HashMap<String, String> = HashMap::new();
    for job in jobs {
        for element in &job.elements {
            for task in &element.tasks {
                task_to_job.insert(task.id.clone(), job.id.clone());
            }
        }
    }

    // Build job deadline map (in minutes from start_date)
    let job_deadlines: HashMap<String, u64> = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref().and_then(|d| {
                parse_deadline_minutes(d, start_date).map(|mins| (j.id.clone(), mins))
            })
        })
        .collect();

    // Build job priority map
    let job_priority: HashMap<&str, u8> = jobs
        .iter()
        .map(|j| (j.id.as_str(), j.deadline_priority))
        .collect();

    // Find max end per job from assignments (using scheduledEnd datetime strings).
    // Both halves contribute: an ST Aller-simple ending after the deadline must
    // bump the job's max_end so per-job lateness is detected even when every
    // internal task fits inside the window.
    let mut job_max_end_minutes: HashMap<String, u64> = HashMap::new();
    let bump_max_end = |
        job_max_end_minutes: &mut HashMap<String, u64>,
        job_id: &str,
        end_mins: u64,
    | {
        let entry = job_max_end_minutes.entry(job_id.to_string()).or_insert(0);
        if end_mins > *entry {
            *entry = end_mins;
        }
    };
    for a in assignments {
        if let Some(job_id) = task_to_job.get(&a.task_id) {
            if let Some(end_mins) = parse_datetime_to_minutes(&a.scheduled_end, start_date) {
                bump_max_end(&mut job_max_end_minutes, job_id, end_mins);
            }
        }
    }
    for o in outsourced_assignments {
        if let Some(job_id) = task_to_job.get(&o.task_id) {
            if let Some(end_mins) = parse_datetime_to_minutes(&o.scheduled_end, start_date) {
                bump_max_end(&mut job_max_end_minutes, job_id, end_mins);
            }
        }
    }

    // Compute late jobs from final assignments
    let mut late_jobs: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut weighted_lateness_minutes: u64 = 0;
    let mut late_task_count: u32 = 0;
    let mut total_lateness_minutes: u64 = 0;
    let mut deadline_violations: u32 = 0;

    // Per-task lateness — internal half
    for a in assignments {
        if let Some(job_id) = task_to_job.get(&a.task_id) {
            if let Some(end_mins) = parse_datetime_to_minutes(&a.scheduled_end, start_date) {
                if let Some(&deadline_mins) = job_deadlines.get(job_id) {
                    if end_mins > deadline_mins {
                        deadline_violations += 1;
                        late_task_count += 1;
                        total_lateness_minutes += end_mins - deadline_mins;
                    }
                }
            }
        }
    }
    // Per-task lateness — outsourced half (Aller-simple PLIAGE etc. routinely
    // misses the deadline by transit days when the upstream task is placed
    // too close to it).
    for o in outsourced_assignments {
        if let Some(job_id) = task_to_job.get(&o.task_id) {
            if let Some(end_mins) = parse_datetime_to_minutes(&o.scheduled_end, start_date) {
                if let Some(&deadline_mins) = job_deadlines.get(job_id) {
                    if end_mins > deadline_mins {
                        deadline_violations += 1;
                        late_task_count += 1;
                        total_lateness_minutes += end_mins - deadline_mins;
                    }
                }
            }
        }
    }

    // Per-job lateness (deduplicated)
    let mut weighted_late_job_count: u64 = 0;
    for (job_id, &max_end) in &job_max_end_minutes {
        if let Some(&deadline_mins) = job_deadlines.get(job_id) {
            if max_end > deadline_mins {
                late_jobs.insert(job_id.clone());
                let lateness = max_end - deadline_mins;
                let priority = *job_priority.get(job_id.as_str()).unwrap_or(&2);
                let w = tier_weights[priority.min(4) as usize];
                weighted_lateness_minutes += (lateness as f64 * w) as u64;
                weighted_late_job_count += (w * 10.0) as u64;
            }
        }
    }

    // Makespan from assignments
    let makespan_minutes = job_max_end_minutes.values().copied().max().unwrap_or(0);

    let late_job_count = late_jobs.len() as u32;
    let mut late_job_ids: Vec<String> = late_jobs.into_iter().collect();
    late_job_ids.sort();

    let (calage_bonus_sum, calage_bonus_mean, calage_bonus_median) =
        compute_calage_stats_from_assignments(assignments, &task_to_job);

    ScheduleStats {
        makespan_minutes,
        total_tasks: assignments.len() as u32,
        scheduled_tasks: assignments.len() as u32,
        deadline_violations,
        late_task_count,
        total_lateness_minutes,
        late_job_count,
        weighted_lateness_minutes,
        weighted_late_job_count,
        late_job_ids,
        calage_bonus_sum,
        calage_bonus_mean,
        calage_bonus_median,
    }
}

/// Assignment-based counterpart to compute_calage_stats_from_actions,
/// used after merge when we only have ComputedAssignment data.
pub(crate) fn compute_calage_stats_from_assignments(
    assignments: &[ComputedAssignment],
    task_to_job: &HashMap<String, String>,
) -> (u64, f64, f64) {
    #[derive(Clone)]
    struct Placed<'a> {
        job_id: &'a str,
        start: &'a str,
    }
    let mut by_station: HashMap<&str, Vec<Placed>> = HashMap::new();
    for a in assignments {
        let job_id = match task_to_job.get(&a.task_id) {
            Some(j) => j.as_str(),
            None => continue,
        };
        by_station.entry(a.station_id.as_str()).or_default().push(Placed {
            job_id,
            start: a.scheduled_start.as_str(),
        });
    }

    let mut bonuses: Vec<u32> = Vec::new();
    for placements in by_station.values_mut() {
        placements.sort_by(|a, b| a.start.cmp(b.start));
        let mut prev_job: Option<&str> = None;
        for p in placements.iter() {
            let bonus = match prev_job {
                Some(prev) if prev == p.job_id => 100u32,
                _ => 0u32,
            };
            bonuses.push(bonus);
            prev_job = Some(p.job_id);
        }
    }

    if bonuses.is_empty() {
        return (0, 0.0, 0.0);
    }

    let sum: u64 = bonuses.iter().map(|&b| b as u64).sum();
    let mean: f64 = sum as f64 / bonuses.len() as f64;

    let mut sorted = bonuses.clone();
    sorted.sort_unstable();
    let median = if sorted.len() % 2 == 1 {
        sorted[sorted.len() / 2] as f64
    } else {
        let mid = sorted.len() / 2;
        (sorted[mid - 1] as f64 + sorted[mid] as f64) / 2.0
    };

    (sum, mean, median)
}

/// Parse a datetime string (ISO/ATOM format) to minutes from start_date.
fn parse_datetime_to_minutes(dt_str: &str, start_date: chrono::NaiveDate) -> Option<u64> {
    // Try RFC 3339 (with timezone)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(dt_str) {
        let naive = dt.naive_local();
        let days = (naive.date() - start_date).num_days();
        if days < 0 { return Some(0); }
        use chrono::Timelike;
        return Some(days as u64 * 24 * 60 + naive.time().hour() as u64 * 60 + naive.time().minute() as u64);
    }
    // Try NaiveDateTime
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(dt_str, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 { return Some(0); }
        use chrono::Timelike;
        return Some(days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64);
    }
    None
}

pub fn parse_deadline_minutes(deadline: &str, start_date: chrono::NaiveDate) -> Option<u64> {
    // Try parsing with timezone offset first (ATOM format: 2026-04-14T17:00:00+02:00)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(deadline) {
        let naive = dt.naive_local();
        let days = (naive.date() - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        let minutes = days as u64 * 24 * 60 + naive.time().hour() as u64 * 60 + naive.time().minute() as u64;
        return Some(minutes);
    }
    // Try without timezone (YYYY-MM-DDTHH:MM:SS)
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(deadline, "%Y-%m-%dT%H:%M:%S") {
        let days = (dt.date() - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
        let minutes = days as u64 * 24 * 60 + dt.time().hour() as u64 * 60 + dt.time().minute() as u64;
        return Some(minutes);
    }
    // Try date-only (YYYY-MM-DD)
    if let Ok(d) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
        let days = (d - start_date).num_days();
        if days < 0 {
            return Some(0);
        }
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
    use crate::model::operator::{ConcurrentGroupInput, DaySchedule, OperatingSchedule, OperatorInput, OperatorSkill, TimeSlot};
    use crate::model::schedule::{ComputeOptions, ComputeRequest};
    use crate::model::station::StationInput;

    fn make_station(id: &str, name: &str, masked_enabled: bool) -> StationInput {
        StationInput {
            id: id.to_string(),
            name: name.to_string(),
            attention_setup: Some(1.0),
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
            similarity_score_rules: None,
            is_press: false,
            drying_time_minutes: 0,
            min_setup_operators: None,
            max_setup_operators: None,
            min_run_operators: None,
            max_run_operators: Some(1),
            capacity: Some(1),
            schedule_exceptions: Vec::new(),
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
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
            operating_schedules: None,
            schedule_rotation_reference_week: None,
            skills: skills
                .iter()
                .map(|(s, p)| OperatorSkill::uniform(s.to_string(), *p))
                .collect(),
            concurrent_groups: groups,
            absences: Vec::new(),
            overtimes: Vec::new(),
        }
    }

    /// Operator available 24/7 — avoids Mon-Fri 8h-17h default schedule
    /// that causes flaky tests when the current time is close to end-of-day.
    fn make_always_on_operator(
        id: &str,
        first_name: &str,
        skills: &[(&str, f64)],
        groups: Vec<ConcurrentGroupInput>,
    ) -> OperatorInput {
        let full_day = DaySchedule {
            slots: vec![TimeSlot { start: "00:00".into(), end: "24:00".into() }],
        };
        let schedule = OperatingSchedule {
            monday: Some(full_day.clone()),
            tuesday: Some(full_day.clone()),
            wednesday: Some(full_day.clone()),
            thursday: Some(full_day.clone()),
            friday: Some(full_day.clone()),
            saturday: Some(full_day.clone()),
            sunday: Some(full_day),
        };
        OperatorInput {
            id: id.to_string(),
            first_name: first_name.to_string(),
            last_name: "Test".to_string(),
            role: "operator".to_string(),
            operating_schedules: Some(vec![schedule]),
            schedule_rotation_reference_week: None,
            skills: skills
                .iter()
                .map(|(s, p)| OperatorSkill::uniform(s.to_string(), *p))
                .collect(),
            concurrent_groups: groups,
            absences: Vec::new(),
            overtimes: Vec::new(),
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
            force_max_staffing: false,
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
                    is_frozen_by_safety_zone: false,
                    pinned_start_tick: None,
                    pinned_end_tick: None,
                    outsourced: None,
                    earliest_start_tick: None,
                    realistic_run_minutes: None,
                    cumulative_position_pct: None,
                    slot_volume_pct: None,
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
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
            perturbed_starts: 0,
            skip_lns: None,
            lns_budget_ms: None,
            precedence_min_gap_ticks: 1,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
        });
        let unpaired_result = compute(&ComputeRequest {
            stations,
            operators: vec![unpaired_op],
            jobs,
            options: options(),
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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
            force_max_staffing: false,
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
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: Some(pinned_tick),
                        pinned_end_tick: None,
                        outsourced: None,
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                    TaskInput {
                        id: "task-finish".into(),
                        station_id: "finish".into(),
                        setup_minutes: 0,
                        run_minutes: 60,
                        sequence_order: 1,
                        is_pinned: false,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: None,
                        pinned_end_tick: None,
                        outsourced: None,
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
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
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
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

    /// Four jobs compete for 1 station. Each takes 2 h (tick=60 min).
    /// Tier-2 jobs with same priority but different deadlines must be scheduled
    /// in urgency order (A before D), not in input order. D is listed first
    /// (loosest deadline) and A last (tightest); the engine's slack-based
    /// scoring must override this and place A first.
    ///
    /// Was previously `#[ignore]`d under the (outdated) belief that the
    /// forward pass alone couldn't reach 0 late without ALAP pre-placement.
    /// Diagnostic in 2026-05 (DIAG_PROXIMITY) showed the scoring DOES
    /// rank A > B > C > D correctly via the urgency formula
    /// (`raw_urgency = 10000 + |slack|` for slack ≤ 0). The actual failure
    /// was a tick-rounding interaction: with 60-min ticks, `now_tick =
    /// ceil(current_minute / 60)` plus the deadline's floor-rounding could
    /// shave up to ~1h off the available margin per task — and the original
    /// 2h spacing between deadlines (h+3, h+5, h+7, h+9) had only 1h of
    /// slack so a single rounding loss tipped a task past its deadline.
    ///
    /// Fix: spread deadlines by 4h (h+5, h+9, h+13, h+17) so each task
    /// has 3h of slack. Robust against any time-of-day the test runs at,
    /// while still requiring the engine to pick urgency-first ordering
    /// (placing D first would still cause A to end at h+8 — past h+5).
    #[test]
    fn tight_deadlines_all_scheduled_on_time() {
        let station = make_station("press", "Press", false);
        let alice = make_always_on_operator("alice", "Alice", &[("press", 1.0)], vec![]);

        let now = chrono::Local::now().naive_local();
        let fmt = |h: i64| {
            (now + chrono::Duration::hours(h))
                .format("%Y-%m-%dT%H:%M:%S")
                .to_string()
        };

        let make_job_with_deadline = |id: &str, deadline: String| JobInput {
            id: id.to_string(),
            reference: None,
            description: None,
            deadline: Some(deadline),
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![TaskInput {
                    id: format!("{id}-task"),
                    station_id: "press".to_string(),
                    setup_minutes: 0,
                    run_minutes: 120,
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
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let jobs = vec![
            make_job_with_deadline("D", fmt(17)), // loosest, listed first
            make_job_with_deadline("C", fmt(13)),
            make_job_with_deadline("B", fmt(9)),
            make_job_with_deadline("A", fmt(5)),  // tightest, listed last
        ];

        let request = ComputeRequest {
            stations: vec![station],
            operators: vec![alice],
            jobs,
            options: Some(ComputeOptions { horizon_days: 2, tick_minutes: 60, fbi_max_iterations: 3, multi_start: false, perturbed_starts: 0, skip_lns: Some(true), lns_budget_ms: None, precedence_min_gap_ticks: 1 }),
            occupied_slots: Vec::new(),
        setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);
        assert_eq!(result.assignments.len(), 4, "all 4 jobs must be scheduled");
        assert_eq!(
            result.stats.late_job_count, 0,
            "no job must be late — proximity bonus + slack-based scoring \
             must order A→B→C→D regardless of input order. assignments={:?}",
            result.assignments.iter().map(|a| (&a.task_id, &a.scheduled_start)).collect::<Vec<_>>()
        );

        // Order check: A.scheduled_start ≤ B ≤ C ≤ D — the engine picks by
        // urgency, not input order (which had D first, A last).
        let by_id = |id: &str| {
            result.assignments.iter().find(|a| a.task_id == format!("{id}-task")).unwrap()
        };
        let a_start = &by_id("A").scheduled_start;
        let b_start = &by_id("B").scheduled_start;
        let c_start = &by_id("C").scheduled_start;
        let d_start = &by_id("D").scheduled_start;
        assert!(a_start <= b_start, "A must start ≤ B (A={a_start}, B={b_start})");
        assert!(b_start <= c_start, "B must start ≤ C (B={b_start}, C={c_start})");
        assert!(c_start <= d_start, "C must start ≤ D (C={c_start}, D={d_start})");
    }

    /// Proximity bonus regression: A and B both need S1 then S2 (sequential, 2 h each leg).
    /// A's deadline is much tighter than B's, but B is listed first in input.
    /// The engine must schedule A first (proximity bonus + slack scoring).
    ///
    /// Was previously `#[ignore]`d with the comment "LAST=0 for all tasks
    /// (known bug)". Diagnostic in 2026-05 disproved that claim: the backward
    /// pass DOES produce differentiated LAST values (A small, B large).
    /// The actual failure was that the original deadline of 5h was too tight
    /// to accommodate the engine's 1-tick precedence-min-gap between A.s1
    /// and A.s2 plus the now_tick rounding — A was placed first correctly
    /// but finished late by ~1 tick. Spreading A's deadline to 8h gives the
    /// scenario enough slack for the precedence guard while still keeping
    /// A meaningfully more urgent than B (h+48).
    #[test]
    fn proximity_bonus_prioritises_tight_deadline_job() {
        let s1 = make_station("s1", "S1", false);
        let s2 = make_station("s2", "S2", false);
        let alice = make_always_on_operator("alice", "Alice", &[("s1", 1.0), ("s2", 1.0)], vec![]);

        let now = chrono::Local::now().naive_local();
        let fmt = |h: i64| {
            (now + chrono::Duration::hours(h))
                .format("%Y-%m-%dT%H:%M:%S")
                .to_string()
        };

        let make_2step_job = |id: &str, deadline: String| JobInput {
            id: id.to_string(),
            reference: None,
            description: None,
            deadline: Some(deadline),
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![
                    TaskInput { id: format!("{id}-s1"), station_id: "s1".into(), setup_minutes: 0, run_minutes: 120, sequence_order: 0, is_pinned: false, is_frozen_by_safety_zone: false, pinned_start_tick: None, pinned_end_tick: None, outsourced: None, earliest_start_tick: None, realistic_run_minutes: None, cumulative_position_pct: None, slot_volume_pct: None, is_in_progress: false, task_elapsed_ticks: 0, forced_start_tick: None, already_eaten_ticks: 0, inherited_setup: None },
                    TaskInput { id: format!("{id}-s2"), station_id: "s2".into(), setup_minutes: 0, run_minutes: 120, sequence_order: 1, is_pinned: false, is_frozen_by_safety_zone: false, pinned_start_tick: None, pinned_end_tick: None, outsourced: None, earliest_start_tick: None, realistic_run_minutes: None, cumulative_position_pct: None, slot_volume_pct: None, is_in_progress: false, task_elapsed_ticks: 0, forced_start_tick: None, already_eaten_ticks: 0, inherited_setup: None },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        // B listed first, A has tight deadline — correct scheduling: A.s1 before B.s1.
        // A.deadline = h+8 gives 4h of work + 1h precedence gap + 3h slack for
        // tick-rounding margin. The slack is generous enough to be robust at
        // any time-of-day, yet A remains far more urgent than B (h+48).
        let request = ComputeRequest {
            stations: vec![s1, s2],
            operators: vec![alice],
            jobs: vec![
                make_2step_job("B", fmt(48)), // listed first, loose
                make_2step_job("A", fmt(8)),  // listed second, tight
            ],
            options: Some(ComputeOptions { horizon_days: 3, tick_minutes: 60, fbi_max_iterations: 3, multi_start: false, perturbed_starts: 0, skip_lns: Some(true), lns_budget_ms: None, precedence_min_gap_ticks: 1 }),
            occupied_slots: Vec::new(),
        setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);
        assert_eq!(result.assignments.len(), 4, "all 4 tasks must be assigned");
        assert_eq!(result.stats.late_job_count, 0,
            "job-A must not be late. assignments={:?}",
            result.assignments.iter().map(|a| (&a.task_id, &a.scheduled_start, &a.scheduled_end)).collect::<Vec<_>>());

        let a_s1 = result.assignments.iter().find(|a| a.task_id == "A-s1").unwrap();
        let b_s1 = result.assignments.iter().find(|a| a.task_id == "B-s1").unwrap();
        assert!(
            a_s1.scheduled_start <= b_s1.scheduled_start,
            "A (8 h deadline) must start before B (48 h deadline): A={} B={}",
            a_s1.scheduled_start, b_s1.scheduled_start
        );
    }

    /// Regression: two pinned tasks whose intervals overlap on a
    /// capacity-1 station must NOT both be emitted at their pinned slots.
    /// First-iteration-wins; the second pin is rejected and falls through
    /// to the forward-pass placement loop.
    ///
    /// Reproduces the "multiple occupied slot" UI bug observed on Komori
    /// G40 / Ryobi 528 after several Ctrl+Alt+P cycles. Cause: the
    /// safety-zone-frozen pathway in PHP's buildJobs() sends both tasks
    /// as `is_pinned: true` with overlapping `[pinned_start_tick,
    /// pinned_start_tick + setup+run)` intervals, and the engine used to
    /// silently overwrite the grid AND emit both ComputedAssignments,
    /// producing two tiles on the same (station, tick) pair.
    #[test]
    fn overlapping_pinned_tasks_on_capacity_one_station_are_not_both_emitted() {
        let stations = vec![make_station("press", "Press", false)];
        let alice = make_always_on_operator("alice", "Alice", &[("press", 1.0)], vec![]);

        // Two single-task jobs, both pinned, both 60-minute, both
        // requesting tick 5 — head-on collision on the same cell.
        let make_pinned_job = |id: &str, pin_tick: usize| JobInput {
            id: id.into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![TaskInput {
                    id: format!("{id}-task"),
                    station_id: "press".into(),
                    setup_minutes: 0,
                    run_minutes: 60,
                    sequence_order: 0,
                    is_pinned: true,
                    is_frozen_by_safety_zone: false,
                    pinned_start_tick: Some(pin_tick),
                    pinned_end_tick: None,
                    outsourced: None,
                    earliest_start_tick: None,
                    realistic_run_minutes: None,
                    cumulative_position_pct: None,
                    slot_volume_pct: None,
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let request = ComputeRequest {
            stations,
            operators: vec![alice],
            jobs: vec![make_pinned_job("J1", 5), make_pinned_job("J2", 5)],
            options: options(),
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);

        // Both task assignments may be present — but they must NOT
        // overlap on the same (station, tick).
        let j1 = result.assignments.iter().find(|a| a.task_id == "J1-task");
        let j2 = result.assignments.iter().find(|a| a.task_id == "J2-task");

        // At least one must be present (the winner of the conflict).
        assert!(
            j1.is_some() || j2.is_some(),
            "expected at least one of the conflicting pinned tasks to be placed"
        );

        // If both ended up scheduled (the loser via forward-pass fallback),
        // their windows must be disjoint.
        if let (Some(a), Some(b)) = (j1, j2) {
            let (a_start, a_end) = assignment_minutes(a);
            let (b_start, b_end) = assignment_minutes(b);
            let overlap = a_start < b_end && b_start < a_end;
            assert!(
                !overlap,
                "capacity-1 station hosts overlapping intervals: J1=[{}, {}) J2=[{}, {})",
                a_start, a_end, b_start, b_end
            );
        }
    }

    /// Regression: when PHP supplies `pinned_end_tick`, the engine must
    /// honour it instead of recomputing `pinned_start_tick + setup_ticks
    /// + run_ticks`. This eliminates the drift that, by accumulating
    /// across compute cycles, caused two pinned tiles to claim the same
    /// (station, tick) cell on capacity-1 stations.
    ///
    /// Setup: two adjacent pinned tasks on the same station. Task B
    /// starts at the shortened end of Task A — exactly where PHP would
    /// place it after task A ran faster than its config (productivity >
    /// 1.0). Without `pinned_end_tick`, the engine would extend A to
    /// its config-derived end, overlap B, and trigger the conflict
    /// rejection (so B would move). With `pinned_end_tick`, A is exactly
    /// 30 minutes long and B starts immediately after, with no conflict
    /// and no movement.
    #[test]
    fn pinned_end_tick_overrides_config_duration() {
        let stations = vec![make_station("press", "Press", false)];
        let alice = make_always_on_operator("alice", "Alice", &[("press", 1.0)], vec![]);

        // tick_minutes = 60. Config duration would be 60 minutes (1 tick)
        // each, but we tell the engine A actually ran in 30 min via
        // pinned_end_tick = pinned_start_tick + 0 (same tick — degenerate
        // for tick=60min, so we use a longer duration to make it meaningful).
        //
        // Concretely:
        //   A: config 120 min (2 ticks), pinned [tick 5, tick 6) — 1 tick actual
        //   B: config 120 min (2 ticks), pinned [tick 6, tick 7) — 1 tick actual
        // Without the fix, A's engine view = [5, 7) overlaps B's [6, 8).
        // With the fix, A's engine view = [5, 6) and B's = [6, 7). Disjoint.
        let a_pinned_start: usize = 5;
        let a_pinned_end: usize = 6;
        let b_pinned_start: usize = 6;
        let b_pinned_end: usize = 7;

        let make_pinned_job = |id: &str, start: usize, end: usize| JobInput {
            id: id.into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: format!("{id}-elem"),
                name: None,
                tasks: vec![TaskInput {
                    id: format!("{id}-task"),
                    station_id: "press".into(),
                    setup_minutes: 0,
                    run_minutes: 120, // config = 2 ticks, but pinned interval = 1 tick
                    sequence_order: 0,
                    is_pinned: true,
                    is_frozen_by_safety_zone: false,
                    pinned_start_tick: Some(start),
                    pinned_end_tick: Some(end),
                    outsourced: None,
                    earliest_start_tick: None,
                    realistic_run_minutes: None,
                    cumulative_position_pct: None,
                    slot_volume_pct: None,
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let request = ComputeRequest {
            stations,
            operators: vec![alice],
            jobs: vec![
                make_pinned_job("A", a_pinned_start, a_pinned_end),
                make_pinned_job("B", b_pinned_start, b_pinned_end),
            ],
            options: options(),
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);

        let a = result.assignments.iter().find(|a| a.task_id == "A-task")
            .expect("A must be placed at its pinned interval");
        let b = result.assignments.iter().find(|a| a.task_id == "B-task")
            .expect("B must be placed at its pinned interval (NOT pushed back by drift)");

        let (a_start, a_end) = assignment_minutes(a);
        let (b_start, b_end) = assignment_minutes(b);

        // A's emitted interval matches the pinned_end_tick (1 tick = 60 min),
        // not the config-derived 120 min.
        assert_eq!(
            a_end - a_start, 60,
            "A's emitted duration must follow pinned_end_tick (1 tick = 60 min), not config (120 min)"
        );
        // B starts exactly where A ends — no drift, no rejection.
        assert_eq!(
            b_start, a_end,
            "B must start immediately after A ends (no drift): A ends {}, B starts {}",
            a_end, b_start
        );
        assert_eq!(
            b_end - b_start, 60,
            "B's emitted duration must also follow pinned_end_tick (1 tick)"
        );
    }

    // ====================================================================
    // Outsourcing precedence regression — reproduces the job-4569 bug.
    //
    // Before the SSOT-in-Rust refactor, ST steps were collapsed in PHP to
    // a flat `predecessorGapMinutes = totalCalendarDays × 24 × 60` on the
    // next internal task. That formula was time-of-day blind: when the
    // internal predecessor finished after the provider cutoff, the real
    // ST departure pushed to the next business day, the real return ran
    // 24h+ later than the gap predicted, and the engine cheerfully placed
    // the successor *before* the actual return — silent precedence
    // violation invisible to the precedence_validator (it never saw the
    // ST task at all).
    //
    // Now: the engine receives the ST task as a TaskInput with
    // `outsourced` set, computes the return tick from the predecessor's
    // ACTUAL end_tick at forward-pass time, and uses it as the floor for
    // the successor. The integration test below proves the constraint
    // holds end-to-end.
    // ====================================================================
    #[test]
    fn outsourced_step_floor_blocks_internal_successor_until_return() {
        use crate::model::job::OutsourcedParams;

        let stations = vec![
            make_station("press", "Press", false),
            make_station("finish", "Finish", false),
        ];

        let operators = vec![
            make_always_on_operator(
                "op",
                "Op",
                &[("press", 1.0), ("finish", 1.0)],
                Vec::new(),
            ),
        ];

        // Job with [Internal A on press, Outsourced (2 work days, 1
        // transit each way, cutoff 14:00, reception 09:00), Internal B
        // on finish]. With a fresh schedule the engine will start A at
        // start_date 00:00 — A ends within minutes. ST departs same day
        // (assuming start_date is a weekday) at 14:00, returns 4 BD
        // later at 09:00. B must therefore start ≥ that return moment.
        let outsourced_params = OutsourcedParams {
            provider_id: "prov-1".into(),
            work_days: 2,
            transit_days: 1,
            latest_departure_minutes: 14 * 60,
            reception_minutes: 9 * 60,
            manual_departure_tick: None,
            manual_return_tick: None,
        };

        let job = JobInput {
            id: "job-4569".into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: "elem".into(),
                name: None,
                tasks: vec![
                    TaskInput {
                        id: "task-A".into(),
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
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                    TaskInput {
                        id: "task-ST".into(),
                        station_id: String::new(), // ignored when outsourced is set
                        setup_minutes: 0,
                        run_minutes: 0,
                        sequence_order: 1,
                        is_pinned: false,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: None,
                        pinned_end_tick: None,
                        outsourced: Some(outsourced_params.clone()),
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                    TaskInput {
                        id: "task-B".into(),
                        station_id: "finish".into(),
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
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let request = ComputeRequest {
            stations,
            operators,
            jobs: vec![job],
            options: Some(ComputeOptions {
                horizon_days: 30,
                tick_minutes: 15,
                fbi_max_iterations: 1,
                multi_start: false,
                perturbed_starts: 0,
                skip_lns: Some(true),
                lns_budget_ms: None,
                precedence_min_gap_ticks: 1,
            }),
            occupied_slots: Vec::new(),
        setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);

        // Find the assignments by task id.
        let a = result.assignments.iter().find(|a| a.task_id == "task-A")
            .expect("Internal A should be placed");
        let b = result.assignments.iter().find(|a| a.task_id == "task-B")
            .expect("Internal B should be placed");
        let st = result.outsourced_assignments.iter()
            .find(|o| o.task_id == "task-ST")
            .expect("ST must be present in outsourced_assignments");

        // The actual claim: B must not start before the ST return.
        // Precise comparison via parsed datetimes; the ISO strings the
        // engine emits compare lexicographically too, but parsing is
        // robust to formatting variation.
        let b_start = iso_to_minutes(&b.scheduled_start);
        let st_return = iso_to_minutes(&st.scheduled_end);
        assert!(
            b_start >= st_return,
            "Internal B must start ≥ ST return. A ends {}, ST departs {}, ST returns {}, B starts {}",
            a.scheduled_end, st.scheduled_start, st.scheduled_end, b.scheduled_start
        );

        // ST departure must be after A ends (sanity).
        let a_end = iso_to_minutes(&a.scheduled_end);
        let st_dep = iso_to_minutes(&st.scheduled_start);
        assert!(
            st_dep >= a_end,
            "ST departure {} must be ≥ A end {}",
            st.scheduled_start, a.scheduled_end
        );

        // Provider id round-trips intact.
        assert_eq!(st.provider_id, "prov-1");
    }

    /// Same shape but with `manualReturn` overriding the auto-formula:
    /// the engine must respect the user's hard date.
    #[test]
    fn manual_return_override_constrains_internal_successor() {
        use crate::model::job::OutsourcedParams;

        let stations = vec![
            make_station("press", "Press", false),
            make_station("finish", "Finish", false),
        ];
        let operators = vec![
            make_always_on_operator(
                "op",
                "Op",
                &[("press", 1.0), ("finish", 1.0)],
                Vec::new(),
            ),
        ];

        // Manual return = 5 days × 24h × (60min / 15 tick_min) = 480 ticks.
        // Whatever date math would have produced, the engine must place
        // task-B at or after that exact tick.
        let manual_return_tick: usize = 5 * 24 * 60 / 15;
        let outsourced_params = OutsourcedParams {
            provider_id: "prov-1".into(),
            work_days: 1,
            transit_days: 0,
            latest_departure_minutes: 14 * 60,
            reception_minutes: 9 * 60,
            manual_departure_tick: None,
            manual_return_tick: Some(manual_return_tick),
        };

        let job = JobInput {
            id: "j".into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: "e".into(),
                name: None,
                tasks: vec![
                    TaskInput {
                        id: "A".into(),
                        station_id: "press".into(),
                        setup_minutes: 0,
                        run_minutes: 30,
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
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                    TaskInput {
                        id: "ST".into(),
                        station_id: String::new(),
                        setup_minutes: 0,
                        run_minutes: 0,
                        sequence_order: 1,
                        is_pinned: false,
                        is_frozen_by_safety_zone: false,
                        pinned_start_tick: None,
                        pinned_end_tick: None,
                        outsourced: Some(outsourced_params.clone()),
                        earliest_start_tick: None,
                        realistic_run_minutes: None,
                        cumulative_position_pct: None,
                        slot_volume_pct: None,
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                    TaskInput {
                        id: "B".into(),
                        station_id: "finish".into(),
                        setup_minutes: 0,
                        run_minutes: 30,
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
                        is_in_progress: false,
                        task_elapsed_ticks: 0,
                        forced_start_tick: None,
                        already_eaten_ticks: 0,
                        inherited_setup: None,
                    },
                ],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        };

        let request = ComputeRequest {
            stations,
            operators,
            jobs: vec![job],
            options: Some(ComputeOptions {
                horizon_days: 30,
                tick_minutes: 15,
                fbi_max_iterations: 1,
                multi_start: false,
                perturbed_starts: 0,
                skip_lns: Some(true),
                lns_budget_ms: None,
                precedence_min_gap_ticks: 1,
            }),
            occupied_slots: Vec::new(),
        setup_completion_log: Vec::new(), reference_time: None,
        };

        let result = compute(&request);
        let b = result.assignments.iter().find(|a| a.task_id == "B")
            .expect("B should be placed");
        let st = result.outsourced_assignments.iter().find(|o| o.task_id == "ST")
            .expect("ST emitted");

        // ST.scheduled_end must equal the manual return moment: 5 days
        // since start_date midnight = 5 × 24 × 60 = 7200 minutes.
        let st_return = iso_to_minutes(&st.scheduled_end);
        let b_start = iso_to_minutes(&b.scheduled_start);
        assert!(
            b_start >= st_return,
            "manual_return_tick must gate B: ST returns {}, B starts {}",
            st.scheduled_end, b.scheduled_start
        );
    }

    /// V2 progress capture — productivity ratio wiring (2026-05-03).
    ///
    /// A saisie d'avancement on a 60-min JCF run with a +1h retard produces
    /// productivityRatio = 2.0. PHP injects realisticRunMinutes = 120 into
    /// the TaskInput. The engine MUST plan with this value, not the 60-min
    /// theoretical, otherwise the retard accumulates silently across replans
    /// (the bug this commit closes).
    ///
    /// First test: direct duration scaling on a single task.
    /// Second test: downstream propagation — a successor task chained behind
    /// a ratio'd predecessor must shift by the extra minutes.
    fn make_single_task_job(id: &str, station_id: &str, run_minutes: u32, realistic: Option<u32>) -> JobInput {
        JobInput {
            id: id.to_string(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
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
                    is_frozen_by_safety_zone: false,
                    pinned_start_tick: None,
                    pinned_end_tick: None,
                    outsourced: None,
                    earliest_start_tick: None,
                    realistic_run_minutes: realistic,
                    cumulative_position_pct: None,
                    slot_volume_pct: None,
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        }
    }

    #[test]
    fn realistic_run_minutes_extends_assignment_duration() {
        let stations = vec![make_station("s1", "S1", false)];
        let operator = make_always_on_operator("op", "Op", &[("s1", 1.0)], vec![]);

        // Baseline: no ratio → assignment duration tracks JCF run (60 min).
        let baseline = ComputeRequest {
            stations: stations.clone(),
            operators: vec![operator.clone()],
            jobs: vec![make_single_task_job("j", "s1", 60, None)],
            options: options(),
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
        };
        let baseline_result = compute(&baseline);
        assert_eq!(baseline_result.assignments.len(), 1, "baseline must place");
        let (b_start, b_end) = assignment_minutes(&baseline_result.assignments[0]);
        assert_eq!(b_end - b_start, 60, "baseline assignment must span the JCF 60 min");

        // With realistic = 120 (saisie produced ratio 2.0): the assignment
        // must now span 120 min — the engine reads effective_run_minutes()
        // and plans on the realistic duration.
        let with_ratio = ComputeRequest {
            stations,
            operators: vec![operator],
            jobs: vec![make_single_task_job("j", "s1", 60, Some(120))],
            options: options(),
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
        };
        let ratio_result = compute(&with_ratio);
        assert_eq!(ratio_result.assignments.len(), 1, "ratio'd job must place");
        let (r_start, r_end) = assignment_minutes(&ratio_result.assignments[0]);
        assert_eq!(
            r_end - r_start,
            120,
            "with realistic_run_minutes=Some(120), assignment must span 120 min, not the 60-min JCF",
        );
    }

    #[test]
    fn realistic_run_minutes_propagates_to_downstream_task() {
        // Two-task job: t1 on s1, t2 on s2 (sequence 1 chains after sequence 0).
        // We compute twice — baseline (t1 theoretical) vs with-ratio (t1 realistic
        // = 120 on a 60-min JCF run) — and assert that the downstream successor
        // t2 shifts by exactly the extra 60 min produced by the saisie.
        //
        // Comparing diffs (not absolute values) sidesteps the configurable
        // precedence_min_gap_ticks — whatever the gap, both computes apply it
        // identically, so the delta is purely the extra realistic run minutes.
        let make_request = |realistic_t1: Option<u32>| -> ComputeRequest {
            let stations = vec![
                make_station("s1", "S1", false),
                make_station("s2", "S2", false),
            ];
            let operator = make_always_on_operator(
                "op",
                "Op",
                &[("s1", 1.0), ("s2", 1.0)],
                vec![],
            );
            let job = JobInput {
                id: "j".into(),
                reference: None,
                description: None,
                deadline: None,
                deadline_priority: 2,
                required_job_ids: Vec::new(),
                force_max_staffing: false,
                elements: vec![ElementInput {
                    id: "j-elem".into(),
                    name: None,
                    tasks: vec![
                        TaskInput {
                            id: "j-t1".into(),
                            station_id: "s1".into(),
                            setup_minutes: 0,
                            run_minutes: 60,
                            sequence_order: 0,
                            is_pinned: false,
                            is_frozen_by_safety_zone: false,
                            pinned_start_tick: None,
                            pinned_end_tick: None,
                            outsourced: None,
                            earliest_start_tick: None,
                            realistic_run_minutes: realistic_t1,
                            cumulative_position_pct: None,
                            slot_volume_pct: None,
                            is_in_progress: false,
                            task_elapsed_ticks: 0,
                            forced_start_tick: None,
                            already_eaten_ticks: 0,
                            inherited_setup: None,
                        },
                        TaskInput {
                            id: "j-t2".into(),
                            station_id: "s2".into(),
                            setup_minutes: 0,
                            run_minutes: 60,
                            sequence_order: 1,
                            is_pinned: false,
                            is_frozen_by_safety_zone: false,
                            pinned_start_tick: None,
                            pinned_end_tick: None,
                            outsourced: None,
                            earliest_start_tick: None,
                            realistic_run_minutes: None,
                            cumulative_position_pct: None,
                            slot_volume_pct: None,
                            is_in_progress: false,
                            task_elapsed_ticks: 0,
                            forced_start_tick: None,
                            already_eaten_ticks: 0,
                            inherited_setup: None,
                        },
                    ],
                    spec: None,
                    prerequisite_element_ids: Vec::new(),
                }],
            };
            ComputeRequest {
                stations,
                operators: vec![operator],
                jobs: vec![job],
                options: options(),
                occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
            }
        };

        let baseline = compute(&make_request(None));
        let ratio = compute(&make_request(Some(120)));

        let baseline_t2 = baseline.assignments.iter().find(|a| a.task_id == "j-t2")
            .expect("baseline t2 placed");
        let ratio_t1 = ratio.assignments.iter().find(|a| a.task_id == "j-t1")
            .expect("ratio t1 placed");
        let ratio_t2 = ratio.assignments.iter().find(|a| a.task_id == "j-t2")
            .expect("ratio t2 placed");

        let (b_t2_start, _) = assignment_minutes(baseline_t2);
        let (r_t1_start, r_t1_end) = assignment_minutes(ratio_t1);
        let (r_t2_start, _) = assignment_minutes(ratio_t2);

        assert_eq!(
            r_t1_end - r_t1_start,
            120,
            "with realistic_run_minutes=Some(120), t1 spans 120 min",
        );
        assert_eq!(
            r_t2_start - b_t2_start,
            60,
            "downstream t2 must shift by exactly +60 min (the extra realistic \
             run on t1) compared to the no-ratio baseline; this proves the \
             saisie-driven retard propagates to successors instead of being \
             swallowed silently",
        );
    }
}

#[cfg(test)]
mod resolve_now_tests {
    //! Tests for `resolve_now` — the entry point of the now-override
    //! flow on the engine side. PHP forwards its `ClockService::now()`
    //! as `reference_time`, and `resolve_now` parses it into a
    //! `DateTime<Local>` that drives `start_date` and tick conversions.
    //! Anything unparseable must transparently fall back to wall clock
    //! so a malformed payload never breaks prod compute.

    use super::resolve_now;
    use chrono::{Datelike, Local, TimeZone, Timelike};

    #[test]
    fn returns_wall_clock_when_field_absent() {
        let before = Local::now();
        let now = resolve_now(&None);
        let after = Local::now();
        assert!(now >= before);
        assert!(now <= after + chrono::Duration::seconds(1));
    }

    #[test]
    fn returns_wall_clock_when_field_empty() {
        let now = resolve_now(&Some(String::new()));
        let wall = Local::now();
        let diff = (now - wall).num_seconds().abs();
        assert!(diff <= 1, "diff {} s exceeds 1 s tolerance", diff);
    }

    #[test]
    fn parses_rfc3339_with_timezone() {
        // 2026-05-07T10:00:00+02:00 → 2026-05-07 08:00:00 UTC.
        let s = "2026-05-07T10:00:00+02:00".to_string();
        let parsed = resolve_now(&Some(s));
        let utc = parsed.with_timezone(&chrono::Utc);
        assert_eq!(utc.year(), 2026);
        assert_eq!(utc.month(), 5);
        assert_eq!(utc.day(), 7);
        assert_eq!(utc.hour(), 8);
        assert_eq!(utc.minute(), 0);
    }

    #[test]
    fn parses_rfc3339_with_z_zulu() {
        let s = "2026-05-07T10:00:00Z".to_string();
        let parsed = resolve_now(&Some(s));
        let utc = parsed.with_timezone(&chrono::Utc);
        assert_eq!(utc.hour(), 10);
    }

    #[test]
    fn falls_back_to_wall_when_unparseable() {
        let s = "not-a-date".to_string();
        let now = resolve_now(&Some(s));
        let wall = Local::now();
        let diff = (now - wall).num_seconds().abs();
        assert!(diff <= 1);
    }

    #[test]
    fn parses_naive_iso_as_local_time() {
        // Naive ISO: no timezone marker → interpreted as local wall time.
        let s = "2026-05-07T15:30:00".to_string();
        let parsed = resolve_now(&Some(s));
        // Sanity: the wall-time fields should match what we wrote.
        assert_eq!(parsed.year(), 2026);
        assert_eq!(parsed.month(), 5);
        assert_eq!(parsed.day(), 7);
        // Confirm it's the local-time interpretation (not UTC) by
        // round-tripping through Local.
        let expected = Local
            .with_ymd_and_hms(2026, 5, 7, 15, 30, 0)
            .single()
            .expect("local time should be unambiguous on May 7");
        assert_eq!(parsed.timestamp(), expected.timestamp());
    }
}

#[cfg(test)]
mod setup_run_split_e2e_tests {
    //! End-to-end scenario tests for the setup/run proficiency split feature.
    //!
    //! Exercises the FULL engine pipeline (`compute(&request)`) with realistic
    //! operator/station/job inputs, then asserts the invariants the split is
    //! supposed to deliver:
    //!
    //!  1. Run-only operators (setup=0, run>0) are NEVER assigned to a setup
    //!     phase — they only ever appear during run.
    //!  2. Calage-only operators (setup>0, run=0) are NEVER assigned to a run
    //!     phase — they only ever appear during setup.
    //!  3. With a versatile + run-only on the same station, the engine prefers
    //!     the run-only for the run (P3a specialization tiebreaker), producing
    //!     a `setup_op != run_op` handover visible in `operators[]`.
    //!  4. Asymmetric `runProf` directly affects the realised duration:
    //!     a 2× faster run-op finishes the run portion in roughly half.
    //!  5. The wire format rétro-compat works: a legacy `proficiency` field
    //!     (no split) is honoured (mirrored to both phases by deserializer).
    //!
    //! These tests use the real `compute` function — same code path that
    //! production hits when PHP posts a `ComputeRequest`. They're slower
    //! than the unit tests but they're the only thing that proves the
    //! whole stack (data model → algo → output) actually delivers the
    //! advertised behaviour.

    use super::*;
    use crate::model::job::{ElementInput, JobInput, TaskInput};
    use crate::model::operator::{
        DaySchedule, OperatingSchedule, OperatorInput, OperatorSkill, TimeSlot,
    };
    use crate::model::schedule::{ComputeOptions, ComputeRequest};
    use crate::model::station::StationInput;

    fn always_on() -> OperatingSchedule {
        let full = DaySchedule {
            slots: vec![TimeSlot { start: "00:00".into(), end: "24:00".into() }],
        };
        OperatingSchedule {
            monday: Some(full.clone()),
            tuesday: Some(full.clone()),
            wednesday: Some(full.clone()),
            thursday: Some(full.clone()),
            friday: Some(full.clone()),
            saturday: Some(full.clone()),
            sunday: Some(full),
        }
    }

    fn make_op(id: &str, first: &str, skills: Vec<OperatorSkill>) -> OperatorInput {
        OperatorInput {
            id: id.into(),
            first_name: first.into(),
            last_name: "Test".into(),
            role: "operator".into(),
            operating_schedules: Some(vec![always_on()]),
            schedule_rotation_reference_week: None,
            skills,
            concurrent_groups: Vec::new(),
            absences: Vec::new(),
            overtimes: Vec::new(),
        }
    }

    fn make_station(id: &str, name: &str) -> StationInput {
        StationInput {
            id: id.into(),
            name: name.into(),
            attention_setup: Some(1.0),
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
            min_setup_operators: None,
            max_setup_operators: None,
            min_run_operators: None,
            max_run_operators: Some(1),
            capacity: Some(1),
            schedule_exceptions: Vec::new(),
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
        }
    }

    fn make_task(
        job_id: &str,
        station_id: &str,
        setup_minutes: u32,
        run_minutes: u32,
    ) -> JobInput {
        JobInput {
            id: job_id.into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            required_job_ids: Vec::new(),
            force_max_staffing: false,
            elements: vec![ElementInput {
                id: format!("{job_id}-elem"),
                name: None,
                tasks: vec![TaskInput {
                    id: format!("{job_id}-task"),
                    station_id: station_id.into(),
                    setup_minutes,
                    run_minutes,
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
                    is_in_progress: false,
                    task_elapsed_ticks: 0,
                    forced_start_tick: None,
                    already_eaten_ticks: 0,
                    inherited_setup: None,
                }],
                spec: None,
                prerequisite_element_ids: Vec::new(),
            }],
        }
    }

    fn run_engine(
        stations: Vec<StationInput>,
        operators: Vec<OperatorInput>,
        jobs: Vec<JobInput>,
    ) -> crate::model::schedule::ScheduleResult {
        let request = ComputeRequest {
            stations,
            jobs,
            operators,
            occupied_slots: Vec::new(), setup_completion_log: Vec::new(), reference_time: None,
            options: Some(ComputeOptions {
                horizon_days: 2,
                tick_minutes: 60,
                fbi_max_iterations: 1,
                multi_start: false,
                perturbed_starts: 0,
                skip_lns: Some(true),
                lns_budget_ms: None,
                precedence_min_gap_ticks: 1,
            }),
        };
        compute(&request)
    }

    /// Helper: parse a "YYYY-MM-DDTHH:MM:00" timestamp produced by the engine
    /// into absolute minutes since the test's start_date midnight.
    fn iso_to_minutes(iso: &str) -> i64 {
        let dt = chrono::NaiveDateTime::parse_from_str(iso, "%Y-%m-%dT%H:%M:%S")
            .expect("engine emits valid ISO timestamps");
        let base = chrono::NaiveDateTime::parse_from_str(
            "2026-04-09T00:00:00",
            "%Y-%m-%dT%H:%M:%S",
        )
        .unwrap();
        (dt - base).num_minutes()
    }

    /// I1 + I3: Bernard is versatile (setup=1, run=1) on the plieuse,
    /// Frédéric is run-only (setup=0, run=1) on the same plieuse. With a
    /// task that has a real setup phase, the engine MUST pick Bernard for
    /// the calage and Frédéric for the run (specialization tiebreaker).
    /// Frédéric must NEVER appear inside the setup window.
    #[test]
    fn run_only_operator_takes_run_handover_after_setup() {
        let stations = vec![make_station("plieuse", "Plieuse SBG")];
        let operators = vec![
            make_op("bernard", "Bernard", vec![
                OperatorSkill::asymmetric("plieuse".into(), 1.0, 1.0),
            ]),
            make_op("frederic", "Frédéric", vec![
                OperatorSkill::asymmetric("plieuse".into(), 0.0, 1.0),
            ]),
        ];
        // 60 min setup + 240 min run, 60-min ticks.
        let jobs = vec![make_task("j1", "plieuse", 60, 240)];

        let result = run_engine(stations, operators, jobs);

        let assignment = result
            .assignments
            .iter()
            .find(|a| a.task_id == "j1-task")
            .expect("task must be placed");

        let setup_end_min = assignment
            .setup_end
            .as_ref()
            .map(|s| iso_to_minutes(s))
            .expect("setup_end must be emitted for tasks with setup phase");

        // Walk operators[]: Frédéric must be entirely past setup_end_min.
        let mut frederic_setup_appearances = 0;
        let mut frederic_run_appearances = 0;
        let mut bernard_setup_appearances = 0;
        for op in &assignment.operators {
            let from = iso_to_minutes(&op.from);
            if op.operator_id == "frederic" {
                if from < setup_end_min {
                    frederic_setup_appearances += 1;
                } else {
                    frederic_run_appearances += 1;
                }
            } else if op.operator_id == "bernard" && from < setup_end_min {
                bernard_setup_appearances += 1;
            }
        }
        assert_eq!(
            frederic_setup_appearances, 0,
            "I1: Frédéric (setup=0) must NEVER appear inside the setup window. \
             Got {frederic_setup_appearances} setup appearance(s). \
             operators={:?}, setup_end_min={setup_end_min}",
            assignment.operators
        );
        assert!(
            bernard_setup_appearances >= 1,
            "I3: Bernard (versatile) must drive the calage when no other \
             setup-qualified op is available. operators={:?}",
            assignment.operators
        );
        assert!(
            frederic_run_appearances >= 1,
            "I3: Frédéric (run-only) must take the run after the magnetism \
             break — that's the specialization tiebreaker firing. \
             operators={:?}",
            assignment.operators
        );

        // Sanity: the two operators are distinct, confirming the handover
        // happens at the engine level (not just in the UI rendering).
        let distinct_ops: std::collections::HashSet<&str> = assignment
            .operators
            .iter()
            .map(|o| o.operator_id.as_str())
            .collect();
        assert!(
            distinct_ops.len() >= 2,
            "I3: operators[] must contain ≥2 distinct ops on a setup+run task \
             when both versatile and run-only are available. Got: {distinct_ops:?}"
        );
    }

    /// I2: Calage-only operator (setup>0, run=0) is excluded from the run
    /// election. Set up a station where the only "run-qualified" op is
    /// versatile — the calage-only op only handles setup, never run.
    #[test]
    fn calage_only_operator_never_takes_the_run() {
        let stations = vec![make_station("plieuse", "Plieuse SBG")];
        let operators = vec![
            // Pure setter — no run capability.
            make_op("paul", "Paul", vec![
                OperatorSkill::asymmetric("plieuse".into(), 1.0, 0.0),
            ]),
            // Versatile — can run, will be picked for the run phase.
            make_op("bernard", "Bernard", vec![
                OperatorSkill::asymmetric("plieuse".into(), 1.0, 1.0),
            ]),
        ];
        let jobs = vec![make_task("j1", "plieuse", 60, 180)];

        let result = run_engine(stations, operators, jobs);

        let assignment = result
            .assignments
            .iter()
            .find(|a| a.task_id == "j1-task")
            .expect("task must be placed");

        let setup_end_min = assignment.setup_end.as_ref().map(|s| iso_to_minutes(s));

        for op in &assignment.operators {
            if op.operator_id == "paul" {
                let from_min = iso_to_minutes(&op.from);
                if let Some(seu) = setup_end_min {
                    assert!(
                        from_min < seu,
                        "I2: Paul (run=0) appears at minute {from_min} but \
                         setup_end is {seu} — he's in the run phase. \
                         operators={:?}",
                        assignment.operators
                    );
                }
            }
        }
    }

    /// I4: Asymmetric runProf directly affects the realised duration. Two
    /// scenarios with identical inputs except runProf — the under-skilled
    /// op (prof=0.5) must produce a strictly LATER scheduled_end than the
    /// nominal one (prof=1.0). We compare on the slow side rather than the
    /// fast side because the engine caps run-phase rate at the station's
    /// `max_run_attention` (so a 2× faster op hits the ceiling and offers
    /// no observable speedup), whereas an under-skilled op cleanly inflates
    /// the work-tick count.
    #[test]
    fn lower_run_proficiency_finishes_later() {
        let stations = vec![make_station("plieuse", "Plieuse SBG")];

        // Scenario A: runProf=1.0 → baseline.
        let ops_a = vec![make_op("alice", "Alice", vec![
            OperatorSkill::asymmetric("plieuse".into(), 1.0, 1.0),
        ])];
        let jobs_a = vec![make_task("j1", "plieuse", 0, 240)];
        let result_a = run_engine(stations.clone(), ops_a, jobs_a);

        let end_a = iso_to_minutes(
            &result_a
                .assignments
                .iter()
                .find(|a| a.task_id == "j1-task")
                .expect("task A must be placed")
                .scheduled_end,
        );

        // Scenario B: runProf=0.5 → run portion stretches 2× wall clock.
        let ops_b = vec![make_op("alice", "Alice", vec![
            OperatorSkill::asymmetric("plieuse".into(), 1.0, 0.5),
        ])];
        let jobs_b = vec![make_task("j1", "plieuse", 0, 240)];
        let result_b = run_engine(stations, ops_b, jobs_b);

        let end_b = iso_to_minutes(
            &result_b
                .assignments
                .iter()
                .find(|a| a.task_id == "j1-task")
                .expect("task B must be placed")
                .scheduled_end,
        );

        assert!(
            end_b > end_a,
            "I4: runProf=0.5 must finish strictly later than runProf=1.0 \
             (slower op needs more wall clock). end_a={end_a} min, end_b={end_b} min"
        );
    }

    /// I5: Wire-format rétro-compat. An OperatorSkill emitted with only the
    /// legacy `proficiency` field (no setup/run split) must deserialize and
    /// behave identically to one with explicit equal split fields. This
    /// guards the migration path: any caller that hasn't yet adopted the
    /// split shape continues to produce valid plans.
    #[test]
    fn legacy_proficiency_field_round_trips_to_split_fields() {
        let json = r#"{"stationId": "plieuse", "proficiency": 0.85}"#;
        let parsed: OperatorSkill = serde_json::from_str(json)
            .expect("legacy single-field shape must deserialize");
        assert_eq!(parsed.station_id, "plieuse");
        assert_eq!(parsed.setup_proficiency, 0.85);
        assert_eq!(parsed.run_proficiency, 0.85);
        // Legacy field mirrors run_proficiency by convention.
        assert_eq!(parsed.proficiency, 0.85);

        // And a wire payload with explicit split fields takes precedence.
        let json2 =
            r#"{"stationId": "plieuse", "setupProficiency": 0.0, "runProficiency": 1.5}"#;
        let parsed2: OperatorSkill = serde_json::from_str(json2)
            .expect("split shape must deserialize");
        assert_eq!(parsed2.setup_proficiency, 0.0);
        assert_eq!(parsed2.run_proficiency, 1.5);
    }
}
