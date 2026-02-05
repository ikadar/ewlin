# Layout Grid - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** SCHED-001 – SCHED-034 (B4: Mock Data, Layout, Grid)
>
> **Fixtures:** `test`, `swap`, `layout-redesign`

---

## Overview

Ez a dokumentum a Scheduler UI alapvető layout és grid funkcionalitásának manuális tesztelését fedi le. A feature csoport magában foglalja:

- Mock data generátorok és API
- Sidebar navigáció
- Jobs List panel (bal oldali munkalista)
- Job Details panel (kiválasztott munka részletei)
- DateStrip (nap navigáció)
- Timeline Column (óra mutatók)
- Station Headers és Columns (ütemezési rács)
- Tile component (ütemezett feladatok megjelenítése)
- Similarity Indicators (hasonlósági jelzők)

---

## Test Fixtures

| Fixture | URL | Leírás |
|---------|-----|--------|
| `test` | `http://localhost:5173/?fixture=test` | Alapértelmezett teszt adatok 3 jobbal, 5 taskkal, 3 assignmenttel |
| `swap` | `http://localhost:5173/?fixture=swap` | Swap teszt: 3 egymás utáni tile ugyanazon a station-ön |
| `layout-redesign` | `http://localhost:5173/?fixture=layout-redesign` | Layout teszteléshez (zoom, sidebar) |

---

## Test Scenarios

### SCHED-011 - Sidebar Component

#### Scenario: Sidebar megjelenik és ikonok láthatók

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Grid látható

**Steps:**
1. Nyisd meg az alkalmazást a böngészőben
2. Ellenőrizd a bal szélső keskeny sávot (Sidebar)

**Expected Results:**
- [ ] Sidebar látható a képernyő bal szélén
- [ ] Sidebar szélessége 56px (w-14)
- [ ] Sidebar magassága a teljes viewport magasság
- [ ] Háttérszín: sötét (`bg-zinc-900/50`)
- [ ] Jobb oldali border látható (`border-r border-white/5`)

---

#### Scenario: Navigation ikonok és állapotok

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Keresd meg a Grid ikont (LayoutGrid) a Sidebar tetején
2. Keresd meg a Calendar ikont
3. Keresd meg a Settings ikont

**Expected Results:**
- [ ] Grid ikon aktív állapotban van (világosabb háttér: `bg-white/10`, szöveg: `text-zinc-300`)
- [ ] Calendar ikon inaktív állapotban (sötét háttér, szöveg: `text-zinc-500`)
- [ ] Settings ikon disabled állapotban (szöveg: `text-zinc-700`, cursor-not-allowed)
- [ ] Hover a Grid ikonon: háttér `bg-white/15`
- [ ] Hover a Calendar ikonon: háttér `bg-white/10`, szöveg `text-zinc-300`
- [ ] Settings ikonra hover hatástalan (disabled)

---

### SCHED-013 - JobsList Container

#### Scenario: Jobs List panel megjelenítése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg a Sidebar melletti panelt (Jobs List)

**Expected Results:**
- [ ] Panel szélessége 288px (w-72)
- [ ] Panel scrollozható vertikálisan
- [ ] Háttérszín: `bg-zinc-900/30`
- [ ] Két szekció látható: "PROBLÈMES" és "TRAVAUX"

---

#### Scenario: Jobs List header elemek

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg a Jobs List panel tetejét

**Expected Results:**
- [ ] "+" (Add Job) gomb látható
- [ ] Keresőmező (search field) látható
- [ ] Add Job gomb zöld színű (MVP-ben disabled lehet)

---

### SCHED-015 - ProblemsSection

#### Scenario: Problémás munkák megjelenítése

**Preconditions:**
- Szükséges: fixture late/conflict jobokkal (vagy módosított `test` fixture)

**Steps:**
1. Ellenőrizd a "PROBLÈMES" szekciót

**Expected Results:**
- [ ] Késett munkák piros háttérrel jelennek meg (`bg-red-500/10`)
- [ ] Késett munkáknál "En retard" badge látható
- [ ] Alert-circle ikon a késett munkáknál
- [ ] Konfliktus munkák sárga/amber háttérrel (`bg-amber-500/10`)
- [ ] Konfliktus munkáknál "Conflit" badge
- [ ] Shuffle ikon a konfliktus munkáknál

---

### SCHED-016 - JobCard

#### Scenario: Job kártya tartalma

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg bármelyik job kártyát a "TRAVAUX" szekcióban

