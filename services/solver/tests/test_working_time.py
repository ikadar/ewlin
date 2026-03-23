"""Tests for working time blocked interval generation."""

from datetime import datetime

from flux_solver.models.snapshot import (
    DaySchedule,
    OperatingSchedule,
    Station,
    ScheduleException,
    TimeSlot,
)
from flux_solver.solver.working_time import (
    generate_blocked_intervals,
    parse_hhmm,
    compute_outsourced_wall_minutes,
)


def _station(schedule: OperatingSchedule, exceptions=None) -> Station:
    return Station(
        id="s1", name="Test", status="Available",
        category_id="c1", group_id="g1", capacity=1,
        display_order=0, operating_schedule=schedule,
        exceptions=exceptions or [],
    )


def _standard_schedule() -> OperatingSchedule:
    """Mon-Fri 06:00-12:00, 13:00-17:00 (standard workday with lunch break)."""
    workday = DaySchedule(
        is_operating=True,
        slots=[TimeSlot(start="06:00", end="12:00"), TimeSlot(start="13:00", end="17:00")],
    )
    off = DaySchedule(is_operating=False, slots=[])
    return OperatingSchedule(
        monday=workday, tuesday=workday, wednesday=workday,
        thursday=workday, friday=workday, saturday=off, sunday=off,
    )


def _single_shift_schedule(start: str = "07:00", end: str = "14:00") -> OperatingSchedule:
    """Mon-Fri single shift."""
    workday = DaySchedule(
        is_operating=True,
        slots=[TimeSlot(start=start, end=end)],
    )
    off = DaySchedule(is_operating=False, slots=[])
    return OperatingSchedule(
        monday=workday, tuesday=workday, wednesday=workday,
        thursday=workday, friday=workday, saturday=off, sunday=off,
    )


def _24_7_schedule() -> OperatingSchedule:
    day = DaySchedule(is_operating=True, slots=[TimeSlot(start="00:00", end="24:00")])
    return OperatingSchedule(
        monday=day, tuesday=day, wednesday=day, thursday=day,
        friday=day, saturday=day, sunday=day,
    )


class TestParseHhmm:
    def test_midnight(self):
        assert parse_hhmm("00:00") == 0

    def test_noon(self):
        assert parse_hhmm("12:00") == 720

    def test_end_of_day(self):
        assert parse_hhmm("24:00") == 1440

    def test_arbitrary(self):
        assert parse_hhmm("13:45") == 825


class TestBlockedIntervals:
    def test_24_7_has_no_blocks(self):
        """24/7 station should have no blocked intervals."""
        station = _station(_24_7_schedule())
        ref = datetime(2026, 3, 18, 8, 0)  # 08:00 UTC
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="UTC")
        assert blocks == []

    def test_24_7_has_no_blocks_with_timezone(self):
        """24/7 station should have no blocked intervals regardless of timezone."""
        station = _station(_24_7_schedule())
        ref = datetime(2026, 3, 18, 8, 0)
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="Europe/Paris")
        assert blocks == []

    def test_standard_workday_blocks_overnight_and_lunch_utc(self):
        """Standard workday (06:00-12:00, 13:00-17:00) in UTC should block overnight and lunch."""
        station = _station(_standard_schedule())
        # Monday 06:00 UTC
        ref = datetime(2026, 3, 16, 6, 0)
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="UTC")

        # Expected blocks from ref (Mon 06:00 UTC):
        # - Mon 12:00-13:00 UTC (lunch) = minutes 360-420
        # - Mon 17:00 UTC onwards (overnight) = minutes 660-1440
        assert len(blocks) >= 2
        lunch_found = any(s == 360 and e == 420 for s, e in blocks)
        assert lunch_found, f"Lunch block not found in {blocks}"

    def test_weekend_fully_blocked_utc(self):
        """Saturday and Sunday should be fully blocked with standard schedule."""
        station = _station(_standard_schedule())
        # Friday 17:00 UTC → weekend should be blocked
        ref = datetime(2026, 3, 20, 17, 0)
        blocks = generate_blocked_intervals(station, ref, 3 * 1440, tz_name="UTC")

        # From Fri 17:00 UTC: everything until Mon 06:00 UTC should be blocked
        # That's 61 hours = 3660 minutes
        assert blocks[0][0] == 0
        assert blocks[0][1] == 3660

    def test_exception_overrides_regular(self):
        """Schedule exception should override regular schedule."""
        exc = ScheduleException(
            id="2026-03-18",
            date="2026-03-18",
            schedule=DaySchedule(is_operating=False, slots=[]),
            reason="Holiday",
        )
        station = _station(_standard_schedule(), exceptions=[exc])
        ref = datetime(2026, 3, 18, 0, 0)
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="UTC")

        # Entire day should be blocked
        assert blocks[0] == (0, 1440)

    def test_blocks_are_sorted_and_merged(self):
        """Blocks should be sorted and adjacent blocks merged."""
        station = _station(_standard_schedule())
        ref = datetime(2026, 3, 16, 0, 0)
        blocks = generate_blocked_intervals(station, ref, 2 * 1440, tz_name="UTC")

        for i in range(len(blocks) - 1):
            assert blocks[i][1] <= blocks[i + 1][0], "Blocks should not overlap"


