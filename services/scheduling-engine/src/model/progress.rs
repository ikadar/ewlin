use serde::Serialize;

/// Progress event emitted during compute for real-time tracking.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProgressEvent {
    /// FBI iteration starting
    #[serde(rename_all = "camelCase")]
    FbiStart {
        iteration: u32,
        max_iterations: u32,
    },
    /// Backward pass (LAST values) completed for an iteration
    #[serde(rename_all = "camelCase")]
    BackwardDone {
        iteration: u32,
    },
    /// Forward pass progress (emitted periodically)
    #[serde(rename_all = "camelCase")]
    ForwardProgress {
        iteration: u32,
        tick: usize,
        actions_placed: u32,
        total_actions: u32,
    },
    /// FBI iteration completed
    #[serde(rename_all = "camelCase")]
    FbiIterationDone {
        iteration: u32,
        makespan_minutes: u64,
        scheduled_tasks: u32,
        late_job_count: u32,
    },
    /// FBI converged early
    #[serde(rename_all = "camelCase")]
    FbiConverged {
        iteration: u32,
    },
    /// Post-processing: merging chunks
    MergeStart,
    /// Compute fully done — result follows as a separate event
    EngineDone {
        #[serde(rename = "computeTimeMs")]
        compute_time_ms: u64,
    },
}
