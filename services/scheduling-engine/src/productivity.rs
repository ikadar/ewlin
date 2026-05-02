//! V2 progress capture — productivity ratio and dual-duration math.
//!
//! See `docs/operator-sandbox/progress-capture-design.md` § 4–5 and the memory
//! entries `project_calage_run_ratio` and `project_dual_duration_model` for the
//! design rationale. Highlights :
//!
//! - Productivity ratio = real / expected, computed on the **run portion only**
//!   (calage is bounded by machine + material, immune to operator pace).
//! - Each entity (Fragment / Task / Job) carries both a theoretical (immutable
//!   JCF) and realistic (live, calage-aware) duration.
//! - `realistic = setup + run × ratio_run` at fragment level. Task and Job
//!   roll up by simple summation — no extra storage needed.
//!
//! The functions here are **pure** : caller-driven inputs, no state. They're
//! ready to be plugged into the snapshot builder (PHP) or the replan loop
//! once the dual-duration fields land in `TaskInput`. Until then they live
//! standalone with unit tests, exercising the math in isolation.

/// Productivity ratio on the run portion of a fragment.
///
/// Given the operator's projected total duration (saisie d'avancement) for
/// a fragment whose JCF defines `(setup_min, planned_run_min)`, returns the
/// ratio `new_run / planned_run_min`. The ratio is what propagates to the
/// remaining fragments of the same job (their realistic run is multiplied).
///
/// Setup is treated as fixed : the projected total is presumed to include
/// the JCF setup unchanged ; only what's left scales with the operator's
/// pace. This avoids propagating phantom retard onto pure setup phases that
/// don't depend on operator productivity.
///
/// The function clamps `new_run` to a minimum of 1 minute to avoid producing
/// a degenerate `0.0` ratio that would zero-out subsequent fragments.
///
/// # Arguments
/// - `setup_min`         : fragment's planned setup duration (JCF)
/// - `planned_run_min`   : fragment's planned run duration (JCF)
/// - `projected_total_min` : operator-reported total duration for the fragment
///
/// Returns `1.0` (no propagation) when inputs are degenerate
/// (`planned_run_min == 0` or `projected_total_min <= setup_min`).
pub fn productivity_ratio_run_only(
    setup_min: u32,
    planned_run_min: u32,
    projected_total_min: u32,
) -> f64 {
    if planned_run_min == 0 {
        return 1.0;
    }
    let new_run_signed = projected_total_min as i64 - setup_min as i64;
    if new_run_signed <= 0 {
        return 1.0;
    }
    let new_run = new_run_signed as u32;
    new_run as f64 / planned_run_min as f64
}

/// Fragment realistic duration — `setup + run × ratio_run`, rounded to the
/// nearest minute. Setup is left untouched (calage neutral).
pub fn fragment_realistic_duration(setup_min: u32, run_min: u32, ratio_run: f64) -> u32 {
    let realistic_run = (run_min as f64 * ratio_run).round();
    let clamped = realistic_run.max(0.0) as u32;
    setup_min.saturating_add(clamped)
}

/// Task theoretical duration — sum of the fragments' (setup + planned run).
/// Uses the JCF inputs verbatim ; immutable once persisted.
pub fn task_theoretical_duration<I: IntoIterator<Item = (u32, u32)>>(fragments: I) -> u32 {
    fragments.into_iter().map(|(s, r)| s.saturating_add(r)).sum()
}

/// Task realistic duration — sum of the fragments' realistic durations.
/// Each fragment carries its own `ratio_run` (typically derived from the most
/// recent saisie on that fragment ; subsequent fragments inherit the ratio).
pub fn task_realistic_duration<I: IntoIterator<Item = (u32, u32, f64)>>(fragments: I) -> u32 {
    fragments
        .into_iter()
        .map(|(s, r, ratio)| fragment_realistic_duration(s, r, ratio))
        .sum()
}

/// Job theoretical duration — sum of its tasks' theoretical durations.
pub fn job_theoretical_duration<I: IntoIterator<Item = u32>>(task_durations: I) -> u32 {
    task_durations.into_iter().sum()
}

