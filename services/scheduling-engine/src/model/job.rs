use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobInput {
    pub id: String,
    #[serde(default)]
    pub reference: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub deadline: Option<String>,
    /// Deadline priority tier: 0=imperative, 1=important, 2=standard (default), 3=flexible.
    /// Controls processing order in the backward pass (lower = placed first = reserves capacity).
    #[serde(default = "default_deadline_priority")]
    pub deadline_priority: u8,
    pub elements: Vec<ElementInput>,
    #[serde(default)]
    pub required_job_ids: Vec<String>,
}

fn default_deadline_priority() -> u8 {
    2 // standard
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementInput {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    pub tasks: Vec<TaskInput>,
    #[serde(default)]
    pub spec: Option<serde_json::Value>,
    #[serde(default)]
    pub prerequisite_element_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub id: String,
    pub station_id: String,
    #[serde(default)]
    pub setup_minutes: u32,
    #[serde(default)]
    pub run_minutes: u32,
    #[serde(default)]
    pub sequence_order: u32,
    /// True if the user has pinned this task to a specific moment in time.
    /// The engine MUST place it at exactly `pinned_start_tick` on
    /// `station_id` and not move it. Successors of a pinned task see its
    /// fixed end_tick when checking precedence and chain naturally after.
    #[serde(default)]
    pub is_pinned: bool,
    /// Tick at which the task starts (only meaningful if `is_pinned`).
    /// PHP computes this from the existing assignment's scheduledStart
    /// using the same epoch (today 00:00 local) and tick_minutes (15) the
    /// engine uses.
    #[serde(default)]
    pub pinned_start_tick: Option<usize>,
    /// Tick at which the pinned interval ends (exclusive; only meaningful
    /// if `is_pinned`). PHP computes this from the existing assignment's
    /// scheduledEnd using the same epoch + tick_minutes as
    /// `pinned_start_tick`. When present, the engine uses this value
    /// instead of recomputing `pinned_start_tick + setup_ticks +
    /// run_ticks` — eliminating drift between the engine's config-based
    /// view and the DB's actual-productivity-based extent. Without it,
    /// drift accumulates across compute cycles and produces pin-pin
    /// overlaps on capacity-1 stations (Komori G40, Ryobi 528) via the
    /// safety-zone Option A pathway. Falls back to config-derived end
    /// when `None` (legacy clients, missing scheduledEnd).
    #[serde(default)]
    pub pinned_end_tick: Option<usize>,
    /// True iff the pin was injected by PHP's safety-zone freeze pathway
    /// (i.e. the task was already placed by a prior compute, sits inside
    /// the rolling working-hours window, and the user has not overridden
    /// the freeze). User pins (`assignment.isPinned == true` in the DB)
    /// leave this false even though they also set `is_pinned: true`.
    ///
    /// `pre_place_pinned_actions` consults this flag to decide whether
    /// to honour the pin position verbatim (safety-zone: yes — Phase 1
    /// already produced a feasible placement, the contiguous-window
    /// check would fail spuriously on multi-stint tasks and shift the
    /// pin into a slot occupied by another action) or treat the pin as
    /// a start-time preference and slide it forward to the next
    /// fully-feasible window emitting a "Pin déplacé" warning (user
    /// pin: yes — the user picked a preferred moment, the engine may
    /// move it if infeasible).
    #[serde(default)]
    pub is_frozen_by_safety_zone: bool,
    /// When set, this task is an outsourced step. The engine does not place
    /// it on a station/operator; instead it acts as a floor-shifter on its
    /// successor: the engine computes the return tick dynamically from the
    /// predecessor's end tick at forward-pass time (single source of truth
    /// for ST scheduling, replacing the pre-engine `predecessorGapMinutes`
    /// estimate that was time-of-day blind).
    #[serde(default)]
    pub outsourced: Option<OutsourcedParams>,
    /// Hard floor on the earliest tick at which this task may start. The
    /// scoring loop refuses to place the action at any tick `t < earliest_start_tick`,
    /// and `pre_place_pinned_actions` degrades pins whose `pinned_start_tick`
    /// is below this value (emitting a warning so the user sees the displacement).
    ///
    /// Sourced by PHP from external constraints the engine doesn't natively
    /// model. Currently the only producer is the BAT-deadline rule:
    ///   - Internal task in element E: blocked when E.batStatus is not Ready
    ///   - Outsourced task in element E: blocked when at least one prerequisite
    ///     element of E has batStatus not Ready
    /// In both cases the floor is `Job.batDeadline` converted to tick units.
    /// The engine treats the field neutrally — it doesn't know about BAT.
    #[serde(default)]
    pub earliest_start_tick: Option<usize>,
    /// V2 progress capture — operator-derived realistic run duration (minutes).
    /// `Some` when a saisie has produced a productivity ratio for this fragment ;
    /// the engine plans with this value instead of `run_minutes` via
    /// `effective_run_minutes()`. `None` = pre-saisie, fall back to JCF planned
    /// run. PHP computes `round(run_minutes × productivity_ratio)` upstream
    /// (ScheduleComputeController). Setup is unchanged either way (calage
    /// neutral — bounded by machine + material, not operator pace).
    #[serde(default)]
    pub realistic_run_minutes: Option<u32>,
    /// V2 progress capture — % of the parent job's volume already delivered by
    /// fragments before this one. Carried through so the FE's VolumeGauge can
    /// position the active slot on the 100% job scale without re-deriving it.
    /// Computed by the snapshot builder from the element/task ordering. `None`
    /// → FE falls back to a sane default.
    #[serde(default)]
    pub cumulative_position_pct: Option<f64>,
    /// V2 progress capture — % of the job's volume that this slot delivers.
    /// Pairs with `cumulative_position_pct` to fully describe the slot zone in
    /// the gauge. `None` → FE falls back to a default.
    #[serde(default)]
    pub slot_volume_pct: Option<f64>,
}

/// Provider parameters needed to compute departure & return ticks of a
/// single outsourced step. Snapshotted at compute-request time so the
/// engine has no need to look up provider state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutsourcedParams {
    pub provider_id: String,
    /// Number of business days the work itself takes at the provider.
    pub work_days: u32,
    /// Calendar days transit each way. Counted as business days too —
    /// matches the existing PHP behaviour (`addBusinessDays`).
    pub transit_days: u32,
    /// Latest minute-of-day at which the provider's truck collects work
    /// (cutoff). Predecessor ending after this minute pushes departure to
    /// the next business day.
    pub latest_departure_minutes: u32,
    /// Minute-of-day at which returned work arrives back at the workshop.
    pub reception_minutes: u32,
    /// User-typed override of the departure tick (since today midnight,
    /// in tick units). When set, calculation skips the cutoff/business-day
    /// logic and uses this value verbatim.
    #[serde(default)]
    pub manual_departure_tick: Option<usize>,
    /// User-typed override of the return tick (since today midnight, in
    /// tick units). When set, the successor's earliest start is fixed to
    /// this tick regardless of how the auto-formula would have placed it.
    #[serde(default)]
    pub manual_return_tick: Option<usize>,
}

