use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorInput {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    #[serde(default = "default_role")]
    pub role: String,
    #[serde(default)]
    pub operating_schedule: Option<OperatingSchedule>,
    #[serde(default)]
    pub skills: Vec<OperatorSkill>,
    /// Pairs of stations this operator can run concurrently (masked time).
    /// Empty for operators who never run two machines simultaneously.
    /// Currently ignored by the engine — Phase 1 ingestion only.
    #[serde(default)]
    pub concurrent_groups: Vec<ConcurrentGroupInput>,
}

/// A pair of stations an operator can run concurrently, with a per-station
/// effective productivity for that pair.
///
/// The productivity is per-station-within-the-pair: e.g. an operator running
/// SBG with MBO XL may achieve 0.85 on SBG and 0.90 on MBO XL, while the
/// same operator running SBG with MBO XS may have different values for SBG
/// and MBO XS. Productivity ∈ [0.0, 1.5] (>1.0 is "expert on this pairing").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConcurrentGroupInput {
    /// Exactly 2 station UUIDs.
    pub station_ids: Vec<String>,
    /// Map of stationId → productivity. Keys must equal station_ids.
    pub effective_productivity: HashMap<String, f64>,
}

impl ConcurrentGroupInput {
    /// Validate the group's invariants. Called during input validation,
    /// not at deserialization time, to keep error messages contextual.
    pub fn validate(&self, operator_id: &str) -> Result<(), String> {
        if self.station_ids.len() != 2 {
            return Err(format!(
                "operator {operator_id}: concurrent group must contain exactly 2 stations, got {}",
                self.station_ids.len()
            ));
        }

        if self.station_ids[0] == self.station_ids[1] {
            return Err(format!(
                "operator {operator_id}: concurrent group station IDs must be distinct"
            ));
        }

        if self.effective_productivity.len() != 2 {
            return Err(format!(
                "operator {operator_id}: effectiveProductivity must contain exactly 2 entries, got {}",
                self.effective_productivity.len()
            ));
        }

        for station_id in &self.station_ids {
            if !self.effective_productivity.contains_key(station_id) {
                return Err(format!(
                    "operator {operator_id}: effectiveProductivity is missing entry for station {station_id}"
                ));
            }
        }

        for (station_id, &productivity) in &self.effective_productivity {
            if !(0.0..=1.5).contains(&productivity) {
                return Err(format!(
                    "operator {operator_id}: effectiveProductivity[{station_id}] = {productivity} is out of range [0.0, 1.5]"
                ));
            }
        }

        Ok(())
    }
}

fn default_role() -> String {
    "operator".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorSkill {
    pub station_id: String,
    #[serde(default = "default_proficiency")]
    pub proficiency: f64,
}

fn default_proficiency() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatingSchedule {
    #[serde(default)]
    pub monday: Option<DaySchedule>,
    #[serde(default)]
    pub tuesday: Option<DaySchedule>,
    #[serde(default)]
    pub wednesday: Option<DaySchedule>,
    #[serde(default)]
    pub thursday: Option<DaySchedule>,
    #[serde(default)]
    pub friday: Option<DaySchedule>,
    #[serde(default)]
    pub saturday: Option<DaySchedule>,
    #[serde(default)]
    pub sunday: Option<DaySchedule>,
}

impl OperatingSchedule {
    pub fn day_schedule(&self, weekday: chrono::Weekday) -> Option<&DaySchedule> {
        match weekday {
            chrono::Weekday::Mon => self.monday.as_ref(),
            chrono::Weekday::Tue => self.tuesday.as_ref(),
            chrono::Weekday::Wed => self.wednesday.as_ref(),
            chrono::Weekday::Thu => self.thursday.as_ref(),
            chrono::Weekday::Fri => self.friday.as_ref(),
            chrono::Weekday::Sat => self.saturday.as_ref(),
            chrono::Weekday::Sun => self.sunday.as_ref(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DaySchedule {
    #[serde(default)]
    pub slots: Vec<TimeSlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSlot {
    pub start: String,
    pub end: String,
}

impl TimeSlot {
    /// Parse "HH:MM" to minutes since midnight
    pub fn start_minutes(&self) -> u32 {
        parse_hhmm(&self.start)
    }

    pub fn end_minutes(&self) -> u32 {
        parse_hhmm(&self.end)
    }
}

fn parse_hhmm(s: &str) -> u32 {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() >= 2 {
        let h: u32 = parts[0].parse().unwrap_or(0);
        let m: u32 = parts[1].parse().unwrap_or(0);
        h * 60 + m
    } else {
        0
    }
}

impl OperatorInput {
    pub fn proficiency_for(&self, station_id: &str) -> Option<f64> {
        self.skills
            .iter()
            .find(|s| s.station_id == station_id)
            .map(|s| s.proficiency)
    }

    pub fn full_name(&self) -> String {
        format!("{} {}", self.first_name, self.last_name)
    }
}

#[cfg(test)]
mod concurrent_group_tests {
    use super::*;

    fn make_group(stations: &[&str], productivities: &[(&str, f64)]) -> ConcurrentGroupInput {
        ConcurrentGroupInput {
            station_ids: stations.iter().map(|s| s.to_string()).collect(),
            effective_productivity: productivities
                .iter()
                .map(|(s, p)| (s.to_string(), *p))
                .collect(),
        }
    }

    #[test]
    fn valid_pair_passes() {
        let g = make_group(&["sbg", "mbo-xl"], &[("sbg", 0.85), ("mbo-xl", 0.90)]);
        assert!(g.validate("op-1").is_ok());
    }

    #[test]
    fn productivity_above_one_is_allowed() {
        let g = make_group(&["sbg", "mbo-xl"], &[("sbg", 1.3), ("mbo-xl", 0.85)]);
        assert!(g.validate("op-1").is_ok());
    }

    #[test]
    fn rejects_single_station() {
        let g = make_group(&["sbg"], &[("sbg", 0.9)]);
        let err = g.validate("op-1").unwrap_err();
        assert!(err.contains("exactly 2"), "got: {err}");
    }

    #[test]
    fn rejects_three_stations() {
        let g = make_group(
            &["a", "b", "c"],
            &[("a", 0.9), ("b", 0.9), ("c", 0.9)],
        );
        assert!(g.validate("op-1").is_err());
    }

    #[test]
    fn rejects_duplicate_station_in_pair() {
        let g = make_group(&["same", "same"], &[("same", 0.9)]);
        let err = g.validate("op-1").unwrap_err();
        assert!(err.contains("distinct"), "got: {err}");
    }

    #[test]
    fn rejects_productivity_key_mismatch() {
        let g = make_group(&["a", "b"], &[("a", 0.9), ("wrong", 0.9)]);
        let err = g.validate("op-1").unwrap_err();
        assert!(err.contains("missing entry"), "got: {err}");
    }

    #[test]
    fn rejects_productivity_below_zero() {
        let g = make_group(&["a", "b"], &[("a", -0.1), ("b", 0.9)]);
        let err = g.validate("op-1").unwrap_err();
        assert!(err.contains("out of range"), "got: {err}");
    }

    #[test]
    fn rejects_productivity_above_one_five() {
        let g = make_group(&["a", "b"], &[("a", 0.9), ("b", 1.6)]);
        let err = g.validate("op-1").unwrap_err();
        assert!(err.contains("out of range"), "got: {err}");
    }
}
