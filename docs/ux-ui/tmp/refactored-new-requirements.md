# Refactored Requirements

Ez a dokumentum tartalmazza az átfogalmazott, szabatos requirementeket.

---

## REQ-01: Job Focus Visual Effect

**Leírás:**
Amikor a felhasználó kiválaszt (focus) egy job-ot, a scheduling grid-en ugyanaz a vizuális effekt jelenjen meg, mint drag művelet közben.

**Vizuális viselkedés:**

| Elem | Stílus |
|------|--------|
| **Kiválasztott job tile-jai** | Glow effekt: `box-shadow: 0 0 12px 4px ${job.color}99` |
| **Többi job tile-jai** | Muted: `filter: saturate(0.2); opacity: 0.6` |

**Kiváltó esemény:**
- Job kiválasztása a job listában (kattintás)
- Job kiválasztása tile-ra kattintással a grid-en

**Visszaállás:**
- Job deselect (másik job kiválasztása, vagy ugyanarra a job-ra kattintás újra)

**Jelenlegi állapot:**
- A glow effekt már implementálva van kiválasztott tile-okra (`isSelected` prop)
- A muting effekt csak drag közben aktív (`activeJobId` prop alapján)
- **Hiányzik:** A muting effekt alkalmazása job kiválasztás esetén is (nem csak drag közben)

**Implementációs javaslat:**
A `Tile` komponensben az `isMuted` logikát ki kell terjeszteni: a tile muted legyen, ha `selectedJobId !== undefined && selectedJobId !== job.id` (nem csak `activeJobId` alapján).

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Mik a pontos vizuális stílusok drag közben? | Forráskód alapján (`Tile.tsx`): Muting: `filter: saturate(0.2); opacity: 0.6`, Glow: `box-shadow: 0 0 12px 4px ${job.color}99` |

