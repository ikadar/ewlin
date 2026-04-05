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
