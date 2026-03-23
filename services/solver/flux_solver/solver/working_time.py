"""Operating hours → blocked-interval generation for CP-SAT.

Approach: for each station, pre-compute non-working-time intervals (nights,
breaks, weekends, holidays) and add them as fixed intervals to NoOverlap.
The solver then naturally avoids scheduling tasks during non-working hours.

Operating schedule times are in **local time** (default: Europe/Paris).
All solver-internal times are in UTC minutes from reference_time.
This module converts local operating hours → UTC blocked intervals,
correctly handling CET/CEST DST transitions.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from flux_solver.models.snapshot import (
    DaySchedule,
    ScheduleException,
    Station,
    TimeSlot,
)

MINUTES_PER_DAY = 1440
DEFAULT_TIMEZONE = "Europe/Paris"
_UTC = ZoneInfo("UTC")


def parse_hhmm(s: str) -> int:
    """Parse "HH:MM" to minutes since midnight. Allows "24:00" → 1440."""
    parts = s.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def get_schedule_for_date(station: Station, d: date) -> DaySchedule:
    """Get the effective schedule for a station on a given date.

    Priority: exception > regular weekly schedule (mirrors PHP Station::getEffectiveScheduleForDate).
    """
    date_str = d.isoformat()  # "YYYY-MM-DD"
    for exc in (station.exceptions or []):
        if exc.date == date_str:
            return exc.schedule
    if station.operating_schedule is None:
        # No schedule = 24/7
        return DaySchedule(is_operating=True, slots=[TimeSlot(start="00:00", end="24:00")])
    dow = d.weekday()  # 0=Monday
    schedule = station.operating_schedule
    return [
        schedule.monday,
        schedule.tuesday,
        schedule.wednesday,
        schedule.thursday,
        schedule.friday,
        schedule.saturday,
        schedule.sunday,
    ][dow]


def _slot_to_utc_minutes(
    slot: TimeSlot,
    local_date: date,
    tz: ZoneInfo,
    reference_time: datetime,
) -> tuple[int, int] | None:
    """Convert a local-time slot to UTC minute offsets from reference_time.

    Returns (start_min, end_min) or None if the slot is degenerate.
    Handles DST transitions correctly by constructing timezone-aware datetimes.
    """
    start_hm = parse_hhmm(slot.start)
    end_hm = parse_hhmm(slot.end)

    h_s, m_s = divmod(start_hm, 60)
    h_e, m_e = divmod(end_hm, 60)

    # Handle 24:00 (end of day = next day midnight)
    if h_s >= 24:
        local_start = datetime(local_date.year, local_date.month, local_date.day, tzinfo=tz) + timedelta(days=1)
    else:
        local_start = datetime(local_date.year, local_date.month, local_date.day, h_s, m_s, tzinfo=tz)

    if h_e >= 24:
        local_end = datetime(local_date.year, local_date.month, local_date.day, tzinfo=tz) + timedelta(days=1)
    else:
        local_end = datetime(local_date.year, local_date.month, local_date.day, h_e, m_e, tzinfo=tz)

    utc_start = local_start.astimezone(_UTC).replace(tzinfo=None)
    utc_end = local_end.astimezone(_UTC).replace(tzinfo=None)

    start_min = int((utc_start - reference_time).total_seconds() / 60)
    end_min = int((utc_end - reference_time).total_seconds() / 60)

    if start_min < end_min:
        return (start_min, end_min)
    return None


def generate_blocked_intervals(
    station: Station,
    reference_time: datetime,
    horizon_minutes: int,
    tz_name: str = DEFAULT_TIMEZONE,
) -> list[tuple[int, int]]:
    """Generate non-working-time intervals for a station over the solve horizon.

    Operating schedule hours are interpreted in the given timezone (default
    Europe/Paris) and converted to UTC for the solver's internal timeline.

    Returns a sorted, merged list of (start_minute, end_minute) pairs
    representing times when the station cannot be used, relative to
    reference_time (which is in UTC).
    """
    tz = ZoneInfo(tz_name)
    horizon_end = reference_time + timedelta(minutes=horizon_minutes)

    # Determine the range of local dates to iterate
    ref_utc = reference_time.replace(tzinfo=_UTC)
    ref_local = ref_utc.astimezone(tz)
    end_utc = horizon_end.replace(tzinfo=_UTC)
    end_local = end_utc.astimezone(tz)

    current_date = ref_local.date()
    end_date = end_local.date() + timedelta(days=1)

    # Collect all working periods as UTC minute ranges
    working_periods: list[tuple[int, int]] = []

    while current_date <= end_date:
        schedule = get_schedule_for_date(station, current_date)

        if schedule.is_operating and schedule.slots:
            for slot in schedule.slots:
                period = _slot_to_utc_minutes(slot, current_date, tz, reference_time)
                if period is not None:
                    s, e = period
                    # Clamp to horizon
                    s = max(0, s)
                    e = min(e, horizon_minutes)
                    if s < e:
                        working_periods.append((s, e))

        current_date += timedelta(days=1)

    # Merge working periods
    working_periods = _merge_intervals(working_periods)

    # Invert: everything NOT in a working period is blocked
    blocked: list[tuple[int, int]] = []
    prev_end = 0
    for wp_start, wp_end in working_periods:
        if wp_start > prev_end:
            blocked.append((prev_end, wp_start))
        prev_end = max(prev_end, wp_end)
    if prev_end < horizon_minutes:
        blocked.append((prev_end, horizon_minutes))

    return blocked


def _merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Merge overlapping/adjacent intervals into minimal set."""
    if not intervals:
        return []
    sorted_iv = sorted(intervals)
    merged = [sorted_iv[0]]
    for s, e in sorted_iv[1:]:
        if s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def compute_outsourced_wall_minutes(open_days: int) -> int:
    """Compute approximate wall-clock minutes for outsourced task duration.

    Accounts for weekends: N business days ≈ N * 7/5 calendar days.
    """
    if open_days <= 0:
        return MINUTES_PER_DAY  # minimum 1 day
    calendar_days = math.ceil(open_days * 7 / 5)
    return calendar_days * MINUTES_PER_DAY
