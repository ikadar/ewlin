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
    /// Extra gap (in minutes) to add after the predecessor before this task
    /// can start. Used for outsourced tasks: PHP skips the outsourced task
    /// but encodes its estimated duration as a gap on the next internal task.
    #[serde(default)]
    pub predecessor_gap_minutes: u32,
}

impl TaskInput {
    pub fn total_minutes(&self) -> u32 {
        self.setup_minutes + self.run_minutes
    }
}
