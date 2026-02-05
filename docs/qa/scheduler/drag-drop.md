# Drag & Drop - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** SCHED-041 – SCHED-083 (B5: Drag & Drop Basics + B6: Station Compact, Fixes)
>
> **Fixtures:** `test`, `swap`, `alt-bypass`, `sidebar-drag`, `drag-snapping`

---

## Overview

Ez a dokumentum a Scheduler UI drag & drop, pick & place, és kapcsolódó funkcionalitásának manuális tesztelését fedi le. A feature csoport magában foglalja:

- Real-time validációs visszajelzés drag/pick közben
- ALT billentyű validáció bypass
- Tile swap gombok (fel/le)
- Quick Placement mód
- Keyboard shortcutok (ALT+↑, ALT+↓, Home, ALT+D)
- Job Details panel interakciók (single-click, double-click recall)
- Selection glow és conflict glow effektek
- Station Compact API és UI
- Ghost placeholder drag közben
- 30-perces rács snapping
- Task completion toggle
- Progress segments vizualizáció

**Megjegyzés:** A dnd-kit alapú drag & drop deprecated lett v0.3.57-ben, helyette Pick & Place mechanizmus van.

---

## Test Fixtures

| Fixture | URL | Leírás |
|---------|-----|--------|
| `test` | `http://localhost:5173/?fixture=test` | Alapértelmezett: 3 job, 5 task, 3 assignment |
| `swap` | `http://localhost:5173/?fixture=swap` | Swap teszt: 3 egymás utáni tile Komori-n |
| `alt-bypass` | `http://localhost:5173/?fixture=alt-bypass` | Precedence bypass: Task 1 @ 10:00-11:00, Task 2 ütemezetlen |
| `sidebar-drag` | `http://localhost:5173/?fixture=sidebar-drag` | Sidebar pick: 1 job, 1 ütemezetlen task |
| `drag-snapping` | `http://localhost:5173/?fixture=drag-snapping` | Snapping teszt |

---

## Test Scenarios

### SCHED-041 - Realtime Validation Feedback

#### Scenario: Érvényes pozíció zöld jelzéssel

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=sidebar-drag`
- SIDE-001 job kiválasztva
- task-sidebar-1 ütemezetlen task látható a Job Details panelben

**Steps:**
1. Kattints a SIDE-001 job kártyára
2. Kattints az ütemezetlen task tile-ra a Job Details panelben (pick mód indul)
3. Vidd az egeret a Komori oszlop fölé, 08:00 magasságban
4. Figyeld a vizuális visszajelzést

**Expected Results:**
- [ ] Pick preview (ghost tile) követi a kurzort
- [ ] Érvényes pozíción zöld ring/highlight látható (`ring-2 ring-green-500`)
- [ ] A validáció <10ms alatt fut (nincs észlelhető késleltetés)

---

#### Scenario: Érvénytelen pozíció piros jelzéssel

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=alt-bypass`
- Job BYPASS-001 kiválasztva
- Task 1 ütemezve 10:00-11:00, Task 2 ütemezetlen

**Steps:**
1. Kattints a BYPASS-001 job kártyára
2. Kattints a Task 2 tile-ra (task-bypass-2) a sidebarban
3. Vidd az egeret a Polar oszlop fölé, 09:00 magasságban (Task 1 vége előtt)
4. Figyeld a vizuális visszajelzést

**Expected Results:**
- [ ] Pick preview követi a kurzort
- [ ] Érvénytelen pozíción (09:00 < 11:00 precedence) piros ring látható (`ring-2 ring-red-500`)
- [ ] A rendszer auto-snap-el az érvényes pozícióra (11:00)

---

### SCHED-042 - ALT Key Validation Bypass

