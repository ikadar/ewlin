# Feature Catalog

> **Status:** ✅ Complete
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
| API-001 | Station Entity | Aggregate root for print shop workstations with UUID, name, status, capacity | Active | v0.1.0 |
| API-002 | StationStatus Enum | Station states: Active, Inactive, Maintenance, OutOfService | Active | v0.1.0 |
| API-003 | Station CRUD API | REST endpoints for station create, read, update, delete operations | Active | v0.1.1 |
| API-004 | Station List Filtering | Filter stations by status, categoryId, groupId with pagination | Active | v0.1.1 |
| API-005 | TimeSlot Value Object | HH:MM time range representation with overlap detection | Active | v0.1.2 |
| API-006 | OperatingSchedule | Weekly operating pattern (Mon-Sun) with multiple time slots per day | Active | v0.1.2 |
| API-007 | Schedule Update API | PUT endpoint to update station operating schedule | Active | v0.1.2 |
| API-008 | ScheduleException | Date-specific schedule overrides (CLOSED or MODIFIED) | Active | v0.1.3 |
| API-009 | Schedule Exception API | CRUD endpoints for station schedule exceptions | Active | v0.1.3 |
| API-010 | SimilarityCriterion | Code/name/fieldPath for job attribute comparison indicators | Active | v0.1.4 |
| API-011 | StationCategory Entity | Station classification with similarity criteria support | Active | v0.1.4 |
| API-012 | StationCategory CRUD API | REST endpoints for station category management | Active | v0.1.4 |
| API-013 | StationGroup Entity | Station grouping with maxConcurrent capacity control | Active | v0.1.5 |
| API-014 | StationGroup CRUD API | REST endpoints for station group management | Active | v0.1.5 |
| API-015 | OutsourcedProvider Entity | External work providers with action types and time windows | Active | v0.1.6 |
| API-016 | Provider Auto-Group | Providers auto-create StationGroup with unlimited capacity | Active | v0.1.6 |
| API-017 | Provider CRUD API | REST endpoints for outsourced provider management | Active | v0.1.6 |
| API-018 | StationRegistered Event | Domain event emitted when station is created | Active | v0.1.7 |
| API-019 | OperatingScheduleUpdated Event | Domain event emitted when schedule is modified | Active | v0.1.7 |
| API-020 | StationStatusChanged Event | Domain event emitted when station status transitions | Active | v0.1.7 |

### B2: Job Management API (v0.1.9 - v0.1.19)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-021 | Job Entity | Aggregate root for print orders with reference, client, deadline, color | Active | v0.1.9 |
| API-022 | JobStatus Enum | Workflow states: Draft, Planned, InProgress, Delayed, Completed, Cancelled | Active | v0.1.9 |
| API-023 | Job CRUD API | REST endpoints for job create, read, update, delete operations | Active | v0.1.10 |
| API-024 | Job List Filtering | Filter jobs by status with search and pagination | Active | v0.1.10 |
| API-025 | Task Entity | Production operations within Job with sequence, type, duration | Active | v0.1.11 |
| API-026 | TaskStatus Enum | Task states: Defined, Ready, Assigned, Completed, Cancelled | Active | v0.1.11 |
| API-027 | TaskType Enum | Internal (workshop) vs Outsourced (provider) task classification | Active | v0.1.11 |
| API-028 | Duration Value Object | Setup+run minutes for internal, open days for outsourced tasks | Active | v0.1.11 |
| API-029 | DSL Parser Service | Server-side semantic validation and Task creation from DSL input | Active | v0.1.12 |
| API-030 | Job Creation with DSL | POST /api/v1/jobs accepts tasksDsl field for batch task creation | Active | v0.1.12 |
| API-031 | Station Names Autocomplete | GET /api/v1/stations/names for DSL editor autocomplete | Active | v0.1.13 |
| API-032 | Provider Names Autocomplete | GET /api/v1/providers/names for DSL editor autocomplete | Active | v0.1.13 |
| API-033 | Action Types Autocomplete | GET /api/v1/providers/action-types for DSL editor autocomplete | Active | v0.1.13 |
| API-034 | ~~Proof Approval Gate~~ | ~~proofSentAt/proofApprovedAt fields and PUT endpoint~~ | Deprecated | v0.1.14 |
| API-035 | ~~Plates Status Gate~~ | ~~PlatesStatus enum (Todo/Done) and PUT endpoint~~ | Deprecated | v0.1.14 |
| API-036 | ~~Paper Procurement~~ | ~~PaperPurchaseStatus enum and PUT endpoint~~ | Deprecated | v0.1.15 |
| API-037 | Job Dependencies | Job-to-job finish-to-start relationships with circular detection | Active | v0.1.16 |
| API-038 | Dependencies CRUD API | POST/GET/DELETE endpoints for job dependency management | Active | v0.1.16 |
| API-039 | JobComment Entity | Immutable comments within Job aggregate for audit trail | Active | v0.1.17 |
| API-040 | Comments API | POST/GET endpoints for adding and listing job comments | Active | v0.1.17 |
| API-041 | JobCreated Event | Domain event emitted when job is created | Active | v0.1.18 |
| API-042 | TaskAddedToJob Event | Domain event emitted when task is added to job | Active | v0.1.18 |
| API-043 | ~~ApprovalGateUpdated Event~~ | ~~Domain event for proof/plates/paper changes~~ | Deprecated | v0.1.18 |
| API-044 | Job Cancellation API | POST /api/v1/jobs/{id}/cancel with task cascade | Active | v0.1.19 |
| API-045 | JobCancelled Event | Domain event with cancelled task IDs list | Active | v0.1.19 |

#### Deprecated Features (v0.4.32e)

| ID | Feature | Mi váltotta fel |
|----|---------|-----------------|
| API-034 | Proof Approval Gate (Job-level) | Element.batStatus |
| API-035 | Plates Status Gate (Job-level) | Element.plateStatus |
| API-036 | Paper Procurement (Job-level) | Element.paperStatus |
| API-043 | ApprovalGateUpdated Event | Element-level events (ElementBatStatusUpdated, etc.) |

