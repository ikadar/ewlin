---
tags:
  - specification
  - domain
---

# Domain Open Questions – Flux Print Shop Scheduling System

This document collects **unresolved or partially clarified domain questions** that should be answered before completing the domain model, workflows, or implementation.
It is intentionally concise and structured for iterative refinement.

---

## 1. Station Management

### Resolved ✓
- ✓ Stations have categories with similarity criteria
- ✓ Stations belong to groups with capacity limits
- ✓ All stations must belong to exactly one group
- ✓ Operating schedules support recurring weekly patterns + exceptions
- ✓ Seasonal schedules: Not in MVP, future improvement
- ✓ Reduced capacity (50%): Not supported
- ✓ Backup/substitute stations: Not supported (out of scope)
- ✓ Multiple categories per station: Not supported

---

## 2. Outsourced Providers

### Resolved ✓
- ✓ Each provider has unlimited capacity (own group with no limit)
- ✓ Provider tasks use open days (JO) for duration
- ✓ Providers have supported action types (Pelliculage, Dorure, etc.)
- ✓ Limited capacity in future: Not supported (providers always unlimited)
- ✓ Provider-specific business calendars: Not in MVP, future improvement
- ✓ Multiple concurrent jobs from same client: Supported
- ✓ Cost tracking: Out of scope (scheduling is not related to costs)

---

## 3. Task Definition

### Resolved ✓
- ✓ Tasks are defined using DSL syntax
- ✓ Internal tasks: `[Station] setup+run "comment"`
- ✓ Outsourced tasks: `ST [Provider] ActionType duration "comment"`
- ✓ Station names with spaces use underscores
- ✓ Comments can appear anywhere with quotes
- ✓ Single task spanning multiple stations: Not supported
- ✓ Task templates: Not supported
- ✓ Task duration: User-provided, not calculated from complexity
- ✓ Optional tasks: Not supported (all tasks are required)

---

## 4. Job Dependencies

### Resolved ✓
- ✓ Dependencies are at job level only (not task level)
- ✓ Circular dependencies are prevented
- ✓ Dependent job cannot start until prerequisites complete
- ✓ Conditional dependencies: Not supported (no success/failure concept)
- ✓ External event triggers: Not supported (approval gates happen before scheduling)
- ✓ Cross-client dependencies: Not supported (client irrelevant to dependencies)

---

## 5. Scheduling Constraints

### Resolved ✓
- ✓ 30-minute snap grid for scheduling
- ✓ Precedence within job must be respected (unless Alt bypass)
- ✓ Station unavailability stretches task duration
- ✓ Group capacity limits concurrent tasks
- ✓ Min/max gap between tasks: Not required
- ✓ Schedule outside operating hours: Not supported (future: UI for modifying downtime)
- ✓ Facility-wide constraints: Not supported
- ✓ Provider travel time: Handled via LatestDepartureTime/ReceptionTime
- ✓ Tight schedule warnings: Not supported

---

## 6. Approval Gates

### Resolved ✓
- ✓ BAT (Proof): Must be sent and approved before scheduling
- ✓ BAT can be marked "NoProofRequired" to bypass
- ✓ Plates: Must be "Done" before printing tasks
- ✓ Paper status tracked: InStock, ToOrder, Ordered, Received
- ✓ Tasks without BAT: Only if job configured "NoProofRequired"
- ✓ Automatic BAT timeout: Not supported
- ✓ BAT pending notifications: Not in MVP
- ✓ Additional approval gates: Not in MVP
- ✓ Partial paper reception: Not supported (all or nothing)

---

## 7. Validation & Conflicts

### Resolved ✓
- ✓ Real-time validation during drag (< 10ms)
- ✓ Server-side authoritative validation
- ✓ Conflict types: Station, GroupCapacity, Precedence, ApprovalGate, Availability
- ✓ Escalation path: None (user resolves outside system)
- ✓ Override validation rules: Not supported
- ✓ Re-validation: On any schedule or job definition change
- ✓ Optimal resolution suggestions: Not supported

---

## 8. Similarity Indicators

