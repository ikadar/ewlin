## Improvements

### REQ-01: Month Visibility in DateStrip
A DateStrip-en nehéz tájékozódni, mert nem látszik a hónap. Csak a napok vannak megjelenítve (pl. "Lu 12", "Ma 13"), de nem tudjuk, melyik hónapban vagyunk.

**Elvárt viselkedés:** A hónap legyen látható a DateStrip-en, pl.:
- Hónap megjelenítése az első napon és minden hónap elején
- Vagy: sticky hónap felirat a DateStrip tetején/alján
- Vagy: tooltip a napokon hover-re

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`
- `apps/web/src/components/DateStrip/DateCell.tsx`

### REQ-02: Auto-Scroll on Drag Near Grid Edge
Ha a grid széléhez közelítek drag overrel egy tile-t, a grid nem scrollozik automatikusan.

**Elvárt viselkedés:** Amikor a user drag közben a grid széléhez közelít (felső vagy alsó ~50-100px), a grid automatikusan kezdjen scrollozni abba az irányba.

**Vizuális jelzés:**
- A scrollozás irányában megjelenik egy nyíl (háromszög) indikátor
- A nyíl a grid szélén, középen pozícionálva
- Animált/pulzáló effekt a scroll aktív állapotában

```
┌─────────────────────────┐
│           ▲             │  ← Felfelé scroll indikátor
│                         │
│         Grid            │
│                         │
│           ▼             │  ← Lefelé scroll indikátor
└─────────────────────────┘
```

**Fontos:** Ez a feature teljesen kiválthatná a jelenlegi oszlop shrinking viselkedést (amikor drag közben a nem-target oszlopok összezsugorodnak). Az auto-scroll sokkal intuitívabb megoldás a horizontális navigációra is.

**Implementációs javaslat:**
- Edge detection zone: ~80px a grid szélétől
- Scroll speed: progresszív (minél közelebb, annál gyorsabb)
- Működjön horizontálisan is (DateStrip/napok között) - ◀ és ▶ nyilakkal
- Oszlop shrinking eltávolítása ha az auto-scroll implementálva van

**Affected files:**
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx`
- `apps/web/src/components/StationColumns/StationColumn.tsx` - shrinking eltávolítása
- `apps/web/src/components/StationHeaders/StationHeader.tsx` - shrinking eltávolítása
- Vagy új hook: `useAutoScrollOnDrag.ts`
- Új komponens: `ScrollIndicator.tsx` vagy hasonló

### REQ-03: Clickable Dates in Job Details
A job "Départ" (workshopExitDate) és "BAT Approuvé" (proofApproval.approvedAt) dátumai jelenleg nem interaktívak.

**Elvárt viselkedés:** A dátumok legyenek kattinthatók, és kattintásra:
1. A DateStrip scrollozzon a dátumhoz
2. Az adott nap legyen kijelölve/fókuszálva

**Affected files:**
- `apps/web/src/components/JobDetailsPanel/JobDetailsPanel.tsx`
- `apps/web/src/components/DateStrip/DateStrip.tsx` - scrollTo API

### REQ-04: Precedence Lines Ignore Non-Working Hours
A leghamarabbi (purple) és legkésőbbi (orange) kezdési időpontot jelölő vonalak nem veszik figyelembe a munkaszüneti órákat (lunch break, hétvége, stb.).

**Példa:**
- Predecessor task vége: 11:30
- Dry time: +4h
- Jelenlegi számítás: 15:30 (helyes)
- DE ha lunch break 12:00-13:00: a tényleges earliest start 16:30 kellene legyen

**Elvárt viselkedés:** A constraint vonalak pozíciója vegye figyelembe a station operatingSchedule-ját és az exceptions-t.

**Affected files:**
- `apps/web/src/App.tsx` - constraint calculation logic
- `packages/validator/src/validators/precedence.ts` - esetleg közös logika

### REQ-05: Visual Hint for Impossible Placement
Ha a leghamarabbi kezdési időpont (purple) a legkésőbbi (orange) után van, az azt jelenti, hogy a task nem szúrható be az előtte és az utána következő task-ok közé. Jelenleg ez nehezen értelmezhető.

**Elvárt viselkedés:** Külön vizuális jelzés erre az esetre:
- Piros/vörös háttér vagy keret a vonalak közötti területen
- Warning ikon vagy tooltip
- Egyértelmű üzenet: "Task cannot fit between predecessor and successor"

**Affected files:**
- `apps/web/src/components/ConstraintLines/` vagy hasonló
- Drag validation logic

### REQ-06: Dragover Performance with Many Tiles
Sok tile esetén még mindig lassú a dragover, annak ellenére, hogy v0.3.46-ban volt performance optimalizáció.

**Megfigyelések:**
- 20+ tile esetén érezhető lag
- A `Tile` komponens memo-zálva van, de lehet, hogy más komponensek renderelnek feleslegesen

**Lehetséges okok:**
- StationColumn re-render minden dragover event-nél
- Constraint line kalkuláció minden frame-ben
- React devtools Profiler-rel ellenőrizni

**Affected files:**
- `apps/web/src/components/StationColumns/StationColumn.tsx`
- `apps/web/src/components/Tile/Tile.tsx`
- Drag-related hooks és context-ek

### REQ-07: Undo/Redo Functionality
Az undo és redo funkció hiányzik, pedig nagyon hasznos lenne a scheduling műveletek visszavonásához.

