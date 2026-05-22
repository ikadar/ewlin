use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::schedule::{
    ComputedAssignment, ScheduleStats, SetupCompletion, Warning,
};
use crate::model::station::StationInput;
use crate::model::operator::OperatorInput;
use crate::model::job::JobInput;

use super::backward_pass::{compute_last_values, BackwardOrdering};
use super::forward_pass::{
    build_prepared_groups, run_forward_pass, Action, OperatorAvailability, OperatorScheduleData,
    PreparedConcurrentGroup, SetupCompletionEntry, SkillEntry, StationAttrs,
};
use super::grid::ScheduleGrid;
use super::pre_split::pre_split;
use super::{build_actions, compute_stats, remap_assignments};

/// Project the wire-format `setup_completion_log` (a flat list of
/// {task, station, tick} tuples) into a per-station-idx vec of entries
/// sorted ascending by tick. Entries pointing at unknown station ids are
/// silently dropped — they can't influence any decision because no
/// action will ever look them up.
fn index_setup_log_by_station(
    log: &[SetupCompletion],
    station_id_to_idx: &HashMap<String, usize>,
    num_stations: usize,
) -> Vec<Vec<SetupCompletionEntry>> {
    let mut out: Vec<Vec<SetupCompletionEntry>> = vec![Vec::new(); num_stations];
    for entry in log {
        if let Some(&idx) = station_id_to_idx.get(&entry.station_id) {
            if idx < num_stations {
                out[idx].push(SetupCompletionEntry {
                    task_id: entry.task_id.clone(),
                    at_tick: entry.at_tick,
                });
            }
        }
    }
    for entries in out.iter_mut() {
        entries.sort_by_key(|e| e.at_tick);
    }
    out
}

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
    ordering: BackwardOrdering,
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    setup_completion_log: &[SetupCompletion],
    progress: &super::ProgressSender,
    now_tick: usize,
    score_weights: &[f64; 7],
    precedence_min_gap_ticks: u32,
    warnings: &mut Vec<Warning>,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    let station_id_to_idx: HashMap<String, usize> = stations
        .iter()
        .enumerate()
        .map(|(i, s)| (s.id.clone(), i))
        .collect();

    let num_stations = stations.len();
    let num_operators = operators.len();

    // Project the historical setup completion log onto our station index so
    // each StationAttrs carries its own slice — avoids a separate context
    // struct + reference threading through the entire engine pipeline.
    let mut setup_completions_per_station =
        index_setup_log_by_station(setup_completion_log, &station_id_to_idx, num_stations);

    let station_attrs: Vec<StationAttrs> = stations
        .iter()
        .enumerate()
        .map(|(idx, s)| StationAttrs {
            attention_setup: s.effective_attention_setup(),
            attention_run: s.effective_attention_run(),
            max_run_attention: s.effective_max_run_attention(),
            masked_time_enabled: s.masked_time_enabled,
            peremption_ticks: if s.effective_peremption() > 0 && tick_minutes > 0 {
                (s.effective_peremption() + tick_minutes - 1) / tick_minutes
            } else {
                0
            },
            setup_completions: std::mem::take(&mut setup_completions_per_station[idx]),
            min_setup_operators: s.effective_min_setup_operators(),
            max_setup_operators: s.effective_max_setup_operators(),
            min_run_operators: s.effective_min_run_operators(),
            max_run_operators: s.effective_max_run_operators(),
            max_chunk_ticks: if tick_minutes > 0 {
                (s.effective_max_chunk() + tick_minutes - 1) / tick_minutes
            } else {
                s.effective_max_chunk()
            },
            chunk_mini_setup_multiplier: s.effective_chunk_mini_setup_multiplier(),
            chunk_mini_task_percentage: s.effective_chunk_mini_task_percentage(),
            similarity_criteria: s.similarity_criteria.clone().unwrap_or_default(),
            similarity_score_rules: s.similarity_score_rules.clone().unwrap_or_default(),
        })
        .collect();

    let operator_skills: Vec<Vec<SkillEntry>> = operators
        .iter()
        .map(|op| {
            op.skills
                .iter()
                .filter_map(|skill| {
                    station_id_to_idx
                        .get(&skill.station_id)
                        .map(|&idx| SkillEntry {
                            station_idx: idx,
                            setup_proficiency: skill.setup_proficiency,
                            run_proficiency: skill.run_proficiency,
                        })
                })
                .collect()
        })
        .collect();

    let operator_groups: Vec<Vec<PreparedConcurrentGroup>> =
        build_prepared_groups(operators, &station_id_to_idx);

    let schedules: Vec<OperatorScheduleData> = operators
        .iter()
        .map(|op| OperatorScheduleData {
            schedules: op.operating_schedules.clone(),
            reference_week: op.schedule_rotation_reference_week,
            absences: op.absences.clone(),
            overtimes: op.overtimes.clone(),
        })
        .collect();

    let mut best_assignments: Vec<ComputedAssignment> = Vec::new();
    let mut best_actions: Vec<Action> = Vec::new();
    // Sentinel "always lose" baseline so the FIRST real iteration always
    // wins. `total_tasks: u32::MAX, scheduled_tasks: 0` makes the unplaced
    // primary key max-out — without this, the first iteration's
    // (real_unplaced ≥ 0) is never strictly less than the sentinel's
    // (0 − 0 = 0), so any partial schedule is silently dropped and the
    // function returns empty `best_assignments`.
    let mut best_stats = ScheduleStats {
        makespan_minutes: u64::MAX,
        total_tasks: u32::MAX,
        scheduled_tasks: 0,
        deadline_violations: u32::MAX,
        late_task_count: u32::MAX,
        total_lateness_minutes: u64::MAX,
        late_job_count: u32::MAX,
        weighted_lateness_minutes: u64::MAX,
        weighted_late_job_count: u64::MAX,
        late_job_ids: Vec::new(),
        calage_bonus_sum: 0,
        calage_bonus_mean: 0.0,
        calage_bonus_median: 0.0,
    };
    let mut prev_makespan: u64 = u64::MAX;
    let mut prev_weighted_late_count: u64 = u64::MAX;
    let mut prev_weighted_lateness: u64 = u64::MAX;
    let mut iteration_count: u32 = 0;

    // Station urgency boost: currently disabled (empirically harmful —
    // causes catastrophic priority inversions on iterations 2+).
    // The infrastructure remains for future use with perturbed multi-start.
    let station_urgency_boost: HashMap<usize, f64> = HashMap::new();

    let effective_max = if max_iterations == 0 { 1 } else { max_iterations };

    // Mid-FBI re-prioritization: late jobs from the previous iteration get
    // their deadline_priority boosted by one tier (clamped to 1 = imperative;
    // tier 0 = Vital is operator-only and never produced automatically) so
    // the next backward pass schedules them earlier. The boost only affects
    // the backward pass (LAST computation), not the permanent job data.
    let mut boosted_jobs: Vec<JobInput> = Vec::new();

    for iteration in 0..effective_max {
        iteration_count = iteration + 1;

        super::emit(progress, crate::model::progress::ProgressEvent::FbiStart {
            iteration: iteration + 1,
            max_iterations: effective_max,
        });

        // Use boosted jobs for backward pass if available (from previous iteration's late jobs)
        let jobs_for_backward = if boosted_jobs.is_empty() { jobs } else { &boosted_jobs };

        let initial_ticks_for_last = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);

        // Single placement path: backward pass computes LAST values only
        // (for forward-pass urgency scoring). The forward pass owns all
        // placements uniformly, with tier-preempt in scoring protecting
        // tier-0/1 urgency and `predecessor_idx` / `additional_predecessors`
        // handling intra- and cross-element precedence.
        let last_values = compute_last_values(
            jobs_for_backward, stations, operators,
            &station_attrs, &operator_skills, &operator_groups,
            tick_minutes, start_date,
            initial_ticks_for_last,
            ordering,
            station_blocked_ranges,
            occupied_slots,
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

        // Station urgency boost is applied in the forward pass scoring,
        // not here — it doesn't change LAST values, just scoring weights.

        // Pre-split chunks long tasks, remapping ONLY intra-element
        // predecessor_idx. Cross-element / cross-job edges are wired
        // immediately after, against stable post-chunk indices.
        pre_split(&mut actions, stations, tick_minutes);
        super::pre_split::wire_cross_cutting_edges(&mut actions, jobs, stations, tick_minutes);


        // Build grid. Size it so pre-block cells beyond the nominal
        // horizon_days window (maintenance spanning far into the future,
        // assignments honored over a long period) land in backing storage
        // rather than being silently dropped by `assign_station`.
        let initial_ticks_base = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);
        let mut required_ticks = initial_ticks_base;
        for &(_, _, _, end_t) in occupied_slots {
            required_ticks = required_ticks.max(end_t);
        }
        for ranges in station_blocked_ranges.iter() {
            for &(_, end_t) in ranges {
                required_ticks = required_ticks.max(end_t);
            }
        }
        let initial_ticks = required_ticks;
        let mut grid = ScheduleGrid::new(num_stations, num_operators, initial_ticks, tick_minutes);
        let station_capacities: Vec<u32> =
            stations.iter().map(|s| s.effective_capacity()).collect();
        grid.init_station_capacities(&station_capacities);

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
        let assignments = run_forward_pass(
            &mut grid,
            &mut actions,
            &station_attrs,
            &operator_skills,
            &mut operator_availability,
            &operator_groups,
            tick_minutes,
            start_date,
            now_tick,
            &station_urgency_boost,
            &score_weights,
            precedence_min_gap_ticks,
            warnings,
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

        // Track best result: lex-order on (unplaced, weighted-late jobs,
        // weighted lateness, makespan). Unplaced ranks above lateness —
        // a task we couldn't place is strictly worse than a late one,
        // because the user can't ship a task that doesn't exist in the
        // schedule. Forward pass can hit `max_outer_t` and bail with some
        // actions un-end-ticked; this guard keeps such results from
        // beating a fully-placed-but-late baseline.
        let current_unplaced = (stats.total_tasks - stats.scheduled_tasks) as u64;
        let best_unplaced = (best_stats.total_tasks - best_stats.scheduled_tasks) as u64;
        let current_score = (current_unplaced, stats.weighted_late_job_count, stats.weighted_lateness_minutes, current_makespan);
        let best_score = (best_unplaced, best_stats.weighted_late_job_count, best_stats.weighted_lateness_minutes, best_stats.makespan_minutes);
        if current_score < best_score {
            best_assignments = remapped;
            best_stats = stats;
            best_actions = actions
                .iter()
                .map(|a| super::pre_split::clone_action(a))
                .collect();
        }

        // Convergence check: makespan changed < 1% AND lateness metrics
        // are stable. Without the lateness check, FBI can converge with
        // avoidable late jobs just because makespan stopped moving.
        if iteration > 0 && prev_makespan < u64::MAX {
            let diff = if current_makespan > prev_makespan {
                current_makespan - prev_makespan
            } else {
                prev_makespan - current_makespan
            };
            let threshold = (prev_makespan as f64 * 0.01) as u64;
            let makespan_stable = diff <= threshold;
            let lateness_stable = current_score.0 == prev_weighted_late_count
                && current_score.1 == prev_weighted_lateness;
            if makespan_stable && lateness_stable {
                super::emit(progress, crate::model::progress::ProgressEvent::FbiConverged {
                    iteration: iteration + 1,
                });
                break;
            }
        }

        prev_makespan = current_makespan;
        prev_weighted_late_count = current_score.0;
        prev_weighted_lateness = current_score.1;

        // Mid-FBI re-prioritization: boost late jobs by one tier for the
        // next iteration's backward pass. This makes the LAST computation
        // treat them as more urgent, giving them earlier slots.
        if !best_stats.late_job_ids.is_empty() {
            let late_set: std::collections::HashSet<&str> = best_stats.late_job_ids.iter().map(|s| s.as_str()).collect();
            boosted_jobs = jobs.iter().map(|j| {
                let mut j2 = j.clone();
                if late_set.contains(j.id.as_str()) {
                    j2.deadline_priority = j.deadline_priority.saturating_sub(1).max(1);
                }
                j2
            }).collect();
        } else {
            boosted_jobs.clear();
        }

    }

    (best_assignments, best_actions, best_stats, iteration_count)
}

