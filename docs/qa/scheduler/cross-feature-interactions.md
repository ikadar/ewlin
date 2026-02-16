# Flux Scheduler - Cross-Feature Interaction Manual QA

> **Feature Group:** Cross-Feature Interactions
> **Batch:** B10
> **Fixture:** louis-phase-1
> **Scope:** Complex multi-feature interaction scenarios, edge cases, cascading behaviors

---

## Overview

This document tests **interactions between features** rather than features in isolation. Each scenario requires at least two features working together correctly. The goal is to catch regressions where a change in one feature breaks another.

Key feature interactions covered:
- **Drying time + station operating hours** (physical drying vs. machine schedule)
- **Compaction + drying time / precedence** (does compaction respect constraints?)
- **Outsourced auto-assign + recall cascades** (lifecycle of outsourced assignments)
- **Quick Placement + multi-element backward scheduling** (cross-element task ordering)
- **Precedence validation + operating hours** (end time calculation accuracy)
- **Multi-job station conflicts** (resource contention)

---

## Test Fixture

| Fixture | URL | Description |
|---------|-----|-------------|
| `louis-phase-1` | `?fixture=louis-phase-1` | 10 jobs, 14 stations, 1 outsourced provider (Clément DCC) |

### Key Jobs for Testing

| Job | Type | Elements | Notable Stations |
|-----|------|----------|------------------|
| L-00001 | Brochure piquée | Couv (Komori→Polar), Cah1 (**Ryobi**→B26), Cah2 (SM52→MBO S), Fin (Hohner→Filmeuse) | Ryobi 524 (07:00-14:00) on Cahier 1 |
| L-00003 | Brochure assemblée | Int (**Ryobi**→Polar), Couv (SM52→Polar), Ass (Horizon ASS→Filmeuse) | Ryobi 524 on Intérieur |
| L-00007 | Brochure piquée | Couv (**Ryobi**→Polar), Cah1 (SM52→MBO M80), Cah2 (Komori→B26), Fin (Hohner→Filmeuse) | Ryobi 524 on Couverture |
| L-00008 | Dépliant | ELT: **Ryobi**→Polar→MBO S→Carton | All 4 tasks in single element, Ryobi first |
| L-00010 | Brochure piquée (DCC) | Couv (**Ryobi**→Polar), Cah1 (SM52→MBO M80), Cah2 (Komori→B26), Fin (**outsourced DCC**) | Outsourced task on Finition |

### Key Stations

| Station | Schedule | Category | Notes |
|---------|----------|----------|-------|
| Ryobi 524 | 07:00-14:00 | Offset | Narrow schedule → tasks span overnight |
| Heidelberg SM52 | 07:00-14:30 | Offset | Similar narrow schedule |
| Komori G40 | 00:00-23:59 | Offset | Effectively 24h → no overnight spillover |
| Polar 137 | 07:00-14:00 | Massicot | Narrow schedule |
| B26 / MBO S / MBO M80 | 06:00-19:00 | Plieuse | Wide schedule |
| Hohner | 06:00-19:00 | Encarteuse | Wide schedule |
| Horizon 60H / ASS | 06:00-13:00 | Assembleuse | Narrow schedule |
| Filmeuse / Carton | 07:00-14:00 | Conditionnement | Narrow schedule |

---

## A. Drying Time + Operating Hours

These scenarios test that the 4-hour physical drying time interacts correctly with station operating hours.

### CFI-A01: Drying time spans past Ryobi closing

**Priority:** P1
**Job:** L-00001 (Cahier 1: Ryobi 524 → B26)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Pick (click) the Cahier 1 Ryobi 524 task from sidebar
2. Place it on the Ryobi 524 column at **12:00** today (the task will finish at ~13:30 depending on duration)
3. Observe the drying time yellow arrow indicator on the tile
4. Now pick the Cahier 1 B26 (plieuse) task from sidebar
5. Observe the **purple line** on the B26 column

