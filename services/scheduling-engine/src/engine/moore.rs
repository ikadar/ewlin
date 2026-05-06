use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{ComputedAssignment, ScheduleStats, StationGroupInput};
use crate::model::station::StationInput;

use super::backward_pass::BackwardOrdering;
use super::fbi::run_with_fbi_ordering;
use super::forward_pass::Action;

/// Moore escape hatch: after FBI converges, if late jobs remain, try to
/// improve the schedule by re-running FBI with modified priorities.
///
/// Two strategies are tried:
///
/// **Strategy A (cross-priority):** For late high-priority jobs, find lower-priority
/// jobs blocking the same stations. Boost the late job, demote the blockers, re-run.
///
/// **Strategy B (same-priority / capacity sacrifice):** When all jobs share the same
/// priority, find the most-late jobs and the biggest capacity consumers on their
/// stations. Boost the late jobs to imperative, demote the capacity hogs to flexible.
/// This trades off one large job being late for several smaller ones being on time.
///
/// Returns improved result or None if no improvement found.
pub fn moore_escape(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    actions: &[Action],
    stats: &ScheduleStats,
    tick_minutes: u32,
    horizon_days: u32,
    fbi_max_iterations: u32,
    start_date: NaiveDate,
    max_attempts: u32,
    station_groups: &[StationGroupInput],
    setup_completion_log: &[crate::model::schedule::SetupCompletion],
    now_tick: usize,
    precedence_min_gap_ticks: u32,
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    if stats.late_job_count == 0 {
        return None;
    }

    let job_deadlines: HashMap<&str, u64> = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref().and_then(|d| {
                super::parse_deadline_minutes(d, start_date)
                    .map(|mins| (j.id.as_str(), mins / tick_minutes as u64))
            })
        })
        .collect();

    let job_priorities: HashMap<&str, u8> = jobs
        .iter()
        .map(|j| (j.id.as_str(), j.deadline_priority))
        .collect();

    // Collect all late jobs with their lateness
    let mut late_jobs: Vec<LateJobInfo> = Vec::new();
    let mut seen_jobs: HashSet<String> = HashSet::new();

    for action in actions {
        if let Some(end_tick) = action.end_tick {
            if let Some(&deadline_tick) = job_deadlines.get(action.job_id.as_str()) {
                if end_tick as u64 > deadline_tick && !seen_jobs.contains(&action.job_id) {
                    let priority = *job_priorities.get(action.job_id.as_str()).unwrap_or(&2);
                    late_jobs.push(LateJobInfo {
                        job_id: action.job_id.clone(),
                        priority,
                        lateness_ticks: end_tick as u64 - deadline_tick,
                    });
                    seen_jobs.insert(action.job_id.clone());
                }
            }
        }
    }

    if late_jobs.is_empty() {
        return None;
    }

    // Sort: highest priority first, then most late first
    late_jobs.sort_by(|a, b| {
        a.priority.cmp(&b.priority)
            .then(b.lateness_ticks.cmp(&a.lateness_ticks))
    });

    // Build station usage per job: job_id → Vec<station_idx>
    let mut job_stations: HashMap<&str, Vec<usize>> = HashMap::new();
    for action in actions {
        job_stations
            .entry(action.job_id.as_str())
            .or_default()
            .push(action.station_idx);
    }

    let current_score = (stats.late_job_count, stats.weighted_lateness_minutes, stats.makespan_minutes);
    let mut best_result: Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> = None;
    let mut attempts = 0;

    for late_job in &late_jobs {
        if attempts >= max_attempts {
            break;
        }

        let my_stations: HashSet<usize> = job_stations
            .get(late_job.job_id.as_str())
            .map(|v| v.iter().copied().collect())
            .unwrap_or_default();

        // Strategy A: find strictly lower-priority blockers
        let mut blocker_jobs: HashSet<String> = HashSet::new();
        for action in actions {
            if action.job_id == late_job.job_id { continue; }
            let p = *job_priorities.get(action.job_id.as_str()).unwrap_or(&2);
            if p > late_job.priority && my_stations.contains(&action.station_idx) {
                blocker_jobs.insert(action.job_id.clone());
            }
        }

        // Strategy B: same-priority capacity sacrifice.
        // When no cross-priority blockers exist (all same priority), find
        // non-late jobs on the same stations consuming the most capacity.
        // Demote them to flexible, boost the late job to imperative.
        // This creates genuine priority differentiation: backward pass
        // reserves capacity for tier 0 before tier 3, and forward pass
        // tier weights differ 8x (4.0/0.5).
        if blocker_jobs.is_empty() {
            // Sum ART per job on shared stations (only non-late jobs)
            let mut job_capacity: HashMap<String, u32> = HashMap::new();
            for action in actions {
                if action.job_id == late_job.job_id { continue; }
                if seen_jobs.contains(&action.job_id) { continue; } // skip other late jobs
                if !my_stations.contains(&action.station_idx) { continue; }
                *job_capacity.entry(action.job_id.clone()).or_insert(0) += action.art;
            }

            // Skip sacrifice candidates whose own slack is tight (< 2 days in ticks)
            let two_days_ticks = 2 * 24 * 60 / tick_minutes as u64;
            let mut sacrifice_candidates: Vec<(String, u32)> = job_capacity
                .into_iter()
                .filter(|(jid, _)| {
                    // Check this job has enough slack to absorb demotion
                    if let Some(&dl) = job_deadlines.get(jid.as_str()) {
                        // Find max end_tick for this job
                        let max_end = actions.iter()
                            .filter(|a| a.job_id == *jid)
                            .filter_map(|a| a.end_tick)
                            .max()
                            .unwrap_or(0) as u64;
                        // Slack = deadline - current end
                        dl.saturating_sub(max_end) >= two_days_ticks
                    } else {
                        true // no deadline = infinite slack
                    }
                })
                .collect();

            // Sort by capacity descending, take top 3
            sacrifice_candidates.sort_by(|a, b| b.1.cmp(&a.1));
            for (jid, _cap) in sacrifice_candidates.iter().take(3) {
                blocker_jobs.insert(jid.clone());
            }
        }

        if blocker_jobs.is_empty() {
            continue;
        }

        // Create modified jobs: boost late job, demote blockers
        let modified_jobs: Vec<JobInput> = jobs
            .iter()
            .map(|j| {
                let mut modified = j.clone();
                if j.id == late_job.job_id {
                    modified.deadline_priority = 0; // imperative
                } else if blocker_jobs.contains(&j.id) {
                    modified.deadline_priority = 3; // flexible
                }
                modified
            })
            .collect();

        attempts += 1;
        let default_weights: [f64; 7] = [1.0; 7];
        // Pin-displacement warnings here are discarded — they are emitted
        // deterministically by the prior multi_start_fbi pass which already
        // surfaced them via best_warnings; re-emitting from a recovery pass
        // would only produce duplicates.
        let mut _moore_warnings: Vec<crate::model::schedule::Warning> = Vec::new();
        let (new_assignments, new_actions, new_stats, new_iters) = run_with_fbi_ordering(
            &modified_jobs, stations, operators,
            tick_minutes, horizon_days, fbi_max_iterations, start_date,
            BackwardOrdering::TierFirst, station_groups, &[], &[],
            // Moore inherits the same historical log as the main pass —
            // recovery passes that ignore inheritance plan stale setups
            // and produce systematically pessimistic recovery schedules,
            // making Moore look unhelpful on partially-progressed late
            // jobs. Threading the original log through keeps the recovery
            // attempts on equal footing with the main FBI passes.
            setup_completion_log,
            &None,
            now_tick, &default_weights,
            precedence_min_gap_ticks,
            &mut _moore_warnings,
        );

        let new_score = (new_stats.late_job_count, new_stats.weighted_lateness_minutes, new_stats.makespan_minutes);

        eprintln!("[MOORE-B] attempt {}: boost {} demote {:?} → late_jobs={} (was {})",
            attempts, &late_job.job_id[..8.min(late_job.job_id.len())],
            blocker_jobs.iter().map(|s| &s[..8.min(s.len())]).collect::<Vec<_>>(),
            new_stats.late_job_count, stats.late_job_count);

        let effective_current = match &best_result {
            Some((_, _, best, _)) => (best.late_job_count, best.weighted_lateness_minutes, best.makespan_minutes),
            None => current_score,
        };

        if new_score < effective_current {
            best_result = Some((new_assignments, new_actions, new_stats, new_iters));
        }
    }

    best_result
}

struct LateJobInfo {
    job_id: String,
    priority: u8,
    lateness_ticks: u64,
}
