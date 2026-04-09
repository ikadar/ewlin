use serde::{Deserialize, Serialize};

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
    /// Whether this station is a press (requires drying time after printing)
    #[serde(default)]
    pub is_press: bool,
    /// Drying time in minutes after printing on this station (default: 240 = 4h)
    #[serde(default = "default_drying_time")]
    pub drying_time_minutes: u32,
    pub max_operators: Option<u32>,
    pub capacity: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityCriterion {
    pub code: Option<String>,
    pub name: Option<String>,
    pub field_path: Option<String>,
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