### B3: Validation & Assignment API (v0.2.7 - v0.2.18)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-046 | Validation Service Setup | Node.js Express server a @flux/schedule-validator csomag REST API-ként | Active | v0.2.7 |
| API-047 | Health Check Endpoint | GET /health endpoint service állapot lekérdezéséhez | Active | v0.2.7 |
| API-048 | Request Logger Middleware | Kérések naplózása timestamp, method, path, duration adatokkal | Active | v0.2.7 |
| API-049 | Error Handler Middleware | JSON hibaválaszok egységes kezelése | Active | v0.2.7 |
| API-050 | POST /validate Endpoint | Ütemezés validálása @flux/schedule-validator hívással | Active | v0.2.8 |
| API-051 | Zod Request Validation | Zod sémák a validation endpoint kéréseinek validálásához | Active | v0.2.8 |
| API-052 | Schedule Entity | Aggregate root a task assignment-ek kezeléséhez version tracking-gel | Active | v0.2.10 |
| API-053 | TaskAssignment Value Object | Task hozzárendelés immutable reprezentációja (taskId, targetId, scheduledStart/End) | Active | v0.2.10 |
| API-054 | TaskAssigned Event | Domain event task assignment-kor | Active | v0.2.10 |
| API-055 | TaskUnassigned Event | Domain event task unassignment-kor | Active | v0.2.10 |
| API-056 | TaskCompletionToggled Event | Domain event completion toggle-kor | Active | v0.2.10 |
| API-057 | POST /tasks/{id}/assign Endpoint | Task hozzárendelése station-hoz/provider-hez időponttal | Active | v0.2.11 |
| API-058 | AssignmentService | Business logic orchestration task assignment-hez | Active | v0.2.11 |
| API-059 | ValidationServiceClient | HTTP kliens a Validation Service hívásához PHP-ból | Active | v0.2.11 |
| API-060 | EndTimeCalculator Service | Befejezési időpont számítása duration és schedule alapján | Active | v0.2.12 |
| API-061 | BusinessCalendar Service | Munkanapok számítása (hétköznapok, hétvégék kizárása) | Active | v0.2.12 |
| API-062 | DELETE /tasks/{id}/assign Endpoint | Task visszavonása az ütemezésből (Assigned → Ready) | Active | v0.2.13 |
| API-063 | UnassignmentService | Business logic orchestration task unassignment-hez | Active | v0.2.13 |
| API-064 | Task.markUnassigned() | Státusz átmenet Assigned → Ready | Active | v0.2.13 |
| API-065 | PUT /tasks/{id}/assign Endpoint | Task átütemezése (új időpont/target) revalidálással | Active | v0.2.14 |
| API-066 | RescheduleService | Business logic orchestration task reschedule-hoz | Active | v0.2.14 |
| API-067 | Schedule.rescheduleTask() | Meglévő assignment frissítése TaskRescheduled event-tel | Active | v0.2.14 |
| API-068 | TaskRescheduled Event | Domain event átütemezéskor (old/new target, old/new scheduledStart) | Active | v0.2.14 |
| API-069 | GET /schedule/snapshot Endpoint | Teljes ütemezés snapshot (stations, jobs, tasks, assignments) | Active | v0.2.15 |
| API-070 | SnapshotBuilder.buildFullSnapshot() | Minden entity aggregálása snapshot-hoz | Active | v0.2.15 |
| API-071 | GET /calendar/open-days Endpoint | Munkanapok lekérdezése dátumtartományra vagy N napra | Active | v0.2.16 |
| API-072 | CalendarService | API-level műveletek a BusinessCalendar fölött | Active | v0.2.16 |
| API-073 | ConflictDetected Event | Domain event validációs konfliktus detektálásakor | Active | v0.2.17 |
| API-074 | ScheduleUpdated Event | Általános domain event ütemezés módosításkor | Active | v0.2.17 |
| API-075 | PUT /tasks/{id}/completion Endpoint | Task completion toggle (isCompleted, completedAt) | Active | v0.2.18 |
| API-076 | CompletionService | Business logic orchestration task completion toggle-hoz | Active | v0.2.18 |

---

## Scheduler UI Features

### B4: Mock Data, Layout, Grid (v0.3.0 - v0.3.10)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-001 | Station Generator | Mock station, category, group generálás realistic francia nevekkel | Active | v0.3.0 |
| SCHED-002 | Operating Schedule Generator | Heti munkarend generálás (Mon-Sun, time slots per day) | Active | v0.3.0 |
| SCHED-003 | Provider Generator | Outsourced provider generálás action type-okkal | Active | v0.3.0 |
| SCHED-004 | Job Generator | Mock job generálás változó státuszokkal, late jobs jelöléssel | Active | v0.3.0 |
| SCHED-005 | Task Generator | Internal/Outsourced task generálás realistic duration-ökkel | Active | v0.3.0 |
| SCHED-006 | Assignment Generator | TaskAssignment generálás intentional conflict-ekkel teszteléshez | Active | v0.3.0 |
| SCHED-007 | Snapshot Cache | In-memory cache singleton a generált ScheduleSnapshot-hoz | Active | v0.3.0 |
| SCHED-008 | Mock API getSnapshot | Schedule snapshot lekérdezés szimulált késleltetéssel | Active | v0.3.1 |
| SCHED-009 | Mock API CRUD | Assignment create/update/delete műveletek mock-ként | Active | v0.3.1 |
| SCHED-010 | Mock API Latency Config | Konfigurálható késleltetés és failure rate teszteléshez | Active | v0.3.1 |
| SCHED-011 | Sidebar Component | Navigációs strip Lucide ikonokkal (Grid, Calendar, Settings) | Active | v0.3.2 |
| SCHED-012 | SidebarButton | Újrafelhasználható button active/inactive/disabled állapotokkal | Active | v0.3.2 |
| SCHED-013 | JobsList Container | Scrollable job lista panel "Problèmes" és "Travaux" szekciókkal | Active | v0.3.3 |
| SCHED-014 | JobsListHeader | Add Job button és search field | Active | v0.3.3 |
| SCHED-015 | ProblemsSection | Late és conflict jobok kiemelése badge-ekkel | Active | v0.3.3 |
| SCHED-016 | JobCard | Job kártya reference, client, description és progress dots-szal | Active | v0.3.3 |
| SCHED-017 | ProgressDots | Task completion vizualizáció (filled green / outline) | Active | v0.3.3 |
| SCHED-018 | Search Filtering | Job szűrés reference, client, description alapján | Active | v0.3.3 |
| SCHED-019 | JobDetailsPanel | Kiválasztott job információk és task lista panel | Active | v0.3.4 |
| SCHED-020 | JobInfo Section | Code, Client, Intitulé, Départ mezők megjelenítése | Active | v0.3.4 |
| SCHED-021 | TaskList Component | Task tile-ok scrollable listája scheduled/unscheduled státuszokkal | Active | v0.3.4 |
| SCHED-022 | DateStrip Component | Nap-alapú navigációs oszlop francia rövidítésekkel (Lu, Ma, Me...) | Active | v0.3.5 |
| SCHED-023 | DateCell | Napi cella day abbreviation + number, today amber highlight | Active | v0.3.5 |
| SCHED-024 | TimelineColumn | Óra markerek és tick marks (80px/óra skála) | Active | v0.3.6 |
| SCHED-025 | NowLine | Piros vonal az aktuális időpontnál időcímkével | Active | v0.3.6 |
| SCHED-026 | StationHeaders | Sticky header sor station nevekkel és off-screen indikátorokkal | Active | v0.3.7 |
| SCHED-027 | OffScreenIndicator | Chevron + count az off-screen tile-okhoz | Active | v0.3.7 |
| SCHED-028 | StationColumns Container | Horizontális scroll container a station oszlopoknak | Active | v0.3.8 |
| SCHED-029 | StationColumn | Egyéni station oszlop óra grid vonalakkal | Active | v0.3.8 |
| SCHED-030 | Unavailability Overlay | Hatched pattern a nem működő időszakokra | Active | v0.3.8 |
| SCHED-031 | SchedulingGrid | Unified grid komponens synchronized scrolling-gel | Active | v0.3.8 |
| SCHED-032 | Tile Component | Scheduled task assignment megjelenítés job színnel, setup/run szekciókkal | Active | v0.3.9 |
| SCHED-033 | SwapButtons | Hover-visible chevron up/down gombok tile-on | Active | v0.3.9 |
| SCHED-034 | SimilarityIndicators | Link/unlink ikonok consecutive tile-ok között setup time saving jelzéssel | Active | v0.3.10 |