**Forrás:** [REQ-01](new-requirements.md#req-01)

---

## REQ-02/03: Job Deselection Methods

**Leírás:**
A felhasználónak több módon kell tudnia bezárni/deselect-álni a kiválasztott job-ot (és ezáltal a Job Details Panel-t).

**Elvárt deselect módok:**

| Mód | Leírás | Hol |
|-----|--------|-----|
| **Close gomb (X)** | Kattintás az X ikonra | Job Details Panel jobb felső sarka |
| **Toggle kattintás** | Újbóli kattintás a már kiválasztott job-ra | Jobs List (bal panel) |

**Vizuális specifikáció - Close gomb:**
- Pozíció: Job Details Panel jobb felső sarka
- Ikon: `X` (lucide-react)
- Méret: `w-5 h-5`
- Szín: `text-zinc-500 hover:text-zinc-300`

**Viselkedés:**
- Close gomb kattintás → `setSelectedJobId(null)`
- Jobs List-ben kiválasztott job-ra kattintás → `setSelectedJobId(null)` (toggle)
- Mindkét esetben a Job Details Panel eltűnik

**Jelenlegi állapot:**
- Close gomb: **Hiányzik**
- Toggle kattintás Jobs List-ben: **Hiányzik** (csak set, nincs toggle)
- Toggle kattintás grid tile-on: **Már implementálva** (Tile.tsx)

**Implementációs javaslat:**
1. `JobDetailsPanel.tsx`: Close gomb hozzáadása, `onClose` prop
2. `JobsList.tsx` / `App.tsx`: Toggle logika: `onSelectJob?.(selectedJobId === job.id ? null : job.id)`

**Forrás:** [REQ-02](new-requirements.md#req-02), [REQ-03](new-requirements.md#req-03)

---

## REQ-04/05/06: Top Navigation Bar with Controls

**Leírás:**
Horizontal navigation bar hozzáadása a képernyő tetejére, amely globális kontrollokat tartalmaz a scheduling view-hoz.

**Elvárt layout:**
```
+--------------------------------------------------------------------------------+
|  [Logo]    [Quick Placement]    [Zoom: -  100%  +]         [User] [Settings]   |
+--------------------------------------------------------------------------------+
+--------+------------+-------------+------+----------+-------------------+
| SIDE-  |   JOBS     |    JOB      | DATE | TIMELINE |   STATION         |
| BAR    |   LIST     |   DETAILS   | STRIP|          |   COLUMNS         |
+--------+------------+-------------+------+----------+-------------------+
```

**Komponensek a nav bar-ban:**

| Elem | Pozíció | Leírás |
|------|---------|--------|
| **Logo / App name** | Bal | Flux branding |
| **Quick Placement gomb** | Közép-bal | Toggle gomb az ALT+Q mellett |
| **Zoom kontroll** | Közép | Vertikális zoom % választó |
| **User / Settings** | Jobb | Account, beállítások |

**REQ-05: Quick Placement Button**
- Toggle gomb ami aktiválja/deaktiválja a Quick Placement Mode-ot
- Vizuális visszajelzés aktív állapotról (highlighted/pressed state)
- Ugyanaz a viselkedés mint ALT+Q (ALT+Q továbbra is működik)
- Prerequisite: Job kiválasztva (disabled ha nincs)

**REQ-06: Zoom Mode (Vertical Grid Zoom)**
- A grid vertikális zoom-ja, azaz a `PIXELS_PER_HOUR` érték változtatása
- Zoom szintek %-ban kifejezve (100% = jelenlegi 80px/hour)
- Javasolt szintek: 50%, 75%, 100%, 150%, 200%
- UI: `[-]  100%  [+]` gombok vagy dropdown

| Zoom % | PIXELS_PER_HOUR | Hatás |
|--------|-----------------|-------|
| 50% | 40px | Több óra látszik, kisebb tile-ok |
| 75% | 60px | Kompaktabb nézet |
| 100% | 80px | Jelenlegi alapértelmezett |
| 150% | 120px | Nagyobb tile-ok, kevesebb óra |
| 200% | 160px | Részletesebb nézet |

**Vizuális specifikáció - Nav Bar:**
- Magasság: `h-12` (48px)
- Háttér: `bg-zinc-900`
- Border: `border-b border-white/5`
- Teljes szélesség

**Sidebar:** Marad a jelenlegi helyén (a nav bar alatt, bal oldalon)

**Jelenlegi állapot:**
- Horizontal nav bar: **Hiányzik**
- Quick Placement gomb: **Hiányzik** (csak ALT+Q)
- Zoom kontroll: **Hiányzik** (fix 80px/hour)

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Mi a pontos értelmezése a "task granularity" zoom-nak? | A grid vertikális zoom-ja, azaz a `PIXELS_PER_HOUR` érték változtatása |
| Zoom szintek %-ban vagy named presets (Hour/Day/Week)? | %-ban kifejezve |
| A sidebar maradjon a jelenlegi helyén, vagy kerüljön a nav bar-ba? | Maradjon a jelenlegi helyén (nav bar alatt, bal oldalon) |

**Forrás:** [REQ-04](new-requirements.md#req-04), [REQ-05](new-requirements.md#req-05), [REQ-06](new-requirements.md#req-06)

---

## REQ-07: Enhanced Job Progression Visualization

**Leírás:**
A Jobs List-ben lévő job kártyákon a jelenlegi progress dots helyett egy fejlettebb vizualizáció, amely a taskok állapotát és méretét is mutatja.

**Vizuális viselkedés - Task állapotok:**

| Állapot | Feltétel | Szín |
|---------|----------|------|
| **Unscheduled** | `!assignment` (nincs assignment a task-hoz) | Üres (border only, `border-zinc-700`) |
| **Scheduled, incomplete** | `assignment && !isCompleted && scheduledEnd > now` | Szürke (`bg-zinc-500`) |
| **Scheduled, completed** | `assignment && isCompleted` | Zöld (`bg-emerald-500`) |
| **Scheduled, late** | `assignment && !isCompleted && scheduledEnd < now` | Piros (`bg-red-500`) |

**Vizuális viselkedés - Szegmensek (méret alapú):**

| Task típus | Időtartam | Megjelenés |
|------------|-----------|------------|
| Internal, ≤ 30 perc | `setupMinutes + runMinutes` | Standard méret (fix szélesség, pl. `w-2`) |
| Internal, > 30 perc | `setupMinutes + runMinutes` | Proporcionális szélesség, lekerekített sarkak |
| Outsourced | `durationOpenDays` | 5× standard méret, felirattal (pl. "2JO") |

**Layout:**
- A szegmensek több sorba is törhetnek (`flex-wrap`)
- Nincs maximum szélesség korlátozás

**Cél:**
> "The goal is to be able to, at a glance, get a feel of the size of the jobs and actions"

Egy pillantással látható legyen:
- Hány task van a job-ban
- Melyik van ütemezve, melyik nincs
- Melyik kész, melyik késik
- Mekkora a taskok relatív mérete

**Jelenlegi állapot:**
- `ProgressDots` komponens: **Csak completed/pending, nem nézi az assignment-et**
- Méret alapú vizualizáció: **Hiányzik**
- Late (piros) állapot: **Hiányzik**

**Implementációs javaslat:**
1. Új komponens: `ProgressSegments` a `ProgressDots` helyett
2. Input: `tasks: Task[]`, `assignments: TaskAssignment[]` (nem csak counts)
3. Minden task-hoz: állapot számítás az assignment alapján
4. Internal task szélesség: `Math.max(8, duration / 30 * 8)` px
5. Outsourced task szélesség: 5 × standard (40px), + felirat

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| A task időtartama: `setupMinutes + runMinutes`? | Igen |
| Outsourced taskok esetén mi legyen a méret? | 5× standard méret, benne felirat a duration-nel (pl. "2JO") |
| Maximum szélesség korlátozás szükséges-e? | Nem, a vizualizáció több sorba is törhet |

**Forrás:** [REQ-07](new-requirements.md#req-07)

---

## REQ-08/09: Snapping Drag Preview with Vertical Constraint

**Leírás:**
A drag preview-nak drag közben is a snap pozícióba kell ugrania, hogy a user egyértelműen lássa, hova fog landolni a tile. Továbbá, a drag csak vertikálisan lehetséges (tile-ok nem mozoghatnak oszlopok között).

**REQ-08: Drag Preview Snapping**

| Jelenlegi viselkedés | Elvárt viselkedés |
|---------------------|-------------------|
| DragPreview szabadon követi a kurzort | DragPreview a legközelebbi 30 perces snap pozícióba ugrik |
| Snap csak drop-kor történik | Snap real-time, drag közben is |

**Implementációs részletek:**
- A `DragLayer.tsx`-ben a `top` pozíciót snap-elni kell: `snapToGrid(position.y - grabOffset.y)`
- A horizontális pozíció (`left`) maradhat fix (az oszlop közepén)

**REQ-09: Vertical-Only Drag**

A tile-ok csak vertikálisan mozgathatók (időben), horizontálisan nem (station már előre meghatározott a task-hoz).

| Kontextus | Viselkedés |
|-----------|------------|
| Task sidebar-ból grid-re | Csak a target station oszlopában lehet droppolni |
| Tile a grid-en | Csak vertikálisan mozgatható, oszlop fix |

**Jelenlegi állapot:**
- Horizontális korlátozás: **Már implementálva** (task.stationId alapján csak egy oszlopba lehet droppolni)
- Snap during drag: **Hiányzik** (csak drop-kor snapel)

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Tile snap during drag or only on drop? | Snap during drag (real-time) |

**Forrás:** [REQ-08](new-requirements.md#req-08), [REQ-09](new-requirements.md#req-09)

---

## REQ-10: Global Timeline Compaction

**Leírás:**
Globális "compaction" funkció, amely az összes station-on eltávolítja a gap-eket a taskok között egy megadott időhorizonton belül. A funkció a top nav bar-ban lesz elérhető (REQ-04/05/06).

**Különbség a meglévő station compact-tól:**

| Tulajdonság | Station Compact (meglévő) | Timeline Compaction (új) |
|-------------|---------------------------|--------------------------|
| Scope | Egy station | Összes station |
| Trigger | Gomb a station header-ben | Gomb a top nav bar-ban |
| Időhorizont | Nincs (összes task) | Választható: 4h / 8h / 24h |
| Referencia | Nincs | Jelenlegi időpont |
| Védelem | Nincs | Tasks in progress immobilis |
| Precedence | Nem ellenőrzi | Betartja a precedence szabályokat |

**Időhorizont opciók:**

| Opció | Jelentés |
|-------|----------|
| 4h | Következő 4 óra |
| 8h | Következő 8 óra |
| 24h | Következő 24 óra |

**Viselkedés:**
1. Kiindulási pont: `now` (jelenlegi rendszeridő)
2. Végpont: `now + selectedHorizon`
3. **Immobilis taskok:** Amelyek `scheduledStart < now` VAGY folyamatban vannak (`scheduledStart <= now && scheduledEnd > now`)
4. **Mozgatható taskok:** Amelyek `scheduledStart >= now` ÉS az időhorizonton belül vannak
5. A compaction balról jobbra (station sorrendben) és fentről lefelé (időrendben) halad
6. **Precedence szabályok betartása:** A compaction nem hozhat létre precedence violation-t

**UI specifikáció (a top nav bar-ban):**
```
[Compact: 4h] [8h] [24h]   -->  Segmented buttons
```

**Jelenlegi állapot:**
- Global timeline compaction: **Hiányzik**
- Per-station compact: **Implementálva** (v0.3.22)

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| UI forma: Dropdown vagy segmented buttons? | Segmented buttons |
| Kell-e "Compact All" opció (időhorizont nélkül)? | Nem |
| A compaction figyelembe veszi-e a precedence szabályokat? | Igen |

**Forrás:** [REQ-10](new-requirements.md#req-10)

---

## REQ-11: Dry Time (Drying Delay After Printing)

**Leírás:**
Nyomtatás után száradási időre van szükség, mielőtt a következő task elkezdődhetne. Ez nem jelenik meg külön station-ként vagy oszlopként, hanem a precedence szabályokat módosítja.

**Domain koncepció:**

| Tulajdonság | Leírás |
|-------------|--------|
| **Dry time** | Fix várakozási idő nyomtatás befejezése és a következő task kezdete között |
| **Scope** | Applikáció szintű konstans (nem konfigurálható) |
| **Alkalmazás** | Minden nyomtatási task után (offset press category) |
| **Nem station** | Nem jelenik meg oszlopként a grid-en |
| **Precedence módosító** | `printingTask.scheduledEnd + DRY_TIME > successor.scheduledStart` = konfliktus |

**Példa:**
```
DRY_TIME = 4 óra (konstans)

Hagyományos precedence:
  Printing ends at 10:00 → Next task can start at 10:00

Dry time esetén:
  Printing ends at 10:00 → Next task can start at 14:00
  Precedence check: scheduledEnd (10:00) + DRY_TIME (4h) = 14:00
```

**Vizuális viselkedés:**
- Precedence violation feedback ugyanaz mint más violation-öknél (red halo)
- **Label** a Job Details Panel-ben a precedence bar-on: `+4h drying`

```
Job Details Panel - Task List:
┌─────────────────────────────────┐
│ [Komori] Printing  ──────────  │
│        ════════════════════    │  ← precedence bar
│        +4h drying              │  ← dry time label
│ [Massicot] Cutting  ─────────  │
└─────────────────────────────────┘
```

**Implementációs javaslat:**
1. Konstans: `DRY_TIME_MINUTES = 240` (4 óra) - applikáció szinten
2. Precedence validáció módosítása: ha a predecessor printing task, akkor `scheduledEnd + DRY_TIME`
3. Station category alapján: `category.id === 'offset-press'` vagy hasonló

**Jelenlegi állapot:**
- Dry time koncepció: **Hiányzik**
- Precedence: `predecessor.scheduledEnd > successor.scheduledStart`
- Nincs delay támogatás a task-ok között

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Hol legyen konfigurálható a dry time? | Applikáció szintű konstans (nem user-configurable) |
| Fix értékek vagy szabadon megadható? | Fix érték |
| Minden nyomtatás után kell, vagy csak bizonyos típusoknál? | Minden nyomtatás után |

**Forrás:** [REQ-11](new-requirements.md#req-11)

---

## REQ-12: Persistent Visual Feedback for Precedence Violations

**Leírás:**
Amikor egy task precedence violation-nel kerül ütemezésre (Alt+drag bypass), a tile-oknak **tartós vizuális visszajelzést** kell mutatniuk, nem csak drag közben.

**Jelenlegi viselkedés:**
```
1. User drags task
2. Precedence conflict detected → column shows amber ring
3. User presses Alt → column shows amber warning
4. User drops task
5. Tile placed → NO VISUAL INDICATION of the conflict
6. Job appears in Problems section (conflict) ✓
```

**Elvárt viselkedés:**
```
1. User drags task
2. Precedence conflict detected → column shows amber ring
3. User presses Alt → column shows amber warning
4. User drops task
5. Tile placed → PERSISTENT YELLOW/AMBER GLOW on affected tiles
6. Job appears in Problems section (conflict) ✓
```

**Vizuális specifikáció:**

| Állapot | Tile megjelenés |
|---------|-----------------|
| Normal | Nincs glow |
| Selected | Job color glow: `box-shadow: 0 0 12px 4px ${job.color}99` |
| **Precedence conflict** | **Amber glow: `box-shadow: 0 0 12px 4px #F59E0B99`** |
| Selected + Conflict | Amber glow overrides job color glow |

**Érintett tile-ok:**
- A precedence-t sértő task tile-ja (a rossz helyre rakott)
- Opcionálisan: a predecessor task tile-ja is (amelyikkel konfliktusban van)

**Adatmodell változás:**
- `ScheduleConflict` már létezik és tartalmazza a `taskId`-t
- A `Tile` komponensnek ismernie kell, hogy van-e aktív conflict a task-jához

**Jelenlegi állapot:**
- Persistent conflict glow: **Hiányzik**
- Conflict data elérhető: **Van** (`conflicts` array in snapshot)
- Problems section: **Már van**

**Implementációs javaslat:**
1. `Tile` komponens: új prop `hasConflict?: boolean`
2. Ha `hasConflict`, akkor amber glow: `box-shadow: 0 0 12px 4px #F59E0B99`
3. A conflict tile-ok meghatározása: `conflicts.filter(c => c.type === 'PrecedenceConflict').map(c => c.taskId)`

**Forrás:** [REQ-12](new-requirements.md#req-12)

---

## REQ-13: Fix Alt+Drag Bypass Conflict Recording (BUG)

**Leírás:**
A REQ-12 és REQ-13 eredeti kérése ("Precedence violations should affect job appearance and position") már implementálva van. A UX-tervező azért nem látta működni, mert:

1. **BUG: Alt+drag bypass nem rögzíti a conflict-et** - A validator `bypassPrecedence=true` esetén nem ad vissza conflict-et, így a `hasPrecedenceConflict` flag hamis, és a conflict nem kerül mentésre
2. **Mock adat inkonzisztencia** - A mock csak `CONFLICT_TEST` marker alapján generál static conflict-eket, nem valódi precedence violation alapján

**Jelenlegi (bugos) viselkedés:**
```
1. User drags task over invalid position
2. Precedence conflict detected → hasPrecedenceConflict = true
3. User presses Alt → bypassPrecedence = true
4. Validation re-runs → returns NO conflict (bypass active)
5. hasPrecedenceConflict = false (!)
6. bypassedPrecedence = wasAltPressed && hasPrecedenceConflict = true && false = false
7. No conflict added → Job NOT in Problems section
```

**Elvárt viselkedés:**
```
1. User drags task over invalid position
2. Precedence conflict detected → hasPrecedenceConflict = true
3. User presses Alt → bypassPrecedence = true (visual warning shown)
4. User drops task
5. Conflict IS recorded (bypassedPrecedence = true)
6. Job appears in Problems section with amber styling
7. Tile shows persistent amber glow (REQ-12)
```

**Fix javaslat:**
A `bypassedPrecedence` flag számításának módosítása `App.tsx`-ben:
```typescript
// Jelenlegi (bugos):
const bypassedPrecedence = wasAltPressed && currentValidation.hasPrecedenceConflict;

// Javított:
// Validation WITHOUT bypass to detect if conflict exists
const conflictCheckValidation = validateAssignment(
  { ...proposed, bypassPrecedence: false },
  snapshot
);
const hadPrecedenceConflict = conflictCheckValidation.conflicts.some(
  c => c.type === 'PrecedenceConflict'
);
const bypassedPrecedence = wasAltPressed && hadPrecedenceConflict;
```

**Jelenlegi állapot:**
- Problems section styling: ✅ Implementálva
- JobCard conflict styling: ✅ Implementálva
- Alt+drag bypass: ⚠️ Bug - conflict nem mentődik
- Persistent tile glow (REQ-12): ❌ Hiányzik

**Kapcsolat REQ-12-vel:**
Ez a bug fix előfeltétele a REQ-12 (persistent glow) működésének. Ha nincs conflict mentve, nincs mit megjeleníteni.

**Forrás:** [REQ-13](new-requirements.md#req-13)

---

## REQ-14/15/16/17: Multi-Day Grid Navigation & Date Strip Integration

**Leírás:**
A grid és DateStrip közötti navigáció és szinkronizáció nem működik, valamint hiányzik a multi-day támogatás és a kontextuális kiemelések.

**Problémák összefoglalása:**

| REQ | Probléma | Jelenlegi állapot |
|-----|----------|-------------------|
| REQ-14 | Day navigation | Grid csak 1 napot mutat, `onDateClick` nincs bekötve, nincs scroll sync |
| REQ-15 | Departure date highlight | Nincs kiemelt departure date a DateStrip-en |
| REQ-16 | Scheduled days highlight | Nincs jelzés melyik napokon van task ütemezve |
| REQ-17 | Virtual scrolling | Scroll nem bővíti a hátteret, fix méretű grid |

**REQ-14: Day Navigation & Scroll Sync**

| Feature | Leírás |
|---------|--------|
| Click-to-scroll | DateStrip napra kattintás → Grid scrolloz oda |
| Bidirectional scroll sync | DateStrip és Grid együtt scrolloz |
| Multi-day support | Grid több napot mutasson, scrollozható napok között |

**REQ-15: Departure Date Highlight**

Kiválasztott job departure date-je kiemelve a DateStrip-en.

| Állapot | Megjelenés |
|---------|------------|
| Normal day | `text-zinc-500`, `border-white/5` |
| Today | `text-amber-200`, `bg-amber-500/15` |
| **Departure date (selected job)** | **`text-red-300`, `bg-red-500/10`, `border-red-500/30`** |

**REQ-16: Scheduled Days Highlight**

Napok ahol a kiválasztott job-nak van ütemezett task-ja.

| Állapot | Megjelenés |
|---------|------------|
| **Has scheduled task** | **Kis indikátor pont vagy `bg-emerald-500/10` háttér** |

**REQ-17: Virtual Scrolling / Extended Grid Background**

A grid háttere (grid vonalak, unavailability overlay) kiterjedjen scrollozáskor.

| Jelenlegi | Elvárt |
|-----------|--------|
| Fix méretű grid (24h × hoursToDisplay) | Dinamikusan bővülő grid vagy virtual scrolling |
| Scroll nem bővíti a hátteret | Scroll → háttér követi |

**Implementációs javaslatok:**

1. **Scroll sync:** Közös scroll container, vagy `onScroll` event handler ami szinkronizálja
2. **DateStrip props bővítése:**
   ```typescript
   interface DateStripProps {
     startDate: Date;
     dayCount?: number;
     onDateClick?: (date: Date) => void;
     departureDate?: Date;  // REQ-15
     scheduledDays?: Date[];  // REQ-16
   }
   ```
3. **Virtual scrolling:** `react-virtualized` vagy `@tanstack/virtual` használata

**Jelenlegi állapot:**
- Multi-day grid: ❌ Csak 1 nap (24h)
- Click-to-scroll: ❌ `onDateClick` nincs bekötve
- Scroll sync: ❌ DateStrip és Grid független
- Departure date highlight: ❌ Hiányzik
- Scheduled days highlight: ❌ Hiányzik
- Virtual scrolling: ❌ Fix méret

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| "Scrolling doesn't pass to next day" | Grid jelenleg csak 1 napot mutat |
| "Day column behaviours" | Click → scroll, Grid scroll → DateStrip follows |
| DateStrip fix vagy scrolloz? | Scrolloz a grid-del együtt |

**Forrás:** [REQ-14](new-requirements.md#req-14), [REQ-15](new-requirements.md#req-15), [REQ-16](new-requirements.md#req-16), [REQ-17](new-requirements.md#req-17)

---

## REQ-18: Machine Group Capacity Limits Visualization

**Leírás:**
A station csoportokhoz (StationGroup) tartozó párhuzamos kapacitás korlátok (`maxConcurrent`) nem láthatók és nem validáltak a UI-ban. A UX-tervező nem látja, hogy:
- Melyik station melyik csoportba tartozik
- Mi a csoport maximális párhuzamos kapacitása
- Mikor van a kapacitás kihasználva/túllépve

**Domain kontextus:**

| Fogalom | Leírás |
|---------|--------|
| **StationGroup** | Logikai csoportosítás kapacitás korlátozással |
| **maxConcurrent** | Max párhuzamos taskok száma a csoportban (null = korlátlan) |
| **isOutsourcedProviderGroup** | Outsource provider csoportok mindig korlátlanok |
| **GroupCapacityConflict** | Conflict típus ha a kapacitás túllépve |

**Jelenlegi állapot:**

| Komponens | Állapot |
|-----------|---------|
| `StationGroup.maxConcurrent` type | ✅ Definiálva (`packages/types`) |
| `validateGroupCapacity` validator | ✅ Implementálva (`packages/validator`) |
| `GroupCapacityConflict` conflict type | ✅ Létezik |
| Station header: csoport megjelenítés | ❌ **Hiányzik** |
| Grid: kapacitás kihasználtság vizualizáció | ❌ **Hiányzik** |
| Drag: kapacitás konfliktus feedback | ❌ **Hiányzik** |
| Tile: conflict glow kapacitás túllépésnél | ❌ **Hiányzik** |

**Elvárt funkciók:**

**1. Station Header - Csoport információ:**
```
┌─────────────────────────────────────┐
│ Komori 5L          [↑2] [↓1] [⊕]   │
│ Offset Press (2/3)                  │  ← Csoport neve + kapacitás
└─────────────────────────────────────┘
```

| Elem | Leírás |
|------|--------|
| Csoport neve | A station groupId-jéhez tartozó group.name |
| Kapacitás kijelzés | `(aktív/maxConcurrent)`, pl. "(2/3)" |
| Ha korlátlan | Csak csoport név, nincs kapacitás szám |

**2. Grid - Kapacitás vizualizáció:**

A dokumentáció szerint (`conflict-indicators.md`):
> "Time slot highlighted in yellow/orange across affected columns"

| Állapot | Vizuális |
|---------|----------|
| Kapacitás < 50% | Normál |
| Kapacitás 50-99% | Enyhe sárga háttér (opcionális warning) |
| **Kapacitás = 100% (limit)** | **Sárga/narancs idősáv kiemelés** |
| **Kapacitás > 100% (túllépve)** | **Piros idősáv kiemelés** |

**3. Drag - Kapacitás validáció:**

| Drag állapot | Feedback |
|--------------|----------|
| Drop nem lépné túl kapacitást | Zöld ring (valid drop) |
| **Drop túllépné kapacitást** | **Piros ring (blocked drop)** |

A `validateGroupCapacity` már visszaadja a `GroupCapacityConflict`-et, de a UI-nak meg kell jelenítenie.

**4. Conflict megjelenítés:**

Placement után ha a csoport kapacitás túl van lépve:
- Érintett tile-ok: Sárga/narancs glow (hasonlóan a precedence conflict-hez)
- Job megjelenik a Problems section-ben

**Business Rules kapcsolat:**
- `BR-GROUP-002`: "At any point in time, the number of active tasks on stations in a group CANNOT exceed MaxConcurrent"
- `BR-SCHED-002`: "The system MUST prevent any state where station group concurrent task count exceeds MaxConcurrent"

**Mock adat kontextus:**
A `generateStationGroups()` generátor jelenleg a következő csoportokat hozza létre:

| Csoport | maxConcurrent |
|---------|---------------|
| offset-press-group | 3 |
| finishing-group | null (unlimited) |
| binding-group | 2 |
| Outsource provider groups | null (always unlimited) |

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Legyen-e kapacitás info a station header-ben? | *Kérdés a user-nek* |
| Real-time kapacitás kijelzés (pl. "2/3") vagy csak conflict? | *Kérdés a user-nek* |
| Grid time slot highlight formátuma? | Yellow/orange background az érintett időszakon |

**Forrás:** [REQ-18](new-requirements.md#req-18)

---

## REQ-19: Outsourcing Columns (Provider Display)

**Leírás:**
Az outsourced provider-ek (külső beszállítók) nem jelennek meg a scheduling grid-en, annak ellenére, hogy az adatmodellben léteznek és a dokumentáció szerint oszlopokként kellene megjelenniük.

**Domain kontextus:**

| Fogalom | Leírás |
|---------|--------|
| **OutsourcedProvider** | Külső cég, amely bizonyos munkafolyamatokat végez |
| **isOutsourced** | Assignment flag: true = provider-hez rendelt, false = station-hoz |
| **Unlimited capacity** | Provider csoportok mindig korlátlan kapacitásúak |
| **Provider group** | `StationGroup` ahol `isOutsourcedProviderGroup: true` |

**Jelenlegi állapot:**

| Komponens | Állapot |
|-----------|---------|
| `OutsourcedProvider` type | ✅ Definiálva (`packages/types`) |
| `TaskAssignment.isOutsourced` flag | ✅ Létezik |
| Mock provider data (Clément, Reliure Express) | ✅ Generálódik |
| Outsourced assignments generálása | ✅ Működik |
| **Provider columns a grid-en** | ❌ **Hiányzik** |
| **Outsourced assignment rendering** | ❌ **Kihagyva!** |

**Kritikus bug a kódban (`SchedulingGrid.tsx`):**
```typescript
assignments.forEach((assignment) => {
  // Skip outsourced assignments - they go to providers, not stations
  if (assignment.isOutsourced) return;  // <-- Kihagyja őket!
  ...
});
```

**Elvárt megjelenés:**

Provider columns a station columns után, jobbra:
```
Station Columns                    Provider Columns
┌──────────┬──────────┐           ┌────────────────────┐
│ Komori   │ Massicot │           │ Clément            │
├──────────┼──────────┤           ├─────────┬──────────┤
│  Tile A  │  Tile C  │           │ Task X  │ Task Y   │  ← Parallel subcolumns
│          │          │           │         │          │
│  Tile B  │          │           │         │ Task Z   │
└──────────┴──────────┘           └─────────┴──────────┘
```

**Vizuális különbség a station-októl:**

| Tulajdonság | Station Column | Provider Column |
|-------------|----------------|-----------------|
| Háttér | `bg-[#0a0a0a]` | Enyén eltérő (pl. `bg-zinc-900/80`) |
| Header ikon | Nincs vagy gép ikon | Cég/outsource ikon (pl. `building-2`) |
| Kapacitás | Fix (1 vagy maxConcurrent) | Korlátlan (subcolumn layout) |
| Átfedés | Nem lehetséges (push down) | Subcolumn-ok (calendar-like) |

**Subcolumn layout (Calendar-style parallel tasks):**

Amikor több outsourced task átfedi egymást időben, **egymás mellett** jelennek meg ugyanazon az oszlopon belül:

```
Provider: Clément (width: 240px)
─────────────────────────────────
08:00  ┌────────────┬────────────┐
       │   Task A   │   Task B   │   ← 2 parallel → subcolumn width = 120px
09:00  ├────────────┤            │
       │   Task C   │            │   ← Task C starts, still 2 subcolumns
10:00  └────────────┴────────────┘
10:00  ┌────────────────────────┐
       │       Task D           │   ← 1 task → full width (no subcolumns)
11:00  └────────────────────────┘
11:00  ┌────────┬────────┬──────┐
       │ Task E │ Task F │Task G│   ← 3 parallel → 3 subcolumns
12:00  └────────┴────────┴──────┘
```

**Subcolumn számítás algoritmus:**
1. Időpontonként meghatározni a max concurrent task számot
2. Minden task-hoz subcolumn index hozzárendelése (greedy: első szabad slot)
3. Subcolumn szélesség: `column_width / max_concurrent_in_range`

**Mock adat kontextus:**

| Provider | Supported Actions | Group |
|----------|-------------------|-------|
| Clément | binding, laminating | grp-clement |
| Reliure Express | binding | grp-reliure |

**Implementációs javaslatok:**

1. **Provider columns hozzáadása a SchedulingGrid-hez:**
   - Station columns után
   - Saját header komponens outsource ikonnal

2. **Outsourced assignment rendering engedélyezése:**
   - Az `if (assignment.isOutsourced) return;` eltávolítása
   - Provider column-okhoz irányítás

3. **Subcolumn layout implementálása:**
   - Concurrent task detection
   - Subcolumn index assignment
   - Width és left position számítás

**Business Rules kapcsolat:**
- `BR-PROVIDER-003`: "Provider has unlimited capacity"
- `BR-GROUP-003`: "Outsourced provider groups are unlimited"

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Hol jelenjenek meg a provider columns? | Station-ok után jobbra (mint extra oszlopok) |
| Vizuális különbség a station oszlopoktól? | Igen, más háttérszín és ikon a header-ben |
| Parallel layout szükséges-e már most? | Igen, calendar-like subcolumns átfedő taskok esetén |
| Subcolumn = párhuzamos taskok egymás mellett? | Igen, ugyanabban a column-ban, egymás mellett |

**Forrás:** [REQ-19](new-requirements.md#req-19)

---

## REQ-20: Similarities Feature Completion

**Leírás:**
A similarity indicators infrastruktúra részben implementálva van, de a printing press criteria nem működik teljesen, mert hiányoznak mezők a `Job` típusból és a mock adatokból.

**REQ-20 kérés (printing press criteria):**

| Kritérium | Job mező | Állapot |
|-----------|----------|---------|
| Same paper type | `paperType` | ✅ Létezik |
| Same paper weight | `paperWeight` | ❌ **Hiányzik** |
| Same paper sheet size | `paperFormat` | ✅ Létezik |
| Same inking | `inking` | ❌ **Hiányzik** |

**Jelenlegi állapot:**

| Komponens | Állapot |
|-----------|---------|
| `SimilarityIndicators` komponens | ✅ Implementálva |
| `compareSimilarity` logika | ✅ Működik |
| SchedulingGrid integráció | ✅ Átadja a `similarityResults`-ot |
| `Job.paperType` | ✅ Létezik, mock generál értéket |
| `Job.paperFormat` | ✅ Létezik, mock generál értéket |
| `Job.inking` | ❌ **Hiányzik a típusból** |
| `Job.paperWeight` | ❌ **Hiányzik a típusból** |

**A probléma részletesen:**

A mock criteria (`stations.ts`):
```typescript
const OFFSET_PRESS_CRITERIA = [
  { name: 'Même type de papier', fieldPath: 'paperType' },   // ✅ működik
  { name: 'Même format', fieldPath: 'paperFormat' },         // ✅ működik
  { name: 'Même encrage', fieldPath: 'inking' },             // ⚠️ MINDIG MATCHED!
];
```

Mivel az `inking` mező nem létezik a Job-on, mindkét job-nál `undefined`, és a `valuesMatch(undefined, undefined) = true` → **félrevezető "matched" ikon**.

**Szükséges változtatások:**

**1. Job típus bővítése (`packages/types/src/job.ts`):**
```typescript
export interface Job {
  // ... existing fields ...

  /** Paper type and weight description (e.g., "CB300") */
  paperType?: string;
  /** Paper dimensions (e.g., "63x88") */
  paperFormat?: string;
  /** Paper weight in g/m² (e.g., 300) */
  paperWeight?: number;           // ← ÚJ
  /** Inking configuration (e.g., "CMYK", "4C+0", "Pantone 123") */
  inking?: string;                // ← ÚJ
}
```

**2. Mock generátor bővítése (`apps/web/src/mock/generators/jobs.ts`):**
```typescript
const PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350];
const INKINGS = ['CMYK', '4C+0', '4C+4C', '2C+0', 'Pantone 485+Black', '1C+0'];

// A job generátorban:
paperType: randomElement(PAPER_TYPES),
paperFormat: randomElement(PAPER_FORMATS),
paperWeight: randomElement(PAPER_WEIGHTS),    // ← ÚJ
inking: randomElement(INKINGS),               // ← ÚJ
```

**3. Backend API szinkronizálás (későbbi feladat):**
- A PHP API-ban is szükséges a `Job` entity bővítése
- DTO-k frissítése
- Migration a meglévő adatokhoz

**Vizuális viselkedés (már implementálva):**

```
+------------------------+
|     Tile A (Job A)     |
+------------------------+
         🔗 🔗 🔗 ⛓️‍💥      ← 3 matched, 1 not matched
+------------------------+
|     Tile B (Job B)     |
+------------------------+
```

- `🔗` (link ikon, `text-zinc-400`) = kritérium egyezik
- `⛓️‍💥` (unlink ikon, `text-zinc-800`) = kritérium nem egyezik

**Tisztázó kérdések:**

| Kérdés | Válasz |
|--------|--------|
| Az `inking` mező típusa? | String szabadon (pl. "CMYK", "4C+0", "Pantone 123") |
| A `paperWeight` mező típusa? | Number gramm/m²-ben (pl. 300) |
| A "paper sheet size" = `paperFormat`? | Igen |
| Kell-e más similarity criteria? | Most nem kell, csak printing press |

**Forrás:** [REQ-20](new-requirements.md#req-20)