#### Scenario: ALT lenyomásával precedence szabály áthágása

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=alt-bypass`
- BYPASS-001 job kiválasztva
- Task 1 @ 10:00-11:00 Komori-n, Task 2 ütemezetlen

**Steps:**
1. Kattints a Task 2 tile-ra a sidebarban
2. Nyomd le az ALT billentyűt
3. Vidd az egeret a Polar oszlop fölé, 09:00 pozícióra
4. Kattints a pozícióra ALT lenyomva tartásával

**Expected Results:**
- [ ] ALT lenyomva: amber/narancs warning ring látható (`ring-2 ring-amber-500`)
- [ ] Kattintásra a tile elhelyeződik 09:00-kor (precedence bypass)
- [ ] Job megjelenik a "PROBLÈMES" szekcióban "Conflit" badge-dzsel
- [ ] A tile amber glow-t kap (PrecedenceConflict jelzés)

---

#### Scenario: ALT nélkül auto-snap érvényes pozícióra

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=alt-bypass`
- BYPASS-001 job kiválasztva

**Steps:**
1. Kattints a Task 2 tile-ra a sidebarban
2. NE nyomd le az ALT-ot
3. Vidd az egeret a Polar oszlop fölé, 09:00 pozícióra
4. Kattints

**Expected Results:**
- [ ] A rendszer auto-snap-el 11:00-ra (Task 1 vége után)
- [ ] A tile 11:00-kor jelenik meg
- [ ] Job NEM jelenik meg a "PROBLÈMES" szekcióban
- [ ] Nincs amber conflict glow

---

### SCHED-044/045 - Tile Swap Up/Down Buttons

#### Scenario: Swap up gomb működése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`
- 3 tile látható Komori-n: SWAP-001 @ 7:00, SWAP-002 @ 8:00, SWAP-003 @ 9:00

**Steps:**
1. Vidd az egeret a középső tile (SWAP-002 @ 8:00) fölé
2. Várd meg a swap gombok megjelenését
3. Kattints a Chevron-up (swap up) gombra

**Expected Results:**
- [ ] Swap gombok megjelennek hover-re (jobb alsó sarok)
- [ ] Kattintás után SWAP-002 felfelé mozog: 7:00-8:00
- [ ] SWAP-001 lefelé mozog: 8:00-9:00
- [ ] SWAP-003 helyben marad: 9:00-10:00
- [ ] Tile magasságok (duration) változatlanok maradnak

---

#### Scenario: Legfelső tile-on nincs swap-up gomb

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`

**Steps:**
1. Vidd az egeret a legfelső tile (SWAP-001 @ 7:00) fölé
2. Figyeld a megjelenő gombokat

**Expected Results:**
- [ ] Csak Chevron-down (swap down) gomb látható
- [ ] Chevron-up gomb NEM látható vagy disabled

---

#### Scenario: Legalsó tile-on nincs swap-down gomb

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`

**Steps:**
1. Vidd az egeret a legalsó tile (SWAP-003 @ 9:00) fölé
2. Figyeld a megjelenő gombokat

**Expected Results:**
- [ ] Csak Chevron-up (swap up) gomb látható
- [ ] Chevron-down gomb NEM látható vagy disabled

---

### SCHED-048/049 - Keyboard Shortcuts (ALT+↑, ALT+↓)

#### Scenario: ALT+↑ kijelölt tile mozgatása felfelé

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`
- Egy tile ki van jelölve (pl. SWAP-002)

**Steps:**
1. Kattints a középső tile-ra (SWAP-002) a kijelöléshez
2. Nyomd meg ALT+↑

**Expected Results:**
- [ ] SWAP-002 felfelé mozog (swap a felette lévővel)
- [ ] Új pozíció: 7:00-8:00

---

### SCHED-052 - Job Details Double-Click Recall

#### Scenario: Dupla kattintás visszavonja a tile-t

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- TEST-001 job kiválasztva
- print task ütemezve van a griden

**Steps:**
1. Kattints a TEST-001 job kártyára
2. A Job Details panelben keresd meg az ütemezett task tile-t (sötét háttér, station+idő)
3. Kattints duplán a tile-ra

**Expected Results:**
- [ ] A tile eltűnik a gridről
- [ ] A task visszakerül "ütemezetlen" állapotba a sidebarban
- [ ] Task tile színe visszavált a job színére (cursor-grab)

---

### SCHED-053 - Job Details Single-Click Jump

#### Scenario: Egyszeri kattintás a grid pozícióhoz scrolloz

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- TEST-001 job kiválasztva
- print task ütemezve van

**Steps:**
1. Görgess el a gridtől, hogy a tile ne legyen látható
2. A Job Details panelben kattints egyszer az ütemezett task tile-ra

**Expected Results:**
- [ ] A grid automatikusan scrolloz a tile pozíciójához
- [ ] A tile láthatóvá válik a viewport-ban

---

### SCHED-054 - Selection Glow Effect

#### Scenario: Kijelölt tile glow effekt

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Kattints egy job kártyára (pl. TEST-001)
2. Figyeld a hozzá tartozó tile-okat a griden

**Expected Results:**
- [ ] Kijelölt job tile-jai glow effektet kapnak
- [ ] Glow szín megegyezik a job színével (pl. purple: `box-shadow: 0 0 12px 4px #8b5cf699`)
- [ ] Nem kijelölt jobok tile-jai muted állapotban (`opacity: 0.6`, `filter: saturate(0.2)`)