**Expected Results:**
- [ ] Yellow arrow appears at the bottom of the Ryobi tile
- [ ] Drying ends 4 hours after the Ryobi task finishes (e.g., if task ends 13:30 → drying ends 17:30)
- [ ] Purple line on B26 appears at **17:30** (or the equivalent drying end time) — NOT at 13:30
- [ ] Since B26 operates 06:00-19:00, 17:30 is within working hours → purple line is at 17:30 same day
- [ ] Placing B26 task before purple line → **red ring** (invalid)
- [ ] Placing B26 task after purple line → **green ring** (valid)

---

### CFI-A02: Drying time ends outside successor station hours

**Priority:** P1
**Job:** L-00001 (Couverture: Komori G40 → Polar 137)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Pick the Couverture Komori G40 (offset) task from sidebar
2. Place it on Komori G40 at **20:00** today (Komori runs 00:00-23:59, so this is valid)
3. Note when the task ends (e.g., ~21:00 depending on duration)
4. Drying ends at ~01:00 next day (end + 4h)
5. Now pick the Couverture Polar 137 (massicot) task from sidebar
6. Observe the purple line on Polar 137 column

**Expected Results:**
- [ ] Polar 137 operates 07:00-14:00
- [ ] Drying ends at ~01:00 (overnight, when Polar is closed)
- [ ] Purple line on Polar 137 should appear at **07:00 next day** (snapped to next working slot)
- [ ] Cannot place the Polar task before 07:00 next day

---

### CFI-A03: Drying time with Ryobi task near closing (overnight spillover)