### Resolved ✓
- ✓ Visual circles between consecutive tiles
- ✓ Filled = matching criterion, Hollow = non-matching
- ✓ Criteria defined per station category
- ✓ Scheduling suggestions: Not supported (no auto-scheduling)
- ✓ Utilization optimization: Not supported (visual cue only)
- ✓ Composite criteria: Not supported (each criterion separate)

---

## 9. UI/UX Questions

### Resolved ✓
- ✓ Vertical time axis (time flows downward)
- ✓ 3-panel layout (Left: Jobs, Center: Grid, Right: Late jobs)
- ✓ Alt-key bypasses precedence safeguard
- ✓ Recall removes only the specific task assignment
- ✓ Zoom levels (day/week/month): Not in MVP, future improvement
- ✓ Customize column order/width: Not in MVP, future improvement
- ✓ Compact view: Not in MVP, future improvement
- ✓ Progress during execution: Not supported
- ✓ Multi-day tasks display: Same as other tasks

---

## 10. Performance Requirements

### Resolved ✓
- ✓ Drag feedback < 10ms
- ✓ Grid render (100 tiles) < 100ms
- ✓ Initial load < 2s
- ✓ Max concurrent jobs: ~300 non-completed
- ✓ Max stations: MVP dozens, up to 100 later
- ✓ Time range: Dynamic (jobs completed within last 14 days)
- ✓ Offline mode: Not supported

---

## 11. Implementation Decisions

### Resolved ✓
- ✓ Similarity criteria: Assigned during job creation via Job fields
- ✓ Station schedule change: MVP doesn't allow with existing assignments; tiles push down (no overlap)
- ✓ Outsourced task start: Business days only
- ✓ Job color: Random per job; dependent jobs use shades of same color
- ✓ Paper status granularity: Per job
- ✓ Comments attribution: Anonymous (MVP); auth post-MVP
- ✓ Cancelled job: Future tiles recalled, past remain; task completion checkbox on tiles
- ✓ Rush/priority jobs: Not in MVP

---

## 12. Post-MVP Considerations

### Schedule Branching
- Multiple schedule versions for what-if analysis
- PROD designation for active schedule
- Branch comparison views

### Automation/Optimization
- Auto-scheduling suggestions
- Conflict resolution recommendations
- Utilization optimization

### Reporting
- Job completion analytics
- Station utilization reports
- Late job trends

### Integration
- ERP/MES integration for job import
- Customer portal for order tracking
- Mobile app for shop floor updates

### Multi-User
- Concurrent editing support
- User role permissions
- Change audit trail

---

## 13. Recently Resolved Questions

Questions that were open but have been resolved through discussion:

