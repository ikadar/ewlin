use serde::{Deserialize, Serialize};

use super::job::JobInput;
use super::operator::OperatorInput;
use super::station::StationInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeRequest {
    pub stations: Vec<StationInput>,
    #[serde(default)]
    pub operators: Vec<OperatorInput>,
    pub jobs: Vec<JobInput>,
    #[serde(default)]
    pub options: Option<ComputeOptions>,
    /// Pre-occupied slots from existing assignments. The engine blocks these
    /// station+operator ticks in the grid before the forward pass, so new
    /// tasks are placed in the remaining gaps only.
    #[serde(default)]
    pub occupied_slots: Vec<OccupiedSlot>,
    /// Historical record of every setup completion observed in the
    /// workshop on the stations relevant to this compute. Sourced from
    /// PHP's append-only `setup_completion_log` table, filtered by
    /// station and clipped to a finite lookback (PHP default: 30 days).
    /// Drives the past-side intercalation check inside
    /// `evaluate_setup_inheritance` — given an inherited anchor, the
    /// engine asks "did another task complete a setup on the same
    /// station between the anchor and now?". The grid (which only
    /// represents the current in-flight plan) cannot answer past-side
    /// questions reliably, hence this companion input.
    #[serde(default)]
    pub setup_completion_log: Vec<SetupCompletion>,
    /// Optional virtual-clock reference (ISO 8601 with timezone). When
    /// set, the engine treats this as "now" instead of reading
    /// `Local::now()`. PHP forwards its `ClockService::now()` in this
    /// field so a global now-override toggled in the admin UI flows
    /// through to the engine without the engine having to know about
    /// the override mechanism. Absent or unparseable values fall back
    /// to wall-clock time, preserving prod behaviour.
    #[serde(default)]
    pub reference_time: Option<String>,
}

/// One row from the setup-completion historical log. `at_tick` is signed
/// because completions older than `today_midnight` resolve to negative
/// ticks ; the engine only does subtraction on this value, so signedness
/// is purely a wire-format concern.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupCompletion {
    pub task_id: String,
    pub station_id: String,
    pub at_tick: i64,
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
    /// Run TierFirst, EDD and SlackFirst orderings in parallel and pick
    /// the best score. Default is `true` — production callers don't ship
    /// the field and got the bool field-default (`false`) silently for a
    /// long time, masking the EDD/SlackFirst paths entirely. Tests and
    /// the precedence validator opt out explicitly to keep their result
    /// deterministic.
    #[serde(default = "default_multi_start")]
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

fn default_multi_start() -> bool {
    true
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
    /// Outsourced (ST) step placements: one entry per outsourced TaskInput
    /// the request submitted, in element-sequence order. Empty when the
    /// request had no outsourced tasks. Each entry's `departure` /
    /// `return` are computed by the engine from the predecessor internal
    /// task's actual end tick — no PHP-side recomputation needed.
    #[serde(default)]
    pub outsourced_assignments: Vec<OutsourcedAssignment>,
    /// Engine identity stamped on every response. PHP captures it on
    /// the live Preprod row at compute time and copies it onto Prod at
    /// promotion time, giving every promoted plan a permanent reference
    /// to the engine binary that produced it (ISO audit requirement).
    /// Sourced from the `flux-scheduler` crate version at compile time;
    /// future revisions can append a build-sha if reproducibility needs
    /// require it.
    pub engine_version: String,
}

/// One placed outsourced step, ready for PHP-side persistence verbatim.
/// `scheduled_start` and `scheduled_end` use the same ISO 8601 (no
/// timezone) format as `ComputedAssignment.scheduled_start`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutsourcedAssignment {
    pub task_id: String,
    pub provider_id: String,
    /// Departure datetime — when the work leaves the workshop.
    pub scheduled_start: String,
    /// Return datetime — when the work is back from the provider.
    pub scheduled_end: String,
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
    /// Optional active-window decomposition of the assignment.
    ///
    /// `None` (default) means the task is active continuously from
    /// `scheduled_start` to `scheduled_end`. The UI renders one solid tile.
    ///
    /// `Some(windows)` means the task was chunk-split during scheduling and
    /// is active *only* during these sub-windows. The complement of the
    /// union of windows inside `[scheduled_start, scheduled_end)` is a gap
    /// where the station was working on something else (typically a
    /// safety-zone-frozen pin that the forward pass routed around). The UI
    /// must render only the active windows so the gap is visible — without
    /// this, the merged envelope visually overlaps the pin tile.
    ///
    /// Set by `merge_chunk_assignments` only when there are ≥2 chunks. If
    /// the gap between chunks falls entirely on closures (night, weekend),
    /// the field stays `None`: the collapse-aware UI projection already
    /// hides those bands and a continuous envelope renders correctly.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_windows: Option<Vec<PhaseSegment>>,
    /// True when the engine honoured a setup-inheritance offer from PHP:
    /// the previous calage was reused and the setup phase was collapsed to
    /// zero ticks for this placement. Surfaced to the UI so the operator
    /// understands why a partially-progressed re-placement is shorter than
    /// the theoretical setup + run.
    #[serde(default)]
    pub setup_inherited: bool,
    /// Set when PHP offered an inheritance but the engine rejected it.
    /// Tag values: `"peremption"` (calage too old), `"intercalated_setup"`
    /// (another task's setup ran on the station between the anchor and
    /// the candidate placement), `"station_mismatch"` (anchor station
    /// differs from current placement, or anchor's station id is unknown).
    /// `None` when the inheritance was honoured or no inheritance was
    /// offered. The UI renders an ambre "recalage" badge when this is
    /// set together with `recordedProgressPct > 0` on the linked task.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub setup_lost_reason: Option<String>,
}

/// A generic phase window within an assignment, used today for re-calage
/// events and active-window decomposition. Timestamps are RFC 3339 strings
/// aligned with scheduled_start / scheduled_end.
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
    /// Priority-weighted late job count: vital=10M, imperative=4, important=2, standard=1, flexible=0.5.
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
