# Backlog – Flux Print Shop Scheduling System

This document collects **postponed requirements**, **deferred decisions**, and **candidate features** that are not part of the current MVP roadmap but may be implemented in future releases.

Items here have no committed version number. Priority and implementation order will be determined based on user feedback and business needs.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P1** | High value, likely next after MVP |
| **P2** | Medium value, good candidate for v1.x |
| **P3** | Nice-to-have, lower priority |

---

## Postponed from MVP

Items explicitly marked as "Post-MVP" or "Not in MVP" in the specification:

### Scheduling Features

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-SCHED-001 | Schedule Branching | Multiple schedule versions for what-if analysis, PROD designation | P1 | domain-open-questions.md |
| BL-SCHED-002 | Task Interruption/Splitting | Allow tasks to be split across downtime instead of stretching as single tile | P2 | workflow-definitions.md, business-rules.md |
| BL-SCHED-003 | MaintenanceBlock Entity | Scheduled maintenance periods that block station availability (distinct from TaskAssignment) | P2 | domain-model.md |
| BL-SCHED-004 | Auto-scheduling Suggestions | System suggests optimal placement for tasks | P2 | domain-open-questions.md |
| BL-SCHED-005 | Conflict Resolution Recommendations | System suggests how to resolve scheduling conflicts | P3 | domain-open-questions.md |
| BL-SCHED-006 | Utilization Optimization | Automatic optimization of station utilization | P3 | domain-open-questions.md |

### Business Calendar

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-CAL-001 | French Public Holidays | Exclude French holidays from open days calculation | P1 | business-rules.md (CAL-002) |
| BL-CAL-002 | Per-Provider Business Calendars | Different providers may have different business days | P2 | domain-open-questions.md |
| BL-CAL-003 | Station Seasonal Schedules | Different operating hours for different seasons | P3 | domain-open-questions.md |

### UI/UX Improvements

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-UI-001 | Zoom Levels | Day/week/month view in scheduling grid | P1 | domain-open-questions.md |
| BL-UI-002 | Column Customization | Customize column order and width | P2 | domain-open-questions.md |
| BL-UI-003 | Compact View | Condensed view for overview | P2 | domain-open-questions.md |
| BL-UI-004 | Rush/Priority Jobs | Visual indicators and special handling for urgent jobs | P2 | domain-open-questions.md |
| BL-UI-005 | BAT Pending Notifications | Alerts when BAT approval is pending too long | P3 | domain-open-questions.md |

### Multi-User & Security

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-AUTH-001 | Concurrent Editing Support | Multiple users editing schedule simultaneously | P1 | domain-open-questions.md |
| BL-AUTH-002 | User Role Permissions | Different access levels for different users | P1 | domain-open-questions.md |
| BL-AUTH-003 | Change Audit Trail | Track who changed what and when | P2 | domain-open-questions.md |
| BL-AUTH-004 | Comments with Authentication | Author tracking for job comments (currently anonymous) | P2 | domain-open-questions.md |

### Reporting & Analytics

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-RPT-001 | Job Completion Analytics | Metrics on job completion times, delays | P2 | domain-open-questions.md |
| BL-RPT-002 | Station Utilization Reports | Reports on how stations are being used | P2 | domain-open-questions.md |
| BL-RPT-003 | Late Job Trends | Historical analysis of late jobs | P2 | domain-open-questions.md |

### Integration

| ID | Item | Description | Priority | Source |
|----|------|-------------|----------|--------|
| BL-INT-001 | ERP/MES Integration | Import jobs from existing ERP system | P2 | domain-open-questions.md |
| BL-INT-002 | Customer Portal | Order tracking for customers | P3 | domain-open-questions.md |
| BL-INT-003 | Mobile App | Shop floor updates from mobile devices | P3 | domain-open-questions.md |

---

## Explicitly Not Supported

Features explicitly decided NOT to support:

| ID | Feature | Reason | Source |
|----|---------|--------|--------|
| NS-001 | Station reduced capacity (50%) | Complexity without clear benefit | domain-open-questions.md |
| NS-002 | Backup/substitute stations | Out of scope | domain-open-questions.md |
| NS-003 | Multiple categories per station | Not needed for current use case | domain-open-questions.md |
| NS-004 | Provider limited capacity | Providers always unlimited | domain-open-questions.md |
| NS-005 | Task spanning multiple stations | Not supported | domain-open-questions.md |
| NS-006 | Task templates | Not needed | domain-open-questions.md |
| NS-007 | Conditional dependencies | No success/failure concept | domain-open-questions.md |
| NS-008 | External event triggers | Approval gates before scheduling | domain-open-questions.md |
| NS-009 | Cross-client dependencies | Client irrelevant to dependencies | domain-open-questions.md |
| NS-010 | Min/max gap between tasks | Not required | domain-open-questions.md |
| NS-011 | Facility-wide constraints | Not supported | domain-open-questions.md |
| NS-012 | Tight schedule warnings | Not supported | domain-open-questions.md |
| NS-013 | Additional approval gates | Not in MVP | domain-open-questions.md |
| NS-014 | Partial paper reception | All or nothing | domain-open-questions.md |
| NS-015 | Override validation rules | Not supported | domain-open-questions.md |
| NS-016 | Offline mode | Not supported | domain-open-questions.md |

---

## Technical Debt

Items to address for code quality and maintainability:

| ID | Item | Description | Priority |
|----|------|-------------|----------|
| TD-001 | Submodule CI/CD | Individual CI/CD pipelines for submodules | P1 |
| TD-002 | Hard validation blocks | Currently warnings-only; may want hard blocks post-MVP | P2 |

---

## Open Design Questions

Questions that need resolution before implementation:

| ID | Question | Status |
|----|----------|--------|
| OQ-001 | Job color shade algorithm for dependent jobs | Open |

See `docs/domain-model/domain-open-questions.md` section 14 for details.

---

## Notes

- This backlog is a living document and should be updated as priorities change
- Items may be promoted to the roadmap when committed to a release
- "Not Supported" items require explicit product decision to reconsider
- Priority can change based on user feedback and business needs
