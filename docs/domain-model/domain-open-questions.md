# Domain Open Questions (Operations Research System)

This document collects **unresolved or partially clarified domain questions** that must be answered before completing the domain model, workflows, or implementation.  
It is intentionally concise and structured for iterative refinement and AI‑assisted completion.

---

## 1. Operator Management

- Can operators have different availability schedules per week, or is it a fixed pattern?
- How far in advance can operators modify their availability?
- Are there different operator roles/levels with different permissions?
- Can operators work on multiple equipment simultaneously if tasks allow it?
- How is operator training/certification tracked and validated?

---

## 2. Equipment Management

- What defines equipment maintenance windows—calendar schedule or usage hours?
- Can equipment have reduced capacity during certain periods (not just available/unavailable)?
- Are there equipment groups where any member can fulfill a task requirement?
- How is equipment location tracked if distributed across facilities?
- What happens to assignments when equipment unexpectedly breaks down?

---

## 3. Task Definition

- Can task duration vary based on operator skill level?
- Are there task templates for common operations?
- Can a task be split across multiple operators (shift handover)?
- What defines task type compatibility—exact match or hierarchical categories?
- Can tasks have alternative equipment options with different durations?

---

## 4. Task Dependencies

- Can dependencies be conditional (if Task A succeeds, do B; if fails, do C)?
- Are there different types of dependencies (finish-to-start, start-to-start, etc.)?
- Can external events trigger task readiness?
- How are dependency cycles prevented during planning?
- Can dependencies span across different jobs?

---

## 5. Scheduling Constraints

- Is there a minimum/maximum time gap required between consecutive tasks?
- How are operator break times handled in scheduling?
- Can tasks be scheduled outside normal working hours with approval?
- Are there facility-wide constraints (max concurrent operations)?
- How is travel time between equipment locations calculated?

---

## 6. Assignment Rules

- Can assignments be provisional/tentative before confirmation?
- Who can override skill requirements in emergencies?
- Are there preferred operator-equipment pairings to optimize for?
- Can the system suggest alternative assignments automatically?
- How are assignment priorities determined when resources are scarce?

---

## 7. Validation & Conflicts

- What is the escalation path for unresolvable conflicts?
- Are some validation rules warnings vs. hard blocks?
- Can certain users override specific validation rules?
- How often should the system re-validate existing schedules?
- What triggers automatic re-scheduling attempts?

---

## 8. Performance & Optimization

- Should the system optimize for deadline adherence, resource utilization, or cost?
- Are there SLAs for different job types or customers?
- How is overtime cost calculated and approved?
- Can jobs have different priority levels affecting scheduling?
- What KPIs need to be tracked and reported?

---

## 9. Integration Questions

- Which external systems need real-time schedule updates?
- How are operator time tracking systems integrated?
- Is there an existing ERP/MES system to sync with?
- What format should schedule exports use (Gantt, Calendar, etc.)?
- Are there mobile apps for operators to view assignments?

---

## 10. Business Policy Questions

- Can operators see other operators' schedules?
- Are there union rules affecting scheduling?
- How far in advance must schedules be published?
- Can operators swap assignments between themselves?
- What audit trail is required for schedule changes?

---

## 11. Questions Blocking Implementation

These questions must be resolved before implementation can begin:

1. **Is operator overtime allowed, and what are the approval rules?**
2. **Can a single task require multiple operators working together?**
3. **Are partial task completions tracked (e.g., 50% done at shift end)?**
4. **What is the granularity of time slots (minutes, hours, shifts)?**
5. **Must all tasks in a job use the same facility/location?**
6. **Can equipment be reserved for future maintenance windows?**
7. **How are skill levels verified—certification, testing, or supervisor approval?**
8. **Is there a concept of "setup time" between different task types on equipment?**
9. **Can jobs be paused/suspended and later resumed?**
10. **What happens to the schedule when a job is cancelled mid-execution?**

---

## 12. Future Considerations

- Will the system need to support multiple facilities/plants?
- Are there plans for automated schedule optimization?
- Will predictive maintenance affect equipment availability?
- Should the system learn from historical data to improve estimates?
- Are there regulatory compliance requirements for scheduling?

---

This file should be continuously updated as the team learns more about the domain and resolves these questions.