### B5: Drag & Drop Basics (v0.3.11 - v0.3.20)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-035 | ~~@dnd-kit Integration~~ | ~~@dnd-kit/core library integráció drag & drop alapfunkciókhoz~~ | Deprecated | v0.3.11 |
| SCHED-036 | ~~DndContext Provider~~ | ~~React context provider drag session kezeléséhez~~ | Deprecated | v0.3.11 |
| SCHED-037 | ~~useDraggable Hook Integration~~ | ~~Task tile-ok draggable-ként regisztrálása~~ | Deprecated | v0.3.11 |
| SCHED-038 | ~~useDroppable Hook Integration~~ | ~~Station column-ok drop target-ként regisztrálása~~ | Deprecated | v0.3.11 |
| SCHED-039 | ~~Column Collapse During Drag~~ | ~~Nem-target oszlopok összezárása drag közben~~ | Deprecated | v0.3.12 |
| SCHED-040 | ~~Tile Muting During Drag~~ | ~~Nem-aktív tile-ok elhalványítása drag közben~~ | Deprecated | v0.3.12 |
| SCHED-041 | Realtime Validation Feedback | Validációs visszajelzés drag közben (conflict detection) | Active | v0.3.13 |
| SCHED-042 | ALT Key Validation Bypass | ALT billentyű lenyomásával validáció átugrása | Active | v0.3.13 |
| SCHED-043 | ~~Drop Handler Assignment Creation~~ | ~~Assignment létrehozása drop eseménykor~~ | Deprecated | v0.3.14 |
| SCHED-044 | Tile Swap Up Button | Tile felfelé cserélése az előző tile-lal | Active | v0.3.15 |
| SCHED-045 | Tile Swap Down Button | Tile lefelé cserélése a következő tile-lal | Active | v0.3.15 |
| SCHED-046 | Quick Placement Mode Toggle (ALT+Q) | Gyors elhelyezési mód be/ki kapcsolás | Active | v0.3.16 |
| SCHED-047 | Click-to-Place in Quick Placement | Kattintással elhelyezés quick placement módban | Active | v0.3.16 |
| SCHED-048 | Keyboard Shortcut: ALT+↑ (Move Up) | Kijelölt tile mozgatása felfelé | Active | v0.3.17 |
| SCHED-049 | Keyboard Shortcut: ALT+↓ (Move Down) | Kijelölt tile mozgatása lefelé | Active | v0.3.17 |
| SCHED-050 | Keyboard Shortcut: Home (First Slot) | Ugrás az első szabad slotra | Active | v0.3.17 |
| SCHED-051 | Keyboard Shortcut: ALT+D (Deselect) | Kijelölés megszüntetése | Active | v0.3.17 |
| SCHED-052 | Job Details Double-Click Recall | Dupla kattintás task tile-on visszavonja az ütemezésből | Active | v0.3.18 |
| SCHED-053 | Job Details Single-Click Jump | Egyszeri kattintás task tile-on a grid pozícióhoz scrolloz | Active | v0.3.18 |
| SCHED-054 | Selection Glow Effect | Kijelölt tile glow effekt a ring border helyett | Active | v0.3.19 |
| SCHED-055 | ~~Tile-Based Drop Position~~ | ~~Drop pozíció számítása a tile felső éléből~~ | Deprecated | v0.3.20 |

#### Deprecated Features (v0.3.57)

| ID | Feature | Mi váltotta fel |
|----|---------|-----------------|
| SCHED-035 | @dnd-kit Integration | Pick & Place (v0.3.57) |
| SCHED-036 | DndContext Provider | Pick & Place (v0.3.57) |
| SCHED-037 | useDraggable Hook | Pick & Place (v0.3.57) |
| SCHED-038 | useDroppable Hook | Pick & Place (v0.3.57) |
| SCHED-039 | Column Collapse During Drag | Pick & Place (v0.3.57) |
| SCHED-040 | Tile Muting During Drag | Pick & Place (v0.3.57) |
| SCHED-043 | Drop Handler Assignment Creation | Pick & Place (v0.3.57) |
| SCHED-055 | Tile-Based Drop Position | Pick & Place (v0.3.57) |

### B6: Station Compact, Fixes (v0.3.21 - v0.3.33)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-056 | Station Compact API | POST /api/v1/stations/{id}/compact endpoint gap eltávolításhoz | Active | v0.3.21 |
| SCHED-057 | CompactStationService | Compact algoritmus precedencia szabályok tiszteletben tartásával | Active | v0.3.21 |
| SCHED-058 | Station Compact Button | Compact gomb a station header-ben | Active | v0.3.22 |
| SCHED-059 | Compact Loading State | Spinner megjelenítése compact API hívás közben | Active | v0.3.22 |
| SCHED-060 | Downtime-Aware Tile Height | Tile magasság scheduledEnd - scheduledStart alapján | Active | v0.3.23 |
| SCHED-061 | Setup/Run Ratio Preservation | Proportionális setup/run szekciók stretched tile-okon | Active | v0.3.23 |
| SCHED-062 | Unscheduled Predecessor No Conflict | Ütemezetlen előd nem okoz PrecedenceConflict-ot | Active | v0.3.24 |
| SCHED-063 | Grid Tile Drag Repositioning | Ütemezett tile drag & drop újrapozícionálás | Active | v0.3.25 |
| SCHED-064 | Ghost Placeholder During Drag | Szaggatott körvonal az eredeti pozíción drag közben | Active | v0.3.25 |
| SCHED-065 | Custom Collision Detection | document.elementsFromPoint() alapú collision detection | Active | v0.3.26 |
| SCHED-066 | Reschedule Same Validation | Átütemezés azonos validációt követ mint új elhelyezés | Active | v0.3.26 |
| SCHED-067 | Orange Warning for Non-Blocking | Narancs highlight nem-blokkoló konfliktusokhoz (Plates) | Active | v0.3.26 |
| SCHED-068 | End Time Stretching (BR-ASSIGN-003b) | Befejezési idő nyújtása nem-működő időszakokon át | Active | v0.3.26 |
| SCHED-069 | E2E Test Suite (Drag-Drop) | 29 Playwright teszt drag & drop funkcionalitáshoz | Active | v0.3.27 |
| SCHED-070 | pragmatic-drag-and-drop Migration | Migráció @dnd-kit-ről pragmatic-drag-and-drop-ra | Active | v0.3.27 |
| SCHED-071 | Alt+Drop Conflict Recording Fix | Alt+drop helyesen rögzíti a PrecedenceConflict-ot | Active | v0.3.28 |
| SCHED-072 | Bypass-Independent Conflict Check | Külön validáció bypass nélkül konfliktus detektáláshoz | Active | v0.3.28 |
| SCHED-073 | Job Focus Muting (Non-Drag) | Nem-kijelölt job tile-ok elhalványítása kijelöléskor | Active | v0.3.29 |
| SCHED-074 | Persistent Amber Glow for Conflicts | Amber glow PrecedenceConflict-os tile-okon | Active | v0.3.29 |
| SCHED-075 | Conflict Glow Priority | Conflict glow felülírja a selection glow-t | Active | v0.3.29 |
| SCHED-076 | JobDetailsPanel Close Button | X gomb a panel jobb felső sarkában | Active | v0.3.30 |
| SCHED-077 | Toggle Click Deselection | Kijelölt job-ra kattintás megszünteti a kijelölést | Active | v0.3.30 |
| SCHED-078 | Real-Time Drag Snapping | Drag preview 30-perces rács pozíciókhoz snap-el | Active | v0.3.31 |
| SCHED-079 | Vertical-Only Drag Constraint | Tile csak vertikálisan mozgatható (station fix) | Active | v0.3.31 |
| SCHED-080 | ProgressSegments Component | 4-állapotú task progress vizualizáció | Active | v0.3.32 |
| SCHED-081 | Duration-Based Segment Width | Task időtartam alapú szegmens szélesség | Active | v0.3.32 |
| SCHED-082 | Outsourced Task Label | "2JO" stílusú címke outsourced szegmenseken | Active | v0.3.32 |
| SCHED-083 | Task Completion Toggle | Kattintásra toggle-olható completion ikon a tile-on | Active | v0.3.33 |

