//! Precedence-invariant validator for compute outputs.
//!
//! Given a request's job/element structure and the final assignments, detects
//! every violation of the three precedence invariants:
//!
//! 1. **Intra-element** — within an element, task[i+1] must start ≥ task[i].end.
//! 2. **Cross-element** — an element's first task must start ≥ the last task
//!    end of each of its `prerequisite_element_ids`.
//! 3. **Cross-job** — a job's first task must start ≥ the last task end of
//!    each of its `required_job_ids`.
//!
//! The validator is pure: it reads `jobs` + `assignments`, returns violations,
//! never mutates. Used both as a runtime invariant check (callable from
//! `compute_inner` when wanting strict validation) and as a test oracle.

use std::collections::HashMap;

use crate::model::job::JobInput;
use crate::model::schedule::ComputedAssignment;

/// One precedence violation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Violation {
    pub kind: ViolationKind,
    pub offender_task_id: String,
    pub offender_start: String,
    pub predecessor_task_id: String,
    pub predecessor_end: String,
    /// Element id the offender belongs to (for cross-element this is its OWN element).
    pub offender_element_id: String,
    /// Job id the offender belongs to.
    pub offender_job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViolationKind {
    IntraElement,
    CrossElement { predecessor_element_id: String },
    CrossJob { predecessor_job_id: String },
}

