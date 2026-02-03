# Feature Catalog

> **Status:** In Progress
>
> **Last Updated:** 2026-02-03
>
> **Purpose:** Single Source of Truth az alkalmazás összes aktív feature-jéről.

---

## Overview

Ez a dokumentum az alkalmazás összes aktív feature-jét tartalmazza, logikai csoportokba rendezve. A Manual QA Plan ebből a katalógusból származik.

### Státuszok

| Státusz | Jelentés |
|---------|----------|
| `Active` | Működő, tesztelt feature |
| `Suspicious` | Gyanús (nincs teszt, de kód létezik) - review szükséges |
| `Deprecated` | Felülírt vagy eltávolított - nem kerül a QA Plan-be |

### ID Prefixek

| Prefix | Terület |
|--------|---------|
| `API-` | Backend API (M1, M2) |
| `SCHED-` | Scheduler UI (M3) |
| `JCF-` | Job Creation Form (M4) |

---

## Backend API Features

### B1: Station Management API (v0.1.0 - v0.1.7)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-001 | Station Entity | Station aggregate root with status, category, group references | Active | v0.1.0 |
| API-002 | StationStatus Enum | Station states: Active, Inactive, Maintenance, OutOfService | Active | v0.1.0 |
| API-003 | Station CRUD API | POST/GET/PUT/DELETE /api/v1/stations endpoints | Active | v0.1.1 |
| API-004 | Station List Filtering | Filter stations by status, category, group; search by name | Active | v0.1.1 |
| API-005 | OpenAPI Documentation | Swagger UI at /api/doc for all API endpoints | Active | v0.1.1 |
| API-006 | TimeSlot Value Object | Time range (HH:MM format) with overlap detection | Active | v0.1.2 |
| API-007 | OperatingSchedule Value Object | Weekly pattern (Mon-Sun) with day schedules | Active | v0.1.2 |
| API-008 | Operating Schedule API | PUT /api/v1/stations/{id}/schedule endpoint | Active | v0.1.2 |
| API-009 | Schedule Slot Validation | Overlap detection, time format validation | Active | v0.1.2 |
| API-010 | ScheduleException Value Object | Date-specific overrides (CLOSED/MODIFIED types) | Active | v0.1.3 |
| API-011 | Schedule Exception API | POST/GET/DELETE /api/v1/stations/{id}/exceptions endpoints | Active | v0.1.3 |
| API-012 | StationCategory Entity | Category with similarity criteria for visual indicators | Active | v0.1.4 |
| API-013 | SimilarityCriterion Value Object | Code, name, fieldPath for job comparison | Active | v0.1.4 |
| API-014 | Station Category CRUD API | POST/GET/PUT/DELETE /api/v1/station-categories endpoints | Active | v0.1.4 |
| API-015 | StationGroup Entity | Group with maxConcurrent limit, provider group flag | Active | v0.1.5 |
| API-016 | Station Group CRUD API | POST/GET/PUT/DELETE /api/v1/station-groups endpoints | Active | v0.1.5 |
| API-017 | OutsourcedProvider Entity | Provider with action types, departure/reception times | Active | v0.1.6 |
| API-018 | Provider CRUD API | POST/GET/PUT/DELETE /api/v1/providers endpoints | Active | v0.1.6 |
| API-019 | Auto-create Provider Group | Provider creation auto-creates unlimited capacity group | Active | v0.1.6 |
| API-020 | Domain Event Infrastructure | DomainEvent base class, RecordsDomainEvents trait | Active | v0.1.7 |
| API-021 | Station Domain Events | StationRegistered, OperatingScheduleUpdated, ScheduleExceptionAdded, StationStatusChanged | Active | v0.1.7 |

### B2: Job Management API (v0.1.9 - v0.1.19)

*Pending - B2 batch feldolgozás után*

### B3: Validation & Assignment API (v0.2.7 - v0.2.18)

*Pending - B3 batch feldolgozás után*

---

## Scheduler UI Features

### B4: Mock Data, Layout, Grid (v0.3.0 - v0.3.10)

*Pending - B4 batch feldolgozás után*

### B5: Drag & Drop Basics (v0.3.11 - v0.3.20)

*Pending - B5 batch feldolgozás után*

### B6: Station Compact, Fixes (v0.3.21 - v0.3.33)

*Pending - B6 batch feldolgozás után*

### B7: Navigation, Layout, UX (v0.3.34 - v0.3.46)

*Pending - B7 batch feldolgozás után*

### B8: DateStrip, Validation, Pick&Place (v0.3.47 - v0.3.60)

*Pending - B8 batch feldolgozás után*

---

## Job Creation Form Features

### B9: Element Layer, JCF Basics (v0.4.0 - v0.4.12)

*Pending - B9 batch feldolgozás után*

### B10: JCF Autocomplete Fields (v0.4.13 - v0.4.24)

*Pending - B10 batch feldolgozás után*

### B11: JCF Validation, Templates, API (v0.4.25 - v0.4.40)

*Pending - B11 batch feldolgozás után*

---

## Statistics

| Batch | Status | Features | Active | Suspicious | Deprecated |
|-------|--------|----------|--------|------------|------------|
| B1 | ✅ Complete | 21 | 21 | 0 | 0 |
| B2 | ⏳ Pending | - | - | - | - |
| B3 | ⏳ Pending | - | - | - | - |
| B4 | ⏳ Pending | - | - | - | - |
| B5 | ⏳ Pending | - | - | - | - |
| B6 | ⏳ Pending | - | - | - | - |
| B7 | ⏳ Pending | - | - | - | - |
| B8 | ⏳ Pending | - | - | - | - |
| B9 | ⏳ Pending | - | - | - | - |
| B10 | ⏳ Pending | - | - | - | - |
| B11 | ⏳ Pending | - | - | - | - |
| **Total** | | **21** | **21** | **0** | **0** |
