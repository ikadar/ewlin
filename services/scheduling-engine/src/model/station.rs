use serde::{Deserialize, Deserializer, Serialize};

use crate::model::operator::DaySchedule;

/// Per-date override of a station's operating schedule.
///
/// Encodes explicit exceptions such as maintenance windows, public holidays
/// or custom operating hours. Semantics:
///   - `type = "closed"` OR `schedule = null` OR `schedule.is_operating = false`
///     → the station is completely unavailable on `date`.
///   - `type = "custom"` with `schedule.slots` → the station is available ONLY
///     during those slots on `date`. Gaps between slots are blocked.
///
/// Base operating_schedule wiring is deferred to a later change; until then
/// a station with no exception on a date is considered always-available,
/// and effective availability is driven by operator availability.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleException {
    /// ISO date, e.g. "2026-04-25"
    pub date: String,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub schedule: Option<ExceptionSchedule>,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionSchedule {
    #[serde(default)]
    pub is_operating: bool,
    #[serde(default)]
    pub slots: Vec<crate::model::operator::TimeSlot>,
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
    /// Only consumes `schedule_exceptions`. Base weekly schedule wiring
    /// is deferred — stations without an exception on a date are
    /// considered always-available at this layer (actual availability
    /// is gated via the operators the task needs).
    pub fn blocked_ranges(
        &self,
        start_date: chrono::NaiveDate,
        horizon_days: u32,
        tick_minutes: u32,
    ) -> Vec<(usize, usize)> {
        use crate::model::operator::TimeSlot;
        let mut ranges = Vec::new();

        for exc in &self.schedule_exceptions {
            let date = match chrono::NaiveDate::parse_from_str(&exc.date, "%Y-%m-%d") {
                Ok(d) => d,
                Err(_) => continue,
            };
            let days_from_start = match (date - start_date).num_days() {
                d if d >= 0 && (d as u32) < horizon_days => d as u32,
                _ => continue,
            };

            let day_start_tick =
                (days_from_start as usize * 24 * 60) / tick_minutes as usize;
            let day_end_tick =
                ((days_from_start + 1) as usize * 24 * 60) / tick_minutes as usize;

            let fully_closed = exc.r#type.as_deref() == Some("closed")
                || match &exc.schedule {
                    None => true,
                    Some(sch) => !sch.is_operating || sch.slots.is_empty(),
                };

            if fully_closed {
                ranges.push((day_start_tick, day_end_tick));
                continue;
            }

            // Custom slots: block the gaps between slots.
            let slots: &Vec<TimeSlot> = &exc.schedule.as_ref().unwrap().slots;
            let mut cursor_minutes = 0u32;
            let mut sorted_slots = slots.clone();
            sorted_slots.sort_by_key(|s| s.start_minutes());
            for slot in &sorted_slots {
                let slot_start = slot.start_minutes();
                let slot_end = slot.end_minutes();
                if slot_start > cursor_minutes {
                    let gap_start_tick = day_start_tick
                        + (cursor_minutes as usize) / tick_minutes as usize;
                    let gap_end_tick = day_start_tick
                        + (slot_start as usize) / tick_minutes as usize;
                    if gap_end_tick > gap_start_tick {
                        ranges.push((gap_start_tick, gap_end_tick));
                    }
                }
                cursor_minutes = cursor_minutes.max(slot_end);
            }
            // Tail: from last slot end to midnight.
            let day_end_minutes: u32 = 24 * 60;
            if cursor_minutes < day_end_minutes {
                let tail_start_tick = day_start_tick
                    + (cursor_minutes as usize) / tick_minutes as usize;
                if day_end_tick > tail_start_tick {
                    ranges.push((tail_start_tick, day_end_tick));
                }
            }
        }

        ranges
    }
}

/// Silence unused import warning when not in use inside this module.
#[allow(dead_code)]
type _DayScheduleAlias = DaySchedule;

#[cfg(test)]
mod schedule_exception_tests {
    use super::*;
    use crate::model::operator::TimeSlot;

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

    fn start_date() -> chrono::NaiveDate {
        chrono::NaiveDate::from_ymd_opt(2026, 4, 20).unwrap()
    }

    #[test]
    fn no_exceptions_produces_no_ranges() {
        let s = make_station(vec![]);
        assert!(s.blocked_ranges(start_date(), 7, 60).is_empty());
    }

    #[test]
    fn closed_exception_blocks_full_day() {
        let s = make_station(vec![ScheduleException {
            date: "2026-04-21".into(),
            r#type: Some("closed".into()),
            schedule: None,
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        // Day 1 (2026-04-21) = ticks 24..48 with tick_minutes=60.
        assert_eq!(ranges, vec![(24, 48)]);
    }

    #[test]
    fn null_schedule_blocks_full_day() {
        let s = make_station(vec![ScheduleException {
            date: "2026-04-21".into(),
            r#type: Some("custom".into()),
            schedule: None,
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        assert_eq!(ranges, vec![(24, 48)]);
    }

    #[test]
    fn non_operating_schedule_blocks_full_day() {
        let s = make_station(vec![ScheduleException {
            date: "2026-04-21".into(),
            r#type: Some("custom".into()),
            schedule: Some(ExceptionSchedule {
                is_operating: false,
                slots: vec![],
            }),
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        assert_eq!(ranges, vec![(24, 48)]);
    }

    #[test]
    fn custom_slots_block_the_gaps() {
        // 2026-04-21: station operates 08:00-12:00 and 14:00-18:00 only.
        // Blocked: 00:00-08:00, 12:00-14:00, 18:00-24:00.
        let s = make_station(vec![ScheduleException {
            date: "2026-04-21".into(),
            r#type: Some("custom".into()),
            schedule: Some(ExceptionSchedule {
                is_operating: true,
                slots: vec![
                    TimeSlot { start: "08:00".into(), end: "12:00".into() },
                    TimeSlot { start: "14:00".into(), end: "18:00".into() },
                ],
            }),
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        assert_eq!(ranges, vec![(24, 32), (36, 38), (42, 48)]);
    }

    #[test]
    fn exception_outside_horizon_ignored() {
        let s = make_station(vec![ScheduleException {
            date: "2026-05-01".into(),
            r#type: Some("closed".into()),
            schedule: None,
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        assert!(ranges.is_empty());
    }

    #[test]
    fn exception_before_horizon_ignored() {
        let s = make_station(vec![ScheduleException {
            date: "2026-04-01".into(),
            r#type: Some("closed".into()),
            schedule: None,
            reason: None,
        }]);
        let ranges = s.blocked_ranges(start_date(), 7, 60);
        assert!(ranges.is_empty());
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