**Expected Results:**
- [ ] Job reference szám látható (pl. "TEST-001")
- [ ] Client név látható (pl. "Test Client A")
- [ ] Leírás látható (pl. "Test Job 1 - Brochures")
- [ ] Progress dots láthatók a jobb alsó sarokban

---

### SCHED-017 - ProgressDots

#### Scenario: Task completion vizualizáció

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Legalább egy job kártyán több task van

**Steps:**
1. Nézd meg a job kártyákon a progress dots-ot

**Expected Results:**
- [ ] Befejezett taskok: kitöltött zöld pont (`bg-emerald-500`)
- [ ] Befejezetlen taskok: üres körvonal (`border border-zinc-700`)
- [ ] A pontok száma megegyezik a job task-jainak számával

---

### SCHED-018 - Search Filtering

#### Scenario: Job szűrés keresőmezővel

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Több job látható a listában

**Steps:**
1. Kattints a keresőmezőbe
2. Írd be: "TEST-001"
3. Figyeld a job listát
4. Töröld a keresést
5. Írd be: "Client A"
6. Figyeld a listát

**Expected Results:**
- [ ] "TEST-001" keresésre csak a TEST-001 job marad látható
- [ ] "Client A" keresésre a Test Client A jobok maradnak
- [ ] Üres keresőmezőnél minden job látható
- [ ] A keresés reference, client és description mezőkben is keres

---

### SCHED-019 - JobDetailsPanel

#### Scenario: Job részletek panel megjelenése kiválasztáskor

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Egy job sincs kiválasztva

**Steps:**
1. Ellenőrizd, hogy a Job Details panel nem látható
2. Kattints egy job kártyára a Jobs List-ben
3. Ellenőrizd a megjelenő panelt

**Expected Results:**
- [ ] Kezdetben a Job Details panel nem látható
- [ ] Kattintás után a panel megjelenik
- [ ] Panel szélessége 288px (w-72)
- [ ] Panel a Jobs List mellett jelenik meg

---

### SCHED-020 - JobInfo Section

#### Scenario: Job információk megjelenítése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Egy job ki van választva

**Steps:**
1. Válassz ki egy jobot (pl. TEST-001)
2. Nézd meg a Job Details panel tetejét

**Expected Results:**
- [ ] "CODE" mező: job reference (pl. "TEST-001"), monospace betűtípus
- [ ] "CLIENT" mező: client név (pl. "Test Client A")
- [ ] "INTITULÉ" mező: job description (pl. "Test Job 1 - Brochures")
- [ ] "DÉPART" mező: dátum francia formátumban (pl. "18/12/2025")
- [ ] Label-ek: text-zinc-500, text-xs, uppercase

---

### SCHED-021 - TaskList Component

#### Scenario: Task lista a Job Details panelben

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- TEST-001 job kiválasztva (2 task: print, cut)

**Steps:**
1. Görgess le a Job Details panelben a task listához

**Expected Results:**
- [ ] 2 task tile látható
- [ ] Ütemezett task: sötét háttér (`bg-slate-800/40`), station név és időpont
- [ ] Ütemezetlen task: job színű háttér, `cursor-grab`
- [ ] Task tile-on border-l-4 a bal oldalon

---

### SCHED-022 - DateStrip Component

#### Scenario: Nap navigációs oszlop

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Keresd meg a keskeny dátum oszlopot (DateStrip)

**Expected Results:**
- [ ] Oszlop szélessége 48px (w-12)
- [ ] Francia nap rövidítések: Lu, Ma, Me, Je, Ve, Sa, Di
- [ ] Minden napnál a nap száma is látható (pl. "09")
- [ ] Cella magassága 40px (h-10)

---

### SCHED-023 - DateCell

#### Scenario: Mai nap kiemelése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Keresd meg a mai napot a DateStrip-en

**Expected Results:**
- [ ] Mai nap amber háttérrel kiemelve (`bg-amber-500/15`)
- [ ] Mai nap szövege: `text-amber-200`
- [ ] Mai nap border-je: `border-amber-500/30`
- [ ] Többi nap: `text-zinc-500`, `border-b border-white/5`

---

### SCHED-024 - TimelineColumn

#### Scenario: Óra mutatók megjelenítése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Keresd meg az óra oszlopot (Timeline Column)

**Expected Results:**
- [ ] Oszlop szélessége 48px (w-12)
- [ ] Óra címkék láthatók: "6h", "7h", "8h"... formátumban
- [ ] Óra címkék: `text-sm font-mono text-zinc-600`
- [ ] Vízszintes vonalak minden óránál
- [ ] 30 perces tick mark (w-3)
- [ ] 15/45 perces tick mark (w-2)