/// Run FBI with a specific backward ordering.
pub fn run_with_fbi_ordering(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
    ordering: BackwardOrdering,
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    setup_completion_log: &[SetupCompletion],
    progress: &super::ProgressSender,
    now_tick: usize,
    score_weights: &[f64; 7],
    precedence_min_gap_ticks: u32,
    warnings: &mut Vec<Warning>,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    run_with_fbi(jobs, stations, operators, tick_minutes, horizon_days, max_iterations, start_date, ordering, station_blocked_ranges, occupied_slots, setup_completion_log, progress, now_tick, score_weights, precedence_min_gap_ticks, warnings)
}

/// Multi-start FBI with perturbed scoring weights.
///
/// Runs multiple FBI passes with different configurations and returns the
/// best result. Configurations include:
/// 1. Baseline: TierFirst ordering, default weights
/// 2. EDD ordering (if multi_start=true): EarliestDeadline, default weights
/// 3. SlackFirst ordering (if multi_start=true): tier-stratified with
///    intra-tier slack sort, default weights
/// 4. Perturbed passes (if perturbed_starts > 0): rotate through
///    TierFirst / EDD / SlackFirst with randomly perturbed scoring weights
///    (seeded for determinism)
///
/// The scoring weights multiply the 7 forward pass scoring components.
pub fn run_with_multi_start_fbi(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
    multi_start: bool,
    perturbed_starts: u32,
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    setup_completion_log: &[SetupCompletion],
    progress: &super::ProgressSender,
    now_tick: usize,
    precedence_min_gap_ticks: u32,
    warnings: &mut Vec<Warning>,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    use rand::Rng;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    let default_weights: [f64; 7] = [1.0; 7];
    let mut total_iters: u32 = 0;

    // Pass 1: Baseline (TierFirst, default weights). Per-pass warnings vec
    // so the winning pass's warnings are the ones surfaced to the user —
    // each pass produces deterministically identical warnings for the same
    // pins, but only the winner's schedule is shown so we honour that.
    let mut warnings_p1: Vec<Warning> = Vec::new();
    let (mut best_a, mut best_act, mut best_s, i1) = run_with_fbi_ordering(
        jobs, stations, operators,
        tick_minutes, horizon_days, max_iterations, start_date,
        BackwardOrdering::TierFirst, station_blocked_ranges, occupied_slots, setup_completion_log, progress,
        now_tick, &default_weights,
        precedence_min_gap_ticks,
        &mut warnings_p1,
    );
    let mut best_warnings: Vec<Warning> = warnings_p1;
    total_iters += i1;
    // Score tuple: (unplaced, weighted_late_job_count, weighted_lateness_minutes, makespan_minutes).
    // Unplaced is primary because a task missing from the schedule is
    // strictly worse than a late one — see the `current_score` block in
    // `run_with_fbi_ordering` for the rationale.
    let mut best_unplaced = (best_s.total_tasks - best_s.scheduled_tasks) as u64;
    let mut best_score = (best_unplaced, best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes);

    eprintln!("[MULTI-START] pass 0 (baseline TierFirst): unplaced={} late_jobs={} w_late={} lateness={} makespan={}",
        best_unplaced, best_s.late_job_count, best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes);

    // Pass 2: EDD ordering (if multi_start enabled)
    if multi_start {
        let mut warnings_p2: Vec<Warning> = Vec::new();
        let (a2, act2, s2, i2) = run_with_fbi_ordering(
            jobs, stations, operators,
            tick_minutes, horizon_days, max_iterations, start_date,
            BackwardOrdering::EarliestDeadline, station_blocked_ranges, occupied_slots, setup_completion_log, progress,
            now_tick, &default_weights,
            precedence_min_gap_ticks,
            &mut warnings_p2,
        );
        total_iters += i2;
        let unplaced2 = (s2.total_tasks - s2.scheduled_tasks) as u64;
        let score2 = (unplaced2, s2.weighted_late_job_count, s2.weighted_lateness_minutes, s2.makespan_minutes);

        eprintln!("[MULTI-START] pass 1 (EDD): unplaced={} late_jobs={} w_late={} lateness={} makespan={}",
            unplaced2, s2.late_job_count, s2.weighted_late_job_count, s2.weighted_lateness_minutes, s2.makespan_minutes);

        if score2 < best_score {
            best_a = a2;
            best_act = act2;
            best_s = s2;
            best_score = score2;
            best_unplaced = unplaced2;
            best_warnings = warnings_p2;
        }

        // Pass 3: SlackFirst ordering. Tier-stratified like TierFirst but
        // intra-tier sort by `deadline − remaining_chain_work` — critical
        // path first within each priority level. May produce better
        // schedules when several same-tier jobs compete with varying
        // chain lengths.
        let mut warnings_p3: Vec<Warning> = Vec::new();
        let (a3, act3, s3, i3) = run_with_fbi_ordering(
            jobs, stations, operators,
            tick_minutes, horizon_days, max_iterations, start_date,
            BackwardOrdering::SlackFirst, station_blocked_ranges, occupied_slots, setup_completion_log, progress,
            now_tick, &default_weights,
            precedence_min_gap_ticks,
            &mut warnings_p3,
        );
        total_iters += i3;
        let unplaced3 = (s3.total_tasks - s3.scheduled_tasks) as u64;
        let score3 = (unplaced3, s3.weighted_late_job_count, s3.weighted_lateness_minutes, s3.makespan_minutes);

        eprintln!("[MULTI-START] pass 2 (SlackFirst): unplaced={} late_jobs={} w_late={} lateness={} makespan={}",
            unplaced3, s3.late_job_count, s3.weighted_late_job_count, s3.weighted_lateness_minutes, s3.makespan_minutes);

        if score3 < best_score {
            best_a = a3;
            best_act = act3;
            best_s = s3;
            best_score = score3;
            best_unplaced = unplaced3;
            best_warnings = warnings_p3;
        }
    }

    // Perturbed passes: randomly perturb scoring weights
    if perturbed_starts > 0 {
        let mut rng = StdRng::seed_from_u64(42);

        for pass in 0..perturbed_starts {
            // Generate perturbed weights in [0.5, 1.5] for each of the 7 scoring components
            let mut weights = [0.0f64; 7];
            for w in &mut weights {
                *w = 0.5 + rng.gen_range(0.0..1.0); // [0.5, 1.5)
            }

            // Rotate through TierFirst / EDD / SlackFirst for perturbed passes.
            let ordering = match pass % 3 {
                0 => BackwardOrdering::TierFirst,
                1 => BackwardOrdering::EarliestDeadline,
                _ => BackwardOrdering::SlackFirst,
            };

            let mut warnings_pp: Vec<Warning> = Vec::new();
            let (ap, actp, sp, ip) = run_with_fbi_ordering(
                jobs, stations, operators,
                tick_minutes, horizon_days, max_iterations, start_date,
                ordering, station_blocked_ranges, occupied_slots, setup_completion_log, progress,
                now_tick, &weights,
                precedence_min_gap_ticks,
                &mut warnings_pp,
            );
            total_iters += ip;
            let unplaced_p = (sp.total_tasks - sp.scheduled_tasks) as u64;
            let score_p = (unplaced_p, sp.weighted_late_job_count, sp.weighted_lateness_minutes, sp.makespan_minutes);

            eprintln!("[MULTI-START] pass {} (perturbed {:?} w={:.2?}): unplaced={} late_jobs={} w_late={} lateness={} makespan={}",
                pass + 3, ordering, weights, unplaced_p, sp.late_job_count, sp.weighted_late_job_count, sp.weighted_lateness_minutes, sp.makespan_minutes);

            if score_p < best_score {
                best_a = ap;
                best_act = actp;
                best_s = sp;
                best_score = score_p;
                best_unplaced = unplaced_p;
                best_warnings = warnings_pp;
            }
        }
    }

    eprintln!("[MULTI-START] best: unplaced={} late_jobs={} w_late={} lateness={} makespan={} (total {} FBI iterations)",
        best_unplaced, best_s.late_job_count, best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes, total_iters);

    // Surface only the winning pass's warnings — the schedule shown to the
    // user is best_a, so its accompanying warnings (e.g. pin displacements)
    // are the ones that match the visible state.
    warnings.extend(best_warnings);

    (best_a, best_act, best_s, total_iters)
}