/// Job realistic duration — sum of its tasks' realistic durations.
pub fn job_realistic_duration<I: IntoIterator<Item = u32>>(task_durations: I) -> u32 {
    task_durations.into_iter().sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-9, "{} vs {}", a, b);
    }

    // ─── productivity_ratio_run_only ───────────────────────────────────

    #[test]
    fn ratio_on_time_returns_1() {
        // setup 30, run 120, projected total 150 → new_run = 120 → ratio 1.0
        assert_close(productivity_ratio_run_only(30, 120, 150), 1.0);
    }

    #[test]
    fn ratio_retard_increases_above_1() {
        // +30 min retard : projected 180 → new_run 150 → ratio 1.25
        assert_close(productivity_ratio_run_only(30, 120, 180), 1.25);
    }

    #[test]
    fn ratio_avance_below_1() {
        // -30 min avance : projected 120 → new_run 90 → ratio 0.75
        assert_close(productivity_ratio_run_only(30, 120, 120), 0.75);
    }

    #[test]
    fn ratio_when_planned_run_is_zero_returns_1() {
        // No run portion = no propagation possible
        assert_close(productivity_ratio_run_only(30, 0, 60), 1.0);
    }

    #[test]
    fn ratio_when_projected_below_setup_returns_1() {
        // Degenerate : operator says they finish before setup is even done
        // Treated as "no information about run" → no propagation
        assert_close(productivity_ratio_run_only(30, 120, 20), 1.0);
    }

    #[test]
    fn ratio_when_projected_equals_setup_returns_1() {
        // Boundary : new_run == 0 → degenerate
        assert_close(productivity_ratio_run_only(30, 120, 30), 1.0);
    }

    // ─── fragment_realistic_duration ───────────────────────────────────

    #[test]
    fn fragment_realistic_at_ratio_1_equals_theoretical() {
        assert_eq!(fragment_realistic_duration(30, 120, 1.0), 150);
    }

    #[test]
    fn fragment_realistic_scales_run_only() {
        // ratio 1.25 → run from 120 to 150, setup unchanged
        assert_eq!(fragment_realistic_duration(30, 120, 1.25), 180);
    }

    #[test]
    fn fragment_realistic_setup_unchanged_when_ratio_zero() {
        assert_eq!(fragment_realistic_duration(30, 120, 0.0), 30);
    }

    #[test]
    fn fragment_realistic_rounds_to_nearest_minute() {
        // 120 × 1.333... = 160 rounded
        let result = fragment_realistic_duration(30, 120, 1.3333333);
        assert_eq!(result, 30 + 160);
    }

    #[test]
    fn fragment_realistic_zero_setup() {
        assert_eq!(fragment_realistic_duration(0, 120, 1.5), 180);
    }

    // ─── task_theoretical_duration / task_realistic_duration ───────────

    #[test]
    fn task_theoretical_sums_fragment_setup_run_pairs() {
        let fragments = [(30, 120), (15, 60), (0, 90)];
        // (30+120) + (15+60) + (0+90) = 315
        assert_eq!(task_theoretical_duration(fragments), 315);
    }

    #[test]
    fn task_realistic_applies_ratio_per_fragment() {
        let fragments = [(30, 120, 1.0), (15, 60, 1.25), (0, 90, 0.75)];
        // (30 + 120) + (15 + 75) + (0 + 68) = 308 (68 = round(67.5))
        let expected = 150 + 90 + 68;
        assert_eq!(task_realistic_duration(fragments), expected);
    }

    #[test]
    fn task_realistic_pre_saisie_equals_theoretical() {
        // Before any saisie, ratio = 1.0 everywhere ⇒ realistic = theoretical
        let frags_theo = [(30, 120), (15, 60)];
        let frags_real = [(30, 120, 1.0), (15, 60, 1.0)];
        assert_eq!(
            task_theoretical_duration(frags_theo),
            task_realistic_duration(frags_real),
        );
    }

    #[test]
    fn task_realistic_empty_is_zero() {
        let frags: [(u32, u32, f64); 0] = [];
        assert_eq!(task_realistic_duration(frags), 0);
    }

    // ─── job_*_duration ───────────────────────────────────────────────

    #[test]
    fn job_theoretical_sums_tasks() {
        assert_eq!(job_theoretical_duration([150, 75, 90]), 315);
    }

    #[test]
    fn job_realistic_sums_tasks() {
        assert_eq!(job_realistic_duration([150, 90, 68]), 308);
    }

    #[test]
    fn job_durations_pre_saisie_equal() {
        // Each task at its theoretical duration, ratios all 1.0
        let task_theos = [150_u32, 75, 90];
        let task_reals: Vec<u32> = task_theos.iter().copied().collect();
        assert_eq!(
            job_theoretical_duration(task_theos),
            job_realistic_duration(task_reals),
        );
    }
}