**Elvárt viselkedés:**
- Ctrl+Z / Cmd+Z: Undo
- Ctrl+Shift+Z / Cmd+Shift+Z: Redo
- Visszavonható műveletek:
  - Task placement (sidebar → grid)
  - Task reschedule (grid-en belüli mozgatás)
  - Task recall (grid → sidebar)
  - Swap up/down
  - Task completion toggle

**Implementációs javaslat:**
- History stack a snapshot változásokkal
- Maximum history size (pl. 50 lépés)
- Toolbar-ban Undo/Redo gombok

**Affected files:**
- Új hook: `useUndoRedo.ts` vagy `useScheduleHistory.ts`
- `apps/web/src/App.tsx` - keyboard shortcuts
- Toolbar - undo/redo buttons

### REQ-08: Clarify Group Capacity Display
A grid column fejléceken megjelenik egy felirat, pl. "Impression Numérique (0/2)" vagy "Finition (0/3)", de nem egyértelmű, hogy mit jelent.

**Tényleges jelentés (REQ-18 implementáció alapján):**
- `currentUsage/maxConcurrent` formátum
- `currentUsage` = Párhuzamosan futó task-ok száma a station group-ban **a valós aktuális időpontban**
- `maxConcurrent` = Maximum engedélyezett párhuzamos task-ok száma

**Referencia időpont:** `new Date()` - a valós mostani pillanat (`SchedulingGrid.tsx:182`)
- NEM a griden látható/fókuszált időpont
- NEM a maximális használat az ütemezés során

**Példa:** `(0/10)` = "Éppen most 0 task fut, max 10 futhatna egyszerre ebben a csoportban"

**Probléma:**
1. A jelentés nem egyértelmű első ránézésre
2. Nem világos, hogy ez a "most" pillanatra vonatkozik
3. Ütemezési szempontból talán hasznosabb lenne a max usage vagy a fókuszált időpont usage-e

**Jelenlegi állapot:** Van tooltip (`StationHeader.tsx:189-191`), de csak hover-re látszik:
```
"Presses Offset: 0/10 concurrent tasks"
```

**Elvárt viselkedés:**
- A tooltip szövege legyen érthetőbb, pl.: "Jelenleg 0 aktív / max 10 párhuzamos"
- Vagy: mutassa a fókuszált időpontra vonatkozó usage-et
- Vagy: mutassa a max usage-et az ütemezés során (warning ha túllépve)
- Francia nyelvű tooltip ha az UI francia

**Affected files:**
- `apps/web/src/components/StationHeaders/StationHeader.tsx`
- `apps/web/src/utils/groupCapacity.ts`

### REQ-09: Human-Readable Validation Messages
Gyakran nem világos, hogy egy tile-t az adott helyen miért nem lehet beilleszteni. A piros keret megjelenik, de az ok ismeretlen.

**Elvárt viselkedés:** Human-readable információ arról, hogy miért invalid a drop pozíció:
- Tooltip a tile-on drag közben
- Vagy: panel/overlay a képernyő szélén
- Vagy: toast notification

**Lehetséges hibaüzenetek:**
- "Station is not operating at this time"
- "Conflicts with existing task: [task name]"
- "Predecessor task ends at [time], earliest start is [time]"
- "Successor task starts at [time], latest start is [time]"
- "BAT not approved for this job"
- "Group capacity exceeded ([current]/[max])"

**Affected files:**
- `apps/web/src/components/DragPreview/` - tooltip megjelenítése
- `packages/validator/` - error message generation
- Drag validation hooks

### REQ-10: Auto-Scroll to First Valid Position on Task Click
Nem placed (sidebar-ban lévő) tile-ra kattintva a grid automatikusan scrollozzon a task első valid pozíciójához.

**Elvárt viselkedés:**
1. User rákattint egy unscheduled task tile-ra a sidebar-ban
2. A grid automatikusan scrollozik:
   - **Vertikálisan:** Az első lehetséges valid kezdési időponthoz
   - **Horizontálisan:** A task target station oszlopa kerüljön középre

**Első valid időpont meghatározása:**
- Figyelembe veszi a precedence constraint-eket (predecessor task vége + dry time)
- Figyelembe veszi a station operating schedule-t (nem working hours kihagyása)
- Figyelembe veszi a meglévő assignment-eket (ütközések elkerülése)
- Figyelembe veszi a BAT approval státuszt

**Vizuális feedback:**
- Smooth scroll animáció
- Opcionálisan: highlight/pulse effekt az első valid pozíción

**Edge case-ek:**
- Ha nincs valid pozíció (pl. BAT not approved): warning üzenet, nem scrollozik
- Ha a valid pozíció már látható: nem scrollozik feleslegesen

**Affected files:**
- `apps/web/src/App.tsx` - task click handler
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx` - scroll API
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx` - click handler
- Új utility: `findFirstValidPosition.ts` vagy hasonló

### REQ-11: Hide DateStrip Scrollbar
A DateStrip mellett scrollozás közben megjelenik egy scrollbar, ami zavaró és nem illeszkedik a UI-ba.

**Elvárt viselkedés:** A DateStrip scrollbar-ja legyen elrejtve, de a scroll funkcionalitás maradjon meg (mouse wheel, touch scroll).

**Implementációs javaslat:**
```css
/* Webkit (Chrome, Safari, Edge) */
.datestrip-container::-webkit-scrollbar {
  display: none;
}

/* Firefox */
.datestrip-container {
  scrollbar-width: none;
}

/* IE/Edge legacy */
.datestrip-container {
  -ms-overflow-style: none;
}
```

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx` - CSS/Tailwind osztályok
