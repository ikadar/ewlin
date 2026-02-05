# Flux Scheduler - Manual QA Plan

> **Status:** Complete (M1 + M2 + M3 + M4)
>
> **Last Updated:** 2026-02-03
>
> **Purpose:** Átfogó Manual QA dokumentáció az alkalmazás összes feature-jéhez.

---

## Overview

Ez a dokumentum a Flux Scheduler alkalmazás Manual QA Plan fő indexe. A részletes teszt szcenáriók feature-csoportonként külön dokumentumokban találhatók.

---

## Test Environment

### Prerequisites

| Követelmény | Leírás |
|-------------|--------|
| Docker | `docker-compose up -d` |
| Backend | `http://localhost:8080` |
| Frontend | `http://localhost:5173` |
| Swagger UI | `http://localhost:8080/api/doc` |

### Browser Matrix

| Böngésző | Verzió | Prioritás |
|----------|--------|-----------|
| Chrome | Latest | P1 |
| Firefox | Latest | P1 |
| Safari | Latest (macOS) | P2 |

> **Note:** Desktop only - mobile/tablet nem scope.

---

## QA Document Index

### Backend API (M1 + M2)

| Dokumentum | Feature-ök | Státusz |
|------------|------------|---------|
| [Station Management API](api/station-management.md) | API-001 - API-021 | Complete |
| [Job Management API](api/job-management.md) | API-021 - API-045 | Complete |
| [Scheduling API](api/scheduling.md) | API-046 - API-076 | Complete |

### Scheduler UI (M3)

| Dokumentum | Feature-ök | Státusz |
|------------|------------|---------|
| [Layout & Grid](scheduler/layout-grid.md) | SCHED-001 - SCHED-034 | Complete |
| [Drag & Drop](scheduler/drag-drop.md) | SCHED-041 - SCHED-083 | Complete |
| [Navigation & UX](scheduler/navigation-ux.md) | SCHED-084 - SCHED-114 | Complete |
| [DateStrip & Pick&Place](scheduler/datestrip-pickplace.md) | SCHED-115 - SCHED-152 | Complete |

### Job Creation Form (M4)

| Dokumentum | Feature-ök | Státusz |
|------------|------------|---------|
| [Elements Table](jcf/elements-table.md) | SCHED-153 - SCHED-165, JCF-001 - JCF-054 | Complete |
| [Autocomplete Fields](jcf/autocomplete.md) | JCF-055 - JCF-111 | Complete |
| [Validation & Templates](jcf/validation-templates.md) | JCF-112 - JCF-187 | Complete |

---

## Smoke Test Checklist

Gyors ellenőrzés (~5-10 perc) a fő funkcionalitásokra:

### Backend API

- [ ] Swagger UI elérhető (`/api/doc`)
- [ ] GET `/api/v1/stations` - 200 OK
- [ ] GET `/api/v1/station-categories` - 200 OK
- [ ] GET `/api/v1/station-groups` - 200 OK
- [ ] GET `/api/v1/providers` - 200 OK

### Scheduler UI

- [ ] App betöltődik (`http://localhost:5173`)
- [ ] Sidebar megjelenik
- [ ] Grid megjelenik station oszlopokkal
- [ ] DateStrip navigáció működik

### Job Creation Form

- [ ] JCF dialog megnyílik (`/job/new` or "+" button)
- [ ] Elements tábla működik
- [ ] Autocomplete mezők működnek (papier, imposition, sequence)
- [ ] Submit validation működik (Save button)
- [ ] Template save/apply működik
- [ ] URL navigation működik (browser back/forward)

---

## Regression Test Suite

Kritikus happy path-ok gyűjteménye release előtti teszteléshez.

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

A frontend teszteléshez használható fixture-ök:

| Fixture | URL | Leírás |
|---------|-----|--------|
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

| Terület | Batch-ek | Dokumentumok | Státusz |
|---------|----------|--------------|---------|
| Backend API | B1-B3 | 3/3 | Complete |
| Scheduler UI | B4-B8 | 4/4 | Complete |
| Job Creation Form | B9-B11 | 3/3 | Complete |
