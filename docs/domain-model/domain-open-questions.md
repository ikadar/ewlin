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

### Open Questions
- Can certain task types proceed without BAT approval?
Only if the job is configured with "Pas de BAT" (or "Sans BAT", I don't remember which terminology I used but you get the idea)
- Is there an automatic timeout for BAT approval?
No
- Should the system notify when BAT is pending too long?
Not in MVP.
- Are there other approval gates beyond BAT and Plates?
Not in MVP.
- Can paper be partially received (e.g., 50% of order)?
No. Until all the paper is received we treat is as none of the paper is received.

---

## 7. Validation & Conflicts

### Resolved ✓
- ✓ Real-time validation during drag (< 10ms)
- ✓ Server-side authoritative validation
- ✓ Conflict types: Station, GroupCapacity, Precedence, ApprovalGate, Availability

### Open Questions
- What is the escalation path for unresolvable conflicts?
No path. The user receives the information through the UI and makes his decision with it. Unresolvable conflicts are a business matter that is solved outside of the scheduling system : calling a client to postpone a deadline, outsourcing a traditionnaly in-house action, etc.
- Can certain users override specific validation rules?
No.
- How often should the system re-validate existing schedules?
Anytime a change is made to the schedule or to a job definition (for example a deadline modification or the addition of a new action).
- Should the system suggest optimal conflict resolution?
No.

---

## 8. Similarity Indicators

### Resolved ✓
- ✓ Visual circles between consecutive tiles
- ✓ Filled = matching criterion, Hollow = non-matching
- ✓ Criteria defined per station category

### Open Questions
- Should similarity influence scheduling suggestions?
There are not scheduling suggestions.
- Can similarity be used to optimize station utilization?
It is only a visual cue provided to the user. Basically if the user sees a lot of fullfilled similarity criteria that are met here and there he know he has some leeway in his schedule and is likely to diminish the likelihood of the schedule not being met IRL.
- Are there composite criteria (e.g., "same paper" = type + size)?
No. Each criteria is separate and unique. What you call composite criteria is actually handled as more than one criteria.

---

## 9. UI/UX Questions

### Resolved ✓
- ✓ Vertical time axis (time flows downward)
- ✓ 3-panel layout (Left: Jobs, Center: Grid, Right: Late jobs)
- ✓ Alt-key bypasses precedence safeguard
- ✓ Recall removes only the specific task assignment

### Open Questions
- Should the grid support zoom levels (day/week/month)?
Not in MVP but clearly, in the near future, yes.
- Can users customize column order and width?
Not in MVP but otherwise yes.
- Is there a "compact view" for high-density schedules?
Not in MVP but otherwise yes.
- Should tiles show progress during execution?
No.
- How are very long tasks (multi-day) displayed?
Same as the other tasks.

---

## 10. Performance Requirements

### Resolved ✓
- ✓ Drag feedback < 10ms
- ✓ Grid render (100 tiles) < 100ms
- ✓ Initial load < 2s

### Open Questions
- What is the expected maximum number of concurrent jobs?
If we are talking about non-completed jobs, let's say maximum 300. Otherwise much more but it depends on the overall time span that is accessible through the user interface.
- How many stations should the system support?
For MVP a few dozens. Up to one hundred later.
- What is the maximum time range to display (2 weeks, 1 month)?
I suggest the following : we display a timeframe that is dynamic as in it show all the tasks of jobs that have not had all their tasks marked as done (see below) earlier that 14 days ago.
- Should the system support offline mode?
No.

---

## 11. Questions Blocking Implementation

These questions should be resolved before implementation can begin:

1. **How are similarity criteria values assigned to jobs?**
   - Who enters this data?
   See my answer above. If not clear, ask away. I feel this similarity criteria stuff isn't clear for you.
   - Is it part of job creation or separate workflow?
   It is part of job creation

2. **What happens when station schedule changes with existing assignments?**
   - Auto-reschedule?
   - Flag as conflict?
   - Notify user?
   In the MVP we don't allow schedule changes with existing assignments. I want to clarify that in the MVP we allow the user to create a schedule that violates precedence requirements but we inform him of his violations through the visual cues that have been specified. The user cannot make two tiles overlap unless the station capacity allows for it so when a tile is inserted somewhere it "pushes down" the subsequent tiles of the station. Basically I can insert tiles between others, not over others.

3. **Can outsourced tasks start on any day or only on business days?**
   - If starting Saturday, does the 2JO count from Monday?
   Only on business day.

4. **How is job color assigned?**
   - Random per job?
   - User-selectable?
   - Based on client or job type?
   Random per job with mutually dependant jobs appearing as shades of one another.

5. **What is the granularity of paper status tracking?**
   - Per job?
   - Per paper type?
   - Per quantity?
   Per job.

6. **How are comments attributed?**
   - Anonymous?
   - Logged-in user?
   - System-generated?
   For MVP, anonymous (we will handle auth right AFTER the MVP is shipped)

7. **What happens to assignments when a job is cancelled?**
   - Auto-recall all tasks?
   - Keep for historical reference?
   All tiles in the future are recalled but the tiles in the past remain.
   A side note : Each tile should have a checkbox that is checked when the task is completed. We shoud not assume that tasks in the past are always completed. This doesn't bear any impact on precedence rules which DO assume that scheduled tasks happen as defined. Please ask away if this is not 100% clear.

8. **Is there a concept of "rush" or "priority" jobs?**
   - Visual indicator?
   - Affects conflict resolution?
   Not in MVP.

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

---

This file should be continuously updated as the team learns more about the domain and resolves these questions.
