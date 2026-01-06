## Improvements

### REQ-01
Amikor drag-overezek egy tile-t a griden, akkor a tile snappel, de a snapping nem pontos: a tile teteje nem oda ugrik, ahova drop-kor kerül.

### REQ-02
Amikor drag-overezek egy tile-t a griden, a keret (zöld / piros / amber) állapota / színe nem attól függ, hogy hol a tile a griden, hanem attól, hogy hol az egér cursor (a snap miatt ez gyakran nem ugyanaz).

### REQ-03
A drag validáció (`calculateScheduledStartFromPointer`) nem alkalmazza a `snapToGrid`-et, ezért a validáció más időpontot ellenőriz, mint ami ténylegesen drop-olva lesz.

**Példa:**
- User 12:45-re húzza a tile-t
- DragPreview snap-el és 13:00-at mutat (vizuálisan)
- De a validáció 12:45-öt ellenőrzi → piros keret (mert lunch break 12:00-13:00)
- User drop-ol → tile 13:00-ra kerül (valid pozíció)

**Affected file:** `apps/web/src/App.tsx` - `calculateScheduledStartFromPointer` function

**Fix:**
```typescript
const absoluteY = calculateTileTopPosition(clientY, rect.top, grabOffsetY);
const snappedY = snapToGrid(absoluteY);  // ← HIÁNYZIK
const dropTime = yPositionToTime(snappedY, START_HOUR, startDate);
```

### REQ-04
Az `UnavailabilityOverlay` (csíkos háttér a nem működő időszakokra) csak az első napon jelenik meg a multi-day griden. A többi napon (pl. ma, kedd) nem látszik a lunch break (12:00-13:00) csíkozása.

**Elvárt viselkedés:** Minden napra külön meg kell jelennie az adott nap ütemezésének megfelelő overlay-nek.

**Affected file:** `apps/web/src/components/StationColumns/StationColumn.tsx` és/vagy `UnavailabilityOverlay.tsx`

**Valószínű ok:** A `StationColumn` egyetlen `UnavailabilityOverlay`-t renderel a teljes oszlopra, ami csak az első nap schedule-ját használja. Multi-day grid esetén minden naphoz külön overlay kell.

### REQ-05
A job card a bal oldali sidebar-ban/panelben nem fér el teljesen - a jobb széle levágódik. A dátum ("11/01/2026") kilóg a panel határán túl.

**Elvárt viselkedés:** A job card tartalma a panelen belül maradjon, szükség esetén szöveg-rövidítéssel (ellipsis) vagy sortöréssel.

**Affected file:** `apps/web/src/components/JobDetailsPanel/` vagy `JobsList/` komponensek

**Valószínű ok:** Hiányzik az `overflow: hidden`, `max-width`, vagy `text-overflow: ellipsis` a job card konténerén.

### REQ-06
Ha egy job ki van választva, akkor a griden a más job-okhoz tartozó tile-ok nem kattinthatók.

**Elvárt viselkedés:** Bármelyik tile-ra kattintva az ahhoz tartozó job legyen kiválasztva.

**Valószínű ok:** A kiválasztott job tile-ja fölött van egy overlay vagy a nem-kiválasztott tile-ok `pointer-events: none` állapotban vannak.

### REQ-07: Toolbar/Sidebar Layout Átszervezés

> ✅ Implemented in v0.3.43

**Jelenlegi állapot:**
- Felső toolbar: teljes szélességű, tartalmazza a "Flux" logót bal oldalon és ikonokat jobb oldalon
- Bal sidebar: a toolbar alatt kezdődik, nem teljes magasságú

**Elvárt állapot:**

**7.1 - Sidebar teljes magasságú legyen**
- A bal oldali sidebar a viewport tetejétől az aljáig terjedjen
- A felső toolbar csak a sidebar melletti területet foglalja el (sidebar szélességétől jobbra)

**7.2 - "Flux" felirat eltávolítása**
- A "Flux" logó/felirat törlendő a toolbar-ból

**7.3 - Jobb oldali ikonok áthelyezése**
- A felső toolbar jobb szélén lévő ikonok (beállítások, user, stb.) kerüljenek át a bal sidebar aljára
- Vertikális elrendezésben jelenjenek meg

