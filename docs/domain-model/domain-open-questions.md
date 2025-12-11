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

### Open Questions
- Can stations have different operating schedules per week (e.g., seasonal)?
- How is station maintenance scheduled—separate from schedule exceptions?
- Should stations support reduced capacity (e.g., 50% during certain periods)?
- How are backup/substitute stations handled?
- Can a station belong to multiple categories (e.g., hybrid machines)?

---

## 2. Outsourced Providers

### Resolved ✓
- ✓ Each provider has unlimited capacity (own group with no limit)
- ✓ Provider tasks use open days (JO) for duration
- ✓ Providers have supported action types (Pelliculage, Dorure, etc.)

### Open Questions
- Can providers have limited capacity in the future?
- Should providers have their own business calendar (different holidays)?
- How are provider lead times communicated and updated?
- Can a provider handle multiple concurrent jobs from same client?
- How is provider cost tracked (for reporting/optimization)?

---

## 3. Task Definition

### Resolved ✓
- ✓ Tasks are defined using DSL syntax
- ✓ Internal tasks: `[Station] setup+run "comment"`
- ✓ Outsourced tasks: `ST [Provider] ActionType duration "comment"`
- ✓ Station names with spaces use underscores
- ✓ Comments can appear anywhere with quotes

### Open Questions
- Can a single task span multiple stations (parallel processing)?
- Are there task templates for common operations?
- Can task duration vary based on job complexity or quantity?
- Should tasks support optional vs. required classification?
- Can the same task be split across multiple time slots (interruption)?

---

## 4. Job Dependencies

### Resolved ✓
- ✓ Dependencies are at job level only (not task level)
- ✓ Circular dependencies are prevented
- ✓ Dependent job cannot start until prerequisites complete

### Open Questions
- Can dependencies be conditional (if Job A succeeds, do B; if fails, do C)?
- Are there different types of dependencies (finish-to-start, start-to-start)?
- Can external events trigger job readiness (e.g., customer approval)?
- Should dependencies span across different clients' jobs?

---

## 5. Scheduling Constraints

### Resolved ✓
- ✓ 30-minute snap grid for scheduling
- ✓ Precedence within job must be respected (unless Alt bypass)
- ✓ Station unavailability stretches task duration
- ✓ Group capacity limits concurrent tasks

### Open Questions
- Is there a minimum/maximum time gap required between consecutive tasks?
- Can tasks be scheduled outside normal operating hours with approval?
- Are there facility-wide constraints (max concurrent operations)?
- How is travel time between outsourced provider and shop handled?
- Should the system warn about "tight" schedules (no buffer)?

---

## 6. Approval Gates

### Resolved ✓
- ✓ BAT (Proof): Must be sent and approved before scheduling
- ✓ BAT can be marked "NoProofRequired" to bypass
- ✓ Plates: Must be "Done" before printing tasks
- ✓ Paper status tracked: InStock, ToOrder, Ordered, Received

### Open Questions
- Can certain task types proceed without BAT approval?
- Is there an automatic timeout for BAT approval?
- Should the system notify when BAT is pending too long?
- Are there other approval gates beyond BAT and Plates?
- Can paper be partially received (e.g., 50% of order)?

---

## 7. Validation & Conflicts

### Resolved ✓
- ✓ Real-time validation during drag (< 10ms)
- ✓ Server-side authoritative validation
- ✓ Conflict types: Station, GroupCapacity, Precedence, ApprovalGate, Availability

### Open Questions
- What is the escalation path for unresolvable conflicts?
- Are some validation rules warnings vs. hard blocks?
- Can certain users override specific validation rules?
- How often should the system re-validate existing schedules?
- Should the system suggest optimal conflict resolution?

---

## 8. Similarity Indicators

### Resolved ✓
- ✓ Visual circles between consecutive tiles
- ✓ Filled = matching criterion, Hollow = non-matching
- ✓ Criteria defined per station category

### Open Questions
- How are similarity criteria values populated per job?
- Should similarity influence scheduling suggestions?
- Can similarity be used to optimize station utilization?
- Are there composite criteria (e.g., "same paper" = type + size)?

---

## 9. UI/UX Questions

### Resolved ✓
- ✓ Vertical time axis (time flows downward)
- ✓ 3-panel layout (Left: Jobs, Center: Grid, Right: Late jobs)
- ✓ Alt-key bypasses precedence safeguard
- ✓ Recall removes only the specific task assignment

### Open Questions
- Should the grid support zoom levels (day/week/month)?
- Can users customize column order and width?
- Is there a "compact view" for high-density schedules?
- Should tiles show progress during execution?
- How are very long tasks (multi-day) displayed?

---

## 10. Performance Requirements

### Resolved ✓
- ✓ Drag feedback < 10ms
- ✓ Grid render (100 tiles) < 100ms
- ✓ Initial load < 2s

### Open Questions
- What is the expected maximum number of concurrent jobs?
- How many stations should the system support?
- What is the maximum time range to display (2 weeks, 1 month)?
- Should the system support offline mode?

---

## 11. Questions Blocking Implementation

These questions should be resolved before implementation can begin:

1. **How are similarity criteria values assigned to jobs?**
   - Who enters this data?
   - Is it part of job creation or separate workflow?

2. **What happens when station schedule changes with existing assignments?**
   - Auto-reschedule?
   - Flag as conflict?
   - Notify user?

3. **Can outsourced tasks start on any day or only on business days?**
   - If starting Saturday, does the 2JO count from Monday?

4. **How is job color assigned?**
   - Random per job?
   - User-selectable?
   - Based on client or job type?

5. **What is the granularity of paper status tracking?**
   - Per job?
   - Per paper type?
   - Per quantity?

6. **How are comments attributed?**
   - Anonymous?
   - Logged-in user?
   - System-generated?

7. **What happens to assignments when a job is cancelled?**
   - Auto-recall all tasks?
   - Keep for historical reference?

8. **Is there a concept of "rush" or "priority" jobs?**
   - Visual indicator?
   - Affects conflict resolution?

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

---

This file should be continuously updated as the team learns more about the domain and resolves these questions.
