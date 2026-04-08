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
}

impl TaskInput {
    pub fn total_minutes(&self) -> u32 {
        self.setup_minutes + self.run_minutes
    }
}
