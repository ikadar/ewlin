use std::collections::HashMap;

use chrono::NaiveDate;

use crate::model::schedule::{
    ComputedAssignment, ScheduleStats, StationGroupInput,
};
use crate::model::station::StationInput;
use crate::model::operator::OperatorInput;
use crate::model::job::JobInput;

use super::backward_pass::BackwardOrdering;

use super::backward_pass::{compute_last_values, compute_last_values_with_placements, BackwardPlacement};
use super::forward_pass::{
    build_prepared_groups, run_forward_pass, Action, OperatorAvailability, OperatorScheduleData,
    PreparedConcurrentGroup, StationAttrs,
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
    ordering: BackwardOrdering,
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
    score_weights: &[f64; 6],
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

    let schedules: Vec<OperatorScheduleData> = operators
        .iter()
        .map(|op| OperatorScheduleData {
            schedules: op.operating_schedules.clone(),
            reference_week: op.schedule_rotation_reference_week,
            absences: op.absences.clone(),
        })
        .collect();

    let mut best_assignments: Vec<ComputedAssignment> = Vec::new();
    let mut best_actions: Vec<Action> = Vec::new();
    let mut best_stats = ScheduleStats {
        makespan_minutes: u64::MAX,
        total_tasks: 0,
        scheduled_tasks: 0,
        deadline_violations: u32::MAX,
        late_task_count: u32::MAX,
        total_lateness_minutes: u64::MAX,
        late_job_count: u32::MAX,
        weighted_lateness_minutes: u64::MAX,
        weighted_late_job_count: u64::MAX,
        late_job_ids: Vec::new(),
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
    // their deadline_priority boosted by one tier (clamped to 0 = imperative)
    // so the next backward pass schedules them earlier. The boost only
    // affects the backward pass (LAST computation), not the permanent job data.
    let mut boosted_jobs: Vec<JobInput> = Vec::new();
    let mut alap_placements: Vec<BackwardPlacement> = Vec::new();

    for iteration in 0..effective_max {
        iteration_count = iteration + 1;

        super::emit(progress, crate::model::progress::ProgressEvent::FbiStart {
            iteration: iteration + 1,
            max_iterations: effective_max,
        });

        // Use boosted jobs for backward pass if available (from previous iteration's late jobs)
        let jobs_for_backward = if boosted_jobs.is_empty() { jobs } else { &boosted_jobs };

        // Compute LAST values. On iteration 0, also extract ALAP placements
        // for imperative (tier 0) + important (tier 1) jobs.
        let initial_ticks_for_last = (horizon_days as usize) * 24 * 60 / (tick_minutes as usize);

        // ALAP pre-reservation: protect high-priority jobs from lower-priority ones.
        // Skip for single-job payloads — no competing jobs to protect against.
        let has_priority_jobs = jobs.iter().any(|j| j.deadline_priority <= 1);
        let last_values = if iteration == 0 && has_priority_jobs && ordering == BackwardOrdering::TierFirst && jobs.len() > 1 {
            let (lv, placements) = compute_last_values_with_placements(
                jobs_for_backward, stations, operators,
                &station_attrs, &operator_skills, &operator_groups,
                tick_minutes, start_date,
                initial_ticks_for_last,
                &[0, 1], // ALAP tiers: imperative + important
            );
            // Store placements for later merging into occupied_slots
            alap_placements = placements;
            lv
        } else {
            compute_last_values(
                jobs_for_backward, stations, operators,
                &station_attrs, &operator_skills, &operator_groups,
                tick_minutes, start_date,
                initial_ticks_for_last,
                ordering,
            )
        };

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

        // Pre-block ALAP placements for high-priority jobs (tier 0+1).
        // These ticks are reserved so the forward pass places remaining
        // jobs (tier 2+3) around them.
        let alap_task_ids: std::collections::HashSet<&str> = alap_placements.iter()
            .map(|p| p.task_id.as_str())
            .collect();

        for p in &alap_placements {
            let clamped_end = p.end_tick.min(initial_ticks);
            for t in p.start_tick..clamped_end {
                if p.station_idx < num_stations {
                    grid.assign_station(p.station_idx, t, usize::MAX);
                }
                for &op_idx in &p.operator_indices {
                    if op_idx < num_operators {
                        grid.assign_operator(op_idx, t, p.station_idx, 0.0);
                    }
                }
            }
        }

        // Mark ALAP-placed actions as done so the forward pass skips them.
        // Without this, the forward pass wastes time trying to place actions
        // whose station slots are blocked — O(actions × ticks) wasted cycles.
        for action in actions.iter_mut() {
            if alap_task_ids.contains(action.task_id.as_str()) {
                action.start_tick = Some(0);
                action.end_tick = Some(0);
                action.art = 0;
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
            &station_urgency_boost,
            &score_weights,
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

        // Track best result: prefer fewer weighted-late jobs (protects
        // imperative over flexible), then less weighted lateness, then
        // shorter makespan.
        let current_score = (stats.weighted_late_job_count, stats.weighted_lateness_minutes, current_makespan);
        let best_score = (best_stats.weighted_late_job_count, best_stats.weighted_lateness_minutes, best_stats.makespan_minutes);
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
                    j2.deadline_priority = j.deadline_priority.saturating_sub(1);
                }
                j2
            }).collect();
        } else {
            boosted_jobs.clear();
        }

    }

    // Merge ALAP placements into final assignments.
    // ALAP tasks were pre-blocked in the grid, so the forward pass skipped them.
    // Now we convert them to ComputedAssignment and prepend to the result.
    if !alap_placements.is_empty() {
        let alap_task_ids: std::collections::HashSet<&str> = alap_placements.iter()
            .map(|p| p.task_id.as_str())
            .collect();

        // Remove any forward-pass assignments for ALAP tasks (they shouldn't exist,
        // but safety check in case the forward pass placed them elsewhere)
        best_assignments.retain(|a| !alap_task_ids.contains(a.task_id.as_str()));

        // Convert placements to ComputedAssignment
        for p in &alap_placements {
            let station_id = if p.station_idx < stations.len() {
                stations[p.station_idx].id.clone()
            } else {
                continue;
            };

            let start_dt = tick_to_datetime(p.start_tick, tick_minutes, start_date);
            let end_dt = tick_to_datetime(p.end_tick, tick_minutes, start_date);

            let op_assignments: Vec<crate::model::schedule::OperatorAssignment> = p.operator_indices.iter()
                .filter_map(|&op_idx| {
                    if op_idx < operators.len() {
                        Some(crate::model::schedule::OperatorAssignment {
                            operator_id: operators[op_idx].id.clone(),
                            from: start_dt.clone(),
                            to: end_dt.clone(),
                            attention: 1.0,
                        })
                    } else {
                        None
                    }
                })
                .collect();

            best_assignments.push(ComputedAssignment {
                task_id: p.task_id.clone(),
                station_id,
                scheduled_start: start_dt,
                scheduled_end: end_dt,
                operators: op_assignments,
                setup_end: None,
                is_degraded: false,
                effective_productivity: 1.0,
                is_masked_time: false,
                recalages: Vec::new(),
            });
        }

        // Recompute stats with ALAP assignments included
        best_stats = super::compute_stats(&best_assignments, &best_actions, jobs, tick_minutes, start_date);
        eprintln!("[FBI] ALAP phase: {} tasks pre-placed for tier 0+1, final late_jobs={}",
            alap_placements.len(), best_stats.late_job_count);
    }

    (best_assignments, best_actions, best_stats, iteration_count)
}

