# New Requirements 04 - Raw Notes

> **Status:** Draft - needs clarification
> **Date:** 2026-01-22

---

## REQ-01: Pick and Place (replaces Drag and Drop)

### Probléma
A drag-and-drop sok tile esetén nagyon lassú, mert a `mousemove` esemény folyamatosan triggerel újrarenderelést és validációt (~60x/másodperc).

### Megoldás
Kétlépéses interakció: **Pick** (kattintás a felvételhez) → **Place** (kattintás a lerakáshoz)

### Pick (felvétel)
- **Trigger:** Kattintás tile-ra (gridről VAGY Job Details panelből)
- **Kurzor:** Nyitott kéz → zárt kéz (picked állapotban)
- **Vizuális feedback:**
  - A tile CSS animation-nel pulzál (bg opacity változás)
  - A Job Details panelben is látszik a kijelölés
- **Precedencia vonalak:** Megjelennek (purple/orange) a pick pillanatában

### Place (lerakás)
- **Trigger:** Kattintás a célpozícióra
- **Érvényes pozíció:** Tile odakerül, picked állapot megszűnik
- **Érvénytelen pozíció:** Tile visszakerül az eredeti helyére (ahonnan pickeltük)
- **Vizuális feedback:** Pozíció érvényessége látszik (zöld/piros border mint drag-nál)

### Cancel (megszakítás)
- **Trigger:** ESC billentyű
- **Eredmény:** Tile visszakerül eredeti helyére, picked állapot megszűnik

### Korlátozások
- Egyszerre csak EGY tile lehet picked állapotban
- Új pick automatikusan cancel-eli az előzőt

### Miért gyorsabb?
| Interakció | Validációk száma |
|------------|------------------|
| Drag-and-drop | ~60/másodperc (minden mousemove) |
| Pick and place | 2 összesen (pick + place hover) |

### Kurzor állapotok
| Állapot | Kurzor |
|---------|--------|
| Nincs picked | default (vagy pointer tile felett) |
| Picked, valid target felett | zárt kéz (grab) |
| Picked, invalid target felett | zárt kéz (grab) - border szín jelzi |

### Vizuális feedback (ugyanaz mint drag-and-drop)
A pick-and-place-nek **ugyanúgy kell kinéznie** mint a drag-and-drop-nak:

| Feedback | Megvalósítás |
|----------|--------------|
| Ghost tile | ✅ Egérnél követi picked állapotban |
| Border szín | ✅ Zöld (valid) / Piros (invalid) |
| Precedencia vonalak | ✅ Purple/orange vonalak látszanak |
| Validation message | ✅ Hibaüzenet tooltip (v0.3.52) |
| **Pulsating** | ✅ **ÚJ** - eredeti pozíción jelzi honnan pickeltük |

**Technikai különbség (nem vizuális):**
```
Drag-and-drop: mousedown → mousemove (60x/sec) → mouseup
Pick-and-place: click → hover detection only → click
```

### Mit mozgatunk?
**Task-okat (tile-okat)** mozgatunk.

### Experimental Implementation Reference

> **Branch:** `feature/v0.3.66-element-types`
> **Verzió:** v0.3.54 - v0.3.60 (Pick & Place implementáció)
> **Commit:** `7064ccc` - Remove drag & drop, keep Pick & Place only

### Releváns commitok (v0.3.54-v0.3.60)

| Verzió | Commit | Leírás |
|--------|--------|--------|
| v0.3.54 | `9630264` | Initial Pick & Place (sidebar tasks) |
| v0.3.55 | - | Visual feedback (ring colors, cursor states) |
| v0.3.57 | `6f4b4a3` | Unified Pick & Place from grid tiles |
| v0.3.58 | `ea6cbda` | RAF optimization, validation throttle |
| v0.3.60 | `7bb5623` | Real-time message sync |

### Architektúra (from experimental branch)

**Dual Rendering Streams:**
```
Stream 1: Position (60fps)     - RAF loop → direct DOM manipulation
Stream 2: Validation (100ms)   - Throttled, CSS transition masks latency
Stream 3: Messages (60fps)     - Real-time time string generation
```

**Key Components:**
- `apps/web/src/pick/PickStateContext.tsx` - State management + GhostPositionRef
- `apps/web/src/pick/PickPreview.tsx` - Ghost tile rendering (portal-based)
- `StationColumn.tsx` - Ring color feedback, mouse move handling
- `Tile.tsx` - Click handler, pulsating animation