impl TaskInput {
    pub fn total_minutes(&self) -> u32 {
        self.setup_minutes + self.run_minutes
    }

    /// V2 progress capture — effective run duration used for scheduling.
    /// Returns the realistic value when a saisie has produced one (the engine
    /// should plan with the operator's actual pace) ; otherwise the JCF
    /// planned `run_minutes`. Setup is always immutable (calage neutral).
    pub fn effective_run_minutes(&self) -> u32 {
        self.realistic_run_minutes.unwrap_or(self.run_minutes)
    }

    /// Theoretical total duration (setup + planned run) — immutable JCF view.
    /// Use for audit / devis / comparison with the realistic.
    #[allow(dead_code)]
    pub fn theoretical_duration_minutes(&self) -> u32 {
        self.setup_minutes.saturating_add(self.run_minutes)
    }

    /// Realistic total duration (setup + effective run) — calage neutral.
    /// Use for live planning, snapshot enrichment, etc.
    #[allow(dead_code)]
    pub fn realistic_duration_minutes(&self) -> u32 {
        self.setup_minutes.saturating_add(self.effective_run_minutes())
    }

    /// True when this task is an outsourced step that must NOT be placed
    /// on a station/operator. The engine treats it as a floor-shifter
    /// (see `OutsourcedParams`) rather than a placeable action.
    pub fn is_outsourced(&self) -> bool {
        self.outsourced.is_some()
    }
}

#[cfg(test)]
mod task_input_v2_helpers_tests {
    use super::*;

    fn task(setup: u32, run: u32, realistic: Option<u32>) -> TaskInput {
        TaskInput {
            id: "t".to_string(),
            station_id: "s".to_string(),
            setup_minutes: setup,
            run_minutes: run,
            sequence_order: 0,
            is_pinned: false,
            pinned_start_tick: None,
            pinned_end_tick: None,
            is_frozen_by_safety_zone: false,
            outsourced: None,
            earliest_start_tick: None,
            realistic_run_minutes: realistic,
            cumulative_position_pct: None,
            slot_volume_pct: None,
        }
    }

    #[test]
    fn effective_run_falls_back_to_planned_when_realistic_absent() {
        assert_eq!(task(30, 120, None).effective_run_minutes(), 120);
    }

    #[test]
    fn effective_run_uses_realistic_when_present() {
        assert_eq!(task(30, 120, Some(150)).effective_run_minutes(), 150);
    }

    #[test]
    fn theoretical_duration_ignores_realistic_override() {
        // Theoretical = JCF immutable view, never affected by saisie.
        assert_eq!(task(30, 120, Some(150)).theoretical_duration_minutes(), 150);
    }

    #[test]
    fn realistic_duration_is_setup_plus_effective_run() {
        assert_eq!(task(30, 120, Some(150)).realistic_duration_minutes(), 180);
    }

    #[test]
    fn realistic_equals_theoretical_when_no_saisie() {
        let t = task(30, 120, None);
        assert_eq!(t.theoretical_duration_minutes(), t.realistic_duration_minutes());
    }
}