---

### SCHED-025 - NowLine

#### Scenario: Aktuális időpont jelzése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Keresd meg a piros "now" vonalat a Timeline-on

**Expected Results:**
- [ ] Piros vízszintes vonal (`bg-red-500`) az aktuális időpontnál
- [ ] Idő címke a vonal mellett (pl. "11:10")
- [ ] Címke stílusa: `text-xs font-mono text-red-400 bg-zinc-900 px-1 rounded`
- [ ] A vonal pozíciója megfelel az aktuális időnek

---

### SCHED-026 - StationHeaders

#### Scenario: Station fejlécek megjelenítése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg a grid tetején a station neveket

**Expected Results:**
- [ ] Station nevek láthatók (pl. "Komori G40", "Polar 137", "Heidelberg")
- [ ] Header sor sticky (görgetéskor a tetején marad)
- [ ] Fejléc cellák szélessége 240px (w-60)
- [ ] Szöveg stílusa: `text-sm font-medium text-zinc-300`

---

### SCHED-027 - OffScreenIndicator

#### Scenario: Off-screen indikátorok (ha van tile kiválasztott jobhoz)

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Egy job kiválasztva, amelynek tile-jai részben a látható területen kívül vannak

**Steps:**
1. Válassz ki egy jobot
2. Görgess úgy, hogy a job tile-jai részben láthatók, részben nem
3. Nézd meg a station header-eket

**Expected Results:**
- [ ] Chevron ikon (fel vagy le) megjelenik a headerben
- [ ] Szám jelzi hány tile van a képernyőn kívül
- [ ] Ikon stílusa: `w-3 h-3 text-zinc-500`

---

### SCHED-028 - StationColumns Container

#### Scenario: Station oszlopok konténer

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg a fő grid területet

**Expected Results:**
- [ ] Horizontális görgetés működik (ha több station van)
- [ ] Oszlopok közötti gap 12px (gap-3)
- [ ] Háttérszín: `bg-[#050505]`

---

### SCHED-029 - StationColumn

