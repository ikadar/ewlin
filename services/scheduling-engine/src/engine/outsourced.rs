//! Date computation for outsourced scheduling steps.
//!
//! Single source of truth for the engine side. The PHP-side
//! `OutsourcedAutoAssignmentService` retains its own implementation for
//! incremental flows (drag-drop, single-task reschedule) where the engine
//! is not invoked, but the *compute pipeline* — both the dynamic gap used
//! to constrain successor placement AND the final (departure, return)
//! datetimes persisted on the assignment — flows through this module.
//!
//! Why this lives in Rust rather than being computed in PHP and shipped
//! to the engine as a fixed gap: the gap is a function of the
//! predecessor's actual end time, which only becomes known when the
//! engine places the predecessor. Pre-computing it requires either
//! pessimism (over-large gap, wastes capacity) or optimism (under-large
//! gap, silent precedence violation — the bug this module fixes). Doing
//! the math at forward-pass time is the only way to be both exact and
//! non-wasteful.

use chrono::{Duration, NaiveDate, NaiveDateTime, NaiveTime};

use crate::engine::business_calendar::{
    add_business_days, is_business_day, next_business_day,
};
use crate::model::job::OutsourcedParams;

/// Convert a tick offset (since `today_midnight`, in `tick_minutes` units)
/// to a `NaiveDateTime` in the same local timezone the rest of the engine
/// works with.
fn tick_to_datetime(
    tick: u64,
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> NaiveDateTime {
    today_midnight + Duration::minutes(tick as i64 * tick_minutes as i64)
}

/// Convert a `NaiveDateTime` back to a tick offset (since `today_midnight`,
/// rounded **up** so the resulting tick is never before `dt`). Returns 0
/// when `dt` is before `today_midnight` (shouldn't happen in practice but
/// keeps the function total).
fn datetime_to_tick_ceil(
    dt: NaiveDateTime,
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> u64 {
    let delta_seconds = (dt - today_midnight).num_seconds();
    if delta_seconds <= 0 {
        return 0;
    }
    let delta_minutes = (delta_seconds + 59) / 60; // round up to next minute
    let tm = tick_minutes as i64;
    ((delta_minutes + tm - 1) / tm) as u64
}

/// Apply a minute-of-day to a date. `minutes` is interpreted modulo 1440;
/// excess minutes spill into the date — useful when callers pass values
/// outside [0, 1440). For our cutoff/reception times the value is always
/// in-range, but the implementation is defensive.
fn date_at_minutes(date: NaiveDate, minutes: u32) -> NaiveDateTime {
    let h = (minutes / 60) % 24;
    let m = minutes % 60;
    NaiveDateTime::new(
        date,
        NaiveTime::from_hms_opt(h, m, 0).expect("valid hh:mm"),
    )
}

/// Result of placing a single outsourced step: the moment work leaves the
/// workshop and the moment it returns. The engine uses `return_dt` as the
/// floor for any successor task; PHP persists both as the assignment's
/// scheduledStart / scheduledEnd.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OutsourcedDates {
    pub departure_dt: NaiveDateTime,
    pub return_dt: NaiveDateTime,
}

/// Compute departure & return datetimes for one outsourced step given the
/// predecessor's actual end datetime and the provider's parameters.
///
/// Manual overrides take precedence:
///   - `manual_departure_tick` set → that tick is used as departure
///     (still feeds the auto-return formula unless `manual_return_tick`
///     is also set);
///   - `manual_return_tick` set → that tick is used as return verbatim,
///     ignoring the formula.
///
/// When both overrides are absent the formula is:
///   * Departure = same business day at `latest_departure_minutes` if
///     `predecessor_end` ends ≤ that cutoff AND that day is a business
///     day; otherwise the next business day at the cutoff time.
///   * Return = `add_business_days(departure, transit + work + transit)`
///     at `reception_minutes`.
///
/// The function is pure; the only inputs are its arguments.
pub fn compute_dates(
    predecessor_end: NaiveDateTime,
    params: &OutsourcedParams,
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> OutsourcedDates {
    // Manual departure short-circuits the cutoff logic but is still
    // routed through the same return-from-departure path so an operator
    // who pinned the departure but not the return still gets a
    // formula-derived return that respects business days.
    let departure_dt = match params.manual_departure_tick {
        Some(tick) => tick_to_datetime(tick as u64, today_midnight, tick_minutes),
        None => compute_departure(predecessor_end, params),
    };

    let return_dt = match params.manual_return_tick {
        Some(tick) => tick_to_datetime(tick as u64, today_midnight, tick_minutes),
        None => compute_return_from_departure(departure_dt, params),
    };

    OutsourcedDates { departure_dt, return_dt }
}

/// Convenience wrapper returning the *return tick* directly — the value
/// the forward pass needs to gate the successor's earliest start. The
/// returned tick is rounded **up**, matching the half-open semantics
/// `succ_start ≥ return_tick`.
pub fn compute_return_tick(
    predecessor_end_tick: u64,
    params: &OutsourcedParams,
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> u64 {
    let pred_dt = tick_to_datetime(predecessor_end_tick, today_midnight, tick_minutes);
    let dates = compute_dates(pred_dt, params, today_midnight, tick_minutes);
    datetime_to_tick_ceil(dates.return_dt, today_midnight, tick_minutes)
}

/// Walk a chain of outsourced steps in sequence order, threading the
/// running `predecessor_end` through each step's `compute_dates`. Returns
/// the per-step dates (in the same order) plus the final return tick that
/// constrains the chain's successor.
///
/// Why a chain is needed: an element may have `[Internal, ST_a, ST_b,
/// Internal]` where `ST_b` starts only after `ST_a` returns. The chain
/// walk yields `ST_b.return` from `ST_a.return`, which then becomes the
/// floor for the second Internal.
/// Convenience wrapper returning just the chain's terminal return tick —
/// the value the forward pass needs as the floor for the chain's
/// successor. Same logic as `compute_chain_dates` but discards the
/// intermediate per-step dates (which only matter for output emission).
pub fn compute_chain_return_tick(
    initial_predecessor_end_tick: u64,
    chain: &[OutsourcedParams],
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> u64 {
    let (_, final_tick) = compute_chain_dates(
        initial_predecessor_end_tick,
        chain,
        today_midnight,
        tick_minutes,
    );
    final_tick
}

pub fn compute_chain_dates(
    initial_predecessor_end_tick: u64,
    chain: &[OutsourcedParams],
    today_midnight: NaiveDateTime,
    tick_minutes: u32,
) -> (Vec<OutsourcedDates>, u64) {
    let mut running = tick_to_datetime(
        initial_predecessor_end_tick,
        today_midnight,
        tick_minutes,
    );
    let mut out = Vec::with_capacity(chain.len());
    for params in chain {
        let dates = compute_dates(running, params, today_midnight, tick_minutes);
        running = dates.return_dt;
        out.push(dates);
    }
    let final_tick = datetime_to_tick_ceil(running, today_midnight, tick_minutes);
    (out, final_tick)
}

// ---------------------------------------------------------------------------
// Private formula pieces
// ---------------------------------------------------------------------------

fn compute_departure(
    predecessor_end: NaiveDateTime,
    params: &OutsourcedParams,
) -> NaiveDateTime {
    let cutoff_minutes = params.latest_departure_minutes;
    let pred_minute_of_day = predecessor_end.time().hour() as u32 * 60
        + predecessor_end.time().minute() as u32;

    // Same business day if (a) work is done before the cutoff AND (b)
    // today is itself a business day.
    if pred_minute_of_day <= cutoff_minutes && is_business_day(predecessor_end.date()) {
        return date_at_minutes(predecessor_end.date(), cutoff_minutes);
    }
    let next_day = next_business_day(predecessor_end);
    date_at_minutes(next_day.date(), cutoff_minutes)
}

fn compute_return_from_departure(
    departure: NaiveDateTime,
    params: &OutsourcedParams,
) -> NaiveDateTime {
    let total_business_days =
        params.transit_days + params.work_days + params.transit_days;
    let return_date = add_business_days(departure, total_business_days);
    date_at_minutes(return_date.date(), params.reception_minutes)
}

// chrono trait import has to be local since we only need .hour()/.minute()
use chrono::Timelike;

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn dt(y: i32, m: u32, d: u32, hh: u32, mm: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(y, m, d).unwrap().and_hms_opt(hh, mm, 0).unwrap()
    }

    fn params(work_days: u32, transit_days: u32) -> OutsourcedParams {
        OutsourcedParams {
            provider_id: "p1".into(),
            work_days,
            transit_days,
            latest_departure_minutes: 14 * 60, // 14:00
            reception_minutes: 9 * 60,         // 09:00
            manual_departure_tick: None,
            manual_return_tick: None,
        }
    }

    #[test]
    fn departure_same_day_when_predecessor_before_cutoff_on_weekday() {
        // Tue 28/04/2026 10:00 → cutoff 14:00 → departure same day at 14:00
        let pred = dt(2026, 4, 28, 10, 0);
        let p = params(2, 1);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 15);
        assert_eq!(r.departure_dt, dt(2026, 4, 28, 14, 0));
    }

    #[test]
    fn departure_next_day_when_predecessor_after_cutoff() {
        // Tue 28/04/2026 14:15 (>14:00) → next BD = Wed 29/04 at 14:00
        // This is the exact scenario from the bug screenshot (job 4569).
        let pred = dt(2026, 4, 28, 14, 15);
        let p = params(2, 1);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 15);
        assert_eq!(r.departure_dt, dt(2026, 4, 29, 14, 0));
    }

    #[test]
    fn departure_after_cutoff_friday_skips_weekend() {
        // Fri 24/04/2026 14:15 → next BD = Mon 27/04 at 14:00
        let pred = dt(2026, 4, 24, 14, 15);
        let p = params(2, 1);
        let r = compute_dates(pred, &p, dt(2026, 4, 24, 0, 0), 15);
        assert_eq!(r.departure_dt, dt(2026, 4, 27, 14, 0));
    }

    #[test]
    fn departure_at_exact_cutoff_minute_is_same_day() {
        // Tue 28/04 at exactly 14:00 — cutoff is inclusive (≤).
        let pred = dt(2026, 4, 28, 14, 0);
        let p = params(2, 1);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 15);
        assert_eq!(r.departure_dt, dt(2026, 4, 28, 14, 0));
    }

    #[test]
    fn return_uses_business_days_at_reception_time() {
        // Departure Wed 29/04 14:00, transit=1 + work=2 + transit=1 = 4 BD
        // 29/04 → 30/04 (1) → 1/5 Fri (2) → 4/5 Mon (3) → 5/5 Tue (4) at 09:00.
        let pred = dt(2026, 4, 28, 14, 15);
        let p = params(2, 1);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 15);
        assert_eq!(r.departure_dt, dt(2026, 4, 29, 14, 0));
        assert_eq!(r.return_dt, dt(2026, 5, 5, 9, 0));
    }

    #[test]
    fn manual_departure_tick_overrides_formula() {
        // tick_minutes = 60, today_midnight = 27/04 00:00.
        // tick 86 = 27/04 + 86h = 30/04 14:00.
        let mut p = params(2, 1);
        p.manual_departure_tick = Some(86);
        let pred = dt(2026, 4, 28, 10, 0);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 60);
        assert_eq!(r.departure_dt, dt(2026, 4, 30, 14, 0));
        // Auto-return from 30/04 14:00, +4 BD = Thu 7/5? Let's verify:
        // 30/04 → 1/5 Fri (1) → 4/5 Mon (2) → 5/5 Tue (3) → 6/5 Wed (4) at 09:00
        assert_eq!(r.return_dt, dt(2026, 5, 6, 9, 0));
    }

    #[test]
    fn manual_return_tick_overrides_formula_completely() {
        // tick_minutes=60. Manual return tick 200 = 27/04 + 200h = 5/5 08:00
        let mut p = params(2, 1);
        p.manual_return_tick = Some(200);
        let pred = dt(2026, 4, 28, 14, 15);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 60);
        assert_eq!(r.departure_dt, dt(2026, 4, 29, 14, 0)); // formula-derived
        assert_eq!(r.return_dt, dt(2026, 5, 5, 8, 0));      // verbatim from manual
    }

    #[test]
    fn both_manual_overrides_used_verbatim() {
        let mut p = params(2, 1);
        p.manual_departure_tick = Some(40);  // 27/04 + 40h = 28/04 16:00
        p.manual_return_tick = Some(100);    // 27/04 + 100h = 1/5 04:00
        let pred = dt(2026, 4, 28, 10, 0);
        let r = compute_dates(pred, &p, dt(2026, 4, 27, 0, 0), 60);
        assert_eq!(r.departure_dt, dt(2026, 4, 28, 16, 0));
        assert_eq!(r.return_dt, dt(2026, 5, 1, 4, 0));
    }

    #[test]
    fn return_tick_helper_rounds_up() {
        // Predecessor end at tick 38 (27/04 Mon + 38h = 28/04 Tue 14:00
        // with tick_minutes=60). 14:00 == cutoff so same-day departure.
        // 28/04 14:00 + 4 BD (29 Wed, 30 Thu, 1/5 Fri, 4/5 Mon) at 09:00
        // = 04/05 09:00 = 27/04 + (7d*24h + 9h) = 177 ticks.
        let p = params(2, 1);
        let return_tick = compute_return_tick(38, &p, dt(2026, 4, 27, 0, 0), 60);
        assert_eq!(return_tick, 177);
    }

    #[test]
    fn chain_threads_running_predecessor_through_steps() {
        // Two ST steps in sequence, each 1 work day, 0 transit, cutoff
        // 14:00, reception 09:00. Initial predecessor end = Mon 27/04 10:00.
        // Step 1: dep Mon 27/04 14:00, return Tue 28/04 09:00.
        // Step 2 starts from Tue 28/04 09:00 (≤ cutoff) → dep Tue 28/04 14:00,
        //         return Wed 29/04 09:00.
        let p = OutsourcedParams {
            provider_id: "p".into(),
            work_days: 1,
            transit_days: 0,
            latest_departure_minutes: 14 * 60,
            reception_minutes: 9 * 60,
            manual_departure_tick: None,
            manual_return_tick: None,
        };
        let initial_tick = 10; // 27/04 + 10h
        let (steps, final_tick) =
            compute_chain_dates(initial_tick, &[p.clone(), p.clone()], dt(2026, 4, 27, 0, 0), 60);
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].return_dt, dt(2026, 4, 28, 9, 0));
        assert_eq!(steps[1].return_dt, dt(2026, 4, 29, 9, 0));
        // 29/04 09:00 = 27/04 + 57h
        assert_eq!(final_tick, 57);
    }
}