**Performance Optimizations:**
1. Ghost position via `useRef` + RAF (no React re-renders)
2. Validation throttled to 100ms with early-exit (15-min slot check)
3. CSS transition masking for smooth ring color changes
4. Direct DOM manipulation for ghost positioning

### Újraimplementálás szükséges

Az experimental branch kódja nem illeszkedik a `ux-ui-development` branch architektúrájába. Az újraimplementálásnál:
- [ ] A `ux-ui-development` branch kódbázisára kell építeni
- [ ] Mock módban működik (mint az összes v0.3.x release)
- [ ] A meglévő @flux/types típusokat kell használni

---

## REQ-02: Right Click Context Menu

> **Status:** Részben tisztázva

### Alapötlet
- Right click tile-on: floating context menu jelenik meg
- Csak **tile-on** működik (üres cellán nem)
- A menü bővülni fog a jövőben

### Menü pozíció (from experimental)
- Egér pozíciójánál jelenik meg (cursor x, y)
- Automatikusan flipel ha viewport szélén van (jobb/alsó)
- Portal-based rendering (z-9999)

### Menü opciók (from experimental v0.3.63)

| Opció | Ikon | Leírás |
|-------|------|--------|
| Voir détails | Eye | Kiválasztja a job-ot → megjelenik a Job Details panel |
| Marquer terminé/non terminé | Square/CheckSquare | Toggle completion |
| Déplacer vers le haut | ChevronUp | Swap up (ha van felette tile) |
| Déplacer vers le bas | ChevronDown | Swap down (ha van alatta tile) |

> **Megjegyzés:** "Voir détails" ugyanazt csinálja, mintha a Jobs List-ben (bal oszlop) kattintanánk a job-ra: kiválasztja és megjeleníti a Job Details panelt (balról 2. oszlop).

### Bezárás
- Click outside → bezár
- ESC billentyű → bezár
- Scroll → bezár (pozíció elavulna)

### Experimental Implementation Reference

> **Branch:** `feature/v0.3.66-element-types`
> **File:** `apps/web/src/components/Tile/TileContextMenu.tsx`
> **Version:** v0.3.63

### Pick művelet (tisztázva)

A raw notes-ban szerepelt "pick the tile", de az experimental kódban:
- **A context menu-ben NINCS "Pick" opció**
- **A pick single click-kel történik a tile-on** (nem context menu-ből)

```typescript
// Tile.tsx - v0.3.57
const handleClick = () => {
  if (isCompleted) {
    onSelect?.(job.id);  // Completed tile → csak select
    return;
  }
  if (onPick) {
    onPick(assignment.id, task, job);  // Pick!
  }
};

// Pickable feltétel:
const isPickable = !isOutsourced && !isCompleted && onPick;
```

**Összefoglalva:**
- Single click pickable tile-on → **Pick**
- Single click completed tile-on → **Select job**
- Right click → **Context menu** (nem pick)

> **Megjegyzés:** Az outsourced ellenőrzés a cursor stílusnál van (`isPickable`), de a `handleClick` nem ellenőrzi. Valószínűleg a szülő komponens nem ad át `onPick`-et outsourced tile-oknak.

---

## REQ-03: Column Focus During Pick from Job Details

> **Status:** Tisztázva (experimental kód alapján)

### Probléma
Amikor a Job Details panelből pickelsz egy unscheduled taskot, a cél station oszlop lehet, hogy nem látszik a viewportban.

### Viselkedés: Pick from Sidebar (unscheduled task)

| Fázis | Viselkedés |
|-------|------------|
| **Pick** | Scroll pozíció elmentve (cancel restoration-höz) |
| **Pick** | Target oszlop balra scrolloz (smooth, 300ms) |
| **Pick** | Többi oszlop opacity → **15%** + pointer-events-none |
| **Place** | Opacity visszaáll 100%-ra |
| **Cancel (ESC)** | Scroll pozíció visszaáll |

### Viselkedés: Pick from Grid (scheduled tile - reschedule)
Ha egy már lerakott tile-t mozgatsz:
- **Nincs** opacity változás (minden oszlop látható marad)
- **Nincs** scrollozás (user már ott van)

### Experimental Implementation Reference

> **Branch:** `feature/v0.3.66-element-types`
> **Files:**
> - `apps/web/src/App.tsx` - handlePickTask, handlePickTileFromGrid
> - `apps/web/src/components/StationColumns/StationColumn.tsx` - opacity logic

