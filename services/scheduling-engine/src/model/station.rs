use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationInput {
    pub id: String,
    pub name: String,
    #[serde(default = "default_attention_full")]
    pub attention_full: f64,
    #[serde(default = "default_attention_run")]
    pub attention_run: f64,
    #[serde(default)]
    pub masked_time_enabled: bool,
    #[serde(default = "default_attention_masked")]
    pub attention_masked: f64,
    #[serde(default = "default_masked_productivity")]
    pub masked_productivity: f64,
    #[serde(default = "default_tick_minutes")]
    pub tick_minutes: u32,
    #[serde(default)]
    pub peremption_threshold_minutes: Option<u32>,
    #[serde(default)]
    pub max_chunk_minutes: Option<u32>,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub similarity_criteria: Option<Vec<String>>,
}

fn default_attention_full() -> f64 {
    1.0
}

fn default_attention_run() -> f64 {
    0.5
}

fn default_attention_masked() -> f64 {
    0.0
}

fn default_masked_productivity() -> f64 {
    1.0
}

fn default_tick_minutes() -> u32 {
    15
}

impl StationInput {
    pub fn effective_tick_minutes(&self) -> u32 {
        if self.tick_minutes > 0 {
            self.tick_minutes
        } else {
            15
        }
    }

    pub fn effective_attention_full(&self) -> f64 {
        if self.attention_full > 0.0 {
            self.attention_full
        } else {
            1.0
        }
    }

    pub fn effective_attention_run(&self) -> f64 {
        if self.attention_run > 0.0 {
            self.attention_run
        } else {
            0.5
        }
    }

    pub fn effective_masked_productivity(&self) -> f64 {
        if self.masked_time_enabled {
            self.masked_productivity.max(0.0).min(1.0)
        } else {
            1.0
        }
    }
}
