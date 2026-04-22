use chrono::NaiveDateTime;
use serde::{Deserialize, Deserializer, Serialize};

/// A period of unavailability on a station (maintenance window, cleaning,
/// ad-hoc breakdown). Endpoints are inclusive — a moment `t` is covered iff
/// `start_at <= t <= end_at`. Same shape as [`crate::model::operator::Absence`]
/// so the two concepts unify structurally.
///
/// Base `operating_schedule` wiring is deferred; a station with no exception
/// covering a given moment is considered always-available at this layer,
/// and actual availability is gated via the operators the task needs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleException {
    #[serde(deserialize_with = "deserialize_naive_datetime")]
    pub start_at: NaiveDateTime,
    #[serde(deserialize_with = "deserialize_naive_datetime")]
    pub end_at: NaiveDateTime,
    #[serde(default)]
    pub reason: Option<String>,
}

fn deserialize_naive_datetime<'de, D>(deserializer: D) -> Result<NaiveDateTime, D::Error>
where
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M"))
        .map_err(serde::de::Error::custom)
}

/// Deserializer tolerating both missing field and explicit null.
fn deserialize_exceptions<'de, D>(deserializer: D) -> Result<Vec<ScheduleException>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<Vec<ScheduleException>>::deserialize(deserializer).map(|opt| opt.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationInput {
    pub id: String,
    pub name: String,
    pub attention_full: Option<f64>,
    pub attention_run: Option<f64>,
    /// Max useful attention during run phase for parallelizable (labor-paced) stations.
    /// When > attentionRun, extra operators speed up the task proportionally.
    /// Default = attentionRun (machine-paced, no benefit from extra operators).
    pub max_run_attention: Option<f64>,
    /// Whether this station can ever appear in an operator's concurrent
    /// group (i.e., whether masked-time pairing is allowed at all). The
    /// pair-specific productivity comes from the operator's group, not
    /// from the station — see operator concurrent_groups in Phase 2b.
    #[serde(default)]
    pub masked_time_enabled: bool,
    /// Deprecated: kept for backward-compat with old payloads. Ignored
    /// by the engine since Phase 2b.
    #[serde(default)]
    pub attention_masked: Option<f64>,
    /// Deprecated: kept for backward-compat with old payloads. Ignored
    /// by the engine since Phase 2b.
    #[serde(default)]
    pub masked_productivity: Option<f64>,
    pub tick_minutes: Option<u32>,
    pub peremption_threshold_minutes: Option<u32>,
    pub max_chunk_minutes: Option<u32>,
    /// Minimum-chunk-size setup multiplier (k). The scheduler refuses to
    /// start a task in a window shorter than `k * setup_ticks` so the
    /// setup cost is amortised by at least this much productive work.
    /// Default 2.0 = "setup ≤ 33% of total station occupation time".
    #[serde(default)]
    pub chunk_mini_setup_multiplier: Option<f64>,
    /// Minimum-chunk-size task-fraction (p). The scheduler refuses to
    /// start a task in a window smaller than `p * total_task_ticks`,
    /// which bounds the number of chunks a task can be broken into.
    /// Default 0.5 = "max 2 chunks for tasks smaller than max_chunk".
    /// Automatically capped by max_chunk_minutes — a chunk can never
    /// be required to be bigger than max_chunk.
    #[serde(default)]
    pub chunk_mini_task_percentage: Option<f64>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub similarity_criteria: Option<Vec<SimilarityCriterion>>,
    /// Scoring rules producing practicity points (Phase 3). Empty / None =
    /// no compatibility bonus is ever emitted for pairs on this station's
    /// category. Rules with a non-null `group` are mutually exclusive at
    /// best-in-group resolution; rules with `group = None` accumulate.
    #[serde(default)]
    pub similarity_score_rules: Option<Vec<SimilarityScoreRule>>,
    /// Whether this station is a press (requires drying time after printing)
    #[serde(default)]
    pub is_press: bool,
    /// Drying time in minutes after printing on this station (default: 240 = 4h)
    #[serde(default = "default_drying_time")]
    pub drying_time_minutes: u32,
    pub max_operators: Option<u32>,
    pub capacity: Option<u32>,
    /// Per-date schedule exceptions (maintenance, holidays, ad-hoc custom hours).
    /// Deserializes to an empty Vec when the JSON field is missing or null.
    #[serde(default, deserialize_with = "deserialize_exceptions")]
    pub schedule_exceptions: Vec<ScheduleException>,
}