### B7: Navigation, Layout, UX (v0.3.34 - v0.3.46)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-084 | Top Navigation Bar | TopNavBar component above sidebar/grid with unified controls | Active | v0.3.34 |
| SCHED-085 | Zoom Control (50%-200%) | Slider with 50%, 75%, 100%, 150%, 200% levels | Active | v0.3.34 |
| SCHED-086 | Quick Placement Button | "Placement rapide" toggle for unscheduled mode | Active | v0.3.34 |
| SCHED-087 | Global Timeline Compaction | [4h] [8h] [24h] buttons to compact visible time | Active | v0.3.35 |
| SCHED-088 | compactTimeline() Function | Calculate collapsed hours and render compact grid | Active | v0.3.35 |
| SCHED-089 | Dry Time Precedence | +4h delay after offset printing for drying | Active | v0.3.36 |
| SCHED-090 | DRY_TIME_MINUTES Constant | 240-minute drying time for offset printing | Active | v0.3.36 |
| SCHED-091 | Multi-Day DateStrip Navigation | Click-to-scroll, focused day centering | Active | v0.3.37 |
| SCHED-092 | Departure Date Highlight | Red background on workshopExitDate cells | Active | v0.3.37 |
| SCHED-093 | Scheduled Day Markers | Emerald dots on days with scheduled tasks | Active | v0.3.37 |
| SCHED-094 | Group Capacity in Headers | ~~Usage/max display in station group headers~~ | Deprecated | v0.3.38 |
| SCHED-095 | Capacity Warning Red | ~~Red text when capacity exceeded~~ | Deprecated | v0.3.38 |
| SCHED-096 | Provider Columns | ProviderColumn component for outsourcing display | Active | v0.3.39 |
| SCHED-097 | Provider Headers | ProviderHeader with provider name and contact | Active | v0.3.39 |
| SCHED-098 | Provider Subcolumn Layout | Parallel task slots within provider column | Active | v0.3.39 |
| SCHED-099 | Similarities paperWeight Field | Paper weight in Job for similarity comparison | Active | v0.3.40 |
| SCHED-100 | Similarities inking Field | Inking config in Job for similarity comparison | Active | v0.3.40 |
| SCHED-101 | Drag Snapping Fix | Validate using snapped position, not raw cursor | Active | v0.3.41 |
| SCHED-102 | Multi-Day UnavailabilityOverlay | Overlay renders across multiple days correctly | Active | v0.3.42 |
| SCHED-103 | JobCard Overflow Fix | Long text truncation in job cards | Active | v0.3.42 |
| SCHED-104 | Muted Tile Click Handler | Muted (blocked) tiles respond to clicks | Active | v0.3.42 |
| SCHED-105 | Sidebar Full Height Layout | Sidebar stretches full viewport height | Active | v0.3.43 |
| SCHED-106 | Flux Logo Removed | Removed logo from header for cleaner UI | Active | v0.3.43 |
| SCHED-107 | 25% Zoom Level | Added 25% zoom option for overview | Active | v0.3.43 |
| SCHED-108 | DateStrip Focused Day | Visual focus on selected/focused date | Active | v0.3.44 |
| SCHED-109 | Today Indicator (Thin Line) | Red vertical line marking current time | Active | v0.3.44 |
| SCHED-110 | PrecedenceLines Component | Constraint visualization between tasks | Active | v0.3.45 |
| SCHED-111 | Purple Earliest Start Line | Purple line for earliest possible start | Active | v0.3.45 |
| SCHED-112 | Orange Latest Start Line | Orange line for latest allowed start | Active | v0.3.45 |
| SCHED-113 | Virtual Scrolling | Windowed rendering for 365+ days | Active | v0.3.46 |
| SCHED-114 | DateStrip Windowing | Virtualized DateStrip cells | Active | v0.3.46 |

> **Deprecation Note:** SCHED-094, SCHED-095 removed by v0.3.50 "Station header cleanup - Removed group capacity display for cleaner UI"

### B8: DateStrip, Validation, Pick&Place (v0.3.47 - v0.3.60)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-115 | ViewportIndicator Component | Gray rectangle showing visible portion of day in DateStrip | Active | v0.3.47 |
| SCHED-116 | DateStrip Task Markers | Colored horizontal lines for task status on date cells | Active | v0.3.47 |
| SCHED-117 | Task Marker Status Colors | Gray/orange/red/green colors for scheduled/conflict/late/completed | Active | v0.3.47 |
| SCHED-118 | ExitTriangle Component | White triangle marker at workshop exit date | Active | v0.3.47 |
| SCHED-119 | Task Timeline (Dotted Line) | Dotted line connecting earliest task to exit triangle | Active | v0.3.47 |
| SCHED-120 | "Now" Line in Viewport | Red line positioned by current time within viewport indicator | Active | v0.3.47 |
| SCHED-121 | Zoom-Aware Tile Snapping | Snapping uses current pixelsPerHour at all zoom levels | Active | v0.3.48 |
| SCHED-122 | pixelsPerHour in DragStateContext | Shared access to zoom-adjusted pixels per hour | Active | v0.3.48 |
| SCHED-123 | Hidden DateStrip Scrollbar | Scrollbar hidden using CSS while maintaining scroll functionality | Active | v0.3.49 |
| SCHED-124 | Date Tooltip on Hover | Full French date shown on DateStrip cell hover | Active | v0.3.50 |
| SCHED-125 | Clickable Departure Date | Click "Départ" date in JobInfo to jump to grid | Active | v0.3.50 |
| SCHED-126 | DryingTimeIndicator Component | Yellow arrow and "End of drying" label during drag | Active | v0.3.51 |
| SCHED-127 | Drying End Position Calculation | Show 4h drying period from predecessor end | Active | v0.3.51 |
| SCHED-128 | ValidationMessage Component | Tooltip showing conflict reason during drag | Active | v0.3.52 |
| SCHED-129 | French Validation Messages | Human-readable French messages for each conflict type | Active | v0.3.52 |
| SCHED-130 | addWorkingTime Utility | Add duration skipping non-working periods | Active | v0.3.53 |
| SCHED-131 | subtractWorkingTime Utility | Subtract duration respecting working hours | Active | v0.3.53 |
| SCHED-132 | Precedence Lines + Working Hours | Purple/orange lines account for lunch breaks | Active | v0.3.53 |
| SCHED-133 | PickStateContext | Context provider for pick state (pickedTask, pickSource) | Active | v0.3.54 |
| SCHED-134 | PickPreview Component | Portal-based ghost tile following cursor with RAF | Active | v0.3.54 |
| SCHED-135 | Sidebar Task Pick Handler | Click unscheduled task to start pick mode | Active | v0.3.54 |
| SCHED-136 | Pick Ring Color Feedback | Green/red/amber ring during hover validation | Active | v0.3.54 |
| SCHED-137 | ESC Key Cancel Pick | Press Escape to cancel pick operation | Active | v0.3.54 |
| SCHED-138 | Column Focus on Sidebar Pick | Auto-scroll to target, fade non-target columns 15% | Active | v0.3.55 |
| SCHED-139 | Scroll Position Restoration | ESC cancel restores original scroll position | Active | v0.3.55 |
| SCHED-140 | Non-Target Column Pointer Events Disabled | Prevent interactions with faded columns | Active | v0.3.55 |
| SCHED-141 | Global Grabbing Cursor | cursor:grabbing everywhere during pick mode | Active | v0.3.56 |
| SCHED-142 | Pulsating Animation CSS | pulse-opacity keyframes for placeholder | Active | v0.3.56 |
| SCHED-143 | Validation Throttle Early-Exit | Skip validation when cursor stays in same slot | Active | v0.3.56 |
| SCHED-144 | Pick from Grid Tiles | Click scheduled tile to pick for reschedule | Active | v0.3.57 |
| SCHED-145 | Pulsating Placeholder | Dashed border + animation at original position | Active | v0.3.57 |
| SCHED-146 | Remove Drag & Drop | Deleted dnd/ folder and pragmatic-drag-and-drop | Active | v0.3.57 |
| SCHED-147 | TileContextMenu Component | Portal-based right-click context menu | Active | v0.3.58 |
| SCHED-148 | Context Menu Options | Voir détails, Toggle completion, Move up/down | Active | v0.3.58 |
| SCHED-149 | Context Menu Close Triggers | Click outside, ESC, scroll closes menu | Active | v0.3.58 |
| SCHED-150 | Context Menu Edge Positioning | Auto-flip near viewport edges | Active | v0.3.58 |
| SCHED-151 | Fixed Tile Height in Job Details | 32px height instead of duration-based | Active | v0.3.59 |
| SCHED-152 | Unavailability Overlay SVG | SVG-based stripe pattern for performance | Active | v0.3.60 |

