# Flux Scheduler - Manual QA Plan

> **Status:** In Progress
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
| [Job Management API](api/job-management.md) | API-022 - API-??? | Pending |
| [Scheduling API](api/scheduling.md) | API-??? - API-??? | Pending |

### Scheduler UI (M3)

| Dokumentum | Feature-ök | Státusz |
|------------|------------|---------|
| [Layout & Grid](scheduler/layout-grid.md) | SCHED-001 - SCHED-??? | Pending |
| [Drag & Drop](scheduler/drag-drop.md) | SCHED-??? - SCHED-??? | Pending |
| [Navigation & UX](scheduler/navigation-ux.md) | SCHED-??? - SCHED-??? | Pending |
| [DateStrip & Pick&Place](scheduler/datestrip-pickplace.md) | SCHED-??? - SCHED-??? | Pending |

### Job Creation Form (M4)

| Dokumentum | Feature-ök | Státusz |
|------------|------------|---------|
| [Elements Table](jcf/elements-table.md) | JCF-001 - JCF-??? | Pending |
| [Autocomplete Fields](jcf/autocomplete.md) | JCF-??? - JCF-??? | Pending |
| [Validation & Templates](jcf/validation-templates.md) | JCF-??? - JCF-??? | Pending |

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

- [ ] JCF dialog megnyílik
- [ ] Elements tábla működik
- [ ] Autocomplete mezők működnek
- [ ] Mentés működik

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

*Pending - Scheduler UI batch-ek feldolgozása után*

---

## Test Fixtures

A frontend teszteléshez használható fixture-ök:

| Fixture | URL | Leírás |
|---------|-----|--------|
| `default` | `?fixture=default` | Standard grid with sample data |
| `context-menu` | `?fixture=context-menu` | Multiple tiles for context menu testing |
| `drag-drop` | `?fixture=drag-drop` | Setup for drag & drop testing |
| `validation` | `?fixture=validation` | Jobs with validation warnings |

> **Note:** Fixture lista bővül a Scheduler UI batch-ek feldolgozásával.

---

## Progress

| Terület | Batch-ek | Dokumentumok | Státusz |
|---------|----------|--------------|---------|
| Backend API | B1 | 1/3 | In Progress |
| Scheduler UI | B4-B8 | 0/4 | Pending |
| Job Creation Form | B9-B11 | 0/3 | Pending |
