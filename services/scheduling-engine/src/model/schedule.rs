use serde::{Deserialize, Serialize};

use super::job::JobInput;
use super::operator::OperatorInput;
use super::station::StationInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationGroupInput {
    pub id: String,
    pub station_ids: Vec<String>,
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: u32,
}

fn default_max_concurrent() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeRequest {
    pub stations: Vec<StationInput>,
    #[serde(default)]
    pub operators: Vec<OperatorInput>,
    pub jobs: Vec<JobInput>,
    #[serde(default)]
    pub options: Option<ComputeOptions>,
    #[serde(default)]
    pub station_groups: Vec<StationGroupInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeOptions {
    #[serde(default = "default_horizon_days")]
    pub horizon_days: u32,
    #[serde(default = "default_tick_minutes")]
    pub tick_minutes: u32,
    #[serde(default = "default_fbi_max_iterations")]
    pub fbi_max_iterations: u32,
    #[serde(default)]
    pub multi_start: bool,
}

impl Default for ComputeOptions {
    fn default() -> Self {
        Self {
            horizon_days: default_horizon_days(),
            tick_minutes: default_tick_minutes(),
            fbi_max_iterations: default_fbi_max_iterations(),
            multi_start: false,
        }
    }
}

fn default_horizon_days() -> u32 {
    14
}

fn default_tick_minutes() -> u32 {
    15
}

fn default_fbi_max_iterations() -> u32 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleResult {
    pub assignments: Vec<ComputedAssignment>,
    pub stats: ScheduleStats,
    #[serde(default)]
    pub warnings: Vec<Warning>,
    pub fbi_iterations: u32,
    pub compute_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputedAssignment {
    pub task_id: String,
    pub station_id: String,
    pub scheduled_start: String,
    pub scheduled_end: String,
    pub operators: Vec<OperatorAssignment>,
    #[serde(default)]
    pub setup_end: Option<String>,
    #[serde(default)]
    pub is_degraded: bool,
    #[serde(default = "default_productivity")]
    pub effective_productivity: f64,
    /// True if the task ran in masked time mode on its station
    #[serde(default)]
    pub is_masked_time: bool,
}

fn default_productivity() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorAssignment {
    pub operator_id: String,
    pub from: String,
    pub to: String,
    pub attention: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleStats {
    pub makespan_minutes: u64,
    pub total_tasks: u32,
    pub scheduled_tasks: u32,
    pub deadline_violations: u32,
    pub late_task_count: u32,
    pub total_lateness_minutes: u64,
    #[serde(default)]
    pub late_job_count: u32,
    #[serde(default)]
    pub weighted_lateness_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    #[serde(default)]
    pub task_id: Option<String>,
    pub message: String,
}