**Vizuális változás:**
```
ELŐTTE:                          UTÁNA:
┌─────────────────────────┐      ┌───┬─────────────────────┐
│ Flux    [toolbar]  ⚙👤 │      │   │     [toolbar]       │
├────┬────────────────────┤      │   ├─────────────────────┤
│    │                    │      │   │                     │
│ S  │      Grid          │      │ S │       Grid          │
│ I  │                    │      │ I │                     │
│ D  │                    │      │ D │                     │
│ E  │                    │      │ E │                     │
│    │                    │      │ ⚙ │                     │
│    │                    │      │ 👤│                     │
└────┴────────────────────┘      └───┴─────────────────────┘
```

**Affected files:**
- `apps/web/src/App.tsx` - fő layout struktúra
- `apps/web/src/components/Toolbar/` - toolbar komponens
- `apps/web/src/components/Sidebar/` vagy hasonló sidebar komponens

### REQ-08: Zoom Szintek

> ✅ Implemented in v0.3.43

**Elvárt zoom szintek:** 25%, 50%, 75%, 100%, 150%, 200%

**Affected files:**
- `apps/web/src/components/Toolbar/` - zoom selector komponens
- Zoom-hoz kapcsolódó state/context

### REQ-09: DateStrip Átdolgozás

#### 9.1 - Infinite DateStrip
- A DateStrip legyen végtelen görgetésű (infinite scroll)
- Ne legyen fix `dayCount` limit

#### 9.2 - Fókuszált Nap Középre Igazítás
- A griden aktuálisan látható/fókuszált nap mindig középen legyen a DateStrip-en
- A grid és DateStrip szinkronban görgessen

#### 9.3 - Nap Állapotok Vizuális Jelzései

| Állapot | Leírás | Vizuális jelzés |
|---------|--------|-----------------|
| **Current day** (mai nap) | A mai dátum | Vékony vonal a cell-en belül (NEM háttérszín), hasonló a grid current time line-jához |
| **Focused day** | A griden látható/fókuszált nap | Kiemelt háttér vagy keret (ez a "középső" nap) |
| **Departure date** | A kiválasztott job határideje | Piros háttér/szöveg (REQ-15, már implementálva) |
| **Scheduled day** | Van ütemezett task az aktív job-hoz | Zöld pont indikátor (REQ-16, már implementálva) |

**Jelenlegi állapot (`DateCell.tsx:55-61`):**
- `isToday` amber háttérszínnel van jelezve - ezt vonalra kell cserélni

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`
- `apps/web/src/components/DateStrip/DateCell.tsx`

### REQ-10: Precedence Constraint Vizualizáció

Drag közben vizuálisan megjelennek a task precedence constraint-jei két vízszintes vonalként.

#### Mikor jelenik meg?
- Csak **drag közben**
- Csak abban az **oszlopban**, ami fölött épp húzzuk a tile-t
- Ha nincs constraint → nincs vonal

#### Vonalak

| Vonal | Szín | Mikor látható | Pozíció |
|-------|------|---------------|---------|
| **Earliest possible** | Purple | Ha a predecessor task scheduled | `predecessor.scheduledEnd` (+ 4h dry time ha printing task, lásd `precedence.ts:14`) |
| **Latest possible** | Orange | Ha a successor task scheduled | `successor.scheduledStart - currentTask.duration` |

#### Számítási logika

```typescript
// Earliest (purple)
if (predecessorAssignment) {
  earliestStart = predecessorAssignment.scheduledEnd;
  if (isPrintingTask(predecessor)) {
    earliestStart += 4 hours; // DRY_TIME_MINUTES
  }
}

// Latest (orange)
if (successorAssignment) {
  latestStart = successorAssignment.scheduledStart - currentTask.duration;
}
```

#### Vizuális megjelenés
- Hasonló stílusú, mint a `PlacementIndicator` (vízszintes vonal glow effekttel)
- Purple: `#A855F7` (purple-500)
- Orange: `#F97316` (orange-500)

**Affected files:**
- `apps/web/src/components/StationColumn/StationColumn.tsx` - vonalak renderelése
- `apps/web/src/dnd/` - drag state kiegészítése constraint adatokkal
- `packages/validator/src/validators/precedence.ts` - `getEffectivePredecessorEnd` újrafelhasználható
