use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationInput {
    pub id: String,
    pub name: String,
    pub attention_full: Option<f64>,
    pub attention_run: Option<f64>,
    #[serde(default)]
    pub masked_time_enabled: bool,
    pub attention_masked: Option<f64>,
    pub masked_productivity: Option<f64>,
    pub tick_minutes: Option<u32>,
    pub peremption_threshold_minutes: Option<u32>,
    pub max_chunk_minutes: Option<u32>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub similarity_criteria: Option<Vec<SimilarityCriterion>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarityCriterion {
    pub code: Option<String>,
    pub name: Option<String>,
    pub field_path: Option<String>,
}

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

    pub fn effective_attention_masked(&self) -> f64 {
        self.attention_masked.unwrap_or(0.3)
    }

    pub fn effective_masked_productivity(&self) -> f64 {
        if self.masked_time_enabled {
            self.masked_productivity.unwrap_or(0.95).max(0.0).min(1.0)
        } else {
            1.0
        }
    }

    pub fn effective_peremption(&self) -> u32 {
        self.peremption_threshold_minutes.unwrap_or(120)
    }

    pub fn effective_max_chunk(&self) -> u32 {
        self.max_chunk_minutes.unwrap_or(420)
    }
}
