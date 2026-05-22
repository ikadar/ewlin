use std::collections::HashMap;

use crate::model::job::JobInput;
use crate::model::station::StationInput;

use super::forward_pass::Action;

/// Pre-split long tasks into chunks.
///
/// If a task's total work exceeds `station.max_chunk_minutes`, it is split
/// into chunks of at most `max_chunk_minutes`. Chunks are linked by
/// intra-task precedence (chunk1 → chunk2 → chunk3). Chunks 2+ inherit
/// `setup_ticks = 0` (the original setup belongs to chunk 1; calage handles
/// any re-setup needed when the run resumes).
///
/// Cross-element (`prerequisite_element_ids`) and cross-job
/// (`required_job_ids`) edges are NOT wired here. They are wired by
/// [`wire_cross_cutting_edges`] AFTER `pre_split` returns, when the action
/// vec's indices are stable. The intra-element `predecessor_idx` IS remapped
/// here — safe because intra-element edges always point backward in the
/// input vec (sequence_order guarantees consumer.idx > prereq.idx), so an
/// incremental map suffices for that single case.
pub fn pre_split(actions: &mut Vec<Action>, stations: &[StationInput], tick_minutes: u32) {
    if tick_minutes == 0 {
        return;
    }

    // Intra-element original_idx → last_chunk_new_idx. Built incrementally:
    // safe ONLY because intra-element `predecessor_idx` always points
    // backward in `actions[]` (sequence_order in build_actions guarantees
    // it). Do not generalise this map to cross-cutting edges without
    // switching to a two-pass build — cross-cutting consumers can sit
    // anywhere in the vec relative to their prereqs.
    let mut original_to_last_chunk: HashMap<usize, usize> =
        HashMap::with_capacity(actions.len());

    let mut new_actions: Vec<Action> = Vec::with_capacity(actions.len());

    for action in actions.iter() {
        let station_idx = action.station_idx;
        if station_idx >= stations.len() {
            // Keep action as-is (no station to chunk against)
            let mut cloned = clone_action(action);
            cloned.idx = new_actions.len();
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

        // Split needed. Clamp max_chunk_ticks to ≥ 1 — without this, an
        // admin config of max_chunk_minutes < tick_minutes (e.g. max=15
        // when tick=30) yields max_chunk_ticks=0 and the ceil division
        // below panics with divide-by-zero. The clamp degrades to "1 tick
        // per chunk" which is unambitious but cannot crash the engine.
        let total_ticks = action.setup_ticks + action.run_ticks;
        let max_chunk_ticks = (max_chunk_minutes / tick_minutes).max(1);
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

            // additional_predecessors stays empty here. Cross-element /
            // cross-job edges are wired by `wire_cross_cutting_edges` AFTER
            // pre_split returns, against stable post-chunk indices. In
            // production this field is always empty when pre_split runs;
            // unit tests that pre-populate it should not rely on pre_split
            // to remap (it doesn't) — drive `wire_cross_cutting_edges`
            // explicitly to test cross-cutting edge handling.
            let additional_predecessors: Vec<(usize, u32)> = Vec::new();

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
                borrow_until_tick: None,
                borrowed_op_to_restore: None,
                force_max_staffing: action.force_max_staffing,
                // D — split-at-NOW: pinned tasks are never chunked (see
                // comment on `is_pinned: false` above), so an in-progress
                // pin can never reach pre_split. Defaults are correct.
                is_in_progress: false,
                task_elapsed_ticks: 0,
                forced_start_tick: None,
                already_eaten_ticks: 0,
                // Setup-inheritance is evaluated by `pre_place_pinned_actions`
                // for user pins ; chunked actions are never pinned, so we
                // start without an inherited anchor (each chunk plans its
                // own setup if the engine schedules one).
                inherited_setup_at_tick: None,
                inherited_setup_station_idx: None,
                setup_inherited: false,
                setup_lost_reason: None,
            });

            prev_chunk_idx = Some(idx);
        }

        // Map this original action to the LAST chunk just emitted. Pure
        // append: the next intra-element consumer (always with a higher
        // original_idx by sequence_order) will look this up correctly.
        if let Some(last_idx) = prev_chunk_idx {
            original_to_last_chunk.insert(action.idx, last_idx);
        }
    }

    *actions = new_actions;
}