---

## Job Creation Form Features

### B9: Element Layer, JCF Basics (v0.4.0 - v0.4.12)

#### Element Layer (v0.4.0 - v0.4.3)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| SCHED-153 | Element Interface | Intermediate layer between Job and Task: id, jobId, suffix, label, prerequisiteElementIds, taskIds | Active | v0.4.0 |
| SCHED-154 | Task.elementId | Task references Element via elementId instead of direct jobId | Active | v0.4.0 |
| SCHED-155 | ScheduleSnapshot.elements | Elements array included in schedule snapshot | Active | v0.4.0 |
| SCHED-156 | Element Mock Data Generator | Generate one Element per Job with linked tasks | Active | v0.4.0 |
| SCHED-157 | Task.jobId Removal | Enforces clean architecture: Task.elementId → Element.jobId → Job path | Active | v0.4.1 |
| SCHED-158 | taskHelpers Utilities | getJobIdForTask, getTasksForJob, createTaskToJobMap, groupTasksByJob functions | Active | v0.4.1 |
| SCHED-159 | Element Layer Documentation | Updated domain model, business rules, architecture docs (15 files) | Active | v0.4.2 |
| SCHED-160 | Element PHP Entity | Backend Element entity with Doctrine ORM mapping, repository | Active | v0.4.3 |
| SCHED-161 | Element Database Migration | Creates elements table, migrates existing jobs to 1:1 elements | Active | v0.4.3 |
| SCHED-162 | Job-Element OneToMany | Job.elements collection, addElement, getElements, getElementIds | Active | v0.4.3 |
| SCHED-163 | Task-Element ManyToOne | Task.element relationship replacing Task.job direct reference | Active | v0.4.3 |
| SCHED-164 | SnapshotBuilder Elements | Backend includes elements array in snapshot, tasks have elementId | Active | v0.4.3 |
| SCHED-165 | ElementCreated Event | Domain event emitted when element is created | Active | v0.4.3 |

#### JCF Type System (v0.4.4 - v0.4.5)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-001 | ElementSpec Value Object | Production metadata: format, papier, pagination, imposition, impression, surfacage, quantite, qteFeuilles, autres, commentaires | Active | v0.4.4 |
| JCF-002 | PaperType Interface | Paper type with id, type name, grammages array | Active | v0.4.4 |
| JCF-003 | FeuilleFormat Interface | Sheet format with format name and poses array for imposition | Active | v0.4.4 |
| JCF-004 | ProductFormat Interface | ISO/custom format with id, name, width, height dimensions | Active | v0.4.4 |
| JCF-005 | ImpressionPreset Interface | Printing spec preset with id, value, description | Active | v0.4.4 |
| JCF-006 | SurfacagePreset Interface | Finishing/coating preset with id, value, description | Active | v0.4.4 |
| JCF-007 | PosteCategory Type | Machine category union: Presse offset/numérique, Massicot, Typo, etc. | Active | v0.4.4 |
| JCF-008 | PostePreset Interface | Machine preset with name and category | Active | v0.4.4 |
| JCF-009 | SoustraitantPreset Interface | Subcontractor preset with name | Active | v0.4.4 |
| JCF-010 | TemplateCategory Interface | Template category for grouping (id, name) | Active | v0.4.4 |
| JCF-011 | Mock Paper Types Data | 5 paper types × 14 grammages each | Active | v0.4.5 |
| JCF-012 | Mock Product Formats Data | 36 ISO format definitions (A, B, SRA series) | Active | v0.4.5 |
| JCF-013 | Mock Feuille Formats Data | 10 sheet formats with 8 poses each (powers of 2) | Active | v0.4.5 |
| JCF-014 | Mock Impression Presets Data | 9 printing specification presets | Active | v0.4.5 |
| JCF-015 | Mock Surfacage Presets Data | 10 finishing/coating presets | Active | v0.4.5 |
| JCF-016 | Mock Poste Presets Data | 16 machine presets across 8 categories | Active | v0.4.5 |
| JCF-017 | Mock Reference Data API | 8 getter methods for reference data on MockApi | Active | v0.4.5 |

#### JCF Modal & Job Header (v0.4.6 - v0.4.8)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-018 | JcfModal Component | Full-screen modal overlay with header, scrollable content, footer | Active | v0.4.6 |
| JCF-019 | Modal Keyboard Hints Footer | Tab, Alt+arrows, ↑↓, Cmd+S, Esc shortcuts display | Active | v0.4.6 |
| JCF-020 | Modal Close Interactions | Close via X button, Escape key, or backdrop click | Active | v0.4.6 |
| JCF-021 | JobsList Add Button Integration | "+" button in JobsList opens JCF modal | Active | v0.4.6 |
| JCF-022 | Job ID Field | Auto-generated J-YYYY-NNNN format, readonly, monospace | Active | v0.4.7 |
| JCF-023 | Intitulé Text Field | Free-text job description input, flex-grow | Active | v0.4.7 |
| JCF-024 | Quantité Numeric Input | Right-aligned numeric input, monospace, fixed width | Active | v0.4.7 |
| JCF-025 | Deadline Date Picker | French format (jj/mm or jj/mm/aaaa), ISO internal, calendar icon | Active | v0.4.7 |
| JCF-026 | parseFrenchDate Utility | Parses French date input to ISO 8601 with validation | Active | v0.4.7 |
| JCF-027 | formatToFrench Utility | Converts ISO date to French display format (jj/mm/aaaa) | Active | v0.4.7 |
| JCF-028 | generateJobId Utility | Generates J-{year}-{4digits} job ID format | Active | v0.4.7 |
| JCF-029 | JcfAutocomplete Component | Generic autocomplete with filtering, keyboard nav, dropdown, selection | Active | v0.4.8 |
| JCF-030 | highlightMatch Utility | Bold+colored matching text in autocomplete suggestions | Active | v0.4.8 |
| JCF-031 | useLazyLoadSuggestions Hook | Initial 10 items, scroll load more, max 25, hasMore indicator | Active | v0.4.8 |
| JCF-032 | Client Autocomplete Field | Client selection with session learning for new clients | Active | v0.4.8 |
| JCF-033 | Template Autocomplete Field | Client-filtered template suggestions with category badges | Active | v0.4.8 |
| JCF-034 | Autocomplete Focus Chain | Client → Template → Intitulé focus flow on selection | Active | v0.4.8 |