/// Convert a tick number to an ISO datetime string.
fn tick_to_datetime(tick: usize, tick_minutes: u32, start_date: NaiveDate) -> String {
    let total_minutes = tick as i64 * tick_minutes as i64;
    let dt = start_date.and_hms_opt(0, 0, 0).unwrap()
        + chrono::Duration::minutes(total_minutes);
    dt.format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Run FBI with a specific backward ordering and station groups.
pub fn run_with_fbi_ordering(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    tick_minutes: u32,
    horizon_days: u32,
    max_iterations: u32,
    start_date: NaiveDate,
    ordering: BackwardOrdering,
    _station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
    score_weights: &[f64; 6],
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    run_with_fbi(jobs, stations, operators, tick_minutes, horizon_days, max_iterations, start_date, ordering, station_blocked_ranges, occupied_slots, progress, now_tick, score_weights)
}

/// Multi-start FBI with perturbed scoring weights.
///
/// Runs multiple FBI passes with different configurations and returns the
/// best result. Configurations include:
/// 1. Baseline: TierFirst ordering, default weights [1.0; 6]
/// 2. EDD ordering (if multi_start=true): EarliestDeadline, default weights
/// 3. Perturbed passes (if perturbed_starts > 0): each uses TierFirst with
///    randomly perturbed scoring weights (seeded for determinism)
///
/// The scoring weights multiply the 6 forward pass scoring components:
/// [weighted_urgency, job_boost, proximity_bonus, calage_bonus,
///  chain_pressure, contention_bonus]
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
    station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    progress: &super::ProgressSender,
    now_tick: usize,
) -> (Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32) {
    use rand::Rng;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    let default_weights: [f64; 6] = [1.0; 6];
    let mut total_iters: u32 = 0;

    // Pass 1: Baseline (TierFirst, default weights)
    let (mut best_a, mut best_act, mut best_s, i1) = run_with_fbi_ordering(
        jobs, stations, operators,
        tick_minutes, horizon_days, max_iterations, start_date,
        BackwardOrdering::TierFirst, station_groups, station_blocked_ranges, occupied_slots, progress,
        now_tick, &default_weights,
    );
    total_iters += i1;
    let mut best_score = (best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes);

    eprintln!("[MULTI-START] pass 0 (baseline TierFirst): late_jobs={} w_late={} lateness={} makespan={}",
        best_s.late_job_count, best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes);

    // Pass 2: EDD ordering (if multi_start enabled)
    if multi_start {
        let (a2, act2, s2, i2) = run_with_fbi_ordering(
            jobs, stations, operators,
            tick_minutes, horizon_days, max_iterations, start_date,
            BackwardOrdering::EarliestDeadline, station_groups, station_blocked_ranges, occupied_slots, progress,
            now_tick, &default_weights,
        );
        total_iters += i2;
        let score2 = (s2.weighted_late_job_count, s2.weighted_lateness_minutes, s2.makespan_minutes);

        eprintln!("[MULTI-START] pass 1 (EDD): late_jobs={} w_late={} lateness={} makespan={}",
            s2.late_job_count, s2.weighted_late_job_count, s2.weighted_lateness_minutes, s2.makespan_minutes);

        if score2 < best_score {
            best_a = a2;
            best_act = act2;
            best_s = s2;
            best_score = score2;
        }
    }

    // Perturbed passes: randomly perturb scoring weights
    if perturbed_starts > 0 {
        let mut rng = StdRng::seed_from_u64(42);

        for pass in 0..perturbed_starts {
            // Generate perturbed weights in [0.5, 1.5] for each of the 6 scoring components
            let mut weights = [0.0f64; 6];
            for w in &mut weights {
                *w = 0.5 + rng.gen_range(0.0..1.0); // [0.5, 1.5)
            }

            // Alternate between TierFirst and EDD for perturbed passes
            let ordering = if pass % 2 == 0 {
                BackwardOrdering::TierFirst
            } else {
                BackwardOrdering::EarliestDeadline
            };

            let (ap, actp, sp, ip) = run_with_fbi_ordering(
                jobs, stations, operators,
                tick_minutes, horizon_days, max_iterations, start_date,
                ordering, station_groups, station_blocked_ranges, occupied_slots, progress,
                now_tick, &weights,
            );
            total_iters += ip;
            let score_p = (sp.weighted_late_job_count, sp.weighted_lateness_minutes, sp.makespan_minutes);

            eprintln!("[MULTI-START] pass {} (perturbed {:?} w={:.2?}): late_jobs={} w_late={} lateness={} makespan={}",
                pass + 2, ordering, weights, sp.late_job_count, sp.weighted_late_job_count, sp.weighted_lateness_minutes, sp.makespan_minutes);

            if score_p < best_score {
                best_a = ap;
                best_act = actp;
                best_s = sp;
                best_score = score_p;
            }
        }
    }

    eprintln!("[MULTI-START] best: late_jobs={} w_late={} lateness={} makespan={} (total {} FBI iterations)",
        best_s.late_job_count, best_s.weighted_late_job_count, best_s.weighted_lateness_minutes, best_s.makespan_minutes, total_iters);

    (best_a, best_act, best_s, total_iters)
}