/// Remap an intra-element predecessor index from the original action vec to
/// the new action vec (after chunking). Returns `None` if the predecessor is
/// not in the map — which should be impossible for intra-element edges,
/// since `sequence_order` guarantees the prereq is processed before the
/// consumer and inserts itself into the map.
fn remap_predecessor(
    pred_idx: Option<usize>,
    original_to_last_chunk: &HashMap<usize, usize>,
) -> Option<usize> {
    pred_idx.and_then(|idx| original_to_last_chunk.get(&idx).copied())
}

/// Wire cross-element (`prerequisite_element_ids`, BR-ELEM-004) and
/// cross-job (`required_job_ids`, BR-JOB-006) finish-to-start edges onto
/// the already-chunked `actions` vec. Run AFTER [`pre_split`] so indices
/// are stable — this is the whole point of moving the wiring here:
/// `additional_predecessors` indices written by this function will not be
/// invalidated by any subsequent re-indexing.
///
/// For each element with a non-empty `prerequisite_element_ids`, this
/// resolves the first action (first chunk of first internal task) of the
/// element and adds, for each prereq, the LAST action (last chunk of last
/// internal task) of the prereq element as a predecessor. If the
/// consumer's primary `predecessor_idx` slot is free, the FIRST prereq
/// takes it (and inherits any drying gap from a press); subsequent prereqs
/// are pushed into `additional_predecessors`.
///
/// Cross-job wiring is structurally identical but operates on first/last
/// action per JOB rather than per ELEMENT.
pub fn wire_cross_cutting_edges(
    actions: &mut [Action],
    jobs: &[JobInput],
    stations: &[StationInput],
    tick_minutes: u32,
) {
    // Resolve original_task_id → (first_chunk_idx, last_chunk_idx) using
    // chunk_info to recover the original id for chunked actions. First
    // chunk keeps the original task_id (and has chunk_info with
    // chunk_n==1, OR chunk_info==None for un-chunked tasks); the LAST
    // chunk is found via "last write wins" because the chunks appear in
    // emission order in `actions`.
    let mut task_id_to_first_chunk: HashMap<String, usize> = HashMap::new();
    let mut task_id_to_last_chunk: HashMap<String, usize> = HashMap::new();
    for (i, a) in actions.iter().enumerate() {
        let original_id = match &a.chunk_info {
            Some((_, _, orig)) => orig.clone(),
            None => a.task_id.clone(),
        };
        task_id_to_first_chunk.entry(original_id.clone()).or_insert(i);
        task_id_to_last_chunk.insert(original_id, i);
    }

    // element_id → (first_action_idx, last_action_idx) using
    // sequence_order to identify the first/last INTERNAL task per element
    // (outsourced tasks aren't in `actions` at all).
    let mut element_first_action: HashMap<String, usize> = HashMap::new();
    let mut element_last_action: HashMap<String, usize> = HashMap::new();
    for job in jobs {
        for element in &job.elements {
            let mut sorted_tasks = element.tasks.clone();
            sorted_tasks.sort_by_key(|t| t.sequence_order);
            let internal_ids: Vec<&str> = sorted_tasks
                .iter()
                .filter(|t| t.outsourced.is_none())
                .map(|t| t.id.as_str())
                .collect();
            if let Some(first_id) = internal_ids.first() {
                if let Some(&idx) = task_id_to_first_chunk.get(*first_id) {
                    element_first_action.insert(element.id.clone(), idx);
                }
            }
            if let Some(last_id) = internal_ids.last() {
                if let Some(&idx) = task_id_to_last_chunk.get(*last_id) {
                    element_last_action.insert(element.id.clone(), idx);
                }
            }
        }
    }

    // Cross-element edges.
    for job in jobs {
        for element in &job.elements {
            if element.prerequisite_element_ids.is_empty() {
                continue;
            }
            let Some(&first_action_idx) = element_first_action.get(&element.id) else { continue };
            for prereq_id in &element.prerequisite_element_ids {
                let Some(&last_action_idx) = element_last_action.get(prereq_id) else { continue };
                let pred_station = actions[last_action_idx].station_idx;
                let gap = if pred_station < stations.len() && stations[pred_station].is_press {
                    super::minutes_to_ticks(stations[pred_station].drying_time_minutes, tick_minutes)
                } else {
                    0
                };
                if actions[first_action_idx].predecessor_idx.is_none() {
                    actions[first_action_idx].predecessor_idx = Some(last_action_idx);
                    actions[first_action_idx].predecessor_gap_ticks =
                        actions[first_action_idx].predecessor_gap_ticks.max(gap);
                } else {
                    actions[first_action_idx]
                        .additional_predecessors
                        .push((last_action_idx, gap));
                }
            }
        }
    }

    // Cross-job edges. Same pattern as cross-element, scoped to job rather
    // than element.
    let mut job_id_to_first_action: HashMap<String, usize> = HashMap::new();
    let mut job_id_to_last_action: HashMap<String, usize> = HashMap::new();
    for (i, a) in actions.iter().enumerate() {
        job_id_to_first_action.entry(a.job_id.clone()).or_insert(i);
        job_id_to_last_action.insert(a.job_id.clone(), i);
    }
    for job in jobs {
        if job.required_job_ids.is_empty() {
            continue;
        }
        let Some(&first_action_idx) = job_id_to_first_action.get(&job.id) else { continue };
        for req_job_id in &job.required_job_ids {
            let Some(&last_action_idx) = job_id_to_last_action.get(req_job_id) else { continue };
            if actions[first_action_idx].predecessor_idx.is_some() {
                actions[first_action_idx]
                    .additional_predecessors
                    .push((last_action_idx, 0));
            } else {
                actions[first_action_idx].predecessor_idx = Some(last_action_idx);
            }
        }
    }
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
            borrow_until_tick: None,
            borrowed_op_to_restore: None,
            force_max_staffing: false,
            is_in_progress: false,
            task_elapsed_ticks: 0,
            forced_start_tick: None,
            already_eaten_ticks: 0,
            inherited_setup_at_tick: None,
            inherited_setup_station_idx: None,
            setup_inherited: false,
            setup_lost_reason: None,
        }
    }

    fn make_station(max_chunk_minutes: u32) -> StationInput {
        StationInput {
            id: format!("s{}", max_chunk_minutes),
            name: "Station".into(),
            attention_setup: None,
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
            min_setup_operators: None,
            max_setup_operators: None,
            min_run_operators: None,
            max_run_operators: None,
            capacity: None,
            schedule_exceptions: Vec::new(),
            chunk_mini_setup_multiplier: None,
            chunk_mini_task_percentage: None,
        }
    }

    // Removed: pre_split no longer remaps `additional_predecessors`. The
    // Alternative-B refactor moved cross-element / cross-job wiring to
    // `wire_cross_cutting_edges`, which runs AFTER pre_split with stable
    // post-chunk indices. End-to-end coverage of the regression now lives
    // in `precedence_validator::tests::compute_integration::
    // past_deadline_global_after_prereqs`, which exercises the full
    // build_actions → pre_split → wire_cross_cutting_edges flow.


    /// Regression guard for the pre-existing divide-by-zero in pre_split
    /// when an admin sets `max_chunk_minutes < tick_minutes`. Without the
    /// clamp at `pre_split.rs:84`, both `(max_chunk_minutes / tick_minutes)`
    /// and the subsequent ceil division would yield 0 and panic. The clamp
    /// degrades to "1 tick per chunk" which is suboptimal but safe.
    #[test]
    fn max_chunk_below_tick_size_does_not_panic() {
        let stations = vec![make_station(15)]; // 15 min cap
        let action = make_action(0, 0, 0, 1); // 1 tick of run work
        // tick_minutes = 30 > max_chunk_minutes = 15 → raw division yields
        // max_chunk_ticks=0; the clamp in pre_split forces it to 1, so
        // num_chunks = ceil(1/1) = 1 and the split loop emits a single
        // chunk without crashing.
        let mut actions = vec![action];
        pre_split(&mut actions, &stations, 30);
        assert_eq!(actions.len(), 1);
    }

    // Removed three tests that placed consumers BEFORE their prereqs in
    // `actions[]` (forward-pointing predecessor_idx). They tested the old
    // additional_predecessors remap behaviour. After Alternative B,
    // pre_split is single-pass and only remaps the intra-element
    // predecessor_idx — safe in production because build_actions
    // inserts tasks in sequence_order, so consumer.idx > prereq.idx
    // always. End-to-end coverage of the prod scenario still lives in
    // `past_deadline_global_after_prereqs`.

    /// Boundary: total_minutes == max_chunk_minutes EXACTLY → 1 chunk.
    /// total_minutes == max_chunk_minutes + 1 tick → 2 chunks.
    #[test]
    fn boundary_total_equals_max_chunk_is_single_chunk() {
        let stations = vec![make_station(60)];

        // 4 ticks * 15 min/tick = 60 min == max_chunk → 1 chunk
        let exact = make_action(0, 0, 0, 4);
        let mut actions = vec![exact];
        pre_split(&mut actions, &stations, 15);
        assert_eq!(actions.len(), 1, "total == max_chunk → single chunk");

        // 5 ticks * 15 = 75 > 60 → 2 chunks
        let over = make_action(0, 0, 0, 5);
        let mut actions = vec![over];
        pre_split(&mut actions, &stations, 15);
        assert_eq!(actions.len(), 2, "total > max_chunk → two chunks");
    }

    /// Boundary: zero-work task (setup=0, run=0) — collapsed by mod.rs
    /// upstream. Layout puts prereq BEFORE consumer in actions[], matching
    /// production's sequence_order insertion. Verifies the single-pass
    /// intra-element remap still hits the LAST chunk of the prereq.
    #[test]
    fn zero_work_task_is_single_chunk_with_remap() {
        let stations = vec![make_station(60), make_station(480)];

        let prereq = make_action(0, 0, 0, 8); // 2 chunks at new idx 0, 1
        let mut zero = make_action(1, 1, 0, 0);
        zero.predecessor_idx = Some(0); // backward ref into prereq

        let mut actions = vec![prereq, zero];
        pre_split(&mut actions, &stations, 15);

        assert_eq!(actions.len(), 3, "2 chunks + 1 zero-work = 3");
        let z = actions.iter().find(|a| a.task_id == "t1").expect("zero");
        assert_eq!(
            z.predecessor_idx,
            Some(1),
            "zero-work consumer picks up the remapped predecessor's last chunk"
        );
    }

    /// Boundary: max_chunk_minutes == 0 → no split.
    #[test]
    fn max_chunk_zero_means_no_split() {
        let stations = vec![make_station(0)];
        let big = make_action(0, 0, 5, 50); // 55 ticks
        let mut actions = vec![big];
        pre_split(&mut actions, &stations, 15);
        assert_eq!(actions.len(), 1, "max_chunk=0 disables splitting");
    }

    /// Boundary: tick_minutes == 0 → early-return, no mutation.
    #[test]
    fn tick_minutes_zero_is_noop() {
        let stations = vec![make_station(60)];
        let a = make_action(0, 0, 1, 8);
        let mut actions = vec![a];
        pre_split(&mut actions, &stations, 0);
        assert_eq!(actions.len(), 1, "tick_minutes=0 leaves actions untouched");
        // No chunk_info should appear.
        assert!(actions[0].chunk_info.is_none());
    }

    /// Stress: many actions, every other one is chunked. All
    /// predecessor_idx values point BACKWARDS in the vec (matching the
    /// production invariant: build_actions inserts in sequence_order, so
    /// consumer.idx > prereq.idx). Each consumer's predecessor must land
    /// on the LAST chunk of its prereq, with valid bounds.
    #[test]
    fn stress_interleaved_chunked_and_unchunked_with_backward_prereqs() {
        let stations = vec![make_station(60), make_station(480)];

        let mut actions: Vec<Action> = Vec::new();
        let mut original_chunk_counts: Vec<usize> = Vec::new();

        for i in 0..30usize {
            let chunked = i % 2 == 0;
            let (st, setup, run) = if chunked { (0, 0, 8) } else { (1, 1, 2) };
            let mut a = make_action(i, st, setup, run);

            // BACKWARD references only: alternate between i-3 and i-1.
            if i >= 3 {
                if i % 2 == 1 {
                    a.predecessor_idx = Some(i - 3);
                } else {
                    a.predecessor_idx = Some(i - 1);
                }
            }

            actions.push(a);
            original_chunk_counts.push(if chunked { 2 } else { 1 });
        }

        // Snapshot the original layout so we can compute expected mappings.
        let mut new_indices: Vec<usize> = Vec::with_capacity(30);
        let mut cursor = 0usize;
        for &n in &original_chunk_counts {
            new_indices.push(cursor + n - 1); // last chunk's new idx
            cursor += n;
        }

        pre_split(&mut actions, &stations, 15);

        // Every consumer's predecessor_idx must equal the precomputed
        // last-chunk new idx of its original prereq.
        for new_action in &actions {
            // chunk2+ chain to prev_chunk and aren't governed by this rule.
            if let Some((chunk_n, _total, _)) = &new_action.chunk_info {
                if *chunk_n > 1 {
                    continue;
                }
            }
            let orig: usize = new_action.task_id.trim_start_matches('t').parse().unwrap();
            if orig >= 3 {
                let expected_prereq_orig = if orig % 2 == 1 { orig - 3 } else { orig - 1 };
                assert_eq!(
                    new_action.predecessor_idx,
                    Some(new_indices[expected_prereq_orig]),
                    "task t{} expected predecessor at last chunk of t{} (new idx {}), got {:?}",
                    orig,
                    expected_prereq_orig,
                    new_indices[expected_prereq_orig],
                    new_action.predecessor_idx
                );
            }
        }
    }

    /// Adversarial: consumer points at prereq that is chunked — verify the
    /// remap targets the LAST chunk (not the first). This is the difference
    /// between "wait until split task is fully done" vs "wait until first
    /// chunk done".
    #[test]
    fn primary_predecessor_remaps_to_last_chunk_not_first() {
        let stations = vec![make_station(60), make_station(480)];

        let prereq = make_action(0, 0, 0, 12); // 3 chunks (180 min / 60)
        let mut consumer = make_action(1, 1, 1, 2);
        consumer.predecessor_idx = Some(0);

        let mut actions = vec![prereq, consumer];
        pre_split(&mut actions, &stations, 15);

        // chunks of prereq at 0, 1, 2; consumer at 3
        assert_eq!(actions.len(), 4);
        let c = actions.iter().find(|a| a.task_id == "t1").expect("consumer");
        assert_eq!(
            c.predecessor_idx,
            Some(2),
            "must wait for the LAST chunk of a split prereq, not the first"
        );
    }

    // Removed: the test populated `additional_predecessors` directly on
    // an Action before pre_split, which no longer happens in production
    // (cross-cutting wiring runs AFTER pre_split via
    // wire_cross_cutting_edges). The intra-task chunk chain — first chunk
    // gets predecessor_idx from the original, subsequent chunks chain via
    // prev_chunk_idx with empty additional_predecessors — is exercised by
    // every chunking test above.
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
        borrow_until_tick: a.borrow_until_tick,
        borrowed_op_to_restore: a.borrowed_op_to_restore,
        force_max_staffing: a.force_max_staffing,
        is_in_progress: a.is_in_progress,
        task_elapsed_ticks: a.task_elapsed_ticks,
        forced_start_tick: a.forced_start_tick,
        already_eaten_ticks: a.already_eaten_ticks,
        inherited_setup_at_tick: a.inherited_setup_at_tick,
        inherited_setup_station_idx: a.inherited_setup_station_idx,
        setup_inherited: a.setup_inherited,
        setup_lost_reason: a.setup_lost_reason.clone(),
    }
}