**Scroll logic (App.tsx):**
```typescript
// v0.3.55: Scroll to target station column (300ms animation)
const stationX = LAYOUT.PADDING_LEFT + stationIndex * (LAYOUT.STATION_WIDTH + LAYOUT.GAP);
const scrollTargetX = Math.max(0, stationX - LAYOUT.PADDING_LEFT);
gridRef.current.scrollTo(scrollTargetX, gridRef.current.getScrollY(), 'smooth');
```

**Opacity logic (StationColumn.tsx):**
```typescript
if (pickSource === 'sidebar') {
  return 'opacity-15 pointer-events-none';  // Non-target stations
}
// pickSource === 'grid' → no opacity change
```

### Eltérés a raw notes-tól

| Aspektus | Raw notes | Experimental kód |
|----------|-----------|------------------|
| Opacity | 20% | **15%** (opacity-15) |
| Scroll on place | "nincs" | Nincs (helyes) |
| Cancel scroll restore | Nem említve | **Van** (savedScrollPositionRef) |

### Kérdések (tisztázandó)
- [ ] A 15% opacity OK, vagy legyen 20%?
- [ ] Kell-e üres area a jobb oldalon a scroll-hoz? (Az experimental kódban nem láttam explicit kezelést)

---

## REQ-04: Job Details Panel - Fix Tile Height

> **Status:** ✅ Tisztázva

### Változás

| Jellemző | Régi | Új |
|----------|------|-----|
| **Tile magasság** | Proporcionális (duration alapján) | Fix magasság (**32px**) |

### Miért fix magasság?
A proporcionális magasság problémás volt:
- Rövid taskok túl kicsik lettek (nem olvashatóak)
- Hosszú taskok túl nagyok lettek (helypazarlás)
- Fix 32px egyszerűbb és praktikusabb lista nézet

### Experimental Implementation Reference

> **Branch:** `feature/v0.3.66-element-types`
> **Commit:** `204809d` - refactor(JobDetailsPanel): Use fixed height for task tiles

---

## REQ-05: Unavailability Overlay - CSS Gradient → SVG

> **Status:** ✅ Tisztázva

### Probléma
A grid-en a non-working hours (ebédszünet, munkaidőn kívüli órák) jelölésére használt stripe minta jelenleg CSS gradient-tel van megvalósítva. **Performance** okokból SVG-re kell váltani.

### Változás

| Jellemző | Régi | Új |
|----------|------|-----|
| **Stripe minta** | CSS gradient (`bg-stripes-dark`) | SVG fájl |
| **Megjelenés** | Ugyanaz | Ugyanaz |

### Jelenlegi CSS minta (megtartandó megjelenés)

```css
.bg-stripes-dark {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.03) 10px,
    rgba(255, 255, 255, 0.03) 20px
  );
}
```

**Minta jellemzők:**
- Irány: **45°** (átlós)
- Szín: `rgba(255, 255, 255, 0.03)` (nagyon halvány fehér)
- Szélesség: **10px** stripe / **10px** transparent
- Ismétlődés: **20px**

### Implementáció

Az SVG-nek ugyanezt a mintát kell reprodukálnia:
- [ ] SVG fájl létrehozása (pl. `apps/web/public/stripes.svg`)
- [ ] `background-image: url('/stripes.svg')` használata
- [ ] `background-repeat: repeat` a tiling-hez

### Érintett fájlok

| Fájl | Változás |
|------|----------|
| `apps/web/src/index.css` | `.bg-stripes-dark` módosítása |
| `apps/web/public/stripes.svg` | Új fájl |
| `UnavailabilityOverlay.tsx` | Nincs változás (class marad) |

---

## Összefoglaló: Tisztázandó kérdések

### REQ-01: Pick and Place
- ✅ Tisztázva

### REQ-02: Right Click Context Menu
- [ ] Menü opciók listája
- [ ] Működés üres cellán
- [ ] Pozicionálás

### REQ-03: Column Focus
- [ ] Üres area mérete
- [ ] Transition animáció
- [ ] Multi-station taskok kezelése

### REQ-04: Job Details Panel Fix Tile Height
- ✅ Fix magasság: 32px (végleges)

### REQ-05: Unavailability Overlay SVG
- ✅ Miért kell SVG? → Performance
- ✅ Minta: 45°, 10px stripe, rgba(255,255,255,0.03)

