use crate::model::station::StationInput;

use super::forward_pass::Action;

/// Pre-split long tasks into chunks.
/// If action duration > station.maxChunkMinutes, split into chunks of maxChunkMinutes.
/// Chunks are linked by precedence (chunk1 -> chunk2 -> chunk3).
/// Chunk 2+ have setup_ticks = 0 (setup already done, calage handles re-setup if needed).
pub fn pre_split(actions: &mut Vec<Action>, stations: &[StationInput], tick_minutes: u32) {
    if tick_minutes == 0 {
        return;
    }

    let mut new_actions: Vec<Action> = Vec::new();
    // Map from original action index to the index of its last chunk in new_actions
    let mut original_to_last_chunk: std::collections::HashMap<usize, usize> = std::collections::HashMap::new();

    for action in actions.iter() {
        let station_idx = action.station_idx;
        if station_idx >= stations.len() {
            // Keep action as-is
            let mut cloned = clone_action(action);
            cloned.idx = new_actions.len();
            // Remap predecessor
            cloned.predecessor_idx = remap_predecessor(action.predecessor_idx, &original_to_last_chunk);
            original_to_last_chunk.insert(action.idx, cloned.idx);
            new_actions.push(cloned);
            continue;
        }

        // Pinned tasks have a fixed start time set by the user — splitting
        // them into chunks doesn't make sense. Pass them through unchanged
        // so the forward-pass pre-placement step handles them as one unit.
        if action.is_pinned {
            let mut cloned = clone_action(action);
            cloned.idx = new_actions.len();
            cloned.predecessor_idx = remap_predecessor(action.predecessor_idx, &original_to_last_chunk);
            original_to_last_chunk.insert(action.idx, cloned.idx);
            new_actions.push(cloned);
            continue;
        }

        let max_chunk_minutes = stations[station_idx].effective_max_chunk();
        let total_minutes = (action.setup_ticks + action.run_ticks) * tick_minutes;

        if total_minutes <= max_chunk_minutes || max_chunk_minutes == 0 {
            // No split needed
            let mut cloned = clone_action(action);
            cloned.idx = new_actions.len();
            cloned.predecessor_idx = remap_predecessor(action.predecessor_idx, &original_to_last_chunk);
            original_to_last_chunk.insert(action.idx, cloned.idx);
            new_actions.push(cloned);
            continue;
        }

        // Split needed
        let max_chunk_ticks = max_chunk_minutes / tick_minutes;
        let total_ticks = action.setup_ticks + action.run_ticks;
        let num_chunks = (total_ticks + max_chunk_ticks - 1) / max_chunk_ticks; // ceil division

        let original_task_id = action.task_id.clone();
        let mut prev_chunk_idx: Option<usize> = None;

        for chunk_n in 0..num_chunks {
            let is_first = chunk_n == 0;
            let is_last = chunk_n == num_chunks - 1;

            let (chunk_setup, chunk_run) = if is_first {
                // Chunk 1: original setup_ticks, fill remaining with run
                let run_in_chunk = max_chunk_ticks.saturating_sub(action.setup_ticks);
                (action.setup_ticks, run_in_chunk)
            } else if is_last {
                // Last chunk: remainder
                let ticks_placed = max_chunk_ticks; // first chunk
                let ticks_in_middle = max_chunk_ticks * (num_chunks - 2); // middle chunks
                let remainder = total_ticks.saturating_sub(ticks_placed + ticks_in_middle);
                (0, remainder)
            } else {
                // Middle chunk: full max_chunk_ticks
                (0, max_chunk_ticks)
            };

            let chunk_total = chunk_setup + chunk_run;

            let chunk_task_id = if is_first {
                original_task_id.clone()
            } else {
                format!("{}_chunk_{}", original_task_id, chunk_n + 1)
            };

            let predecessor_idx = if is_first {
                remap_predecessor(action.predecessor_idx, &original_to_last_chunk)
            } else {
                prev_chunk_idx
            };

            // Drying gap only applies to first chunk (from original predecessor)
            let predecessor_gap_ticks = if is_first {
                action.predecessor_gap_ticks
            } else {
                0
            };

            let idx = new_actions.len();
            new_actions.push(Action {
                idx,
                task_id: chunk_task_id,
                job_id: action.job_id.clone(),
                station_idx: action.station_idx,
                setup_ticks: chunk_setup,
                run_ticks: chunk_run,
                art: chunk_total,
                original_art: chunk_total,
                eat: 0,
                last: action.last,
                predecessor_idx,
                predecessor_gap_ticks,
                end_tick: None,
                assigned_operators: Vec::new(),
                start_tick: None,
                chunk_info: Some((chunk_n + 1, num_chunks, original_task_id.clone())),
                deadline_priority: action.deadline_priority,
                job_deadline_tick: action.job_deadline_tick,
                earliest_retry_tick: None,
                additional_predecessors: Vec::new(),
                work_accumulator: 0.0,
                idle_ticks: 0,
                tick_operator_log: Vec::new(),
                total_productivity: 0.0,
                ticks_counted: 0,
                chain_remaining_art: action.chain_remaining_art,
                // Pinned tasks are never split into chunks (their start time
                // is fixed by the user). Pre-split skips them upstream, so
                // these chunked actions are by definition non-pinned.
                is_pinned: false,
                pinned_start_tick: None,
                peremption_count: 0,
                pending_recalage: false,
                current_recalage_start: None,
                recalage_segments: Vec::new(),
                spec_snapshot: action.spec_snapshot.clone(),
            });

            prev_chunk_idx = Some(idx);
        }

        // Map original action to the LAST chunk (successors should wait for last chunk)
        if let Some(last_idx) = prev_chunk_idx {
            original_to_last_chunk.insert(action.idx, last_idx);
        }
    }

    *actions = new_actions;
}