#### Scenario: Egyéni station oszlop

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`

**Steps:**
1. Nézd meg egy station oszlopát

**Expected Results:**
- [ ] Oszlop szélessége 240px (w-60)
- [ ] Háttérszín: `bg-[#0a0a0a]`
- [ ] Óra grid vonalak láthatók (80px távolságra)

---

### SCHED-030 - Unavailability Overlay

#### Scenario: Nem működő időszakok jelzése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Station-nek van non-operating időszaka (pl. 6:00 előtt)

**Steps:**
1. Nézd meg a station oszlopot a nem működő időszakokban

**Expected Results:**
- [ ] Vonalkázott (hatched) pattern látható
- [ ] Pattern: 45 fokos, átlátszó és halvány fehér sávok
- [ ] Overlay lefedi a nem működő időszakot

---

### SCHED-032 - Tile Component

#### Scenario: Ütemezett task tile megjelenítése

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=test`
- Van ütemezett task a griden

**Steps:**
1. Nézd meg a Komori oszlopban az ütemezett tile-t (TEST-001 print task)

**Expected Results:**
- [ ] Tile látható a megfelelő pozícióban (7:00-tól)
- [ ] Bal border: 4px vastag, job színében (purple: #8b5cf6)
- [ ] Setup szekció: világosabb (`bg-purple-900/40`)
- [ ] Run szekció: sötétebb (`bg-purple-950/35`)
- [ ] Tartalom: completion ikon + "TEST-001 · Test Client A"

---

### SCHED-033 - SwapButtons

#### Scenario: Swap gombok megjelenése hover-re

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`
- 3 tile látható a Komori oszlopban

**Steps:**
1. Vidd az egeret a középső tile fölé
2. Figyeld a megjelenő gombokat

**Expected Results:**
- [ ] Swap gombok megjelennek a jobb alsó sarokban
- [ ] Chevron-up és Chevron-down ikonok
- [ ] Gombok stílusa: `w-6 h-6 rounded bg-white/10`
- [ ] Hover-re: `bg-white/20`

---

#### Scenario: Swap up művelet

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`
- 3 tile: 7:00-8:00 (SWAP-001), 8:00-9:00 (SWAP-002), 9:00-10:00 (SWAP-003)

**Steps:**
1. Vidd az egeret a középső tile (SWAP-002) fölé
2. Kattints a Chevron-up (swap up) gombra
3. Figyeld a tile pozíciókat

**Expected Results:**
- [ ] SWAP-002 tile felfelé mozog (új idő: 7:00-8:00)
- [ ] SWAP-001 tile lefelé mozog (új idő: 8:00-9:00)
- [ ] SWAP-003 tile helyben marad (9:00-10:00)
- [ ] Tile magasságok (duration) változatlanok

---

#### Scenario: Legfelső tile-on nincs swap-up

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap`

**Steps:**
1. Vidd az egeret a legfelső tile (SWAP-001) fölé
2. Figyeld a megjelenő gombokat

**Expected Results:**
- [ ] Csak Chevron-down (swap down) gomb látható
- [ ] Chevron-up gomb NEM látható vagy disabled

---

### SCHED-034 - SimilarityIndicators

#### Scenario: Hasonlósági jelzők egymás utáni tile-ok között

**Preconditions:**
- App betöltve: `http://localhost:5173/?fixture=swap` (vagy fixture hasonlósági adatokkal)
- Egymás utáni tile-ok vannak ugyanazon a station-ön

**Steps:**
1. Nézd meg két egymás utáni tile határát

**Expected Results:**
- [ ] Link/Unlink ikonok megjelennek a tile-ok között
- [ ] Pozíció: alsó tile jobb felső sarka, `top: -10px`
- [ ] Matched criterion: `link` ikon, `text-zinc-400`
- [ ] Not matched criterion: `unlink` ikon, `text-zinc-800`

---

## Visual Checklist

### Sidebar
- [ ] Szélesség: 56px
- [ ] Háttér: sötétszürke (`bg-zinc-900/50`)
- [ ] Ikonok: LayoutGrid, Calendar, Settings (Lucide)

### Jobs List Panel
- [ ] Szélesség: 288px
- [ ] Header: Add gomb (zöld +) + keresőmező
- [ ] Szekciók: PROBLÈMES (piros/amber kártyák), TRAVAUX (normál kártyák)

### Job Details Panel
- [ ] Szélesség: 288px
- [ ] JobInfo: CODE, CLIENT, INTITULÉ, DÉPART mezők
- [ ] TaskList: színes tile-ok (ütemezetlen) és sötét tile-ok (ütemezett)

### DateStrip
- [ ] Szélesség: 48px
- [ ] Francia napok: Lu, Ma, Me, Je, Ve, Sa, Di
- [ ] Mai nap: amber kiemelés

### Timeline Column
- [ ] Szélesség: 48px
- [ ] Óra címkék: "Xh" formátum
- [ ] NowLine: piros vonal + időcímke

### Scheduling Grid
- [ ] Station headers: sticky, w-60 cellák
- [ ] Station columns: w-60, óra grid vonalak
- [ ] Unavailability: vonalkázott overlay
- [ ] Tiles: job szín, setup/run szekciók, completion ikon

### Tile Component
- [ ] Border-left: 4px, job color
- [ ] Setup section: lighter shade
- [ ] Run section: full color
- [ ] Content: circle/circle-check ikon + reference · client
- [ ] Completed: zöld gradient balról
- [ ] Swap buttons: hover-re látható

---

## Edge Cases

| Eset | Elvárt viselkedés |
|------|-------------------|
| Nincs job kiválasztva | Job Details Panel nem látható |
| Üres keresés eredmény | "Aucun travail trouvé" üzenet (vagy üres lista) |
| Egyetlen tile a station-ön | Swap gombok nem jelennek meg (vagy mindkettő disabled) |
| Legfelső tile | Swap-up gomb nem elérhető |
| Legalsó tile | Swap-down gomb nem elérhető |
| Mai nap scroll-on kívül | Amber highlight továbbra is a mai napot jelzi |
| Hosszú job reference/client | Truncate ellipsis-szel |
| Nem működő időszak 00:00-06:00 | Hatched overlay lefedi az időszakot |

---

## Cross-feature Interactions

| Kapcsolódó feature | Interakció típusa |
|--------------------|-------------------|
| Pick & Place (B8) | Tile kiválasztása a panelből pick módot indít |
| Drag & Drop (B5) | Tile drag & drop újrapozícionáláshoz |
| Context Menu (B8) | Jobb klikk tile-on context menüt nyit |
| Zoom Control (B7) | Zoom változtatja a grid méretezését |

---

## Statistics

| Metrika | Érték |
|---------|-------|
| Feldolgozott feature-ök | 34 (SCHED-001 – SCHED-034) |
| Generált teszt szcenáriók | 22 |
| Edge case-ek | 8 |
| Visual checklist elemek | 24 |
