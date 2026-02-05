# Flux Scheduler - Manual QA Plan

> **Status:** Complete (M1 + M2 + M3 + M4)
>
> **Last Updated:** 2026-02-03
>
> **Purpose:** Comprehensive Manual QA documentation for all application features.

---

## Overview

This document is the main index for the Flux Scheduler application Manual QA Plan. Detailed test scenarios are found in separate documents organized by feature groups.

---

## Test Environment

### Prerequisites

| Requirement | Description |
|-------------|-------------|
| Docker | `docker-compose up -d` |
| Backend | `http://localhost:8080` |
| Frontend | `http://localhost:5173` |
| Swagger UI | `http://localhost:8080/api/doc` |

### Browser Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | P1 |
| Firefox | Latest | P1 |
| Safari | Latest (macOS) | P2 |

> **Note:** Desktop only - mobile/tablet not in scope.

---

## QA Document Index

### Backend API (M1 + M2)

| Document | Features | Status |
|----------|----------|--------|
| [Station Management API](api/station-management.md) | API-001 - API-021 | Complete |
| [Job Management API](api/job-management.md) | API-021 - API-045 | Complete |
| [Scheduling API](api/scheduling.md) | API-046 - API-076 | Complete |

### Scheduler UI (M3)

| Document | Features | Status |
|----------|----------|--------|
| [Layout & Grid](scheduler/layout-grid.md) | SCHED-001 - SCHED-034 | Complete |
| [Drag & Drop](scheduler/drag-drop.md) | SCHED-041 - SCHED-083 | Complete |
| [Navigation & UX](scheduler/navigation-ux.md) | SCHED-084 - SCHED-114 | Complete |
| [DateStrip & Pick&Place](scheduler/datestrip-pickplace.md) | SCHED-115 - SCHED-152 | Complete |

### Job Creation Form (M4)

| Document | Features | Status |
|----------|----------|--------|
| [Elements Table](jcf/elements-table.md) | SCHED-153 - SCHED-165, JCF-001 - JCF-054 | Complete |
| [Autocomplete Fields](jcf/autocomplete.md) | JCF-055 - JCF-111 | Complete |
| [Validation & Templates](jcf/validation-templates.md) | JCF-112 - JCF-187 | Complete |

---

## Smoke Test Checklist

Quick verification (~5-10 minutes) for main functionalities:

### Backend API

- [ ] Swagger UI accessible (`/api/doc`)
- [ ] GET `/api/v1/stations` - 200 OK
- [ ] GET `/api/v1/station-categories` - 200 OK
- [ ] GET `/api/v1/station-groups` - 200 OK
- [ ] GET `/api/v1/providers` - 200 OK

### Scheduler UI

- [ ] App loads (`http://localhost:5173`)
- [ ] Sidebar appears
- [ ] Grid appears with station columns
- [ ] DateStrip navigation works

### Job Creation Form

- [ ] JCF dialog opens (`/job/new` or "+" button)
- [ ] Elements table works
- [ ] Autocomplete fields work (papier, imposition, sequence)
- [ ] Submit validation works (Save button)
- [ ] Template save/apply works
- [ ] URL navigation works (browser back/forward)

---

## Regression Test Suite

Collection of critical happy paths for pre-release testing.

### API Regression

1. **Station CRUD flow**
   - Create category -> Create group -> Create station -> Update -> Delete

2. **Schedule management flow**
   - Create station -> Set schedule -> Add exception -> Verify getEffectiveSchedule

3. **Provider flow**
   - Create provider -> Verify auto-created group -> Update status

### UI Regression

1. **Pick & Place flow**
   - Select job -> Pick unscheduled task -> Place on grid -> Verify position

2. **DateStrip navigation flow**
   - Click departure date -> Verify scroll -> Check task markers

3. **Context menu flow**
   - Right-click tile -> Move -> Verify new position -> Recall -> Verify unscheduled

4. **JCF modal flow**
   - Open modal via "+" -> Enter job header fields -> Add element -> Navigate with Tab/Alt+Arrow -> Close modal

5. **JCF autocomplete flow**
   - Open JCF modal -> Enter papier (two-step: type→grammage) -> Enter imposition (two-step: format→poses) -> Verify qteFeuilles auto-calculation -> Enter sequence (poste mode with duration)

6. **JCF template flow**
   - Create job with elements -> Save as template -> Open new job -> Apply template -> Verify elements populated -> Test link propagation

7. **Element prerequisites flow**
   - Select job with elements -> Change prerequisite status -> Verify tile border (dashed for blocked) -> Hover 2s on blocked tile -> Verify tooltip

---

## Test Fixtures

Fixtures available for frontend testing:

| Fixture | URL | Description |
|---------|-----|-------------|
| `test` | `?fixture=test` | Basic: 3 jobs, 5 tasks, 3 assignments |
| `swap` | `?fixture=swap` | Swap: 3 consecutive tiles on same station |
| `layout-redesign` | `?fixture=layout-redesign` | Layout testing (zoom, sidebar) |
| `alt-bypass` | `?fixture=alt-bypass` | Precedence bypass: Task 1 scheduled, Task 2 unscheduled |
| `sidebar-drag` | `?fixture=sidebar-drag` | Sidebar pick: 1 job, 1 unscheduled task |
| `drag-snapping` | `?fixture=drag-snapping` | Setup for drag snapping testing |
| `context-menu` | `?fixture=context-menu` | Multiple tiles for context menu testing |
| `validation-messages` | `?fixture=validation-messages` | Jobs with validation warnings |
| `datestrip-redesign` | `?fixture=datestrip-redesign` | DateStrip visual states testing |
| `precedence-visualization` | `?fixture=precedence-visualization` | Precedence constraint lines testing |
| `virtual-scroll` | `?fixture=virtual-scroll` | 365-day virtual scrolling testing |
| `datestrip-markers` | `?fixture=datestrip-markers` | ViewportIndicator, task markers testing |
| `drying-time` | `?fixture=drying-time` | Printing task with successor for drying visualization |
| `elements-table` | `?fixture=elements-table` | JCF modal with default element for grid layout testing |
| `submit-validation` | `?fixture=submit-validation` | JCF modal with partial data for validation testing |
| `blocking-visual` | `?fixture=blocking-visual` | Tiles with various blocking states |
| `forme-date-tracking` | `?fixture=forme-date-tracking` | Elements with forme and date tracking |
| `template-crud` | `?fixture=template-crud` | Pre-populated templates for CRUD testing |
| `router-test` | `?fixture=router-test` | Multiple jobs for URL navigation testing |

---

## Progress

| Area | Batches | Documents | Status |
|------|---------|-----------|--------|
| Backend API | B1-B3 | 3/3 | Complete |
| Scheduler UI | B4-B8 | 4/4 | Complete |
| Job Creation Form | B9-B11 | 3/3 | Complete |