class TestTimezoneConversion:
    """Test that local operating hours are correctly converted to UTC."""

    def test_cet_station_shifts_by_one_hour(self):
        """Station with 07:00-14:00 CET should map to 06:00-13:00 UTC in winter."""
        station = _station(_single_shift_schedule("07:00", "14:00"))
        # Wednesday 2026-03-18 06:00 UTC (07:00 CET, still winter time)
        ref = datetime(2026, 3, 18, 6, 0)
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="Europe/Paris")

        # Operating window: 06:00-13:00 UTC (= 07:00-14:00 CET)
        # First working period starts at ref (minute 0 = 06:00 UTC)
        # Working ends at 13:00 UTC = minute 420

        # The first block should be the overnight after 13:00 UTC
        # No block before minute 0 since we start exactly at opening time

        # Verify no block covers the working window (0-420)
        for blk_start, blk_end in blocks:
            # No block should overlap with [0, 420]
            assert blk_end <= 0 or blk_start >= 420, \
                f"Block ({blk_start}, {blk_end}) overlaps working window [0, 420]"

        # Verify there IS a block starting at minute 420 (13:00 UTC = 14:00 CET = closing)
        block_starts = [s for s, _ in blocks]
        assert 420 in block_starts, f"Expected block at minute 420, got blocks: {blocks}"

    def test_cet_no_work_before_local_opening(self):
        """Tasks should not be schedulable before local opening time."""
        station = _station(_single_shift_schedule("07:00", "14:00"))
        # Reference at 04:00 UTC = 05:00 CET (before opening)
        ref = datetime(2026, 3, 18, 4, 0)
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="Europe/Paris")

        # 04:00-06:00 UTC = 05:00-07:00 CET should be blocked
        # That's minutes 0-120 from reference
        assert blocks[0][0] == 0, "Should start blocking from minute 0"
        assert blocks[0][1] >= 120, \
            f"Block should cover at least until minute 120 (06:00 UTC), got end={blocks[0][1]}"

    def test_cet_operating_window_correct(self):
        """Verify the exact UTC operating window for a CET station."""
        station = _station(_single_shift_schedule("06:00", "19:00"))
        # Reference at midnight UTC on a weekday
        ref = datetime(2026, 3, 18, 0, 0)  # Wednesday
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="Europe/Paris")

        # 06:00-19:00 CET = 05:00-18:00 UTC (CET = UTC+1 in March before DST)
        # Block: 00:00-05:00 UTC = minutes 0-300
        # Working: 05:00-18:00 UTC = minutes 300-1080
        # Block: 18:00-24:00 UTC = minutes 1080-1440

        assert blocks[0] == (0, 300), f"Expected pre-opening block (0, 300), got {blocks[0]}"
        # After-closing block
        closing_blocks = [b for b in blocks if b[0] >= 1080]
        assert len(closing_blocks) >= 1, f"Expected post-closing block, got {blocks}"
        assert closing_blocks[0][0] == 1080, f"Expected closing at 1080, got {closing_blocks[0]}"

    def test_cest_after_dst_switch(self):
        """After DST switch (CEST = UTC+2), operating hours shift by 2h."""
        station = _station(_single_shift_schedule("07:00", "14:00"))
        # 2026-03-30 is Monday, after DST switch (March 29 is the switch)
        ref = datetime(2026, 3, 30, 4, 0)  # Monday 04:00 UTC = 06:00 CEST
        blocks = generate_blocked_intervals(station, ref, 1440, tz_name="Europe/Paris")

        # 07:00-14:00 CEST = 05:00-12:00 UTC
        # From ref at 04:00 UTC: working starts at minute 60 (05:00 UTC)
        # Working ends at minute 480 (12:00 UTC)
        assert blocks[0][0] == 0, "Should start blocking from minute 0"
        assert blocks[0][1] == 60, \
            f"Pre-opening block should end at minute 60 (05:00 UTC), got {blocks[0][1]}"

        # After working hours block
        closing_blocks = [b for b in blocks if b[0] >= 480]
        assert len(closing_blocks) >= 1
        assert closing_blocks[0][0] == 480, \
            f"Post-closing block should start at minute 480 (12:00 UTC), got {closing_blocks[0][0]}"

    def test_weekend_blocked_with_timezone(self):
        """Weekends should be fully blocked even with timezone conversion."""
        station = _station(_single_shift_schedule("07:00", "14:00"))
        # Friday 14:00 CET = 13:00 UTC
        ref = datetime(2026, 3, 20, 13, 0)
        blocks = generate_blocked_intervals(station, ref, 3 * 1440, tz_name="Europe/Paris")

        # From Fri 13:00 UTC (14:00 CET = closing): blocked until Mon 06:00 UTC (07:00 CET)
        # That's Fri 13:00 → Mon 06:00 = 65 hours = 3900 minutes
        assert blocks[0][0] == 0, "Should start blocking immediately (station just closed)"
        assert blocks[0][1] >= 3900, \
            f"Weekend block should extend at least to minute 3900, got {blocks[0][1]}"


class TestOutsourcedDuration:
    def test_1_day(self):
        minutes = compute_outsourced_wall_minutes(1)
        assert minutes == 2 * 1440  # ceil(1 * 7/5) = 2 calendar days

    def test_5_days(self):
        minutes = compute_outsourced_wall_minutes(5)
        assert minutes == 7 * 1440  # 5 business days = 7 calendar days

    def test_0_days(self):
        minutes = compute_outsourced_wall_minutes(0)
        assert minutes == 1440  # minimum 1 day