| Question | Resolution | Date |
|----------|------------|------|
| Time axis orientation | Vertical (time flows down) | Initial design |
| Operator management | Removed from scope | Initial design |
| Station names with spaces | Use underscores in DSL | Q&A session |
| Outsourced provider capacity | Unlimited (own group) | Q&A session |
| DSL specification | Separate document created | Q&A session |
| Job dependency level | Job-level only | Q&A session |
| Deadline field name | `workshopExitDate` | Q&A session |
| Schedule branching | Post-MVP | Q&A session |
| Station maintenance scheduling | MaintenanceBlock entity (like TaskAssignment), Post-MVP | 2025-12-12 |
| Outsourced task lead times | Added LatestDepartureTime and ReceptionTime to OutsourcedDuration | 2025-12-12 |
| Task interruption/splitting | Post-MVP; MVP shows single tile with downtime visual distinction | 2025-12-12 |
| Job dependency types | Finish-to-start only; no start-to-start or finish-to-finish | 2025-12-12 |
| Validation warnings vs blocks | MVP: visual warnings only, no hard blocks | 2025-12-12 |
| Similarity criteria values | fieldPath on Job entity; already implemented in SimilarityCriterion | 2025-12-12 |
| Station seasonal schedules | Not in MVP, future improvement | 2025-12-12 |
| Station reduced capacity | Not supported | 2025-12-12 |
| Backup/substitute stations | Out of scope | 2025-12-12 |
| Multiple categories per station | Not supported | 2025-12-12 |
| Provider limited capacity | Not supported (always unlimited) | 2025-12-12 |
| Provider-specific business calendars | Not in MVP, future improvement | 2025-12-12 |
| Multiple concurrent jobs from same client | Supported | 2025-12-12 |
| Cost tracking | Out of scope | 2025-12-12 |
| Task spanning multiple stations | Not supported | 2025-12-12 |
| Task templates | Not supported | 2025-12-12 |
| Task duration calculation | User-provided, not calculated | 2025-12-12 |
| Optional tasks | Not supported (all required) | 2025-12-12 |
| Conditional dependencies | Not supported (no success/failure concept) | 2025-12-12 |
| External event triggers | Not supported (approval gates before scheduling) | 2025-12-12 |
| Cross-client dependencies | Not supported | 2025-12-12 |
| Min/max gap between tasks | Not required | 2025-12-12 |
| Schedule outside operating hours | Not supported (future: UI modification) | 2025-12-12 |
| Facility-wide constraints | Not supported | 2025-12-12 |
| Provider travel time | Handled via LatestDepartureTime/ReceptionTime | 2025-12-12 |
| Tight schedule warnings | Not supported | 2025-12-12 |
| Tasks without BAT | Only if job configured "NoProofRequired" | 2025-12-12 |
| Automatic BAT timeout | Not supported | 2025-12-12 |
| BAT pending notifications | Not in MVP | 2025-12-12 |
| Additional approval gates | Not in MVP | 2025-12-12 |
| Partial paper reception | Not supported (all or nothing) | 2025-12-12 |
| Conflict escalation path | None (user resolves outside system) | 2025-12-12 |
| Override validation rules | Not supported | 2025-12-12 |
| Re-validation frequency | On any schedule or job change | 2025-12-12 |
| Optimal resolution suggestions | Not supported | 2025-12-12 |
| Similarity scheduling suggestions | Not supported (no auto-scheduling) | 2025-12-12 |
| Similarity utilization optimization | Not supported (visual cue only) | 2025-12-12 |
| Composite similarity criteria | Not supported (each criterion separate) | 2025-12-12 |
| Grid zoom levels | Not in MVP, future improvement | 2025-12-12 |
| Customize column order/width | Not in MVP, future improvement | 2025-12-12 |
| Compact view | Not in MVP, future improvement | 2025-12-12 |
| Progress during execution | Not supported | 2025-12-12 |
| Multi-day tasks display | Same as other tasks | 2025-12-12 |
| Max concurrent jobs | ~300 non-completed | 2025-12-12 |
| Max stations | MVP dozens, up to 100 later | 2025-12-12 |
| Time range display | Dynamic (jobs completed within last 14 days) | 2025-12-12 |
| Offline mode | Not supported | 2025-12-12 |
| Similarity criteria assignment | During job creation via Job fields | 2025-12-12 |
| Station schedule change with assignments | MVP doesn't allow; tiles push down | 2025-12-12 |
| Outsourced task start day | Business days only | 2025-12-12 |
| Job color assignment | Random per job; dependent jobs use shades | 2025-12-12 |
| Paper status granularity | Per job | 2025-12-12 |
| Comments attribution | Anonymous (MVP); auth post-MVP | 2025-12-12 |
| Cancelled job assignments | Future tiles recalled, past remain | 2025-12-12 |
| Task completion checkbox | On tiles; doesn't affect precedence rules | 2025-12-12 |
| Rush/priority jobs | Not in MVP | 2025-12-12 |

---

## 14. Open Questions (Pending Resolution)

Questions identified during specification review that require design decisions:

### OQ-001: Job Color Shade Algorithm for Dependent Jobs
**Context:** BR-JOB-009 states "Dependent jobs (via requiredJobIds) SHOULD use shades of the same base color for visual grouping."

**Unresolved:**
- How should shades be calculated? (lighter? darker? both?)
- What if a job depends on multiple jobs with different colors?
- What is the maximum depth of color shading (chain of dependencies)?
- Should the algorithm ensure sufficient contrast for accessibility?

**Options to consider:**
1. Always use lighter shades of the first required job's color
2. Use a specific lightness adjustment formula (e.g., HSL +10% lightness per dependency level)
3. Use a predefined palette of shades for each base color
4. Ignore color inheritance for multi-parent dependencies (use random color)

**Impact:** UI/UX design, accessibility, frontend implementation

---

This file should be continuously updated as the team learns more about the domain and resolves these questions.
