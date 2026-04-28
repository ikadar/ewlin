use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use chrono::NaiveDate;
use rand::Rng;
use rand::rngs::StdRng;
use rand::SeedableRng;

use crate::model::job::JobInput;
use crate::model::operator::OperatorInput;
use crate::model::progress::ProgressEvent;
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
    cancel: Option<Arc<AtomicBool>>,
    precedence_min_gap_ticks: u32,
) -> Option<(Vec<ComputedAssignment>, Vec<Action>, ScheduleStats, u32)> {
    // Kept the original "no late jobs" guard because destroy/repair has
    // nothing to destroy. However the caller may now want LNS to run even
    // with 0 late jobs purely to improve calage bonus — see also the
    // secondary objective. For V1 we preserve the skip for performance;
    // revisit if users ask for calage-only LNS cycles.
    if stats.late_job_count == 0 || time_budget_ms < 2000 {
        return None;
    }

    let is_cancelled = |token: &Option<Arc<AtomicBool>>| -> bool {
        token.as_ref().map(|t| t.load(Ordering::Relaxed)).unwrap_or(false)
    };

    let start = Instant::now();
    let mut rng = StdRng::seed_from_u64(42);
    let default_weights: [f64; 7] = [1.0; 7];

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
    // Lexicographic objective:
    //   primary = late_job_count (minimise)
    //   secondary (at tied primary) = any-of strict improvement on
    //     (calage_bonus_sum, calage_bonus_mean, calage_bonus_median),
    //     i.e. at least one strictly higher and none lower.
    let mut best_stats_ref: ScheduleStats = stats.clone();
    let mut total_iters: u32 = 0;
    let mut iteration = 0;

    // Cycle through different destroy sizes
    let destroy_sizes = [5, 10, 15, 20, 8, 12, 25];

    eprintln!("[LNS] starting: {} late jobs, {} total jobs, budget {}ms",
        late_jobs.len(), jobs.len(), time_budget_ms);

    while (start.elapsed().as_millis() as u64) < time_budget_ms {
        // Early exit if the caller (e.g. a newer compute superseded us)
        // flips the cancel token. We bail out without committing the
        // current iteration; the best so far is still returned.
        if is_cancelled(&cancel) {
            eprintln!("[LNS] cancelled by caller at iter {}", iteration);
            break;
        }
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

        // Run full FBI with 1 iteration (skip convergence, fast).
        // Suppress FBI progress events (pass &None) to avoid flooding the modal.
        // Pin-displacement warnings are discarded here — multi_start_fbi has
        // already captured them; LNS recovery passes would only duplicate.
        let mut _lns_warnings: Vec<crate::model::schedule::Warning> = Vec::new();
        let (new_a, new_act, new_s, new_i) = run_with_fbi_ordering(
            &modified_jobs, stations, operators,
            tick_minutes, horizon_days, 1, // single FBI iteration
            start_date, BackwardOrdering::TierFirst,
            station_groups, station_blocked_ranges, occupied_slots,
            &None, now_tick, &default_weights,
            precedence_min_gap_ticks,
            &mut _lns_warnings,
        );
        total_iters += new_i;

        let improved = is_strictly_better(&new_s, &best_stats_ref);

        eprintln!("[LNS] iter {}: destroy={} sacrifice={} → {} late (best={}) calage(sum {}, mean {:.1}, med {:.1})",
            iteration, n_destroy, n_sacrifice,
            new_s.late_job_count, best_stats_ref.late_job_count,
            new_s.calage_bonus_sum, new_s.calage_bonus_mean, new_s.calage_bonus_median);

        super::emit(progress, ProgressEvent::LnsIteration {
            iteration: iteration as u32 + 1,
            late_job_count: new_s.late_job_count,
            best_late_job_count: if improved { new_s.late_job_count } else { best_stats_ref.late_job_count },
            improved,
        });

        if improved {
            best_stats_ref = new_s.clone();

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

    let lns_improved = best_result.is_some();
    if let Some(ref result) = best_result {
        eprintln!("[LNS] improved: {} → {} late jobs ({} iterations, {}ms)",
            stats.late_job_count, result.2.late_job_count, iteration,
            start.elapsed().as_millis());
    } else {
        eprintln!("[LNS] no improvement found ({} iterations, {}ms)",
            iteration, start.elapsed().as_millis());
    }

    super::emit(progress, ProgressEvent::LnsDone {
        iterations: iteration as u32,
        best_late_job_count: best_stats_ref.late_job_count,
        improved: lns_improved,
    });

    best_result
}

/// Lexicographic "strictly better" check for the LNS objective.
///
/// Primary: unplaced_count (= total_tasks − scheduled_tasks). A schedule
/// that leaves tasks un-end-ticked (forward-pass `max_outer_t` bailout,
/// infeasible pin window, etc.) is strictly worse than one that placed
/// every task — the missing task simply doesn't ship. Catching this here
/// also prevents LNS from "improving" by destroying repair capacity.
///
/// Secondary: late_job_count. A strict decrease is always better.
/// A strict increase is always worse. When tied, fall through.
///
/// Tertiary (at equal late_job_count): any-of strict improvement on
/// calage bonus metrics (sum, mean, median). At least one of the three
/// must be strictly greater than the reference AND none of the three
/// may be strictly smaller.
pub(crate) fn is_strictly_better(candidate: &ScheduleStats, reference: &ScheduleStats) -> bool {
    let candidate_unplaced = candidate.total_tasks - candidate.scheduled_tasks;
    let reference_unplaced = reference.total_tasks - reference.scheduled_tasks;
    if candidate_unplaced < reference_unplaced {
        return true;
    }
    if candidate_unplaced > reference_unplaced {
        return false;
    }
    if candidate.late_job_count < reference.late_job_count {
        return true;
    }
    if candidate.late_job_count > reference.late_job_count {
        return false;
    }
    // Equal late_job_count — any-of strict on calage bonus triple.
    let sum_cmp = candidate.calage_bonus_sum.cmp(&reference.calage_bonus_sum);
    let mean_cmp = candidate.calage_bonus_mean.partial_cmp(&reference.calage_bonus_mean);
    let median_cmp = candidate.calage_bonus_median.partial_cmp(&reference.calage_bonus_median);

    // If any metric is worse (Less), reject.
    if sum_cmp == std::cmp::Ordering::Less { return false; }
    if matches!(mean_cmp, Some(std::cmp::Ordering::Less)) { return false; }
    if matches!(median_cmp, Some(std::cmp::Ordering::Less)) { return false; }

    // At least one must be strictly better (Greater).
    let any_strict = sum_cmp == std::cmp::Ordering::Greater
        || matches!(mean_cmp, Some(std::cmp::Ordering::Greater))
        || matches!(median_cmp, Some(std::cmp::Ordering::Greater));
    any_strict
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_stats(late: u32, sum: u64, mean: f64, median: f64) -> ScheduleStats {
        ScheduleStats {
            makespan_minutes: 0,
            total_tasks: 0,
            scheduled_tasks: 0,
            deadline_violations: 0,
            late_task_count: 0,
            total_lateness_minutes: 0,
            late_job_count: late,
            weighted_lateness_minutes: 0,
            weighted_late_job_count: 0,
            late_job_ids: Vec::new(),
            calage_bonus_sum: sum,
            calage_bonus_mean: mean,
            calage_bonus_median: median,
        }
    }

    #[test]
    fn primary_lateness_decrease_wins() {
        let cand = make_stats(3, 100, 50.0, 0.0);
        let refr = make_stats(5, 500, 80.0, 100.0);
        assert!(is_strictly_better(&cand, &refr));
    }

    #[test]
    fn primary_lateness_increase_loses() {
        let cand = make_stats(5, 10_000, 99.9, 100.0);
        let refr = make_stats(3, 100, 50.0, 0.0);
        assert!(!is_strictly_better(&cand, &refr));
    }

    #[test]
    fn any_of_strict_accepts_single_gain() {
        let cand = make_stats(3, 200, 50.0, 50.0); // sum ↑
        let refr = make_stats(3, 100, 50.0, 50.0);
        assert!(is_strictly_better(&cand, &refr));
    }

    #[test]
    fn any_of_strict_rejects_any_regression() {
        // Mean drops even though sum and median rise — regression.
        let cand = make_stats(3, 200, 40.0, 100.0);
        let refr = make_stats(3, 100, 50.0, 50.0);
        assert!(!is_strictly_better(&cand, &refr));
    }

    #[test]
    fn equal_everything_not_better() {
        let cand = make_stats(3, 100, 50.0, 50.0);
        let refr = make_stats(3, 100, 50.0, 50.0);
        assert!(!is_strictly_better(&cand, &refr));
    }
}