#### JCF Elements Table (v0.4.9 - v0.4.12)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-035 | JcfElementsTable Grid Layout | CSS Grid with 100px labels, 288px element columns | Active | v0.4.9 |
| JCF-036 | Element Header Row | Element name display with add/remove buttons | Active | v0.4.9 |
| JCF-037 | Element Name Editing | Click to edit, Enter/blur saves, Escape cancels, auto-generate ELEM{N} | Active | v0.4.9 |
| JCF-038 | 12 Field Rows | Precedences, quantité, pagination, format, papier, impression, surfacage, autres, imposition, qteFeuilles, commentaires | Active | v0.4.9 |
| JCF-039 | Sequence Row | Multi-line textarea for task sequence input | Active | v0.4.9 |
| JCF-040 | Add/Remove Element Buttons | + inserts after, − removes (disabled when 1 element) | Active | v0.4.9 |
| JCF-041 | Sticky Label Column | Left column stays visible on horizontal scroll | Active | v0.4.9 |
| JCF-042 | Cell ID System | id="cell-{elementIndex}-{rowIndex}" for programmatic focus | Active | v0.4.10 |
| JCF-043 | focusCell Utility | Imperative DOM focus via cell ID | Active | v0.4.10 |
| JCF-044 | Tab/Shift+Tab Navigation | Vertical movement within column, overflow to adjacent columns | Active | v0.4.10 |
| JCF-045 | Alt+Arrow Navigation | Circular wrap navigation in all four directions | Active | v0.4.10 |
| JCF-046 | Enter Key Cell Behavior | In text inputs: advance to next cell; in textareas: newline | Active | v0.4.10 |
| JCF-047 | Escape Key Cell Behavior | Blur current cell, return focus to table | Active | v0.4.10 |
| JCF-048 | onTabOut Prop | Autocomplete Tab/Shift+Tab delegation to parent table navigation | Active | v0.4.11 |
| JCF-049 | onArrowNav Prop | Autocomplete Alt+Arrow delegation to parent table navigation | Active | v0.4.11 |
| JCF-050 | useSessionLearning Hook | Manages 6 session states with learn handlers for reference data | Active | v0.4.12 |
| JCF-051 | mergeWithSession Utility | Session-first priority ordering with deduplication | Active | v0.4.12 |
| JCF-052 | Papier Session Learning | Replace-merge strategy for paper types | Active | v0.4.12 |
| JCF-053 | FeuilleFormat Session Learning | Poses-merge strategy for sheet formats | Active | v0.4.12 |
| JCF-054 | Simple Preset Session Learning | Dedup strategy for impression, surfacage, productFormat, poste | Active | v0.4.12 |

### B10: JCF Autocomplete Fields (v0.4.13 - v0.4.24)

#### Field-Specific Autocompletes (v0.4.13 - v0.4.16)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-055 | JcfFormatAutocomplete | Format field with ISO (A4, A3f), custom (210x297), composite (A3/A6) support | Active | v0.4.13 |
| JCF-056 | Format DSL Utilities | isValidFormat, normalizeFormat, toPrettyFormat, buildDimensionLookup | Active | v0.4.13 |
| JCF-057 | Format Pretty Display | Dimensions shown when unfocused (A4 — 210×297mm) | Active | v0.4.13 |
| JCF-058 | JcfAutocomplete onFocus Prop | Optional callback when input receives focus | Active | v0.4.13 |
| JCF-059 | JcfImpressionAutocomplete | Impression field with recto/verso DSL (Q/Q, Q+V/, N/N) | Active | v0.4.14 |
| JCF-060 | Impression DSL Utilities | toPrettyImpression, toDslImpression, isValidImpression | Active | v0.4.14 |
| JCF-061 | 9 Impression Presets | Q/Q, Q/, Q+V/Q+V, Q+V/Q, Q+V/, N/N, N/, Q/N, N/Q with descriptions | Active | v0.4.14 |
| JCF-062 | JcfSurfacageAutocomplete | Surfacage field with recto/verso DSL (mat/mat, brillant/, UV/UV) | Active | v0.4.15 |
| JCF-063 | Surfacage DSL Utilities | toPrettySurfacage, toDslSurfacage, isValidSurfacage | Active | v0.4.15 |
| JCF-064 | 10 Surfacage Presets | 5 R/V + 5 recto-only finishing/coating presets | Active | v0.4.15 |
| JCF-065 | JcfQuantiteInput | Digits-only, blur-to-1 default, Arrow Up/Down increment/decrement | Active | v0.4.16 |
| JCF-066 | JcfPaginationInput | Digits-only with inline validation (2 or multiples of 4) | Active | v0.4.16 |
| JCF-067 | isValidPagination Utility | Validates pagination values per §1.6 spec | Active | v0.4.16 |

#### Two-Step Autocompletes (v0.4.17 - v0.4.19)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-068 | JcfPapierAutocomplete | Two-step: type → grammage, DSL Type:Grammage format | Active | v0.4.17 |
| JCF-069 | Papier DSL Utilities | toPrettyPapier, toDslPapier, isValidPapier, parsePapierInput | Active | v0.4.17 |
| JCF-070 | Papier Pretty Display | Type Grammageg format when unfocused (Couché mat 135g) | Active | v0.4.17 |
| JCF-071 | JcfImpositionAutocomplete | Two-step: format → poses, DSL LxH(poses) format | Active | v0.4.18 |
| JCF-072 | Imposition DSL Utilities | toPrettyImposition, toDslImposition, isValidImposition, parseImposition, extractPosesFromImposition | Active | v0.4.18 |
| JCF-073 | Imposition Pretty Display | LxHcm Nposes/f format when unfocused (50x70cm 8poses/f) | Active | v0.4.18 |
| JCF-074 | JcfPrecedencesAutocomplete | Element name suggestions with multi-value comma-separated input | Active | v0.4.19 |
| JCF-075 | Precedences Self-Reference Prevention | Current element excluded from suggestions | Active | v0.4.19 |
| JCF-076 | Precedences Already-Selected Exclusion | Elements in comma list excluded from suggestions | Active | v0.4.19 |
| JCF-077 | Cascading Precedences on Rename | Update all precedences when element is renamed | Active | v0.4.19 |
| JCF-078 | Cascading Precedences on Remove | Remove element from all precedences when deleted | Active | v0.4.19 |