---

### SCHED-058 - Station Compact Button

#### Scenario: Station compact gomb működése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Komori station-ön van 2 tile gap-pel közöttük

**Steps:**
1. Keresd meg a Komori station header-t
2. Kattints a Compact gombra (ha van gap a tile-ok között)

**Expected Results:**
- [ ] Spinner megjelenik compact közben
- [ ] Tile-ok összezáródnak (gap eltűnik)
- [ ] Precedence szabályok tiszteletben tartva (tile nem kerül előd elé)

---

### SCHED-063 - Grid Tile Drag Repositioning

#### Scenario: Ütemezett tile újrapozícionálása drag-gel

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- TEST-001 print task ütemezve @ 7:00 Komori-n

**Steps:**
1. Kattints a tile-ra a griden és tartsd lenyomva
2. Húzd lefelé 9:00 pozícióra
3. Engedd el

**Expected Results:**
- [ ] Drag közben ghost placeholder látható az eredeti pozíción (szaggatott körvonal)
- [ ] Tile követi a kurzort
- [ ] Drop után a tile 9:00-ra kerül (30-perces snap)
- [ ] Tile csak vertikálisan mozog (station fix)

---

### SCHED-073 - Job Focus Muting (Non-Drag)

#### Scenario: Job kijelölésekor más jobok tile-jai elhalványulnak

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Több job tile-ja látható a griden

**Steps:**
1. Kattints TEST-001 job kártyára

**Expected Results:**
- [ ] TEST-001 tile-jai glow effektet kapnak
- [ ] TEST-002, TEST-003 tile-jai muted állapotba kerülnek
- [ ] Muted styling: `opacity: 0.6`, `filter: saturate(0.2)`

---

### SCHED-074 - Persistent Amber Glow for Conflicts

#### Scenario: Precedence konfliktusú tile amber glow-val

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=alt-bypass`
- Hozz létre precedence conflict-ot ALT+drop-pal

**Steps:**
1. Válaszd ki BYPASS-001 jobot
2. ALT lenyomva helyezd el Task 2-t 09:00-ra (konfliktus)
3. Figyeld a tile-t

**Expected Results:**
- [ ] A tile amber glow-t kap (`box-shadow: 0 0 12px 4px #F59E0B99`)
- [ ] Amber glow persistent (nem csak drag közben)
- [ ] Job megjelenik "PROBLÈMES" szekcióban

---

### SCHED-075 - Conflict Glow Priority

#### Scenario: Conflict glow felülírja a selection glow-t

**Preconditions:**
- Precedence conflict létrehozva (előző szcenárió)
- BYPASS-001 job kijelölve

**Steps:**
1. A konfliktusú tile-t figyeld

**Expected Results:**
- [ ] Amber glow látható (NEM job szín glow)
- [ ] Conflict glow prioritást élvez a selection glow-val szemben

---

### SCHED-078 - Real-Time Drag Snapping

