use std::collections::{HashMap, HashSet};
use std::time::Instant;

use chrono::NaiveDate;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{ComputedAssignment, ScheduleStats, StationGroupInput};
use crate::model::station::StationInput;

use super::backward_pass::BackwardOrdering;
use super::fbi::run_with_fbi_ordering;
use super::forward_pass::Action;

/// Local search improvement: try to improve the schedule by re-running FBI
/// with surgical priority modifications for individual late jobs.
///
/// Unlike Moore (which boosts + demotes), local search tries a "pure boost"
/// for each late job: set it to imperative without demoting anything else.
/// This tests whether giving the job absolute priority is enough to save it
/// without hurting others. If the total score improves, we keep the change.
///
/// Additionally tries "swap pairs": for the top late jobs, swap their
/// priority with the top on-time jobs on the same stations. This explores
/// whether reordering specific pairs helps.
///
/// Returns improved result or None if no improvement found.
pub fn local_search_improve(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    actions: &[Action],
    stats: &ScheduleStats,
    tick_minutes: u32,
    horizon_days: u32,
    fbi_max_iterations: u32,
    start_date: NaiveDate,
    station_groups: &[StationGroupInput],
    now_tick: usize,
    time_budget_ms: u64,
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    if stats.late_job_count == 0 {
        return None;
    }

    let start = Instant::now();
    let default_weights: [f64; 6] = [1.0; 6];

    let job_deadlines: HashMap<&str, u64> = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref().and_then(|d| {
                super::parse_deadline_minutes(d, start_date)
                    .map(|mins| (j.id.as_str(), mins / tick_minutes as u64))
            })
        })
        .collect();

    // Collect late jobs sorted by lateness descending
    let mut late_jobs: Vec<(&str, u64)> = Vec::new();
    let mut seen: HashSet<&str> = HashSet::new();
    for action in actions {
        if let Some(end_tick) = action.end_tick {
            if let Some(&deadline_tick) = job_deadlines.get(action.job_id.as_str()) {
                if end_tick as u64 > deadline_tick && !seen.contains(action.job_id.as_str()) {
                    late_jobs.push((action.job_id.as_str(), end_tick as u64 - deadline_tick));
                    seen.insert(action.job_id.as_str());
                }
            }
        }
    }
    late_jobs.sort_by(|a, b| b.1.cmp(&a.1)); // most late first

    let current_score = (stats.late_job_count, stats.weighted_lateness_minutes, stats.makespan_minutes);
    let mut best_result: Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> = None;
    let mut best_score = current_score;
    let mut attempts = 0;

    // Strategy 1: Pure boost — set each late job to imperative, keep others unchanged.
    // This tests whether absolute priority alone saves the job.
    for &(late_job_id, lateness) in &late_jobs {
        if start.elapsed().as_millis() as u64 > time_budget_ms {
            break;
        }

        let modified_jobs: Vec<JobInput> = jobs
            .iter()
            .map(|j| {
                let mut modified = j.clone();
                if j.id == late_job_id {
                    modified.deadline_priority = 0; // imperative
                }
                modified
            })
            .collect();

        let (new_a, new_act, new_s, new_i) = run_with_fbi_ordering(
            &modified_jobs, stations, operators,
            tick_minutes, horizon_days, fbi_max_iterations, start_date,
            BackwardOrdering::TierFirst, station_groups, &[], &[], &None,
            now_tick, &default_weights, None,
        );

        let new_score = (new_s.late_job_count, new_s.weighted_lateness_minutes, new_s.makespan_minutes);
        attempts += 1;

        eprintln!("[LOCAL-SEARCH] pure boost {}: late_jobs={} (was {}, lateness={})",
            &late_job_id[..8.min(late_job_id.len())], new_s.late_job_count, stats.late_job_count, lateness);

        if new_score < best_score {
            best_score = new_score;
            best_result = Some((new_a, new_act, new_s, new_i));
        }

        // Limit attempts to keep within time budget
        if attempts >= 10 {
            break;
        }
    }

    // Strategy 2: Batch boost — set the top N most-late jobs to imperative simultaneously.
    // Sometimes individual boosts don't help because late jobs compete with each other,
    // but boosting them all together creates a "priority lane" effect.
    if start.elapsed().as_millis() as u64 <= time_budget_ms && late_jobs.len() >= 2 {
        for batch_size in [3, 5, 10].iter() {
            if start.elapsed().as_millis() as u64 > time_budget_ms {
                break;
            }
            let n = (*batch_size as usize).min(late_jobs.len());
            let batch: HashSet<&str> = late_jobs[..n].iter().map(|&(id, _)| id).collect();

            let modified_jobs: Vec<JobInput> = jobs
                .iter()
                .map(|j| {
                    let mut modified = j.clone();
                    if batch.contains(j.id.as_str()) {
                        modified.deadline_priority = 0; // imperative
                    }
                    modified
                })
                .collect();

            let (new_a, new_act, new_s, new_i) = run_with_fbi_ordering(
                &modified_jobs, stations, operators,
                tick_minutes, horizon_days, fbi_max_iterations, start_date,
                BackwardOrdering::TierFirst, station_groups, &[], &[], &None,
                now_tick, &default_weights, None,
            );

            let new_score = (new_s.late_job_count, new_s.weighted_lateness_minutes, new_s.makespan_minutes);

            eprintln!("[LOCAL-SEARCH] batch boost top-{}: late_jobs={} (was {})",
                n, new_s.late_job_count, stats.late_job_count);

            if new_score < best_score {
                best_score = new_score;
                best_result = Some((new_a, new_act, new_s, new_i));
            }
        }
    }

    if let Some(ref result) = best_result {
        eprintln!("[LOCAL-SEARCH] improved: late_jobs {} → {} ({} attempts, {}ms)",
            stats.late_job_count, result.2.late_job_count, attempts,
            start.elapsed().as_millis());
    } else {
        eprintln!("[LOCAL-SEARCH] no improvement found ({} attempts, {}ms)",
            attempts, start.elapsed().as_millis());
    }

    best_result
}
