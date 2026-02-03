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

### FONTOS: Minden feature-nek kell teszt szcenárió!

**Egyetlen feature sem maradhat ki a QA dokumentumból!**

- A Feature Katalógusban szereplő MINDEN feature-hez tartoznia kell legalább egy teszt szcenáriónak
- Ha egy feature közvetlenül nem tesztelhető (pl. domain entity, enum, value object), akkor az API-n vagy UI-on keresztül **közvetetten** kell tesztelni
- Példa: `StationStatus Enum` → teszteld az API-n keresztül, hogy mind a 4 státusz érték elfogadott

### Preconditions
- Mindig add meg a fixture URL-t (UI) vagy az API base URL-t (API)
- Írd le az alkalmazás/rendszer kezdő állapotát
- Sorold fel az előfeltételeket (pl. "At least one tile visible" vagy "Station category exists")

### Steps
- Konkrét, végrehajtható lépések
- Használj pontos UI elemneveket vagy API endpoint URL-eket
- Kerüld az általános utasításokat ("kattints valahova")

### Expected Results
- Checkbox formátumban (`- [ ]`)
- Specifikus, ellenőrizhető eredmények
- Vizuális visszajelzések részletesen (szín, ikon, animáció) - UI esetén
- Response mezők és HTTP státusz kódok - API esetén

---

## API-specifikus teszt formátum

**API csoportoknál (station-management, job-management, scheduling) kötelező:**

### Request formátum
- HTTP method és teljes endpoint URL
- **Teljes JSON request payload** kódblokkal
- Query paraméterek ahol releváns

### Expected Results formátum
- HTTP státusz kód (pl. `201 Created`, `400 Bad Request`)
- **Response mezők ellenőrzése** checkboxokkal
- Error response struktúra ellenőrzése hiba esetén

### API teszt példa:

```markdown
### API-009 - DaySchedule Value Object

#### Scenario: Overlapping time slots rejected

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with overlapping slots:

\`\`\`json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "14:00"},
        {"start": "12:00", "end": "17:00"}
      ]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
\`\`\`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message mentions "overlap"
- [ ] Error details include day name ("monday")
```

---

## UI-specifikus teszt formátum

**UI csoportoknál (layout-grid, drag-drop, navigation-ux, stb.) kötelező:**

### UI teszt példa:

```markdown
### SCHED-045 - Context Menu Toggle Completion

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