#### Sequence Multi-line Editor (v0.4.20 - v0.4.22)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-079 | JcfSequenceAutocomplete | Multi-line textarea with per-line autocomplete | Active | v0.4.20 |
| JCF-080 | Sequence Poste Mode | Machine name suggestions from 16 presets, PosteName(duration) format | Active | v0.4.20 |
| JCF-081 | Sequence Duration Suggestions | Default durations: 20, 30, 40, 60, 20+30, 20+40, 30+60 | Active | v0.4.20 |
| JCF-082 | Portal-Based Dropdown | Dropdown positioned at cursor within textarea | Active | v0.4.20 |
| JCF-083 | Sequence DSL Utilities | parseLine, isValidSequenceLine, isSequenceLineComplete, getCurrentLineInfo | Active | v0.4.20 |
| JCF-084 | Smart Sequence Validation | Incomplete lines (no closing paren) not flagged as errors | Active | v0.4.20 |
| JCF-085 | Sequence ST Mode | ST:Name(duration):description format for subcontractors | Active | v0.4.21 |
| JCF-086 | ST Name Suggestions | 5 presets: MCA, F37, LGI, AVN, JF | Active | v0.4.21 |
| JCF-087 | ST Duration Suggestions | Default ST durations with j/h suffixes: 1j, 2j, 3j, 4j, 5j | Active | v0.4.21 |
| JCF-088 | ST Description Step | Free-text description after duration (no autocomplete) | Active | v0.4.21 |
| JCF-089 | learnSoustraitant Session Learning | Session learning for custom subcontractor names | Active | v0.4.21 |
| JCF-090 | Sequence Workflow Prop | Optional sequenceWorkflow array for guided suggestions | Active | v0.4.22 |
| JCF-091 | Workflow Priority Sorting | Matching category postes appear first in suggestions | Active | v0.4.22 |
| JCF-092 | Workflow Star Marker | ★ prefix on category badge for priority postes | Active | v0.4.22 |
| JCF-093 | Multi-Category Workflow Steps | Comma-separated categories per step (e.g., "Presse offset, Presse numérique") | Active | v0.4.22 |
| JCF-094 | getWorkflowStepIndex Utility | Count completed lines to determine current workflow step | Active | v0.4.22 |
| JCF-095 | getExpectedCategories Utility | Look up expected categories from workflow array | Active | v0.4.22 |

#### Validation & Calculated Fields (v0.4.23 - v0.4.24)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-096 | JcfErrorTooltip | Error badge with "!" showing tooltip on hover/focus | Active | v0.4.23 |
| JCF-097 | Live Format Validation | Per-field DSL validation with red background on invalid cells | Active | v0.4.23 |
| JCF-098 | Pagination Validation | Must be 2 (feuillet) or multiple of 4 (cahier) | Active | v0.4.23 |
| JCF-099 | Papier Validation | Must contain : character | Active | v0.4.23 |
| JCF-100 | Imposition Validation | Must contain (N) or (Np) pattern | Active | v0.4.23 |
| JCF-101 | Impression Validation | Must contain / character | Active | v0.4.23 |
| JCF-102 | Surfacage Validation | Must contain / character | Active | v0.4.23 |
| JCF-103 | Format Validation | ISO A0-A10, LxH, f/fi suffix, or composite | Active | v0.4.23 |
| JCF-104 | Lenient Typing Validation | No error while typing incomplete values | Active | v0.4.23 |
| JCF-105 | Required Field Indicators | Amber dot for required-but-empty fields | Active | v0.4.24 |
| JCF-106 | BLOC SUPPORT Required Logic | Trigger: imposition/impression/surfacage/format → papier/pagination/format/qteFeuilles/imposition required | Active | v0.4.24 |
| JCF-107 | BLOC IMPRESSION Required Logic | Trigger: imposition/impression → impression required | Active | v0.4.24 |
| JCF-108 | qteFeuilles Auto-Calculation | Formula: ceil((jobQty × elementQty) / poses) | Active | v0.4.24 |
| JCF-109 | Auto/Manual Toggle | Calculator icon to switch between auto and manual modes | Active | v0.4.24 |
| JCF-110 | Green Auto Mode Indicator | Green text and icon when qteFeuilles is auto-calculated | Active | v0.4.24 |
| JCF-111 | Poses Extraction Utility | Extract poses from imposition DSL for calculation | Active | v0.4.24 |

### B11: JCF Validation, Templates, API (v0.4.25 - v0.4.40)

#### UI Scale & Validation (v0.4.29 - v0.4.30)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-112 | UI Scale Harmonization | 13px root font-size across application | Active | v0.4.29 |
| JCF-113 | 80% Zoom Levels | ZOOM_LEVELS constant with 80% increments | Active | v0.4.29 |
| JCF-114 | pixelsPerHour Scaling | Pixels per hour scales with font-size | Active | v0.4.29 |
| JCF-115 | Level 3 Validation | validateForSubmit() function for submit-blocking validation | Active | v0.4.30 |
| JCF-116 | hasAttemptedSubmit State | Error visibility after first submit attempt | Active | v0.4.30 |
| JCF-117 | French Error Messages | Validation messages in French (vitest) | Active | v0.4.30 |

#### Sequence & Prerequisites (v0.4.31 - v0.4.32e)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-118 | Sequence Template-Free Mode | Autocomplete without template workflow | Active | v0.4.31 |
| JCF-119 | sequenceWorkflow State | State array for guided sequence suggestions | Active | v0.4.31 |
| JCF-120 | Workflow Priority Sorting | Matching categories first in suggestions | Active | v0.4.31 |
| JCF-121 | PaperStatus Type | Element-level paper prerequisite: none/in_stock/to_order/ordered/delivered | Active | v0.4.32a |
| JCF-122 | BatStatus Type | Element-level BAT prerequisite: none/waiting_files/files_received/bat_sent/bat_approved | Active | v0.4.32a |
| JCF-123 | PlateStatus Type | Element-level plate prerequisite: none/to_make/ready | Active | v0.4.32a |
| JCF-124 | PrerequisiteDropdown Component | Dropdown for element prerequisite status selection | Active | v0.4.32a |
| JCF-125 | isElementBlocked Utility | Checks if element has blocking prerequisites | Active | v0.4.32b |
| JCF-126 | Blocked Tile Dashed Border | Visual indicator for blocked elements | Active | v0.4.32b |
| JCF-127 | PrerequisiteTooltip Component | 2-second hover tooltip showing prerequisite status | Active | v0.4.32b |
| JCF-128 | FormeStatus Type | Die-cutting tool prerequisite: none/in_stock/to_order/ordered/delivered | Active | v0.4.32c |
| JCF-129 | Date Tracking Fields | 7 date fields on Element: paperOrderedAt, paperDeliveredAt, filesReceivedAt, batSentAt, batApprovedAt, formeOrderedAt, formeDeliveredAt | Active | v0.4.32c |
| JCF-130 | hasDieCuttingAction Utility | Detect die-cutting tasks in element | Active | v0.4.32c |
| JCF-131 | Date Display Inline | DD/MM/YYYY format next to dropdowns | Active | v0.4.32c |
| JCF-132 | Prerequisites Documentation | Updated domain model, business rules, architecture docs | Active | v0.4.32d |
| JCF-133 | Element Prerequisites API | PUT /api/v1/elements/{id}/prerequisites endpoint | Active | v0.4.32e |
| JCF-134 | Element isBlocked() Method | PHP Entity method for blocking logic | Active | v0.4.32e |
| JCF-135 | ElementPaperStatusUpdated Event | Domain event for paper status changes | Active | v0.4.32e |
| JCF-136 | ElementBatStatusUpdated Event | Domain event for BAT status changes | Active | v0.4.32e |
| JCF-137 | ElementPlateStatusUpdated Event | Domain event for plate status changes | Active | v0.4.32e |
| JCF-138 | ElementFormeStatusUpdated Event | Domain event for forme status changes | Active | v0.4.32e |

#### API Integration (v0.4.33)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-139 | Element suffix → name Rename | Cross-cutting rename in types, API, frontend | Active | v0.4.33 |
| JCF-140 | Multi-Element Job Creation | POST /api/v1/jobs accepts elements[] array | Active | v0.4.33 |
| JCF-141 | JcfElementInput DTO | DTO for element data in job creation | Active | v0.4.33 |
| JCF-142 | Prerequisite Name Resolution | Backend resolves prerequisiteNames to IDs | Active | v0.4.33 |
| JCF-143 | Frontend Job API Client | API client for job creation | Active | v0.4.33 |
| JCF-144 | transformJcfToRequest Function | Transform JCF form state to API request format | Active | v0.4.33 |