impl StationInput {
    /// Compute the list of blocked tick ranges for this station over a
    /// horizon starting at `start_date`. Used by fbi.rs to pre-block
    /// grid ticks the station cannot occupy.
    ///
    /// Each exception `[start_at, end_at]` (endpoints inclusive) maps to
    /// a half-open tick range `[start_tick, end_tick)`. The tick
    /// containing `end_at` is itself blocked (the rightmost tick whose
    /// start ≤ end_at). Ranges outside the `[start_date, start_date +
    /// horizon_days)` horizon are clipped or dropped.
    pub fn blocked_ranges(
        &self,
        start_date: chrono::NaiveDate,
        horizon_days: u32,
        tick_minutes: u32,
    ) -> Vec<(usize, usize)> {
        let horizon_start = start_date.and_hms_opt(0, 0, 0).unwrap();
        let horizon_end = (start_date + chrono::Duration::days(horizon_days as i64))
            .and_hms_opt(0, 0, 0)
            .unwrap();
        let tick = tick_minutes as usize;
        let total_ticks = (horizon_days as usize * 24 * 60) / tick;

        let mut ranges = Vec::new();
        for exc in &self.schedule_exceptions {
            // Clip to horizon. End is inclusive so the last representable
            // moment within the horizon is `horizon_end - 1 minute`.
            let effective_start = exc.start_at.max(horizon_start);
            let horizon_last_moment = horizon_end - chrono::Duration::minutes(1);
            let effective_end = exc.end_at.min(horizon_last_moment);
            if effective_end < effective_start {
                continue;
            }

            let start_minutes = (effective_start - horizon_start).num_minutes();
            let end_minutes = (effective_end - horizon_start).num_minutes();
            if start_minutes < 0 {
                continue;
            }

            let start_tick = (start_minutes as usize) / tick;
            // Tick containing end_at (inclusive) is blocked, hence +1.
            let end_tick = ((end_minutes as usize) / tick + 1).min(total_ticks);

            if end_tick > start_tick {
                ranges.push((start_tick, end_tick));
            }
        }

        ranges
    }
}

#[cfg(test)]
mod schedule_exception_tests {
    use super::*;

    fn make_station(exceptions: Vec<ScheduleException>) -> StationInput {
        StationInput {
            id: "s1".into(),
            name: "Station".into(),
            attention_full: None,
            attention_run: None,
            max_run_attention: None,
            masked_time_enabled: false,
            attention_masked: None,
            masked_productivity: None,
            tick_minutes: Some(60),
            peremption_threshold_minutes: None,
            max_chunk_minutes: None,
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
            category_id: None,
            similarity_criteria: None,
            similarity_score_rules: None,
            is_press: false,
            drying_time_minutes: 240,
            max_operators: None,
            capacity: None,
            schedule_exceptions: exceptions,
        }
    }

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
    }

    fn start_date() -> chrono::NaiveDate {
        chrono::NaiveDate::from_ymd_opt(2026, 4, 20).unwrap()
    }

    #[test]
    fn no_exceptions_produces_no_ranges() {
        let s = make_station(vec![]);
        assert!(s.blocked_ranges(start_date(), 7, 60).is_empty());
    }

    #[test]
    fn full_day_period_blocks_full_day() {
        // 2026-04-21 entirely unavailable → ticks 24..48 with tick_minutes=60.
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-21T00:00:00"),
            end_at: dt("2026-04-21T23:59:00"),
            reason: None,
        }]);
        assert_eq!(s.blocked_ranges(start_date(), 7, 60), vec![(24, 48)]);
    }

    #[test]
    fn intraday_partial_period_blocks_expected_ticks() {
        // Unavailable 08:00 to 11:59 (just before noon) on 2026-04-21.
        // Ticks 32..36 (08:00-12:00).
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-21T08:00:00"),
            end_at: dt("2026-04-21T11:59:00"),
            reason: None,
        }]);
        assert_eq!(s.blocked_ranges(start_date(), 7, 60), vec![(32, 36)]);
    }

    #[test]
    fn multiple_periods_same_day_block_the_gaps() {
        // Mirrors the pre-refactor "custom slots" test but expressed
        // as three unavailable periods directly.
        let s = make_station(vec![
            ScheduleException { start_at: dt("2026-04-21T00:00:00"), end_at: dt("2026-04-21T07:59:00"), reason: None },
            ScheduleException { start_at: dt("2026-04-21T12:00:00"), end_at: dt("2026-04-21T13:59:00"), reason: None },
            ScheduleException { start_at: dt("2026-04-21T18:00:00"), end_at: dt("2026-04-21T23:59:00"), reason: None },
        ]);
        assert_eq!(
            s.blocked_ranges(start_date(), 7, 60),
            vec![(24, 32), (36, 38), (42, 48)]
        );
    }

    #[test]
    fn period_crossing_midnight_produces_single_range() {
        // 22:00 on day 0 → 02:00 on day 1 (inclusive).
        // Ticks 22..27 (22:00 day 0 through 03:00 day 1 exclusive).
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-20T22:00:00"),
            end_at: dt("2026-04-21T02:00:00"),
            reason: None,
        }]);
        assert_eq!(s.blocked_ranges(start_date(), 7, 60), vec![(22, 27)]);
    }

    #[test]
    fn period_starting_before_horizon_is_clipped() {
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-19T12:00:00"),
            end_at: dt("2026-04-20T12:00:00"),
            reason: None,
        }]);
        // Clipped start = horizon start (tick 0), end 12:00 day 0 → tick 13 exclusive.
        assert_eq!(s.blocked_ranges(start_date(), 7, 60), vec![(0, 13)]);
    }

    #[test]
    fn period_ending_after_horizon_is_clipped() {
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-26T12:00:00"),
            end_at: dt("2026-05-01T12:00:00"),
            reason: None,
        }]);
        // Horizon spans 7 days (168 ticks). Clipped end = 2026-04-26T23:59
        // (tick 167 inclusive, upper bound 168 exclusive).
        assert_eq!(s.blocked_ranges(start_date(), 7, 60), vec![(156, 168)]);
    }

    #[test]
    fn period_fully_outside_horizon_is_dropped() {
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-05-01T00:00:00"),
            end_at: dt("2026-05-01T23:59:00"),
            reason: None,
        }]);
        assert!(s.blocked_ranges(start_date(), 7, 60).is_empty());
    }

    #[test]
    fn period_before_horizon_is_dropped() {
        let s = make_station(vec![ScheduleException {
            start_at: dt("2026-04-01T00:00:00"),
            end_at: dt("2026-04-01T23:59:00"),
            reason: None,
        }]);
        assert!(s.blocked_ranges(start_date(), 7, 60).is_empty());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityCriterion {
    pub code: Option<String>,
    pub name: Option<String>,
    pub field_path: Option<String>,
}

/// A scoring rule for practicity computation between two consecutive jobs
/// on a station. Mirrors the PHP `App\ValueObject\SimilarityScoreRule` and
/// the TS `SimilarityScoreRule` from `@flux/types`. The evaluation logic
/// lives in {@link crate::engine::similarity}.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityScoreRule {
    pub criteria_codes: Vec<String>,
    pub points: f64,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub kind: RuleKind,
}

