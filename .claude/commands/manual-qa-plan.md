---
description: Manual QA dokumentum generálása feature csoporthoz
---

# Manual QA Plan: $ARGUMENTS

Generálj Manual QA dokumentumot a megadott feature csoporthoz.

## Elérhető QA csoportok

Olvasd be a `docs/features/feature-catalog.md` dokumentumot a QA Document Mapping szekcióból:

| QA Csoport | Batch-ek | Output fájl |
|------------|----------|-------------|
| `station-management` | B1 | `api/station-management.md` |
| `job-management` | B2 | `api/job-management.md` |
| `scheduling` | B3 | `api/scheduling.md` |
| `layout-grid` | B4 | `scheduler/layout-grid.md` |
| `drag-drop` | B5, B6 | `scheduler/drag-drop.md` |
| `navigation-ux` | B7 | `scheduler/navigation-ux.md` |
| `datestrip-pickplace` | B8 | `scheduler/datestrip-pickplace.md` |
| `elements-table` | B9 | `jcf/elements-table.md` |
| `autocomplete` | B10 | `jcf/autocomplete.md` |
| `validation-templates` | B11 | `jcf/validation-templates.md` |

---

## Workflow

### 1. FÁZIS: Input összegyűjtése

1. **Azonosítsd a QA csoportot** az argumentumból
2. **Olvasd be a kapcsolódó batch-eket** a Feature Katalógusból (`docs/features/feature-catalog.md`)
3. **Olvasd be a releváns release dokumentumokat** (`docs/releases/v*.md`)
   - Különös tekintettel a Manual QA és Testing szekciókra
4. **Olvasd be a kapcsolódó Playwright teszteket** (`apps/web/playwright/*.spec.ts`)
   - Ezekből származnak a teszt szcenáriók

---

### 2. FÁZIS: QA dokumentum struktúra

Készítsd el a dokumentumot az alábbi struktúrában:

```markdown
# {Feature Csoport Név} - Manual QA Plan

> **Last Updated:** {dátum}
>
> **Related Features:** {Feature ID lista a katalógusból}
>
> **Fixtures:** {Kapcsolódó fixture-ök listája}

---

## Overview

{Rövid leírás a feature csoportról és a tesztelés céljáról}

---

## Test Fixtures

| Fixture | URL | Leírás |
|---------|-----|--------|
| `{fixture-name}` | `?fixture={name}` | {Mit tartalmaz} |

---

## Test Scenarios

### {Feature ID} - {Feature Név}

#### Scenario: {Szcenárió neve}

**Preconditions:**
- {Előfeltétel 1}
- {Előfeltétel 2}

**Steps:**
1. {Lépés 1}
2. {Lépés 2}
3. {Lépés 3}

**Expected Results:**
- [ ] {Elvárt eredmény 1}
- [ ] {Elvárt eredmény 2}

---

## Visual Checklist

- [ ] {UI elem 1 - kinézet, szín, méret}
- [ ] {UI elem 2 - kinézet, szín, méret}

---

## Edge Cases

| Eset | Elvárt viselkedés |
|------|-------------------|
| {Edge case 1} | {Viselkedés} |
| {Edge case 2} | {Viselkedés} |

---

## Cross-feature Interactions

| Kapcsolódó feature | Interakció típusa |
|--------------------|-------------------|
| {Feature ID} | {Leírás} |
```

---

### 3. FÁZIS: User review

**STOP – Mutasd be a QA dokumentum draft-ot és VÁRD MEG a jóváhagyást!**

Kérdezd meg:
- Hiányzik teszt szcenárió?
- Helyesek az expected results?
- Van edge case amit nem vettem észre?

---

### 4. FÁZIS: Dokumentum mentése

Csak a jóváhagyás után!

1. **Hozd létre a fájlt:** `docs/qa/{output-fájl}` (a mapping alapján)
2. **Frissítsd a fő dokumentumot** (`docs/qa/manual-qa-plan.md`) ha létezik

---

## Teszt szcenárió írási útmutató

### Preconditions
- Mindig add meg a fixture URL-t
- Írd le az alkalmazás kezdő állapotát
- Sorold fel az előfeltételeket (pl. "At least one tile visible")

### Steps
- Konkrét, végrehajtható lépések
- Használj pontos UI elemneveket
- Kerüld az általános utasításokat ("kattints valahova")

### Expected Results
- Checkbox formátumban (`- [ ]`)
- Specifikus, ellenőrizhető eredmények
- Vizuális visszajelzések részletesen (szín, ikon, animáció)

### Példa:

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

---

## Output

A feldolgozás végén mutasd be:

1. **Összefoglaló:**
   - Feldolgozott feature-ök száma
   - Generált teszt szcenáriók száma
   - Edge case-ek száma

2. **Draft dokumentum** (a 2. fázisban leírt struktúrában)
