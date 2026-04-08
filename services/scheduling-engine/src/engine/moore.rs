use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{ComputedAssignment, ScheduleStats, StationGroupInput};
use crate::model::station::StationInput;

use super::backward_pass::BackwardOrdering;
use super::fbi::run_with_fbi_ordering;
use super::forward_pass::Action;

/// Moore escape hatch: after FBI converges, if late imperative/important jobs remain,
/// try to swap lower-priority work to save higher-priority jobs.
///
/// The algorithm:
/// 1. Find late jobs with deadline_priority <= 1 (imperative or important)
/// 2. For each late job, find the station(s) causing the delay
/// 3. Find lower-priority tasks blocking those stations
/// 4. Temporarily boost the late job's priority and demote the blocker
/// 5. Re-run FBI and check if net late_job_count improves
///
/// Returns improved result or None if no improvement found.
/// Limited to max_attempts to bound compute time.
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
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    // Only activate if there are late imperative or important jobs
    if stats.late_job_count == 0 {
        return None;
    }

    // Find late jobs grouped by job_id, with their max lateness
    let mut late_job_info: Vec<LateJobInfo> = Vec::new();
    let mut seen_jobs: HashSet<String> = HashSet::new();

    // Build job deadline map
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

    for action in actions {
        if let Some(end_tick) = action.end_tick {
            if let Some(&deadline_tick) = job_deadlines.get(action.job_id.as_str()) {
                if end_tick as u64 > deadline_tick && !seen_jobs.contains(&action.job_id) {
                    let priority = *job_priorities.get(action.job_id.as_str()).unwrap_or(&2);
                    // Only consider imperative (0) and important (1) jobs for rescue
                    if priority <= 1 {
                        late_job_info.push(LateJobInfo {
                            job_id: action.job_id.clone(),
                            priority,
                            lateness_ticks: end_tick as u64 - deadline_tick,
                        });
                        seen_jobs.insert(action.job_id.clone());
                    }
                }
            }
        }
    }

    if late_job_info.is_empty() {
        return None;
    }

    // Sort: imperative first, then by lateness descending (rescue the most critical first)
    late_job_info.sort_by(|a, b| {
        a.priority.cmp(&b.priority)
            .then(b.lateness_ticks.cmp(&a.lateness_ticks))
    });

    // Find which stations each late job's tasks use
    let mut late_job_stations: HashMap<String, Vec<usize>> = HashMap::new();
    for action in actions {
        if seen_jobs.contains(&action.job_id) {
            late_job_stations
                .entry(action.job_id.clone())
                .or_default()
                .push(action.station_idx);
        }
    }

    // Find lower-priority tasks that block those stations
    let mut best_result: Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> = None;
    let mut attempts = 0;
    let current_score = (stats.late_job_count, stats.weighted_lateness_minutes, stats.makespan_minutes);

    for late_job in &late_job_info {
        if attempts >= max_attempts {
            break;
        }

        let blocking_stations: &Vec<usize> = match late_job_stations.get(&late_job.job_id) {
            Some(s) => s,
            None => continue,
        };

        // Find lower-priority jobs that have tasks on the same stations
        let mut blocker_jobs: HashSet<String> = HashSet::new();
        for action in actions {
            if action.job_id == late_job.job_id { continue; }
            let action_priority = *job_priorities.get(action.job_id.as_str()).unwrap_or(&2);
            if action_priority > late_job.priority && blocking_stations.contains(&action.station_idx) {
                blocker_jobs.insert(action.job_id.clone());
            }
        }

        if blocker_jobs.is_empty() {
            continue;
        }

        // Create modified jobs with priority overrides:
        // - Boost the late job to priority 0 (super-imperative)
        // - Demote blockers to priority 3 (flexible)
        let modified_jobs: Vec<JobInput> = jobs
            .iter()
            .map(|j| {
                let mut modified = j.clone();
                if j.id == late_job.job_id {
                    modified.deadline_priority = 0;
                } else if blocker_jobs.contains(&j.id) {
                    modified.deadline_priority = 3;
                }
                modified
            })
            .collect();

        // Re-run FBI with modified priorities
        attempts += 1;
        let (new_assignments, new_actions, new_stats, new_iters) = run_with_fbi_ordering(
            &modified_jobs, stations, operators,
            tick_minutes, horizon_days, fbi_max_iterations, start_date,
            BackwardOrdering::TierFirst, station_groups,
        );

        let new_score = (new_stats.late_job_count, new_stats.weighted_lateness_minutes, new_stats.makespan_minutes);

        // Accept only if net late_job_count improves (or same count with less lateness)
        if new_score < current_score {
            let is_better_than_best = match &best_result {
                Some((_, _, best_stats, _)) => {
                    new_score < (best_stats.late_job_count, best_stats.weighted_lateness_minutes, best_stats.makespan_minutes)
                }
                None => true,
            };
            if is_better_than_best {
                best_result = Some((new_assignments, new_actions, new_stats, new_iters));
            }
        }
    }

    best_result
}

struct LateJobInfo {
    job_id: String,
    priority: u8,
    lateness_ticks: u64,
}