**Priority:** P1
**Job:** L-00008 (Dépliant: Ryobi → Polar → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008

**Steps:**
1. Pick the Ryobi 524 (offset) task from sidebar
2. Place it at **13:00** on Ryobi 524 (station closes at 14:00)
3. If the task duration > 60 min, the task will span overnight (resumes at 07:00 next day)
4. Note the actual end time (e.g., 07:30 next day if 90min total)
5. Pick the Polar 137 (massicot) task from sidebar
6. Observe the purple line on Polar 137

**Expected Results:**
- [ ] Task end time accounts for Ryobi operating hours (13:00 + duration, pausing at 14:00, resuming 07:00 next day)
- [ ] Drying time starts from the **actual** end time (e.g., 07:30 next day), not from the naive calculation
- [ ] Purple line on Polar = actual end time + 4h (e.g., 11:30 next day)
- [ ] Since Polar opens 07:00-14:00, 11:30 is within working hours → purple line at 11:30

---

## B. Compaction Interactions

### CFI-B01: Compaction preserves drying time gap

**Priority:** P1
**Job:** L-00008 (Dépliant: Ryobi → Polar → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008

**Steps:**
1. Schedule all 4 tasks in order, with deliberate **large gaps** between them:
   - Ryobi 524: place at 07:00 today
   - Polar 137: place at 07:00 **tomorrow** (large gap, but must be after drying)
   - MBO S: place at 12:00 tomorrow (gap after Polar)
   - Carton: place at 07:00 **day after tomorrow** (large gap)
2. Click the **Compact** button in the toolbar
3. Select **24h** horizon
4. Observe the results

**Expected Results:**
- [ ] Polar 137 task moves earlier but NOT before Ryobi end + 4h drying
- [ ] MBO S task moves to immediately after Polar ends (no drying between non-printing tasks)
- [ ] Carton task moves to immediately after MBO S ends
- [ ] The gap between Ryobi and Polar is exactly the drying time (4h)
- [ ] Console shows moved count > 0

---

### CFI-B02: Compaction respects cross-element precedence

**Priority:** P1
**Job:** L-00001 (Brochure piquée: 4 elements)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Schedule tasks from all elements with gaps:
   - Couverture: Komori at 07:00 today, Polar at 07:00 tomorrow
   - Cahier 1: Ryobi at 07:00 today, B26 at 07:00 tomorrow
   - Cahier 2: SM52 at 07:00 today, MBO S at 07:00 tomorrow
   - Finition: Hohner at 07:00 day-after-tomorrow, Filmeuse at 12:00 day-after-tomorrow
2. Click **Compact** → 24h
3. Observe the Finition element tasks

**Expected Results:**
- [ ] Hohner task does NOT move before the latest of (Couv Polar end, Cah1 B26 end, Cah2 MBO S end)
- [ ] Cross-element prerequisite order is preserved
- [ ] Filmeuse task stays after Hohner task
- [ ] Print element tasks are compacted independently (no cross-element dependency between Couv/Cah1/Cah2)

---

### CFI-B03: Compaction with mixed scheduled/unscheduled tasks

**Priority:** P2
**Job:** L-00001 (Brochure piquée)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Schedule only Couverture element tasks (Komori + Polar) with a gap
2. Leave Cahier 1, Cahier 2, and Finition **unscheduled**
3. Click **Compact** → 24h

**Expected Results:**
- [ ] Only the 2 scheduled Couverture tasks are affected by compaction
- [ ] Unscheduled tasks remain unscheduled (compaction doesn't auto-schedule)
- [ ] Compacted Couverture tasks maintain correct order (Komori before Polar, with drying gap if applicable)

---

### CFI-B04: Compaction does not move task before station opens

**Priority:** P1
**Job:** L-00008 (Dépliant: Ryobi → Polar → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008

**Steps:**
1. Schedule tasks with gaps, ensuring predecessors end before successor station opens:
   - Ryobi 524: place at **07:00** today (ends ~08:30, drying ends ~12:30)
   - Polar 137: place at **13:00** today (gap after drying end — could move to 12:30)
   - MBO S: place at **12:00 tomorrow** (large gap — MBO opens 06:00)
   - Carton: place at **12:00 tomorrow** (after MBO S, Carton opens 07:00)
2. Click **Compact** → 24h
3. Observe each task's new start time

**Expected Results:**
- [ ] Polar 137 moves to 12:30 (Ryobi end + 4h drying) — within Polar hours (07:00-14:00), valid
- [ ] MBO S moves to immediately after Polar ends — if Polar ends at, say, 13:15, MBO starts 13:15 (MBO open 06:00-19:00, valid)
- [ ] Carton moves to immediately after MBO S ends — but if MBO S ends at e.g. 15:15 and Carton closes at 14:00 → Carton task should start at **07:00 next day** (not 15:15)
- [ ] No task is placed outside its station's operating hours after compaction

---

### CFI-B05: Compaction with predecessor on 24h station, successor on narrow station

**Priority:** P1
**Job:** L-00001 (Couverture: Komori G40 → Polar 137)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Schedule Couverture Komori G40 (offset) task at **03:00** today (Komori runs 00:00-23:59)
   - Task ends around ~04:00-04:30, drying ends ~08:00-08:30
2. Schedule Couverture Polar 137 task at **12:00** today (gap of ~4h after drying)
3. Click **Compact** → 24h

**Expected Results:**
- [ ] Komori task does NOT move earlier than 03:00 (it's already the earliest in its own chain)
- [ ] Polar task moves earlier to **drying end time** (~08:00-08:30)
- [ ] Polar does NOT move to 04:00 (Komori end without drying), the 4h drying gap is preserved
- [ ] Polar does NOT move before 07:00 (its opening time), even if drying ends at e.g. 06:30
- [ ] If drying ends at 06:30 → Polar starts at **07:00** (station opening, whichever is later)

---

### CFI-B06: Compaction cascading across narrow-schedule stations

**Priority:** P2
**Job:** L-00008 (Dépliant: Ryobi 524 → Polar 137 → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008

**Steps:**
1. Schedule all 4 tasks far apart, each at **07:00** on consecutive days:
   - Ryobi 524: 07:00 Monday (ends ~08:30 Mon, drying ~12:30 Mon)
   - Polar 137: 07:00 Tuesday (huge gap)
   - MBO S: 07:00 Wednesday (huge gap)
   - Carton: 07:00 Thursday (huge gap)
2. Click **Compact** → 24h (should cover all 4 days if large enough)
3. Check each task's new position

**Expected Results:**
- [ ] Ryobi stays at 07:00 Monday (nothing before it)
- [ ] Polar moves to ~12:30 Monday (Ryobi end + 4h drying) — within Polar hours (07:00-14:00)
- [ ] MBO S moves to immediately after Polar ends Monday — within MBO hours (06:00-19:00)
- [ ] Carton moves to immediately after MBO S ends — if within Carton hours (07:00-14:00), same day; if not, to 07:00 next operating day
- [ ] All 4 tasks may fit on the **same day** if durations are short enough
- [ ] No task violates its station operating hours

---

## C. Outsourced Task Interactions

### CFI-C01: Full outsourced auto-assign lifecycle

**Priority:** P1
**Job:** L-00010 (Brochure piquée with DCC outsourced Finition)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010

**Steps:**
1. Note the Finition element shows the DCC outsourced task with empty Dép/Ret dates
2. Schedule **all 6 print tasks** (2 per element: Couv, Cah1, Cah2) in any order
3. After placing the **last** (6th) print task, observe the outsourced task

**Expected Results:**
- [ ] Dép/Ret dates remain empty until ALL 6 tasks are scheduled
- [ ] After the 6th task is placed, the outsourced task auto-assigns with calculated dates
- [ ] Departure date = latest predecessor end time, snapped to latestDepartureTime (14:00)
- [ ] Return date = departure + transitDays(3) + openDays(3) + transitDays(3) (accounting for weekends)
- [ ] The mini-form shows the calculated dates (non-empty)

---

### CFI-C02: Partial predecessor scheduling — no auto-assign

**Priority:** P1
**Job:** L-00010

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010

**Steps:**
1. Schedule only Couverture's 2 tasks (Ryobi + Polar)
2. Schedule Cahier 1's 2 tasks (SM52 + MBO M80)
3. Leave Cahier 2 **unscheduled**
4. Check the outsourced task

**Expected Results:**
- [ ] Outsourced task does NOT auto-assign (Cahier 2 not fully scheduled)
- [ ] Dép/Ret dates remain empty
- [ ] No assignment is created for the outsourced task

---

### CFI-C03: Recall predecessor → outsourced auto-removal

**Priority:** P1
**Job:** L-00010

**Preconditions:**
- Complete CFI-C01 first (all predecessors scheduled, outsourced auto-assigned)

**Steps:**
1. Verify outsourced task shows calculated Dép/Ret dates
2. **Double-click** (recall) any one of the 6 print tasks (e.g., Cahier 2 B26)
3. Observe the outsourced task

**Expected Results:**
- [ ] Outsourced task assignment is **removed** (because not ALL predecessors are scheduled anymore)
- [ ] Dép/Ret dates become empty again
- [ ] The outsourced task returns to unscheduled state

---

### CFI-C04: Re-schedule predecessor → outsourced re-assignment

**Priority:** P1
**Job:** L-00010

**Preconditions:**
- Complete CFI-C03 first (one predecessor recalled, outsourced unassigned)

**Steps:**
1. Re-schedule the recalled task (pick it and place it on the grid)
2. Observe the outsourced task

**Expected Results:**
- [ ] Outsourced task auto-assigns again with recalculated dates
- [ ] Dates may differ from CFI-C01 if the re-scheduled task is at a different time
- [ ] Full cycle: assigned → removed → re-assigned works correctly

---

### CFI-C05: Outsourced task with tight deadline

**Priority:** P2
**Job:** L-00010

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Note L-00010's workshop exit date (visible in job details panel)
- Select L-00010

**Steps:**
1. Schedule all 6 print tasks as **late as possible** (near the workshop exit date)
2. After the 6th task, observe the outsourced task auto-assign
3. Check if the return date exceeds the workshop exit date

**Expected Results:**
- [ ] If return date > workshop exit date → the job should appear in the late jobs list
- [ ] Late job indicator (if any) reflects the outsourced return date, not just the last print task

---

## D. Precedence + Operating Hours

### CFI-D01: Predecessor end time respects station schedule (orange line)

**Priority:** P1
**Job:** L-00001 (Finition: Hohner → Filmeuse)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001
- Schedule Couverture, Cahier 1, and Cahier 2 fully (all 6 print tasks)

**Steps:**
1. Pick the Finition Hohner task from sidebar
2. Observe the **purple line** on the Hohner column
3. Note that it should be at or after the latest predecessor end (Couv Polar end, Cah1 B26 end, Cah2 MBO S end)
4. Place the Hohner task after the purple line
5. Now pick the Finition Filmeuse task from sidebar
6. Observe the **purple line** on the Filmeuse column

**Expected Results:**
- [ ] Purple line on Hohner = max(last tasks of Couv, Cah1, Cah2) including drying if any predecessor chain includes offset
- [ ] Purple line on Filmeuse = Hohner task end time (Hohner is not offset → no drying)
- [ ] If Hohner task is placed near 18:00 (Hohner closes 19:00), the actual end accounts for working hours
- [ ] The constraint lines correctly account for operating hours in all calculations

---

### CFI-D02: Predecessor on narrow-schedule station — actual vs. naive end time

**Priority:** P1
**Job:** L-00003 (Intérieur: Ryobi 524 → Polar 137)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00003

**Steps:**
1. Pick the Intérieur Ryobi 524 (offset) task
2. Place it at **13:00** on Ryobi 524 (which closes at 14:00)
3. The task should run ~60min at station but station closes at 14:00 → task continues next day at 07:00
4. Calculate: actual end = 07:00 next day + (duration - 60min worked)
5. Now pick the Intérieur Polar 137 (massicot) task
6. Check purple line on Polar 137

**Expected Results:**
- [ ] Ryobi tile shows correct duration accounting for overnight pause
- [ ] Purple line on Polar = Ryobi actual end + 4h drying (NOT naive 13:00 + duration + 4h)
- [ ] Example: if 90min total, runs 60min (13:00-14:00), resumes 07:00, ends 07:30 → drying ends 11:30
- [ ] Purple line at 11:30 next day (Polar is open 07:00-14:00, so 11:30 is valid)

---

### CFI-D03: Assembleuse narrow hours + cross-element

**Priority:** P2
**Job:** L-00003 (Assemblage: Horizon ASS (06:00-13:00) → Filmeuse (07:00-14:00))

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00003
- Schedule all Intérieur and Couverture tasks

**Steps:**
1. Pick the Assemblage Horizon ASS task
2. Place it at **12:00** on Horizon ASS (station closes 13:00)
3. If task duration > 60min → spans to next day 06:00
4. Pick the Assemblage Filmeuse task
5. Check purple line on Filmeuse

**Expected Results:**
- [ ] Horizon ASS task spans overnight if duration > 60min from 12:00
- [ ] Purple line on Filmeuse = actual Horizon ASS end (not naive calculation)
- [ ] Since Filmeuse opens at 07:00, purple line = max(actual end, 07:00) if end is before 07:00

---

## E. Quick Placement Complex Scenarios

### CFI-E01: Full backward scheduling across 4 elements

**Priority:** P1
**Job:** L-00001 (Brochure piquée: Couv, Cah1, Cah2, Finition — 8 tasks)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001

**Steps:**
1. Activate Quick Placement mode (Alt+Q)
2. Note which task is highlighted in the sidebar (should be the **bottom-most** task across all elements = Finition Filmeuse, seq 1)
3. Grid should auto-scroll to the Filmeuse column
4. Place the task on Filmeuse
5. Next highlighted task should be Finition Hohner (seq 0)
6. Grid should auto-scroll to Hohner column
7. Continue placing tasks in backward order through all elements
8. Complete all 8 tasks

**Expected Results:**
- [ ] Task order follows bottom-to-top in sidebar: Finition tasks first, then Cahier 2, Cahier 1, Couverture
- [ ] Within each element: highest sequenceOrder first (backward scheduling)
- [ ] After each placement, grid auto-scrolls to the next target station
- [ ] After each placement, the correct constraint lines appear on the next station
- [ ] After all 8 tasks: Quick Placement has no more tasks to highlight

---

### CFI-E02: Quick Placement auto-scroll targets correct station

**Priority:** P1
**Job:** L-00001

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001
- Scroll grid all the way to the left

**Steps:**
1. Activate Quick Placement mode (Alt+Q)
2. Note the highlighted task (bottom-most unscheduled)
3. Observe the grid auto-scroll

**Expected Results:**
- [ ] Grid scrolls horizontally to center the target station column in viewport
- [ ] If predecessor constraint exists, grid scrolls vertically to show the purple line
- [ ] If no predecessor constraint, grid scrolls horizontally only
- [ ] Smooth animation (not instant jump)

---

### CFI-E03: Quick Placement skips outsourced task

**Priority:** P1
**Job:** L-00010 (with DCC outsourced Finition)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010

**Steps:**
1. Activate Quick Placement mode (Alt+Q)
2. Note the highlighted task — should be the **last internal task** in Cahier 2 (B26, plieuse)
3. NOT the outsourced DCC task (outsourced tasks can't be placed via Quick Placement)
4. Place all 6 internal tasks using Quick Placement

**Expected Results:**
- [ ] Quick Placement never highlights the outsourced DCC task
- [ ] The 6 internal tasks are placed in backward order: Cah2 B26, Cah2 Komori, Cah1 MBO M80, Cah1 SM52, Couv Polar, Couv Ryobi
- [ ] After all 6 internal tasks placed, the outsourced task auto-assigns
- [ ] Quick Placement shows no more tasks available (exits or shows empty state)

---

### CFI-E04: Quick Placement validation with drying time

**Priority:** P1
**Job:** L-00008 (Dépliant: Ryobi → Polar → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008

**Steps:**
1. Activate Quick Placement mode (Alt+Q)
2. Last task is Carton (seq 3) — place it
3. Next task is MBO S (seq 2) — place it
4. Next task is Polar 137 (seq 1) — place it
5. Next task is Ryobi 524 (seq 0, offset printing)
6. Hover over Ryobi 524 column — observe the **orange line** (successor constraint)
7. The orange line should account for drying time between Ryobi and Polar

**Expected Results:**
- [ ] Orange line on Ryobi = Polar start - 4h drying - Ryobi task duration (all in working hours)
- [ ] Placing Ryobi task **before** orange line → green ring (valid, finishes in time for drying + successor)
- [ ] Placing Ryobi task **after** orange line → red ring (invalid, successor would be violated)
- [ ] Orange line is calculated in working hours (not naive subtraction)

---

## F. Multi-Job Station Conflicts

### CFI-F01: Two jobs competing for same station slot

**Priority:** P1
**Jobs:** L-00001 (Cah1: Ryobi) + L-00003 (Int: Ryobi)

**Preconditions:**
- Load `?fixture=louis-phase-1`

**Steps:**
1. Select L-00001 and schedule Cahier 1 Ryobi task at **08:00** today
2. Select L-00003 and pick Intérieur Ryobi task
3. Try to place it at **08:00** today (same time, same station)

**Expected Results:**
- [ ] Red ring appears — station overlap conflict
- [ ] Validation message indicates the station is occupied
- [ ] Placing it at a non-overlapping time → green ring

---

### CFI-F02: Two jobs on same station, sequential (no conflict)

**Priority:** P2
**Jobs:** L-00001 + L-00003

**Preconditions:**
- Load `?fixture=louis-phase-1`

**Steps:**
1. Select L-00001, schedule Cahier 1 Ryobi task at 07:00 (ends ~08:30)
2. Select L-00003, pick Intérieur Ryobi task
3. Place it right after L-00001's task ends (e.g., 08:30 or 08:45)

**Expected Results:**
- [ ] Green ring — no conflict when tasks don't overlap
- [ ] Both tasks visible on the Ryobi column without overlap

---

### CFI-F03: Polar 137 bottleneck — multiple jobs on single massicot

**Priority:** P2
**Jobs:** Any 3 jobs that use Polar 137

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Note: ALL jobs with a massicot step use Polar 137 (only 1 massicot station)

**Steps:**
1. Schedule 3 different jobs' Polar 137 tasks at the **same time** (e.g., 08:00)
2. Observe conflicts for the 2nd and 3rd tasks

**Expected Results:**
- [ ] First task: green ring (station free)
- [ ] Second task at same time: red ring (station overlap)
- [ ] Tasks can be stacked sequentially without conflict
- [ ] Polar 137 is the natural bottleneck (only 1 massicot station)

---

## G. Recall Cascade Scenarios

### CFI-G01: Recall middle task in same-element chain

**Priority:** P1
**Job:** L-00008 (Dépliant: Ryobi → Polar → MBO S → Carton)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008
- Schedule all 4 tasks in correct order

**Steps:**
1. Verify all 4 tasks are scheduled and show as valid (green)
2. **Double-click** (recall) the Polar 137 task (2nd in chain)
3. Observe the MBO S and Carton tasks (3rd and 4th in chain)

**Expected Results:**
- [ ] Polar task is removed from the grid
- [ ] MBO S task remains scheduled and shows **no conflict** (unscheduled predecessor is not a constraint — backward scheduling is valid)
- [ ] Carton task remains scheduled, no conflict (same reason)
- [ ] The system does NOT automatically cascade-recall dependent tasks

---

### CFI-G02: Recall + outsourced cascade + re-schedule full cycle

**Priority:** P1
**Job:** L-00010 (with DCC outsourced)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010
- Schedule all 6 internal tasks → outsourced auto-assigns

**Steps:**
1. Verify outsourced DCC task has calculated Dép/Ret dates
2. Recall Cahier 1 MBO M80 task (last task of Cahier 1 element)
3. Check outsourced task → should lose its assignment (not all predecessors scheduled)
4. Now recall Cahier 1 SM52 task as well (first task of Cahier 1)
5. Re-schedule SM52 task at a **different time** (earlier or later than original)
6. Re-schedule MBO M80 task
7. Check outsourced task → should auto-assign with new dates

**Expected Results:**
- [ ] Step 2-3: Outsourced assignment removed (Cahier 1 not fully scheduled)
- [ ] Step 4: Still no outsourced assignment
- [ ] Step 6-7: Outsourced re-assigns with dates based on new MBO M80 end time
- [ ] Dates differ from original if the re-scheduled task has a different end time

---

### CFI-G03: Recall in Quick Placement mode

**Priority:** P2
**Job:** L-00001

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00001
- Schedule some tasks via Quick Placement

**Steps:**
1. While in Quick Placement mode, **double-click** a scheduled tile on the grid to recall it
2. Observe Quick Placement state

**Expected Results:**
- [ ] Task is recalled (removed from grid)
- [ ] Quick Placement correctly updates: the recalled task (or a later unscheduled task) becomes the new target
- [ ] Auto-scroll updates to the new target station
- [ ] Constraint lines update

---

## H. Edge Cases

### CFI-H01: Weekend boundary — task placed Friday afternoon

**Priority:** P2
**Job:** L-00008 (Ryobi 524 → Polar 137)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008
- Navigate to a **Friday** on the grid

**Steps:**
1. Place the Ryobi 524 task on **Friday at 13:00** (station closes 14:00)
2. If duration > 60 min, task spans to next working day
3. Check when the task actually ends (should be **Monday morning**)
4. Pick the Polar task and check the purple line

**Expected Results:**
- [ ] Ryobi task pauses at Friday 14:00, resumes Monday 07:00
- [ ] Drying time starts from the actual end (Monday 07:00 + remaining duration)
- [ ] Purple line on Polar = actual end + 4h, snapped to Polar working hours (Mon 07:00-14:00)
- [ ] Saturday and Sunday are correctly skipped

---

### CFI-H02: Quick Placement with all tasks already scheduled

**Priority:** P2
**Job:** L-00005 (Flyer, 3 tasks)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00005
- Schedule all 3 tasks manually

**Steps:**
1. Activate Quick Placement mode (Alt+Q)
2. Observe behavior

**Expected Results:**
- [ ] No task is highlighted in the sidebar (all scheduled)
- [ ] No station is highlighted as available
- [ ] Grid does NOT auto-scroll (no target)
- [ ] Quick Placement mode either deactivates or shows "nothing to place" state

---

### CFI-H03: Zoom level change during Quick Placement

**Priority:** P3
**Job:** Any multi-task job

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select a job and activate Quick Placement mode

**Steps:**
1. Note the purple/orange line positions
2. Change zoom level (Ctrl+scroll or zoom controls)
3. Observe constraint lines

**Expected Results:**
- [ ] Constraint lines update to correct Y positions at new zoom level
- [ ] Auto-scroll targets remain accurate after zoom change
- [ ] Validation (green/red ring) remains correct at new zoom

---

### CFI-H04: Compaction with zero movable tasks

**Priority:** P3

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Do NOT schedule any tasks

**Steps:**
1. Click **Compact** → 24h

**Expected Results:**
- [ ] No error or crash
- [ ] Console shows moved: 0, skipped: 0
- [ ] Snapshot unchanged

---

### CFI-H05: Outsourced task manual date edit after auto-assign

**Priority:** P2
**Job:** L-00010

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010
- Schedule all 6 internal tasks → outsourced auto-assigns

**Steps:**
1. Verify DCC task has auto-assigned dates
2. Manually clear the Dép date in the outsourced mini-form
3. Manually clear the Ret date in the outsourced mini-form

**Expected Results:**
- [ ] Clearing dates should be possible (form is editable)
- [ ] Behavior after clearing: the assignment may remain with empty dates OR be removed
- [ ] No crash or infinite loop when manually editing auto-assigned dates
- [ ] If a predecessor is recalled and re-scheduled, auto-assign recalculates fresh

---

### CFI-H06: Quick Placement toggle during Pick & Place

**Priority:** P2

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select a job

**Steps:**
1. Pick a task from the sidebar (enter Pick & Place mode — task follows cursor)
2. Press Alt+Q to toggle Quick Placement mode

**Expected Results:**
- [ ] The two modes should not interfere
- [ ] Either: Quick Placement activates and Pick is cancelled
- [ ] Or: Quick Placement is blocked while a pick is in progress
- [ ] No visual glitches (double indicators, ghost cursors)

---

### CFI-H07: Compaction + outsourced auto-assign

**Priority:** P2
**Job:** L-00010

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00010
- Schedule all 6 internal tasks with large gaps → outsourced auto-assigns

**Steps:**
1. Note the outsourced Dép/Ret dates
2. Click **Compact** → 24h
3. Check if compaction moves the internal tasks earlier
4. Check the outsourced task dates after compaction

**Expected Results:**
- [ ] Internal tasks move earlier (compacted)
- [ ] Outsourced task dates are **recalculated** based on new predecessor end times
- [ ] OR: outsourced dates remain stale (known limitation — document if so)
- [ ] No crash or inconsistent state

---

## I. Validation Message Accuracy

### CFI-I01: Precedence conflict message shows correct constraint

**Priority:** P2
**Job:** L-00008 (Dépliant)

**Preconditions:**
- Load `?fixture=louis-phase-1`
- Select L-00008
- Schedule Ryobi task at 07:00

**Steps:**
1. Pick the Polar 137 task (successor of Ryobi, needs drying time)
2. Place it **before** the drying time ends (e.g., at 08:00, when Ryobi ends ~08:30 + 4h = 12:30)
3. Check the validation message

**Expected Results:**
- [ ] Red ring on drop
- [ ] Validation message mentions predecessor/precedence constraint
- [ ] Message is in French (application language)
- [ ] Message references the correct predecessor task or drying time

---

### CFI-I02: Multiple simultaneous conflicts

**Priority:** P3
**Job:** L-00008

**Preconditions:**
- Schedule Ryobi task at 07:00
- Schedule another job's task on Polar at 08:00

**Steps:**
1. Pick L-00008's Polar task
2. Try to place at 08:00 (same time as the other job's task AND before drying ends)

**Expected Results:**
- [ ] Red ring
- [ ] Validation shows the **primary** conflict (station overlap or precedence)
- [ ] No crash when multiple conflict types occur simultaneously