/// Remap a predecessor index from the original action vec to the new action vec.
fn remap_predecessor(
    pred_idx: Option<usize>,
    original_to_last_chunk: &std::collections::HashMap<usize, usize>,
) -> Option<usize> {
    pred_idx.and_then(|idx| original_to_last_chunk.get(&idx).copied())
}

/// Clone an Action (Action does not derive Clone, so we do it manually).
pub fn clone_action(a: &Action) -> Action {
    Action {
        idx: a.idx,
        task_id: a.task_id.clone(),
        job_id: a.job_id.clone(),
        station_idx: a.station_idx,
        setup_ticks: a.setup_ticks,
        run_ticks: a.run_ticks,
        art: a.art,
        original_art: a.original_art,
        eat: a.eat,
        last: a.last,
        predecessor_idx: a.predecessor_idx,
        predecessor_gap_ticks: a.predecessor_gap_ticks,
        end_tick: a.end_tick,
        assigned_operators: a.assigned_operators.clone(),
        start_tick: a.start_tick,
        chunk_info: a.chunk_info.clone(),
        deadline_priority: a.deadline_priority,
        job_deadline_tick: a.job_deadline_tick,
        earliest_retry_tick: a.earliest_retry_tick,
        additional_predecessors: a.additional_predecessors.clone(),
        work_accumulator: a.work_accumulator,
        idle_ticks: a.idle_ticks,
        tick_operator_log: a.tick_operator_log.clone(),
        total_productivity: a.total_productivity,
        ticks_counted: a.ticks_counted,
        chain_remaining_art: a.chain_remaining_art,
        is_pinned: a.is_pinned,
        pinned_start_tick: a.pinned_start_tick,
        peremption_count: a.peremption_count,
        pending_recalage: a.pending_recalage,
        current_recalage_start: a.current_recalage_start,
        recalage_segments: a.recalage_segments.clone(),
        spec_snapshot: a.spec_snapshot.clone(),
    }
}
