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

    // LNS is blind to the safety zone: it only sees actions that start
    // *after* the rolling freeze window, since intra-zone tiles are
    // pinned (`is_frozen_by_safety_zone == true`) and pre_place locks
    // them verbatim. Including them in late_jobs / job_stations /
    // sacrifice_candidates wastes destroy/destabilize cycles — the
    // repair cannot move what is pinned. Two consequences:
    //   - a late job whose last tile is intra-zone disappears from
    //     late_jobs (its tardiness is locked, nothing to repair);
    //   - a station that hosts only intra-zone tiles for a job is
    //     dropped from that job's footprint, narrowing the destabilize
    //     pool to stations with actual leverage.
    let mut late_jobs: Vec<(String, u64)> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for action in actions {
        if action.is_frozen_by_safety_zone {
            continue;
        }
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

    // Build job → stations map (still safety-zone-blind: we only
    // record stations from movable actions, otherwise sacrifice
    // candidates would include jobs that have nothing to lose).
    let mut job_stations: HashMap<String, HashSet<usize>> = HashMap::new();
    for action in actions {
        if action.is_frozen_by_safety_zone {
            continue;
        }
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
    let mut iteration = 0;

    // Cycle through different destroy sizes
    let destroy_sizes = [5, 10, 15, 20, 8, 12, 25];

    let frozen_action_count = actions.iter().filter(|a| a.is_frozen_by_safety_zone).count();
    eprintln!("[LNS] starting: {} late jobs (movable scope), {} total jobs, {} frozen actions skipped, budget {}ms",
        late_jobs.len(), jobs.len(), frozen_action_count, time_budget_ms);

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

        // Hard reject any FBI result that violates the station-capacity
        // invariant. Single-iteration FBI inside LNS occasionally leaves
        // residual overlaps when a long task spans a closure (the
        // station_active counter does not cover every traversed tick),
        // and those overlaps then survive bulkReplace persistence as
        // visually superposed tiles. A schedule with overlaps is
        // structurally invalid — never accept it regardless of stats.
        let overlap_count = count_station_overlaps(&new_a);
        let improved = overlap_count == 0 && is_strictly_better(&new_s, &best_stats_ref);

        eprintln!("[LNS] iter {}: destroy={} sacrifice={} → {} late (best={}) overlaps={} calage(sum {}, mean {:.1}, med {:.1})",
            iteration, n_destroy, n_sacrifice,
            new_s.late_job_count, best_stats_ref.late_job_count,
            overlap_count,
            new_s.calage_bonus_sum, new_s.calage_bonus_mean, new_s.calage_bonus_median);

        if overlap_count > 0 {
            eprintln!("[LNS] iter {}: REJECTED — repair produced {} station overlap(s); keeping previous best",
                iteration, overlap_count);
        }

        super::emit(progress, ProgressEvent::LnsIteration {
            iteration: iteration as u32 + 1,
            late_job_count: new_s.late_job_count,
            best_late_job_count: if improved { new_s.late_job_count } else { best_stats_ref.late_job_count },
            improved,
        });

        if improved {
            best_stats_ref = new_s.clone();

            // Update late_jobs list from new result BEFORE moving into best_result.
            // Same safety-zone filter as the initial build — never re-introduce
            // intra-zone late jobs here.
            late_jobs.clear();
            seen.clear();
            for action in &new_act {
                if action.is_frozen_by_safety_zone {
                    continue;
                }
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

/// Count pairs of assignments on the same station whose **active** time
/// ranges overlap. Zero means the schedule respects the station-capacity
/// invariant; any positive value is a structural defect.
///
/// "Active" here means: an assignment with `active_windows = Some(ws)` is
/// considered to occupy the union of `ws` rather than the
/// `[scheduled_start, scheduled_end)` envelope. This prevents false
/// positives when the forward pass chunk-splits a long task to route
/// around a pin: the merged envelope visually covers the pin, but the
/// task is genuinely inactive during the gap and should not count as a
/// capacity violation. An assignment with `active_windows = None` falls
/// back to the envelope, which is correct because that representation
/// implies the task is continuous.
///
/// Used by LNS as a hard-reject filter on FBI single-iteration repair
/// outputs. The forward-pass should never produce overlaps under multi-
/// iteration FBI, but with a single iteration (LNS hot path) residuals
/// occasionally slip through.
///
/// String comparison is sound for the engine's ISO-8601 timestamps:
/// `forward_pass` emits them in a single timezone offset, so lexical
/// sort matches chronological sort.
fn count_station_overlaps(assignments: &[ComputedAssignment]) -> usize {
    // Expand each assignment to its active intervals. A None active_windows
    // expands to a single interval = the envelope.
    let mut by_station: std::collections::HashMap<&str, Vec<(&str, &str)>> =
        std::collections::HashMap::new();
    for a in assignments {
        let entry = by_station.entry(a.station_id.as_str()).or_default();
        match a.active_windows.as_ref() {
            Some(windows) if !windows.is_empty() => {
                for w in windows {
                    entry.push((w.start.as_str(), w.end.as_str()));
                }
            }
            _ => {
                entry.push((a.scheduled_start.as_str(), a.scheduled_end.as_str()));
            }
        }
    }
    let mut count = 0usize;
    for items in by_station.values_mut() {
        items.sort_by(|a, b| a.0.cmp(b.0));
        for w in items.windows(2) {
            if w[1].0 < w[0].1 {
                count += 1;
            }
        }
    }
    count
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

    fn make_assignment(station_id: &str, start: &str, end: &str) -> ComputedAssignment {
        ComputedAssignment {
            task_id: format!("t-{}-{}", station_id, start),
            station_id: station_id.to_string(),
            scheduled_start: start.to_string(),
            scheduled_end: end.to_string(),
            operators: Vec::new(),
            setup_end: None,
            is_degraded: false,
            effective_productivity: 1.0,
            is_masked_time: false,
            recalages: Vec::new(),
            active_windows: None,
        }
    }

    fn make_assignment_with_windows(
        station_id: &str,
        start: &str,
        end: &str,
        windows: Vec<(&str, &str)>,
    ) -> ComputedAssignment {
        let mut a = make_assignment(station_id, start, end);
        a.active_windows = Some(
            windows
                .into_iter()
                .map(|(s, e)| crate::model::schedule::PhaseSegment {
                    start: s.to_string(),
                    end: e.to_string(),
                })
                .collect(),
        );
        a
    }

    #[test]
    fn overlap_count_empty_is_zero() {
        assert_eq!(count_station_overlaps(&[]), 0);
    }

    #[test]
    fn overlap_count_disjoint_same_station_is_zero() {
        let a = vec![
            make_assignment("s1", "2026-04-30T08:00:00+02:00", "2026-04-30T09:00:00+02:00"),
            make_assignment("s1", "2026-04-30T09:00:00+02:00", "2026-04-30T10:00:00+02:00"),
        ];
        assert_eq!(count_station_overlaps(&a), 0);
    }

    #[test]
    fn overlap_count_overlapping_same_station_is_one() {
        let a = vec![
            make_assignment("s1", "2026-04-30T08:00:00+02:00", "2026-04-30T10:00:00+02:00"),
            make_assignment("s1", "2026-04-30T09:00:00+02:00", "2026-04-30T11:00:00+02:00"),
        ];
        assert_eq!(count_station_overlaps(&a), 1);
    }

    #[test]
    fn overlap_count_overlapping_different_stations_is_zero() {
        let a = vec![
            make_assignment("s1", "2026-04-30T08:00:00+02:00", "2026-04-30T10:00:00+02:00"),
            make_assignment("s2", "2026-04-30T09:00:00+02:00", "2026-04-30T11:00:00+02:00"),
        ];
        assert_eq!(count_station_overlaps(&a), 0);
    }

    #[test]
    fn overlap_count_long_task_engulfing_short_task_detected() {
        // Reproduces the field-observed pattern: a 12h task overlaps a
        // shorter task that starts moments later on the same station.
        let a = vec![
            make_assignment("G37", "2026-04-30T06:15:00+02:00", "2026-04-30T18:15:00+02:00"),
            make_assignment("G37", "2026-04-30T06:30:00+02:00", "2026-04-30T09:00:00+02:00"),
        ];
        assert_eq!(count_station_overlaps(&a), 1);
    }

    #[test]
    fn overlap_count_overnight_traversal_with_morning_overlap() {
        // Long task spanning a night closure, short task placed after the
        // morning reopen but before the long task ends.
        let a = vec![
            make_assignment("Duplo10P", "2026-04-30T09:15:00+02:00", "2026-05-01T08:00:00+02:00"),
            make_assignment("Duplo10P", "2026-04-30T09:30:00+02:00", "2026-04-30T11:00:00+02:00"),
        ];
        assert_eq!(count_station_overlaps(&a), 1);
    }

    #[test]
    fn overlap_count_envelope_around_pin_is_not_an_overlap() {
        // The bug we are fixing: a chunk-split long task with two windows
        // around a safety-zone pin. The envelope visually covers the pin,
        // but the task is genuinely inactive during the gap. The pin is a
        // real assignment (None active_windows = continuous). Expected: 0.
        let mut long_task = make_assignment_with_windows(
            "754",
            "2026-04-30T07:00:00+02:00",
            "2026-04-30T18:15:00+02:00",
            vec![
                ("2026-04-30T07:00:00+02:00", "2026-04-30T07:15:00+02:00"),
                ("2026-04-30T09:45:00+02:00", "2026-04-30T18:15:00+02:00"),
            ],
        );
        long_task.task_id = "long".into();
        let mut pin = make_assignment(
            "754",
            "2026-04-30T07:15:00+02:00",
            "2026-04-30T09:45:00+02:00",
        );
        pin.task_id = "pin".into();
        let a = vec![long_task, pin];
        assert_eq!(count_station_overlaps(&a), 0);
    }

    #[test]
    fn overlap_count_chunk_window_actually_overlapping_pin_is_detected() {
        // Same shape as above but with a chunk that genuinely overlaps the
        // pin (engine bug). The fix must NOT silence this — the active
        // window itself overlaps the pin.
        let mut long_task = make_assignment_with_windows(
            "754",
            "2026-04-30T07:00:00+02:00",
            "2026-04-30T18:15:00+02:00",
            vec![
                ("2026-04-30T07:00:00+02:00", "2026-04-30T08:00:00+02:00"),
                ("2026-04-30T08:30:00+02:00", "2026-04-30T18:15:00+02:00"),
            ],
        );
        long_task.task_id = "long".into();
        let mut pin = make_assignment(
            "754",
            "2026-04-30T07:30:00+02:00",
            "2026-04-30T09:00:00+02:00",
        );
        pin.task_id = "pin".into();
        let a = vec![long_task, pin];
        // Pin overlaps both windows of long_task. After sort by start:
        //   [07:00..08:00) [07:30..09:00) [08:30..18:15) → 2 adjacent overlaps.
        assert_eq!(count_station_overlaps(&a), 2);
    }
}
