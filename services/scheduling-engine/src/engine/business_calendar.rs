//! Business-day arithmetic for outsourced step scheduling.
//!
//! In its current form a "business day" is any weekday (Mon–Fri). National
//! holidays are deliberately *not* modelled here: per product decision
//! (2026-04-27), holiday handling will piggy-back on the existing
//! per-operator absence mechanism in a first iteration. A later release
//! may introduce a true holiday calendar if the absence-only model proves
//! insufficient.
//!
//! All functions operate on `chrono::NaiveDate` / `NaiveDateTime` and stay
//! free of any I/O, so they can be exercised exhaustively in unit tests
//! without fixtures.

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Weekday};

/// True when `date` falls on Mon–Fri.
pub fn is_business_day(date: NaiveDate) -> bool {
    !matches!(date.weekday(), Weekday::Sat | Weekday::Sun)
}

/// The next business day strictly after `from`'s date. If `from` is Friday
/// 23:59 the result is the following Monday; if `from` is a weekday the
/// result is the next weekday (Sat → Mon, Fri → Mon, Mon → Tue).
///
/// The time component of the returned datetime is the start of the day
/// (00:00:00) — callers are expected to overwrite it with the relevant
/// time-of-day (e.g. provider cutoff or reception time).
pub fn next_business_day(from: NaiveDateTime) -> NaiveDateTime {
    let mut d = from.date() + Duration::days(1);
    while !is_business_day(d) {
        d = d + Duration::days(1);
    }
    d.and_hms_opt(0, 0, 0).expect("midnight is always valid")
}

/// Add `n` business days to `from`. `n == 0` returns `from` unchanged.
/// When `from` already lies on a weekend, it is first rolled forward to
/// the next business day before the count begins — same behaviour as
/// PHP's `BusinessCalendarService::addBusinessDays` so a Rust port stays
/// drop-in.
pub fn add_business_days(from: NaiveDateTime, n: u32) -> NaiveDateTime {
    let mut date = from.date();
    let time = from.time();
    if !is_business_day(date) {
        date = next_business_day(from).date();
    }
    let mut remaining = n;
    while remaining > 0 {
        date = date + Duration::days(1);
        if is_business_day(date) {
            remaining -= 1;
        }
    }
    NaiveDateTime::new(date, time)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn d(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    fn dt(y: i32, m: u32, d: u32, hh: u32, mm: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(y, m, d).unwrap().and_hms_opt(hh, mm, 0).unwrap()
    }

    #[test]
    fn is_business_day_basic() {
        // 2026-04-27 = Monday, 2026-05-02 = Saturday, 2026-05-03 = Sunday
        assert!(is_business_day(d(2026, 4, 27)));
        assert!(is_business_day(d(2026, 4, 28)));
        assert!(is_business_day(d(2026, 5, 1)));  // Friday — yes, even though it's Labour Day
        assert!(!is_business_day(d(2026, 5, 2))); // Saturday
        assert!(!is_business_day(d(2026, 5, 3))); // Sunday
        assert!(is_business_day(d(2026, 5, 4)));  // Monday
    }

    #[test]
    fn next_business_day_skips_weekend() {
        // Friday 28/04 → Monday 04/05 (skip Sat 02/05 + Sun 03/05)
        // Wait: 2026-05-01 is a Friday. So Fri 1/5 14:00 → Mon 4/5 00:00
        let res = next_business_day(dt(2026, 5, 1, 14, 0));
        assert_eq!(res, dt(2026, 5, 4, 0, 0));
    }

    #[test]
    fn next_business_day_from_weekday_is_next_day() {
        // Wed 29/04 → Thu 30/04
        let res = next_business_day(dt(2026, 4, 29, 14, 0));
        assert_eq!(res, dt(2026, 4, 30, 0, 0));
    }

    #[test]
    fn next_business_day_from_saturday_is_monday() {
        let res = next_business_day(dt(2026, 5, 2, 10, 0));
        assert_eq!(res, dt(2026, 5, 4, 0, 0));
    }

    #[test]
    fn add_business_days_zero_is_identity() {
        let from = dt(2026, 4, 29, 14, 0);
        assert_eq!(add_business_days(from, 0), from);
    }

    #[test]
    fn add_business_days_skips_weekends() {
        // Wed 29/04 + 4 BD = Wed 29 → Thu 30 (1) → Fri 1/5 (2) → Mon 4/5 (3) → Tue 5/5 (4)
        // Time of day preserved.
        let res = add_business_days(dt(2026, 4, 29, 14, 0), 4);
        assert_eq!(res, dt(2026, 5, 5, 14, 0));
    }

    #[test]
    fn add_business_days_starting_on_weekend_rolls_forward_first() {
        // Sat 02/05 + 1 BD: roll Sat→Mon 04/05, then +1 = Tue 05/05
        let res = add_business_days(dt(2026, 5, 2, 10, 0), 1);
        assert_eq!(res, dt(2026, 5, 5, 10, 0));
    }
}