#### Scenario: Drag preview 30-perces rácshoz snap-el

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=sidebar-drag`

**Steps:**
1. Válaszd ki SIDE-001 jobot
2. Kattints az ütemezetlen task tile-ra
3. Mozgasd az egeret lassan a Komori oszlopon

**Expected Results:**
- [ ] Pick preview 30-perces pozíciókhoz snap-el (6:00, 6:30, 7:00...)
- [ ] Nincs "floating" pozíció a rács vonalak között

---

### SCHED-083 - Task Completion Toggle

#### Scenario: Kattintásra toggle-olható completion ikon

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Ütemezett tile látható a griden (incomplete állapot)

**Steps:**
1. Keresd meg a tile-on a completion ikont (circle ikon, bal oldalon)
2. Kattints az ikonra

**Expected Results:**
- [ ] Ikon változik: `circle` → `circle-check` (emerald szín)
- [ ] Zöld gradient jelenik meg balról (`linear-gradient(to right, rgba(34,197,94,0.4)...)`)
- [ ] Job kártya progress dots frissül

---

#### Scenario: Completed visszaállítása incomplete-re

**Preconditions:**
- Tile completed állapotban van (circle-check ikon)

**Steps:**
1. Kattints a circle-check ikonra

**Expected Results:**
- [ ] Ikon visszavált: `circle-check` → `circle` (zinc szín)
- [ ] Zöld gradient eltűnik
- [ ] Progress dots frissül

---

## Visual Checklist

### Validation Feedback
- [ ] Érvényes pozíció: zöld ring (`ring-green-500`)
- [ ] Érvénytelen pozíció: piros ring (`ring-red-500`)
- [ ] ALT bypass warning: amber ring (`ring-amber-500`)

### Glow Effects
- [ ] Selection glow: job color + `99` alpha
- [ ] Conflict glow: `#F59E0B99` (amber)
- [ ] Conflict glow > Selection glow prioritás

### Muting
- [ ] Muted tile: `opacity: 0.6`, `filter: saturate(0.2)`
- [ ] Aktív job tile-jai nem muted

### Swap Buttons
- [ ] Pozíció: jobb alsó sarok
- [ ] Stílus: `w-6 h-6 rounded bg-white/10`
- [ ] Hover: `bg-white/20`

### Ghost Placeholder
- [ ] Szaggatott körvonal eredeti pozíción
- [ ] Pulsating animation (`pulse-opacity` keyframes)

### Completion State
- [ ] Incomplete: `circle` ikon, `text-zinc-600`
- [ ] Completed: `circle-check` ikon, `text-emerald-500`
- [ ] Completed gradient: zöld balról jobbra

---

## Edge Cases

| Eset | Elvárt viselkedés |
|------|-------------------|
| ALT lenyomva érvényes pozíción | Nincs conflict létrehozva, normál elhelyezés |
| Drop múltbeli időpontra | Nem engedélyezett (snap a legkorábbi érvényes pozícióra) |
| Swap egyetlen tile-lal | Swap gombok nem láthatók |
| Compact már tömör station-ön | Nincs változás, "Nothing to compact" |
| Double-click ütemezetlen tile-on | Nincs hatás (recall csak ütemezett tile-ra) |
| Conflict törlése (tile áthelyezése érvényes pozícióra) | Amber glow eltűnik, job kikerül "PROBLÈMES"-ből |
| Pick cancel ESC-szel | Pick preview eltűnik, scroll visszaáll |

---

## Cross-feature Interactions

| Kapcsolódó feature | Interakció típusa |
|--------------------|-------------------|
| Layout Grid (B4) | Tile megjelenítés, station columns |
| Navigation UX (B7) | Zoom befolyásolja a pixels-per-hour-t |
| DateStrip/Pick&Place (B8) | Pick & Place infrastruktúra |
| Context Menu (B8) | Jobb klikk completion toggle, move up/down |

---

## Statistics

| Metrika | Érték |
|---------|-------|
| Feldolgozott feature-ök (B5) | 13 Active (8 Deprecated) |
| Feldolgozott feature-ök (B6) | 28 Active |
| Összes Active feature | 41 |
| Generált teszt szcenáriók | 20 |
| Edge case-ek | 7 |