/// Detect every precedence violation in `assignments` given the DAG in `jobs`.
///
/// Runs in O(J + E + T + P) where J=jobs, E=elements, T=tasks,
/// P=cross-element/job edges. String timestamps are compared lexicographically,
/// which is chronologically correct for the ISO 8601 local format the engine
/// emits.
pub fn validate_precedence(
    jobs: &[JobInput],
    assignments: &[ComputedAssignment],
) -> Vec<Violation> {
    // task_id -> (start, end)
    let asgn_by_task: HashMap<&str, (&str, &str)> = assignments
        .iter()
        .map(|a| {
            (
                a.task_id.as_str(),
                (a.scheduled_start.as_str(), a.scheduled_end.as_str()),
            )
        })
        .collect();

    // element_id -> (first_start, last_end, owning_job_id)
    struct ElemAgg<'a> {
        first_start: Option<&'a str>,
        last_end: Option<&'a str>,
        job_id: &'a str,
        first_task_id: Option<&'a str>,
        last_task_id: Option<&'a str>,
    }
    let mut elem_agg: HashMap<&str, ElemAgg> = HashMap::new();

    // job_id -> (first_start, last_end, first/last task_id)
    struct JobAgg<'a> {
        first_start: Option<&'a str>,
        last_end: Option<&'a str>,
        first_task_id: Option<&'a str>,
        last_task_id: Option<&'a str>,
    }
    let mut job_agg: HashMap<&str, JobAgg> = HashMap::new();

    for job in jobs {
        let j = job_agg.entry(job.id.as_str()).or_insert(JobAgg {
            first_start: None,
            last_end: None,
            first_task_id: None,
            last_task_id: None,
        });

        for element in &job.elements {
            let e = elem_agg.entry(element.id.as_str()).or_insert(ElemAgg {
                first_start: None,
                last_end: None,
                job_id: job.id.as_str(),
                first_task_id: None,
                last_task_id: None,
            });

            for task in &element.tasks {
                if let Some(&(start, end)) = asgn_by_task.get(task.id.as_str()) {
                    match e.first_start {
                        None => {
                            e.first_start = Some(start);
                            e.first_task_id = Some(task.id.as_str());
                        }
                        Some(cur) if start < cur => {
                            e.first_start = Some(start);
                            e.first_task_id = Some(task.id.as_str());
                        }
                        _ => {}
                    }
                    match e.last_end {
                        None => {
                            e.last_end = Some(end);
                            e.last_task_id = Some(task.id.as_str());
                        }
                        Some(cur) if end > cur => {
                            e.last_end = Some(end);
                            e.last_task_id = Some(task.id.as_str());
                        }
                        _ => {}
                    }

                    match j.first_start {
                        None => {
                            j.first_start = Some(start);
                            j.first_task_id = Some(task.id.as_str());
                        }
                        Some(cur) if start < cur => {
                            j.first_start = Some(start);
                            j.first_task_id = Some(task.id.as_str());
                        }
                        _ => {}
                    }
                    match j.last_end {
                        None => {
                            j.last_end = Some(end);
                            j.last_task_id = Some(task.id.as_str());
                        }
                        Some(cur) if end > cur => {
                            j.last_end = Some(end);
                            j.last_task_id = Some(task.id.as_str());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    let mut violations = Vec::new();

    // INTRA-ELEMENT
    for job in jobs {
        for element in &job.elements {
            let mut sorted = element.tasks.clone();
            sorted.sort_by_key(|t| t.sequence_order);
            for w in sorted.windows(2) {
                let a = &w[0];
                let b = &w[1];
                let a_end = asgn_by_task.get(a.id.as_str()).map(|(_, e)| *e);
                let b_start = asgn_by_task.get(b.id.as_str()).map(|(s, _)| *s);
                if let (Some(ae), Some(bs)) = (a_end, b_start) {
                    if ae > bs {
                        violations.push(Violation {
                            kind: ViolationKind::IntraElement,
                            offender_task_id: b.id.clone(),
                            offender_start: bs.to_string(),
                            predecessor_task_id: a.id.clone(),
                            predecessor_end: ae.to_string(),
                            offender_element_id: element.id.clone(),
                            offender_job_id: job.id.clone(),
                        });
                    }
                }
            }
        }
    }

    // CROSS-ELEMENT
    for job in jobs {
        for element in &job.elements {
            if element.prerequisite_element_ids.is_empty() {
                continue;
            }
            let Some(e) = elem_agg.get(element.id.as_str()) else { continue };
            let Some(first_start) = e.first_start else { continue };
            let Some(first_task_id) = e.first_task_id else { continue };
            for prereq_id in &element.prerequisite_element_ids {
                let Some(pe) = elem_agg.get(prereq_id.as_str()) else { continue };
                let (Some(p_last_end), Some(p_last_task)) = (pe.last_end, pe.last_task_id) else {
                    continue;
                };
                if p_last_end > first_start {
                    violations.push(Violation {
                        kind: ViolationKind::CrossElement {
                            predecessor_element_id: prereq_id.clone(),
                        },
                        offender_task_id: first_task_id.to_string(),
                        offender_start: first_start.to_string(),
                        predecessor_task_id: p_last_task.to_string(),
                        predecessor_end: p_last_end.to_string(),
                        offender_element_id: element.id.clone(),
                        offender_job_id: job.id.clone(),
                    });
                }
            }
        }
    }

    // CROSS-JOB
    for job in jobs {
        if job.required_job_ids.is_empty() {
            continue;
        }
        let Some(j) = job_agg.get(job.id.as_str()) else { continue };
        let Some(first_start) = j.first_start else { continue };
        let Some(first_task_id) = j.first_task_id else { continue };
        for req_id in &job.required_job_ids {
            let Some(rj) = job_agg.get(req_id.as_str()) else { continue };
            let (Some(r_last_end), Some(r_last_task)) = (rj.last_end, rj.last_task_id) else {
                continue;
            };
            if r_last_end > first_start {
                violations.push(Violation {
                    kind: ViolationKind::CrossJob {
                        predecessor_job_id: req_id.clone(),
                    },
                    offender_task_id: first_task_id.to_string(),
                    offender_start: first_start.to_string(),
                    predecessor_task_id: r_last_task.to_string(),
                    predecessor_end: r_last_end.to_string(),
                    offender_element_id: String::new(),
                    offender_job_id: job.id.clone(),
                });
            }
        }
    }

    violations
}

/// Counts violations by kind. Useful for test assertions and logging.
pub fn violation_summary(violations: &[Violation]) -> (usize, usize, usize) {
    let mut intra = 0;
    let mut cross_elem = 0;
    let mut cross_job = 0;
    for v in violations {
        match v.kind {
            ViolationKind::IntraElement => intra += 1,
            ViolationKind::CrossElement { .. } => cross_elem += 1,
            ViolationKind::CrossJob { .. } => cross_job += 1,
        }
    }
    (intra, cross_elem, cross_job)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::job::{ElementInput, TaskInput};

    fn task(id: &str, seq: u32, station: &str) -> TaskInput {
        TaskInput {
            id: id.into(),
            station_id: station.into(),
            setup_minutes: 0,
            run_minutes: 60,
            sequence_order: seq,
            is_pinned: false,
            pinned_start_tick: None,
            pinned_end_tick: None,
            predecessor_gap_minutes: 0,
        }
    }

    fn elem(id: &str, tasks: Vec<TaskInput>, prereqs: Vec<String>) -> ElementInput {
        ElementInput {
            id: id.into(),
            name: None,
            tasks,
            spec: None,
            prerequisite_element_ids: prereqs,
        }
    }

    fn job(id: &str, elements: Vec<ElementInput>, required: Vec<String>) -> JobInput {
        JobInput {
            id: id.into(),
            reference: None,
            description: None,
            deadline: None,
            deadline_priority: 2,
            elements,
            required_job_ids: required,
        }
    }

    fn asg(task_id: &str, start: &str, end: &str) -> ComputedAssignment {
        ComputedAssignment {
            task_id: task_id.into(),
            station_id: "s".into(),
            scheduled_start: start.into(),
            scheduled_end: end.into(),
            operators: vec![],
            setup_end: None,
            is_degraded: false,
            effective_productivity: 1.0,
            is_masked_time: false,
            recalages: vec![],
        }
    }

    #[test]
    fn clean_schedule_returns_no_violations() {
        let jobs = vec![job(
            "j1",
            vec![elem(
                "e1",
                vec![task("t0", 0, "s1"), task("t1", 1, "s1")],
                vec![],
            )],
            vec![],
        )];
        let asgn = vec![
            asg("t0", "2026-04-22T08:00:00", "2026-04-22T09:00:00"),
            asg("t1", "2026-04-22T09:00:00", "2026-04-22T10:00:00"),
        ];
        assert!(validate_precedence(&jobs, &asgn).is_empty());
    }

    #[test]
    fn intra_element_inversion_detected() {
        // seq 1 starts BEFORE seq 0 ends — the Cahier 2 bug pattern.
        let jobs = vec![job(
            "j1",
            vec![elem(
                "e1",
                vec![task("t0", 0, "s1"), task("t1", 1, "s1")],
                vec![],
            )],
            vec![],
        )];
        let asgn = vec![
            asg("t0", "2026-06-05T10:00:00", "2026-06-05T12:00:00"),
            asg("t1", "2026-04-27T10:00:00", "2026-05-08T12:00:00"),
        ];
        let v = validate_precedence(&jobs, &asgn);
        assert_eq!(v.len(), 1);
        assert!(matches!(v[0].kind, ViolationKind::IntraElement));
        assert_eq!(v[0].offender_task_id, "t1");
    }

    #[test]
    fn cross_element_inversion_detected() {
        // e2 depends on e1 but e2 starts before e1 ends.
        let jobs = vec![job(
            "j1",
            vec![
                elem("e1", vec![task("t_e1", 0, "s1")], vec![]),
                elem("e2", vec![task("t_e2", 0, "s2")], vec!["e1".into()]),
            ],
            vec![],
        )];
        let asgn = vec![
            asg("t_e1", "2026-04-22T10:00:00", "2026-04-22T12:00:00"),
            asg("t_e2", "2026-04-22T09:00:00", "2026-04-22T10:00:00"),
        ];
        let v = validate_precedence(&jobs, &asgn);
        assert_eq!(v.len(), 1);
        assert!(matches!(v[0].kind, ViolationKind::CrossElement { .. }));
    }

    #[test]
    fn cross_job_inversion_detected() {
        let jobs = vec![
            job(
                "j1",
                vec![elem("e1", vec![task("t_j1", 0, "s1")], vec![])],
                vec![],
            ),
            job(
                "j2",
                vec![elem("e2", vec![task("t_j2", 0, "s2")], vec![])],
                vec!["j1".into()],
            ),
        ];
        let asgn = vec![
            asg("t_j1", "2026-04-22T14:00:00", "2026-04-22T15:00:00"),
            asg("t_j2", "2026-04-22T13:00:00", "2026-04-22T14:00:00"),
        ];
        let v = validate_precedence(&jobs, &asgn);
        assert_eq!(v.len(), 1);
        assert!(matches!(v[0].kind, ViolationKind::CrossJob { .. }));
    }

    // ============================================================
    // Compute-level integration tests
    //
    // These tests drive the ENTIRE engine via `compute()` and then run
    // validate_precedence() on the output. They EXIST to reproduce the
    // B1/B2/B3 bugs before the fixes land, so the test suite documents
    // the before/after semantics.
    // ============================================================

    mod compute_integration {
        use super::super::*;
        use crate::engine::compute;
        use crate::model::job::{ElementInput, JobInput, TaskInput};
        use crate::model::operator::{
            ConcurrentGroupInput, DaySchedule, OperatingSchedule, OperatorInput, OperatorSkill,
            TimeSlot,
        };
        use crate::model::schedule::{ComputeOptions, ComputeRequest};
        use crate::model::station::StationInput;

        fn full_day() -> DaySchedule {
            DaySchedule {
                slots: vec![TimeSlot { start: "00:00".into(), end: "23:59".into() }],
            }
        }

        fn always_on_schedule() -> OperatingSchedule {
            OperatingSchedule {
                monday: Some(full_day()),
                tuesday: Some(full_day()),
                wednesday: Some(full_day()),
                thursday: Some(full_day()),
                friday: Some(full_day()),
                saturday: Some(full_day()),
                sunday: Some(full_day()),
            }
        }

        fn station(id: &str) -> StationInput {
            StationInput {
                id: id.into(),
                name: id.into(),
                attention_full: Some(1.0),
                attention_run: Some(1.0),
                max_run_attention: None,
                masked_time_enabled: false,
                attention_masked: None,
                masked_productivity: None,
                tick_minutes: Some(15),
                peremption_threshold_minutes: None,
                max_chunk_minutes: Some(420),
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

        fn operator(id: &str, station_ids: &[&str]) -> OperatorInput {
            OperatorInput {
                id: id.into(),
                first_name: id.into(),
                last_name: "Test".into(),
                role: "operator".into(),
                operating_schedules: Some(vec![always_on_schedule()]),
                schedule_rotation_reference_week: None,
                skills: station_ids
                    .iter()
                    .map(|s| OperatorSkill { station_id: (*s).into(), proficiency: 1.0 })
                    .collect(),
                concurrent_groups: Vec::<ConcurrentGroupInput>::new(),
                absences: Vec::new(),
                overtimes: Vec::new(),
            }
        }

        fn task_60min(id: &str, seq: u32, station: &str) -> TaskInput {
            // Setup-heavy to keep place_backward in the setup phase where
            // productivity = 1.0/tick (avoids the latent "productivity
            // computed before op assignment" issue in the run phase).
            TaskInput {
                id: id.into(),
                station_id: station.into(),
                setup_minutes: 60,
                run_minutes: 0,
                sequence_order: seq,
                is_pinned: false,
                pinned_start_tick: None,
                pinned_end_tick: None,
                predecessor_gap_minutes: 0,
            }
        }

        fn task_with_setup(id: &str, seq: u32, station: &str, setup_minutes: u32) -> TaskInput {
            TaskInput {
                id: id.into(),
                station_id: station.into(),
                setup_minutes,
                run_minutes: 0,
                sequence_order: seq,
                is_pinned: false,
                pinned_start_tick: None,
                pinned_end_tick: None,
                predecessor_gap_minutes: 0,
            }
        }

        /// Produce a deadline string N days in the future at 17:00 local.
        fn deadline_in_days(n: i64) -> String {
            use chrono::{Duration, Local};
            let d = (Local::now() + Duration::days(n)).date_naive();
            format!("{}T17:00:00", d)
        }

        /// REPRODUCES B1 (cross-element ALAP inversion).
        ///
        /// One tier-1 job with two elements E1 and E2 on different stations.
        /// E2 depends on E1 (`prerequisite_element_ids=[E1]`). Both are tier-1
        /// so both get ALAP-placed from the same deadline by the backward pass.
        /// Since the backward pass doesn't wire cross-element successors,
        /// E2's last task and E1's last task are placed at the SAME ALAP slot,
        /// producing a cross-element precedence violation.
        ///
        /// This test is EXPECTED TO FAIL on the current (pre-fix) code.
        /// After the B1 fix (Step 2), this test must pass with 0 violations.
        #[test]
        fn b1_cross_element_alap_inversion() {
            // Two tier-1 jobs so the ALAP path is engaged (fbi.rs:154 gates
            // ALAP on jobs.len() > 1). j1 is the one we're probing; j2 is a
            // dummy to unlock ALAP.
            // E1 runs 4 HOURS on S1 (so ALAP walks it back from deadline 17:00
            // to 13:00). E2 runs 1 HOUR on S2 — ALAP will place it at 16:00-17:00,
            // overlapping E1's end. Without cross-element awareness, backward_pass
            // doesn't know E2 should start AFTER E1 ends.
            let tier1_job_under_test = JobInput {
                id: "j1".into(),
                reference: None,
                description: None,
                deadline: Some(deadline_in_days(2)),
                deadline_priority: 1,
                elements: vec![
                    ElementInput {
                        id: "E1".into(),
                        name: None,
                        tasks: vec![task_with_setup("t_E1", 0, "S1", 240)],
                        spec: None,
                        prerequisite_element_ids: vec![],
                    },
                    ElementInput {
                        id: "E2".into(),
                        name: None,
                        tasks: vec![task_60min("t_E2", 0, "S2")],
                        spec: None,
                        prerequisite_element_ids: vec!["E1".into()],
                    },
                ],
                required_job_ids: vec![],
            };
            let tier1_dummy = JobInput {
                id: "j2".into(),
                reference: None,
                description: None,
                deadline: Some(deadline_in_days(2)),
                deadline_priority: 1,
                elements: vec![ElementInput {
                    id: "E_dummy".into(),
                    name: None,
                    tasks: vec![task_60min("t_dummy", 0, "S1")],
                    spec: None,
                    prerequisite_element_ids: vec![],
                }],
                required_job_ids: vec![],
            };

            // Per-station dedicated operators — removes the "one op, many
            // stations" contention that otherwise pushes tasks post-deadline
            // and masks B1 behind unrelated lateness.
            let req = ComputeRequest {
                stations: vec![station("S1"), station("S2")],
                operators: vec![
                    operator("op_s1", &["S1"]),
                    operator("op_s2", &["S2"]),
                ],
                jobs: vec![tier1_job_under_test, tier1_dummy],
                options: Some(ComputeOptions {
                    skip_lns: Some(true),
                    multi_start: false,
                    perturbed_starts: 0,
                    ..ComputeOptions::default()
                }),
                station_groups: vec![],
                occupied_slots: vec![],
            };

            let result = compute(&req);
            let violations = validate_precedence(&req.jobs, &result.assignments);
            let (intra, cross_elem, cross_job) = violation_summary(&violations);
            assert_eq!(
                (intra, cross_elem, cross_job),
                (0, 0, 0),
                "found violations: {:?}",
                violations,
            );
        }

        /// REPRODUCES B2+B3 (intra-element inversion when a chain partially
        /// fails ALAP and falls through to forward pass).
        ///
        /// Tier-1 job with one element, two sequential tasks on the same
        /// station. We force the station to be saturated such that seq 0
        /// cannot be placed by ALAP backward from seq 1's last_tick.
        ///
        /// Without fixes: seq 1 gets ALAP-placed, seq 0 fails place_backward
        /// and falls through to forward_pass with no precedence info (seq 1's
        /// end_tick is zeroed), producing an intra-element inversion.
        ///
        /// REPRODUCES B2+B3: ALAP places seq 1 successfully but seq 0 fails
        /// (no operator available for its backward window). Without the fix,
        /// seq 0 falls through to forward_pass with zeroed predecessor ALAP
        /// → placed at an arbitrary tick, potentially AFTER seq 1. With the
        /// B3 rollback, the whole element goes through forward_pass uniformly
        /// so intra-element precedence via `predecessor_idx` is respected.
        #[test]
        fn b2_b3_intra_element_after_alap_rollback() {
            use chrono::NaiveDateTime;

            // Operator op_s1 absent for a wide window covering the backward
            // slot seq 0 would need. seq 1 on S2 can be ALAP-placed normally
            // (op_s2 is always-on). seq 0 on S1 cannot ALAP-place and must
            // fall through to forward_pass.
            let absent_start =
                NaiveDateTime::parse_from_str("2026-04-22T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap();
            let absent_end =
                NaiveDateTime::parse_from_str("2026-04-24T16:00:00", "%Y-%m-%dT%H:%M:%S").unwrap();

            let op_s1 = OperatorInput {
                id: "op_s1".into(),
                first_name: "OpS1".into(),
                last_name: "Test".into(),
                role: "operator".into(),
                operating_schedules: Some(vec![always_on_schedule()]),
                schedule_rotation_reference_week: None,
                skills: vec![OperatorSkill {
                    station_id: "S1".into(),
                    proficiency: 1.0,
                }],
                concurrent_groups: vec![],
                absences: vec![crate::model::operator::Absence {
                    start_at: absent_start,
                    end_at: absent_end,
                    reason: None,
                }],
                overtimes: vec![],
            };

            let j1 = JobInput {
                id: "j1".into(),
                reference: None,
                description: None,
                deadline: Some(deadline_in_days(2)),
                deadline_priority: 1,
                elements: vec![ElementInput {
                    id: "E".into(),
                    name: None,
                    tasks: vec![
                        task_60min("t_seq0", 0, "S1"),
                        task_60min("t_seq1", 1, "S2"),
                    ],
                    spec: None,
                    prerequisite_element_ids: vec![],
                }],
                required_job_ids: vec![],
            };
            let j2 = JobInput {
                id: "j2".into(),
                reference: None,
                description: None,
                deadline: Some(deadline_in_days(2)),
                deadline_priority: 1,
                elements: vec![ElementInput {
                    id: "E_dummy".into(),
                    name: None,
                    tasks: vec![task_60min("t_dummy", 0, "S2")],
                    spec: None,
                    prerequisite_element_ids: vec![],
                }],
                required_job_ids: vec![],
            };

            let req = ComputeRequest {
                stations: vec![station("S1"), station("S2")],
                operators: vec![op_s1, operator("op_s2", &["S2"])],
                jobs: vec![j1, j2],
                options: Some(ComputeOptions {
                    skip_lns: Some(true),
                    multi_start: false,
                    perturbed_starts: 0,
                    ..ComputeOptions::default()
                }),
                station_groups: vec![],
                occupied_slots: vec![],
            };

            let result = compute(&req);
            let violations = validate_precedence(&req.jobs, &result.assignments);
            let (intra, cross_elem, cross_job) = violation_summary(&violations);
            assert_eq!(
                (intra, cross_elem, cross_job),
                (0, 0, 0),
                "found violations: {:?} | assignments: {:?}",
                violations,
                result.assignments.iter().map(|a| format!("{}:{}->{}", a.task_id, a.scheduled_start, a.scheduled_end)).collect::<Vec<_>>(),
            );
        }
    }

    #[test]
    fn summary_counts_each_kind() {
        let v = vec![
            Violation {
                kind: ViolationKind::IntraElement,
                offender_task_id: "a".into(),
                offender_start: "".into(),
                predecessor_task_id: "b".into(),
                predecessor_end: "".into(),
                offender_element_id: "e".into(),
                offender_job_id: "j".into(),
            },
            Violation {
                kind: ViolationKind::CrossElement { predecessor_element_id: "p".into() },
                offender_task_id: "c".into(),
                offender_start: "".into(),
                predecessor_task_id: "d".into(),
                predecessor_end: "".into(),
                offender_element_id: "e2".into(),
                offender_job_id: "j".into(),
            },
        ];
        assert_eq!(violation_summary(&v), (1, 1, 0));
    }
}
