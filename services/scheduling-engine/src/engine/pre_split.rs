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
            // Remap predecessor + additional predecessors
            cloned.predecessor_idx = remap_predecessor(action.predecessor_idx, &original_to_last_chunk);
            cloned.additional_predecessors = remap_additional_predecessors(&action.additional_predecessors, &original_to_last_chunk);
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
            cloned.additional_predecessors = remap_additional_predecessors(&action.additional_predecessors, &original_to_last_chunk);
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
            cloned.additional_predecessors = remap_additional_predecessors(&action.additional_predecessors, &original_to_last_chunk);
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

            // Same logic for the outsourced chain: only the first chunk
            // inherits the chain that sits between the original
            // predecessor and the (now-split) action. Subsequent chunks
            // chain through prev_chunk_idx and have no ST gap to honour.
            let outsourced_predecessor_chain = if is_first {
                action.outsourced_predecessor_chain.clone()
            } else {
                Vec::new()
            };

            // Cross-element / cross-job extra predecessors apply to the
            // first chunk only (subsequent chunks chain through prev_chunk_idx).
            let additional_predecessors = if is_first {
                remap_additional_predecessors(&action.additional_predecessors, &original_to_last_chunk)
            } else {
                Vec::new()
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
                task_total_ticks: action.task_total_ticks,
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
                earliest_start_tick: action.earliest_start_tick,
                additional_predecessors,
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
                is_frozen_by_safety_zone: false,
                pinned_start_tick: None,
                pinned_end_tick: None,
                peremption_count: 0,
                pending_recalage: false,
                current_recalage_start: None,
                recalage_segments: Vec::new(),
                spec_snapshot: action.spec_snapshot.clone(),
                setup_progress: 0.0,
                setup_end_tick: None,
                outsourced_predecessor_chain,
                preserve_calage_during_gap: action.preserve_calage_during_gap,
                borrow_until_tick: None,
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

/// Remap the `additional_predecessors` vec (cross-element / cross-job extra
/// predecessors) from the original action vec to the new action vec. Entries
/// whose original index can't be resolved are dropped — that matches
/// [`remap_predecessor`]'s contract.
fn remap_additional_predecessors(
    extra: &[(usize, u32)],
    original_to_last_chunk: &std::collections::HashMap<usize, usize>,
) -> Vec<(usize, u32)> {
    extra
        .iter()
        .filter_map(|&(idx, gap)| {
            original_to_last_chunk
                .get(&idx)
                .copied()
                .map(|new_idx| (new_idx, gap))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::similarity::SpecSnapshot;

    fn make_action(idx: usize, station_idx: usize, setup_ticks: u32, run_ticks: u32) -> Action {
        Action {
            idx,
            task_id: format!("t{}", idx),
            job_id: "j".into(),
            station_idx,
            setup_ticks,
            run_ticks,
            art: setup_ticks + run_ticks,
            eat: 0,
            last: u64::MAX,
            predecessor_idx: None,
            predecessor_gap_ticks: 0,
            end_tick: None,
            assigned_operators: Vec::new(),
            start_tick: None,
            chunk_info: None,
            deadline_priority: 2,
            job_deadline_tick: u64::MAX,
            earliest_retry_tick: None,
            earliest_start_tick: None,
            additional_predecessors: Vec::new(),
            work_accumulator: 0.0,
            idle_ticks: 0,
            tick_operator_log: Vec::new(),
            original_art: setup_ticks + run_ticks,
            task_total_ticks: setup_ticks + run_ticks,
            total_productivity: 0.0,
            ticks_counted: 0,
            is_pinned: false,
            is_frozen_by_safety_zone: false,
            chain_remaining_art: setup_ticks + run_ticks,
            pinned_start_tick: None,
            pinned_end_tick: None,
            peremption_count: 0,
            pending_recalage: false,
            current_recalage_start: None,
            recalage_segments: Vec::new(),
            spec_snapshot: SpecSnapshot::default(),
            setup_progress: 0.0,
            setup_end_tick: None,
            outsourced_predecessor_chain: Vec::new(),
            preserve_calage_during_gap: false,
            borrow_until_tick: None,
        }
    }

    fn make_station(max_chunk_minutes: u32) -> StationInput {
        StationInput {
            id: format!("s{}", max_chunk_minutes),
            name: "Station".into(),
            attention_full: None,
            attention_run: None,
            max_run_attention: None,
            masked_time_enabled: false,
            attention_masked: None,
            masked_productivity: None,
            tick_minutes: Some(15),
            peremption_threshold_minutes: None,
            max_chunk_minutes: Some(max_chunk_minutes),
            category_id: None,
            similarity_criteria: None,
            similarity_score_rules: None,
            is_press: false,
            drying_time_minutes: 240,
            max_operators: None,
            capacity: None,
            schedule_exceptions: Vec::new(),
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
        }
    }

    /// Regression guard: when pre_split chunks an early action, later actions
    /// whose `additional_predecessors` referenced indices beyond the chunk must
    /// see those indices REMAPPED to the new action vec layout. Previously
    /// (before the fix) the field was cloned verbatim and ended up pointing
    /// at unrelated actions, silently defeating cross-element precedence for
    /// any downstream element with 2+ prerequisites.
    #[test]
    fn additional_predecessors_are_remapped_across_chunks() {
        // Station 0 has a tight max_chunk; station 1 is generous.
        // Action 0: runs on station 0 with 8 * 15 = 120 min of work and
        // max_chunk=60 → splits into 2 chunks (so indices shift by +1).
        // Action 1: prereq on station 1, no split.
        // Action 2: sibling prereq on station 1, no split.
        // Action 3: downstream on station 1, depends on action 1 (primary)
        // and action 2 (additional).
        let stations = vec![make_station(60), make_station(480)];

        let mut act0 = make_action(0, 0, 0, 8); // will split → 2 chunks
        // Pretend action 0 has some run-only payload (setup=0, run=8 ticks = 120min).

        let act1 = make_action(1, 1, 1, 2);
        let act2 = make_action(2, 1, 1, 2);
        let mut act3 = make_action(3, 1, 1, 2);
        act3.predecessor_idx = Some(1); // primary prereq = action 1
        act3.additional_predecessors = vec![(2, 0)]; // additional = action 2

        // Touch act0 so the unused warning doesn't fire; no payload change needed.
        act0.run_ticks = 8;

        let mut actions = vec![act0, act1, act2, act3];
        pre_split(&mut actions, &stations, 15);

        // After split: action 0 becomes 2 chunks at indices 0, 1.
        // Original idx 1 → new idx 2. Original idx 2 → new idx 3. Original idx 3 → new idx 4.
        assert_eq!(actions.len(), 5, "2 chunks + 3 originals = 5 actions");

        // Find the downstream action (originally idx 3).
        let downstream = actions.iter().find(|a| a.task_id == "t3").expect("t3 present");

        assert_eq!(downstream.predecessor_idx, Some(2), "predecessor_idx remapped to t1's new idx");
        assert_eq!(
            downstream.additional_predecessors,
            vec![(3, 0)],
            "additional_predecessors remapped to t2's new idx — this is the regression guard",
        );
    }

    /// Corollary: when the downstream action ITSELF is the one being chunked,
    /// its additional_predecessors must land on the first chunk (and be empty
    /// on subsequent chunks, which chain via the intra-task predecessor).
    #[test]
    fn additional_predecessors_land_on_first_chunk_of_split_action() {
        let stations = vec![make_station(480), make_station(60)];

        let act0 = make_action(0, 0, 1, 2);
        let act1 = make_action(1, 0, 1, 2);
        let mut act2 = make_action(2, 1, 0, 8); // will split → 2 chunks on station 1
        act2.predecessor_idx = Some(0);
        act2.additional_predecessors = vec![(1, 3)];

        let mut actions = vec![act0, act1, act2];
        pre_split(&mut actions, &stations, 15);

        // After split: originals 0, 1 → idx 0, 1. Original 2 → chunks at 2, 3.
        assert_eq!(actions.len(), 4);

        let first_chunk = &actions[2];
        let second_chunk = &actions[3];
        assert_eq!(first_chunk.task_id, "t2");
        assert_eq!(first_chunk.predecessor_idx, Some(0));
        assert_eq!(
            first_chunk.additional_predecessors,
            vec![(1, 3)],
            "first chunk carries the (remapped) additional predecessors",
        );
        assert!(
            second_chunk.additional_predecessors.is_empty(),
            "subsequent chunks chain via intra-task predecessor only",
        );
    }
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
        task_total_ticks: a.task_total_ticks,
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
        earliest_start_tick: a.earliest_start_tick,
        additional_predecessors: a.additional_predecessors.clone(),
        work_accumulator: a.work_accumulator,
        idle_ticks: a.idle_ticks,
        tick_operator_log: a.tick_operator_log.clone(),
        total_productivity: a.total_productivity,
        ticks_counted: a.ticks_counted,
        chain_remaining_art: a.chain_remaining_art,
        is_pinned: a.is_pinned,
        is_frozen_by_safety_zone: a.is_frozen_by_safety_zone,
        pinned_start_tick: a.pinned_start_tick,
        pinned_end_tick: a.pinned_end_tick,
        peremption_count: a.peremption_count,
        pending_recalage: a.pending_recalage,
        current_recalage_start: a.current_recalage_start,
        recalage_segments: a.recalage_segments.clone(),
        spec_snapshot: a.spec_snapshot.clone(),
        setup_progress: a.setup_progress,
        setup_end_tick: a.setup_end_tick,
        outsourced_predecessor_chain: a.outsourced_predecessor_chain.clone(),
        preserve_calage_during_gap: a.preserve_calage_during_gap,
        borrow_until_tick: a.borrow_until_tick,
    }
}
