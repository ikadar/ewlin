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
    /// Pre-occupied slots from existing assignments. The engine blocks these
    /// station+operator ticks in the grid before the forward pass, so new
    /// tasks are placed in the remaining gaps only.
    #[serde(default)]
    pub occupied_slots: Vec<OccupiedSlot>,
}

/// A pre-occupied station+operator slot from an existing assignment.
/// Used by selective/incremental compute to preserve the current schedule.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OccupiedSlot {
    pub station_id: String,
    #[serde(default)]
    pub operator_ids: Vec<String>,
    pub start: String,
    pub end: String,
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
    /// Number of additional perturbed multi-start passes to run.
    /// Each pass uses randomly perturbed scoring weights (seeded for determinism).
    /// 0 = disabled (default: 4 additional passes).
    #[serde(default = "default_perturbed_starts")]
    pub perturbed_starts: u32,
    /// Skip the LNS post-placement improvement phase entirely.
    /// Used by the two-phase /compute-fast endpoint so the base result
    /// returns immediately; LNS is then driven separately via
    /// /compute-lns/stream with its own 60s budget.
    #[serde(default)]
    pub skip_lns: Option<bool>,
    /// Override the LNS time budget in milliseconds. When None the
    /// engine derives it from the remaining 60s compute wall clock.
    #[serde(default)]
    pub lns_budget_ms: Option<u64>,
    /// Minimum number of ticks separating any predecessor's `end_tick`
    /// from its successor's `start_tick`, on top of any explicit
    /// `predecessor_gap_ticks` (drying time / outsourcing). Default 1
    /// — the strict gap that eliminates the "kissing boundary" case
    /// (`pred.end == succ.start` in wall-clock terms). Setting to 0
    /// restores the pre-fix half-open semantics where touching
    /// boundaries are treated as legal contiguity. Same-task chunk
    /// continuations are exempt from this gap regardless of value.
    /// Sourced from PHP's PrecedenceGapConfig (admin UI under
    /// /settings/precedence-gap).
    #[serde(default = "default_precedence_min_gap_ticks")]
    pub precedence_min_gap_ticks: u32,
}

impl Default for ComputeOptions {
    fn default() -> Self {
        Self {
            horizon_days: default_horizon_days(),
            tick_minutes: default_tick_minutes(),
            fbi_max_iterations: default_fbi_max_iterations(),
            multi_start: true,
            perturbed_starts: default_perturbed_starts(),
            skip_lns: None,
            lns_budget_ms: None,
            precedence_min_gap_ticks: default_precedence_min_gap_ticks(),
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

fn default_perturbed_starts() -> u32 {
    0 // Disabled: SA uses the freed compute budget instead
}

fn default_precedence_min_gap_ticks() -> u32 {
    1
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
    /// Actual tick granularity used (may differ from requested if per-station
    /// tick_minutes are configured — the engine uses the minimum).
    pub tick_minutes: u32,
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
    /// Post-peremption re-calage phases. Each entry is a (start, end) window
    /// during which the operator re-staged the press because the previous
    /// calage had expired (idle beyond the station's peremption threshold).
    /// Empty when the action never triggered peremption.
    #[serde(default)]
    pub recalages: Vec<PhaseSegment>,
}

/// A generic phase window within an assignment, used today for re-calage
/// events. Timestamps are RFC 3339 strings aligned with scheduled_start /
/// scheduled_end.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseSegment {
    pub start: String,
    pub end: String,
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
    /// Priority-weighted late job count: imperative=4, important=2, standard=1, flexible=0.5.
    /// Used by FBI to prefer solutions that protect high-priority jobs.
    #[serde(default)]
    pub weighted_late_job_count: u64,
    /// IDs of jobs that miss their deadline (one entry per job, deduplicated)
    #[serde(default)]
    pub late_job_ids: Vec<String>,
    /// Sum of calage bonus points across all placed internal actions.
    /// Calage bonus = 100 if the previous action on the same station
    /// belongs to the same job (job-continuity reward), else 0.
    /// Drives the LNS secondary objective at equal late_job_count.
    #[serde(default)]
    pub calage_bonus_sum: u64,
    /// Mean calage bonus across placed internal actions (0.0..=100.0).
    #[serde(default)]
    pub calage_bonus_mean: f64,
    /// Median calage bonus across placed internal actions (0.0 or 100.0
    /// in practice since bonus is binary).
    #[serde(default)]
    pub calage_bonus_median: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    #[serde(default)]
    pub task_id: Option<String>,
    pub message: String,
}