#### Template System (v0.4.34 - v0.4.35)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-145 | JcfTemplate Type | Template interface in @flux/types | Active | v0.4.34 |
| JCF-146 | Template CRUD localStorage | LocalStorage-based template persistence | Active | v0.4.34 |
| JCF-147 | JcfTemplateList Component | Sortable table with search and actions | Active | v0.4.34 |
| JCF-148 | JcfTemplateEditorModal Component | Create/edit template modal | Active | v0.4.34 |
| JCF-149 | JcfTemplateHeaderForm Component | Template metadata form (name, description, category, client) | Active | v0.4.34 |
| JCF-150 | Template Apply to Elements | Populate JcfElementsTable from template | Active | v0.4.34 |
| JCF-151 | Save as Template | Create template from current job elements | Active | v0.4.34 |
| JCF-152 | Category Autocomplete | Session learning for template categories | Active | v0.4.34 |
| JCF-153 | Relative Date Formatting | French relative dates (il y a 5 min, hier, etc.) | Active | v0.4.34 |
| JCF-154 | JcfLinkToggle Component | Link/unlink button for field inheritance | Active | v0.4.35 |
| JCF-155 | JcfLinkableField Type | 5 linkable fields: format, papier, imposition, impression, surfacage | Active | v0.4.35 |
| JCF-156 | useLinkPropagation Hook | Link state and value propagation management | Active | v0.4.35 |
| JCF-157 | Value Inheritance on Link | Copy value from previous element when linked | Active | v0.4.35 |
| JCF-158 | Auto-Propagation on Change | Source changes cascade to linked downstream fields | Active | v0.4.35 |
| JCF-159 | Linked Field Visual Styling | Blue text and background for linked fields | Active | v0.4.35 |
| JCF-160 | JcfJsonEditor Component | CodeMirror 6 JSON editor with syntax highlighting | Active | v0.4.35 |
| JCF-161 | Dual-Mode Editor | Form/JSON tabs in template editor | Active | v0.4.35 |
| JCF-162 | Bidirectional Form-JSON Sync | Changes sync between Form and JSON views | Active | v0.4.35 |

#### Frontend Infrastructure (v0.4.36 - v0.4.40)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| JCF-163 | API Contract TypeScript Types | Types matching backend DTOs in @flux/types/api | Active | v0.4.36 |
| JCF-164 | CreateJobRequest Type | Request type for job creation | Active | v0.4.36 |
| JCF-165 | AssignTaskRequest Type | Request type for task assignment | Active | v0.4.36 |
| JCF-166 | ValidationErrorResponse Type | Error response type for 409 conflicts | Active | v0.4.36 |
| JCF-167 | RTK Query Endpoint Design | Documentation for RTK Query endpoints | Active | v0.4.36 |
| JCF-168 | Cache Invalidation Strategy | Tag-based cache invalidation documentation | Active | v0.4.36 |
| JCF-169 | Redux Store Configuration | Redux Toolkit store with middleware | Active | v0.4.37 |
| JCF-170 | Typed Redux Hooks | useAppSelector and useAppDispatch with TypeScript | Active | v0.4.37 |
| JCF-171 | RTK Query scheduleApi | API slice with mock adapter pattern | Active | v0.4.37 |
| JCF-172 | uiSlice | Redux slice for UI state | Active | v0.4.37 |
| JCF-173 | jcfSlice | Redux slice for JCF form state | Active | v0.4.37 |
| JCF-174 | Redux DevTools Integration | Time-travel debugging support | Active | v0.4.37 |
| JCF-175 | React Router DOM Setup | BrowserRouter integration | Active | v0.4.38 |
| JCF-176 | URL-Based Job Selection | /job/:jobId deep links | Active | v0.4.38 |
| JCF-177 | JCF Modal Route | /job/new opens JCF modal | Active | v0.4.38 |
| JCF-178 | Browser History Support | Back/forward navigation | Active | v0.4.38 |
| JCF-179 | Deep Linking Support | Direct URL access works | Active | v0.4.38 |
| JCF-180 | SonarQube Scanner Integration | Code quality analysis | Active | v0.4.39 |
| JCF-181 | /sonar Slash Command | Easy analysis command | Active | v0.4.39 |
| JCF-182 | Cognitive Complexity Reduction | CRITICAL issues 17 → 0 | Active | v0.4.39 |
| JCF-183 | Nested Ternary Refactoring | S3358 fixes across components | Active | v0.4.39 |
| JCF-184 | Accessibility Improvements | Native buttons replacing role="button" divs | Active | v0.4.39 |
| JCF-185 | JSON Editor Field Detection | Cursor context detection in JSON | Active | v0.4.40 |
| JCF-186 | Contextual Autocomplete in JSON | Field-aware suggestions in JSON editor | Active | v0.4.40 |
| JCF-187 | JSON Autocomplete Fields | name, format, papier, impression, surfacage, sequence suggestions | Active | v0.4.40 |

---

## QA Document Mapping

Ez a szekció definiálja, hogy a Feature Katalógus batch-ei hogyan képződnek le a Manual QA dokumentumokra. A `/manual-qa-plan` parancs ezt a mappinget használja.

| QA Csoport | Batch-ek | Output fájl | Leírás |
|------------|----------|-------------|--------|
| station-management | B1 | `api/station-management.md` | Station, Category, Group, Provider CRUD + Schedule API |
| job-management | B2 | `api/job-management.md` | Job, Task, Element, Comments API |
| scheduling | B3 | `api/scheduling.md` | Assignment, Validation, Conflict detection API |
| layout-grid | B4 | `scheduler/layout-grid.md` | Sidebar, Jobs List, Grid layout, Station columns |
| drag-drop | B5, B6 | `scheduler/drag-drop.md` | Drag & Drop, Validation feedback, Station compact view |
| navigation-ux | B7 | `scheduler/navigation-ux.md` | Keyboard navigation, Layout modes, UX improvements |
| datestrip-pickplace | B8 | `scheduler/datestrip-pickplace.md` | DateStrip, Pick & Place, Context menu |
| elements-table | B9 | `jcf/elements-table.md` | Element layer, JcfElementsTable, Row operations |
| autocomplete | B10 | `jcf/autocomplete.md` | JCF Autocomplete mezők (Papier, Imposition, etc.) |
| validation-templates | B11 | `jcf/validation-templates.md` | JCF Validation, Templates, JSON Editor |

**Megjegyzés:** A mapping finomítható a batch-ek feldolgozása során, ha az összevonás vagy szétbontás logikusabb struktúrát eredményez.

---

## Statistics

| Batch | Status | Features | Active | Suspicious | Deprecated |
|-------|--------|----------|--------|------------|------------|
| B1 | ✅ Complete | 20 | 20 | 0 | 0 |
| B2 | ✅ Complete | 25 | 21 | 0 | 4 |
| B3 | ✅ Complete | 31 | 31 | 0 | 0 |
| B4 | ✅ Complete | 34 | 34 | 0 | 0 |
| B5 | ✅ Complete | 21 | 13 | 0 | 8 |
| B6 | ✅ Complete | 28 | 28 | 0 | 0 |
| B7 | ✅ Complete | 31 | 29 | 0 | 2 |
| B8 | ✅ Complete | 38 | 38 | 0 | 0 |
| B9 | ✅ Complete | 54 | 54 | 0 | 0 |
| B10 | ✅ Complete | 57 | 57 | 0 | 0 |
| B11 | ✅ Complete | 76 | 76 | 0 | 0 |
| **Total** | | **415** | **401** | **0** | **14** |