/// Rule evaluation kind. `AllMatch` (default) fires when every referenced
/// criterion is MATCHED between prev and curr specs. `FormatDescending`
/// fires when prev's paper format has a strictly greater long side than
/// curr's — used on Presses Offset (R4) to reward large→small transitions.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RuleKind {
    #[default]
    AllMatch,
    FormatDescending,
}

fn default_drying_time() -> u32 { 240 }

impl StationInput {
    pub fn effective_tick_minutes(&self) -> u32 {
        self.tick_minutes.unwrap_or(15)
    }

    pub fn effective_attention_full(&self) -> f64 {
        self.attention_full.unwrap_or(1.0)
    }

    pub fn effective_attention_run(&self) -> f64 {
        self.attention_run.unwrap_or(1.0)
    }

    pub fn effective_max_run_attention(&self) -> f64 {
        self.max_run_attention
            .unwrap_or_else(|| self.effective_attention_run())
            .max(self.effective_attention_run()) // can't be less than attention_run
    }

    pub fn effective_peremption(&self) -> u32 {
        self.peremption_threshold_minutes.unwrap_or(120)
    }

    pub fn effective_max_chunk(&self) -> u32 {
        self.max_chunk_minutes.unwrap_or(420)
    }

    /// k = "a chunk must produce at least k × setup_minutes of work to
    /// be economically worthwhile". Default 2.0.
    pub fn effective_chunk_mini_setup_multiplier(&self) -> f64 {
        self.chunk_mini_setup_multiplier.unwrap_or(2.0).max(0.0)
    }

    /// p = "no chunk should be shorter than p × total_task_minutes".
    /// Default 0.5 → max 2 chunks for tasks smaller than max_chunk.
    pub fn effective_chunk_mini_task_percentage(&self) -> f64 {
        self.chunk_mini_task_percentage.unwrap_or(0.5).clamp(0.0, 1.0)
    }

    pub fn effective_capacity(&self) -> u32 {
        self.capacity.unwrap_or(1).max(1)
    }

    pub fn effective_max_operators(&self) -> u32 {
        self.max_operators.unwrap_or_else(|| {
            // Must allow enough operators to meet attention_run
            let run_ops = self.effective_attention_run().ceil() as u32;
            let max_run_ops = self.effective_max_run_attention().ceil() as u32;
            run_ops.max(max_run_ops).max(1)
        })
    }
}
