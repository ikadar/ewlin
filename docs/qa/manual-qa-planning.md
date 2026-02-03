# Manual QA Planning

> **Status:** Planning
>
> **Created:** 2026-02-03
>
> **Purpose:** Ez a dokumentum rögzíti a Manual QA Plan elkészítésének tervezési döntéseit és megközelítését.
>
> **Kapcsolódó dokumentum:** [Feature Catalog Planning](./feature-catalog-planning.md)

---

## 1. Célkitűzés

A projekt közel áll a befejezéshez. Szükség van egy átfogó Manual QA Plan-re, amely az alkalmazás **minden aktív feature-jét** lefedi, és tesztelők számára részletes útmutatót ad.

A Manual QA Plan a [Feature Katalógus](../features/feature-catalog.md) alapján készül, amely az összes aktív feature-t tartalmazza.

---

## 2. Döntések

### Megközelítés

A Manual QA Plan **feature-alapú újraírással** készül. A meglévő release dokumentumok és Playwright tesztek szolgálnak input forrásként – ezekből azonosítjuk a feature-öket és a teszt szcenáriókat. A végeredmény azonban nem a release dokumentumok egyszerű összefűzése, hanem egy logikai csoportokba rendezett, egységes struktúrájú QA dokumentáció. Ez biztosítja a konzisztenciát, elkerüli az átfedéseket, és könnyebben karbantartható, mint a release-enkénti szétszórt QA tervek.

### Mélység

A dokumentáció **tesztelő számára részletes** szinten készül. Minden teszt szcenárió tartalmazza az előfeltételeket, a konkrét lépéseket és az elvárt eredményeket. A cél, hogy egy tesztelő a dokumentáció alapján önállóan, további magyarázat nélkül el tudja végezni a tesztelést.

**Példa teszt szcenárió:**

```markdown
#### Scenario: Toggle task completion via context menu

**Preconditions:**
- App loaded with `context-menu` fixture (`http://localhost:5173/?fixture=context-menu`)
- At least one tile visible on the grid
- The tile is not in completed state

**Steps:**
1. Right-click on the tile
2. Verify the context menu appears at cursor position
3. Click "Marquer terminé"

**Expected Results:**
- [ ] Context menu closes after click
- [ ] Tile shows completed state:
  - Green gradient background from left
  - Completion icon changes from `circle` to `circle-check` (emerald color)
- [ ] Job's progress indicator updates in the sidebar
```

### Scope

A Manual QA Plan az alábbi területeket fedi le:

- **Frontend – Scheduler UI (M3):** A fő ütemező felület, beleértve a grid navigációt, drag & drop műveleteket, pick & place funkciót, validációs visszajelzéseket és egyéb interakciókat.
- **Frontend – Job Creation Form (M4):** A munka létrehozási űrlap, beleértve az Elements táblát, autocomplete mezőket, template kezelést és validációt.
- **Backend API (M1 + M2):** A Station Management, Job Management és Scheduling API végpontok.

---

## 3. Folder struktúra

```
docs/qa/
├── feature-catalog-planning.md    # Feature katalógus készítés terve
├── manual-qa-planning.md          # Ez a dokumentum (QA plan készítés terve)
├── manual-qa-plan.md              # Fő QA dokumentum (index + közös setup)
├── scheduler/                      # M3 - Scheduler UI feature-ök
│   ├── grid-navigation.md
│   ├── drag-drop.md
│   ├── pick-place.md
│   ├── validation-feedback.md
│   └── ...
├── jcf/                           # M4 - Job Creation Form feature-ök
│   ├── elements-table.md
│   ├── autocomplete-fields.md
│   ├── templates.md
│   └── ...
└── api/                           # M1-M2 - Backend API
    ├── station-management.md
    ├── job-management.md
    ├── scheduling.md
    └── postman/
        ├── flux-api.postman_collection.json
        └── flux-api.postman_environment.json
```

---

## 4. Tartalmi elemek (minden feature-höz)

Minden Manual QA dokumentum az alábbi szekciókat tartalmazza:

### 4.1 Feature Overview

- User Story (részletes leírás)
- Acceptance Criteria

### 4.2 Test Fixtures

- Milyen fixture-rel tesztelhető
- Fixture URL és rövid leírás

**Formátum:**
```markdown
| Fixture | URL | Leírás |
|---------|-----|--------|
| `context-menu` | `?fixture=context-menu` | Multiple tiles on a station for swap testing |
```

### 4.3 Test Scenarios

Minden szcenárióhoz:
- **Preconditions** – előfeltételek
- **Steps** – konkrét lépések
- **Expected Results** – elvárt eredmények (checkbox formátumban)

### 4.4 Visual Checklist

- UI elemek kinézete
- Színek, méretek, elrendezés

### 4.5 Edge Cases

- Szélső esetek
- Error állapotok
- Üres állapotok

### 4.6 Cross-feature Interactions

- Más feature-ökkel való interakció
- Integrációs pontok

---

## 5. Fő dokumentum szekciói

A `manual-qa-plan.md` fő dokumentum az alábbi plusz szekciókat tartalmazza:

| Szekció | Leírás |
|---------|--------|
| **Index** | Linkek az összes feature QA dokumentumra |
| **Regression Test Suite** | Kritikus happy path-ok gyűjteménye |
| **Smoke Test Checklist** | 5-10 perc alatt lefuttatható alapvető tesztek |
| **Browser Matrix** | Támogatott böngészők |

---

## 6. Lezárt kérdések

### Fixture dokumentáció

**Döntés:** Közepes mélység – Név, URL, rövid leírás (mit tartalmaz)

### Browser mátrix

**Döntés:** Desktop only

| Böngésző | Verzió | Prioritás |
|----------|--------|-----------|
| Chrome | Latest | P1 |
| Firefox | Latest | P1 |
| Safari | Latest (macOS) | P2 |

> **Megjegyzés:** Mobile/tablet nem scope, desktop-first alkalmazás.

### API tesztelés eszközei

**Döntés:** Mindkettő – Markdown (curl példák) + Postman collection

---

## 7. Munkafolyamat

A Manual QA Plan elkészítése a Feature Katalógus véglegesítése után kezdődik.

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Feature Katalógus elkészítése                               │
│     (lásd: feature-catalog-planning.md)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Manual QA dokumentumok elkészítése                          │
│     - Feature-kategóriánként (scheduler, jcf, api)              │
│     - Részletes teszt szcenáriók                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Fő dokumentum összeállítása                                 │
│     - Index                                                     │
│     - Smoke test checklist                                      │
│     - Regression suite                                          │
└─────────────────────────────────────────────────────────────────┘
```

