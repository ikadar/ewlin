use std::collections::{HashMap, HashSet};
use std::time::Instant;

use chrono::NaiveDate;
use rand::Rng;
use rand::rngs::StdRng;
use rand::SeedableRng;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::schedule::{ComputedAssignment, ScheduleStats, StationGroupInput};
use crate::model::station::StationInput;

use super::backward_pass::BackwardOrdering;
use super::fbi::run_with_fbi_ordering;
use super::forward_pass::Action;

/// LNS (Large Neighborhood Search) improvement.
///
/// Each iteration:
/// 1. DESTROY: pick a batch of the most-late jobs → set priority 0 (imperative)
/// 2. DESTABILIZE: pick random on-time jobs on the same stations → set priority 3 (flexible)
/// 3. REPAIR: run full FBI (1 iteration) with modified priorities
/// 4. ACCEPT: keep if strictly better (late_job_count, weighted_lateness)
///
/// Uses the FULL forward pass as evaluator — each iteration is exact.
/// 10-15 iterations × ~1.5s = 15-20s, massive neighborhood per iteration.
pub fn lns_improve(
    jobs: &[JobInput],
    stations: &[StationInput],
    operators: &[OperatorInput],
    actions: &[Action],
    stats: &ScheduleStats,
    tick_minutes: u32,
    horizon_days: u32,
    start_date: NaiveDate,
    station_groups: &[StationGroupInput],
    station_blocked_ranges: &[Vec<(usize, usize)>],
    occupied_slots: &[(usize, Vec<usize>, usize, usize)],
    now_tick: usize,
    time_budget_ms: u64,
    progress: &super::ProgressSender,
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    if stats.late_job_count == 0 || time_budget_ms < 2000 {
        return None;
    }

    let start = Instant::now();
    let mut rng = StdRng::seed_from_u64(42);
    let default_weights: [f64; 6] = [1.0; 6];

    // Collect late jobs sorted by lateness descending
    let job_deadlines: HashMap<&str, u64> = jobs
        .iter()
        .filter_map(|j| {
            j.deadline.as_ref().and_then(|d| {
                super::parse_deadline_minutes(d, start_date)
                    .map(|mins| (j.id.as_str(), mins / tick_minutes as u64))
            })
        })
        .collect();

    let mut late_jobs: Vec<(String, u64)> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for action in actions {
        if let Some(end_tick) = action.end_tick {
            if let Some(&deadline_tick) = job_deadlines.get(action.job_id.as_str()) {
                if end_tick as u64 > deadline_tick && !seen.contains(&action.job_id) {
                    late_jobs.push((action.job_id.clone(), end_tick as u64 - deadline_tick));
                    seen.insert(action.job_id.clone());
                }
            }
        }
    }
    late_jobs.sort_by(|a, b| b.1.cmp(&a.1));

    // Build job → stations map
    let mut job_stations: HashMap<String, HashSet<usize>> = HashMap::new();
    for action in actions {
        job_stations
            .entry(action.job_id.clone())
            .or_default()
            .insert(action.station_idx);
    }

    let mut best_result: Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> = None;
    let mut best_score = (stats.late_job_count, stats.weighted_lateness_minutes);
    let mut total_iters: u32 = 0;
    let mut iteration = 0;

    // Cycle through different destroy sizes
    let destroy_sizes = [5, 10, 15, 20, 8, 12, 25];

    eprintln!("[LNS] starting: {} late jobs, {} total jobs, budget {}ms",
        late_jobs.len(), jobs.len(), time_budget_ms);

    while (start.elapsed().as_millis() as u64) < time_budget_ms {
        let destroy_count = destroy_sizes[iteration % destroy_sizes.len()];
        let n_destroy = destroy_count.min(late_jobs.len());

        if n_destroy == 0 {
            break;
        }

        // DESTROY: boost top N late jobs to imperative
        let destroyed: HashSet<&str> = late_jobs[..n_destroy]
            .iter()
            .map(|(id, _)| id.as_str())
            .collect();

        // Find stations used by destroyed jobs
        let affected_stations: HashSet<usize> = destroyed
            .iter()
            .flat_map(|&jid| job_stations.get(jid).cloned().unwrap_or_default())
            .collect();

        // DESTABILIZE: pick random on-time jobs on affected stations
        let late_set: HashSet<&str> = late_jobs.iter().map(|(id, _)| id.as_str()).collect();
        let mut sacrifice_candidates: Vec<&str> = jobs
            .iter()
            .filter(|j| !late_set.contains(j.id.as_str()))
            .filter(|j| {
                job_stations
                    .get(j.id.as_str())
                    .map(|stations| stations.iter().any(|s| affected_stations.contains(s)))
                    .unwrap_or(false)
            })
            .map(|j| j.id.as_str())
            .collect();

        // Randomly select 15-25 sacrifices
        let n_sacrifice = rng.gen_range(15..=30).min(sacrifice_candidates.len());
        // Fisher-Yates partial shuffle
        for i in 0..n_sacrifice.min(sacrifice_candidates.len()) {
            let j = rng.gen_range(i..sacrifice_candidates.len());
            sacrifice_candidates.swap(i, j);
        }
        let sacrificed: HashSet<&str> = sacrifice_candidates[..n_sacrifice]
            .iter()
            .copied()
            .collect();

        // REPAIR: create modified jobs with new priorities
        let modified_jobs: Vec<JobInput> = jobs
            .iter()
            .map(|j| {
                let mut m = j.clone();
                if destroyed.contains(j.id.as_str()) {
                    m.deadline_priority = 0; // imperative
                } else if sacrificed.contains(j.id.as_str()) {
                    m.deadline_priority = 3; // flexible
                }
                m
            })
            .collect();

        // Run full FBI with 1 iteration (skip convergence, fast)
        let (new_a, new_act, new_s, new_i) = run_with_fbi_ordering(
            &modified_jobs, stations, operators,
            tick_minutes, horizon_days, 1, // single FBI iteration
            start_date, BackwardOrdering::TierFirst,
            station_groups, station_blocked_ranges, occupied_slots,
            progress, now_tick, &default_weights,
        );
        total_iters += new_i;

        let new_score = (new_s.late_job_count, new_s.weighted_lateness_minutes);

        eprintln!("[LNS] iter {}: destroy={} sacrifice={} → {} late (best={})",
            iteration, n_destroy, n_sacrifice,
            new_s.late_job_count, best_score.0);

        if new_score < best_score {
            best_score = new_score;

            // Update late_jobs list from new result BEFORE moving into best_result
            late_jobs.clear();
            seen.clear();
            for action in &new_act {
                if let Some(end_tick) = action.end_tick {
                    if let Some(&deadline_tick) = job_deadlines.get(action.job_id.as_str()) {
                        if end_tick as u64 > deadline_tick && !seen.contains(&action.job_id) {
                            late_jobs.push((action.job_id.clone(), end_tick as u64 - deadline_tick));
                            seen.insert(action.job_id.clone());
                        }
                    }
                }
            }
            late_jobs.sort_by(|a, b| b.1.cmp(&a.1));

            best_result = Some((new_a, new_act, new_s, new_i));
        }

        iteration += 1;
    }

    if let Some(ref result) = best_result {
        eprintln!("[LNS] improved: {} → {} late jobs ({} iterations, {}ms)",
            stats.late_job_count, result.2.late_job_count, iteration,
            start.elapsed().as_millis());
    } else {
        eprintln!("[LNS] no improvement found ({} iterations, {}ms)",
            iteration, start.elapsed().as_millis());
    }

    best_result
}
