---
description: Feature katalógus batch feldolgozása
---

# Feature Catalog Batch: $ARGUMENTS

Dolgozd fel a megadott batch-et a Feature Katalógus készítéséhez.

---

## 0. FÁZIS: Fájl inicializálás (ha szükséges)

**ELŐSZÖR** ellenőrizd, hogy létezik-e a `docs/features/feature-catalog.md` fájl.

Ha **NEM létezik**, hozd létre az alábbi sablonnal:

````markdown
# Feature Catalog

> **Status:** In Progress
>
> **Last Updated:** {TODAY}
>
> **Purpose:** Single Source of Truth az alkalmazás összes aktív feature-jéről.

---

## Overview

Ez a dokumentum az alkalmazás összes aktív feature-jét tartalmazza, logikai csoportokba rendezve. A Manual QA Plan ebből a katalógusból származik.

### Státuszok

| Státusz | Jelentés |
|---------|----------|
| `Active` | Működő, tesztelt feature |
| `Suspicious` | Gyanús (nincs teszt, de kód létezik) - review szükséges |
| `Deprecated` | Felülírt vagy eltávolított - nem kerül a QA Plan-be |

### ID Prefixek

| Prefix | Terület |
|--------|---------|
| `API-` | Backend API (M1, M2) |
| `SCHED-` | Scheduler UI (M3) |
| `JCF-` | Job Creation Form (M4) |

---

## Backend API Features

### B1: Station Management API (v0.1.0 - v0.1.7)

*Pending - B1 batch feldolgozás után*

### B2: Job Management API (v0.1.9 - v0.1.19)

*Pending - B2 batch feldolgozás után*

### B3: Validation & Assignment API (v0.2.7 - v0.2.18)

*Pending - B3 batch feldolgozás után*

---

## Scheduler UI Features

### B4: Mock Data, Layout, Grid (v0.3.0 - v0.3.10)

*Pending - B4 batch feldolgozás után*

### B5: Drag & Drop Basics (v0.3.11 - v0.3.20)

*Pending - B5 batch feldolgozás után*

### B6: Station Compact, Fixes (v0.3.21 - v0.3.33)

*Pending - B6 batch feldolgozás után*

### B7: Navigation, Layout, UX (v0.3.34 - v0.3.46)

*Pending - B7 batch feldolgozás után*

### B8: DateStrip, Validation, Pick&Place (v0.3.47 - v0.3.60)

*Pending - B8 batch feldolgozás után*

---

## Job Creation Form Features

### B9: Element Layer, JCF Basics (v0.4.0 - v0.4.12)

*Pending - B9 batch feldolgozás után*

### B10: JCF Autocomplete Fields (v0.4.13 - v0.4.24)

*Pending - B10 batch feldolgozás után*

### B11: JCF Validation, Templates, API (v0.4.25 - v0.4.40)

*Pending - B11 batch feldolgozás után*

---

## QA Document Mapping

Ez a szekció definiálja, hogy a Feature Katalógus batch-ei hogyan képződnek le a Manual QA dokumentumokra. A `/manual-qa-plan` parancs ezt a mappinget használja.

| QA Csoport | Batch-ek | Output fájl | Leírás |
|------------|----------|-------------|--------|
| station-management | B1 | `api/station-management.md` | Station, Category, Group, Provider CRUD + Schedule API |
| job-management | B2 | `api/job-management.md` | Job, Task, Element, Comments API |
| scheduling | B3 | `api/scheduling.md` | Assignment, Validation, Conflict detection API |
| layout-grid | B4 | `scheduler/layout-grid.md` | Sidebar, Jobs List, Grid layout, Station columns |
| drag-drop | B5, B6 | `scheduler/drag-drop.md` | Drag & Drop, Validation feedback, Station compact view |
| navigation-ux | B7 | `scheduler/navigation-ux.md` | Keyboard navigation, Layout modes, UX improvements |
| datestrip-pickplace | B8 | `scheduler/datestrip-pickplace.md` | DateStrip, Pick & Place, Context menu |
| elements-table | B9 | `jcf/elements-table.md` | Element layer, JcfElementsTable, Row operations |
| autocomplete | B10 | `jcf/autocomplete.md` | JCF Autocomplete mezők (Papier, Imposition, etc.) |
| validation-templates | B11 | `jcf/validation-templates.md` | JCF Validation, Templates, JSON Editor |

**Megjegyzés:** A mapping finomítható a batch-ek feldolgozása során, ha az összevonás vagy szétbontás logikusabb struktúrát eredményez.

---

## Statistics

| Batch | Status | Features | Active | Suspicious | Deprecated |
|-------|--------|----------|--------|------------|------------|
| B1 | ⏳ Pending | - | - | - | - |
| B2 | ⏳ Pending | - | - | - | - |
| B3 | ⏳ Pending | - | - | - | - |
| B4 | ⏳ Pending | - | - | - | - |
| B5 | ⏳ Pending | - | - | - | - |
| B6 | ⏳ Pending | - | - | - | - |
| B7 | ⏳ Pending | - | - | - | - |
| B8 | ⏳ Pending | - | - | - | - |
| B9 | ⏳ Pending | - | - | - | - |
| B10 | ⏳ Pending | - | - | - | - |
| B11 | ⏳ Pending | - | - | - | - |
| **Total** | | **0** | **0** | **0** | **0** |
````

Ha **LÉTEZIK** a fájl, olvasd be és folytasd a következő fázissal.

---

## Batch információk

Olvasd be a `docs/qa/feature-catalog-planning.md` dokumentumot a batch-ek listájáért és a teljes workflow leírásáért.

| Batch | Phase | Fókusz | Release-ek |
|-------|-------|--------|------------|
| **B1** | 1A | Station Management API | v0.1.0 - v0.1.7 |
| **B2** | 1B | Job Management API | v0.1.9 - v0.1.19 |
| **B3** | 2B + 2C | Validation & Assignment API | v0.2.7 - v0.2.18 |
| **B4** | 3A + 3B + 3C | Mock Data, Layout, Grid | v0.3.0 - v0.3.10 |
| **B5** | 3D-3F | Drag & Drop alapok | v0.3.11 - v0.3.20 |
| **B6** | 3G-3H | Station compact, Fixes | v0.3.21 - v0.3.33 |
| **B7** | 3I-3J | Navigation, Layout, UX | v0.3.34 - v0.3.46 |
| **B8** | 3K-3L | DateStrip, Validation, Pick&Place | v0.3.47 - v0.3.60 |
| **B9** | 4A-4C | Element layer, JCF alapok | v0.4.0 - v0.4.12 |
| **B10** | 4D-4F | JCF Autocomplete fields | v0.4.13 - v0.4.24 |
| **B11** | 4G-4H | JCF Validation, Templates, API | v0.4.25 - v0.4.40 |

---

## Workflow

### 1. FÁZIS: Release dokumentumok átnézése

1. **Azonosítsd a batch release tartományát** a fenti táblázatból
2. **Olvasd be az összes release dokumentumot** a tartományban:
   - `docs/releases/v{VERSION}-*.md`
3. **Minden release-ből azonosítsd a feature-öket:**
   - Feature név
   - Rövid leírás (capability formátum, max 10-15 szó)
   - Release verzió

---

### 2. FÁZIS: Playwright tesztek átnézése

1. **Keresd meg a kapcsolódó E2E teszteket:**
   - `apps/web/playwright/*.spec.ts`
2. **Jegyzd fel, mely feature-ökhöz van teszt**

---

### 3. FÁZIS: Deprecated ellenőrzés (KÖTELEZŐ)

**FONTOS: Ez a fázis két lépésből áll, és MINDKETTŐ kötelező!**

---

#### 3A. Későbbi release-ek átvizsgálása (ELŐSZÖR!)

**MIELŐTT** bármilyen feature státuszt meghatároznál, keresd meg az ÖSSZES későbbi release-ben a deprecation jeleket:

```bash
# 1. Keress "removed", "replaced", "deprecated", "delete" kulcsszavakra
#    a batch UTÁNI összes release dokumentumban
grep -r -i -E "removed|replaced|deprecated|delete|replaces|removing" docs/releases/

# 2. Keress a batch fő témájára (pl. "drag", "dnd", "drop" a B5-nél)
grep -r -i "{batch_keywords}" docs/releases/v0.3.{later}*.md
```

**Dokumentáld az eredményt:**
- Mely későbbi release-ek említenek eltávolítást/cserét?
- Mi lett lecserélve és mire?

Ha találsz ilyet, **OLVASD EL** a teljes release dokumentumot!

---

#### 3B. Feature-enkénti ellenőrzés

Csak a 3A lépés után, minden feature-nél:

```
Feature azonosítva
         │
         ▼
┌─────────────────────────────────────────────┐
│ 1. A 3A-ban talált deprecation érinti?      │ ──Yes─→ DEPRECATED
└─────────────────────────────────────────────┘
         │ No
         ▼
┌─────────────────────────────────────────────┐
│ 2. Létezik a komponens/fájl a kódbázisban?  │ ──No──→ DEPRECATED
└─────────────────────────────────────────────┘
         │ Yes
         ▼
┌─────────────────────────────────────────────┐
│ 3. A kód TARTALMA is releváns?              │ ──No──→ DEPRECATED
│    (pl. @dnd-kit importok még léteznek?)    │
└─────────────────────────────────────────────┘
         │ Yes
         ▼
┌─────────────────────────────────────────────┐
│ 4. Van aktív Playwright/unit teszt?         │ ──No──→ ⚠️ SUSPICIOUS
└─────────────────────────────────────────────┘
         │ Yes
         ▼
      ✅ ACTIVE
```

---

#### Ellenőrzési módszerek részletesen

| Lépés | Mit kell csinálni | Eszköz |
|-------|-------------------|--------|
| 3A | Keresés MINDEN későbbi release-ben | `grep -r -i` a docs/releases/ mappában |
| 3B.1 | Deprecation lista ellenőrzése | Saját lista a 3A-ból |
| 3B.2 | Fájl létezés | `Glob` a komponens útvonalra |
| 3B.3 | Kód tartalom | `Grep` a specifikus importokra/osztályokra |
| 3B.4 | Teszt létezés | `Grep` a playwright/ és *.test.ts fájlokban |

---

#### Példa a 3A lépésre (B5 batch esetén)

```bash
# B5 = v0.3.11-v0.3.20, tehát keresünk v0.3.21+ release-ekben
grep -r -i -E "drag|drop|dnd" docs/releases/v0.3.{21..60}*.md
grep -r -i -E "removed|replaced|deprecated" docs/releases/v0.3.{21..60}*.md

# Ha találat: v0.3.57-pick-from-grid.md említi "Remove Drag & Drop"
# → OLVASD EL a teljes v0.3.57 dokumentumot!
```

---

### 4. FÁZIS: Feature lista összeállítása

Készítsd el a batch feature listáját az alábbi formátumban:

```markdown
## Batch {N} – {Fókusz}

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| {PREFIX}-001 | {Név} | {Capability leírás} | Active/Suspicious/Deprecated | v{X.Y.Z} |
| {PREFIX}-002 | {Név} | {Capability leírás} | Active | v{X.Y.Z} |
```

**ID prefix-ek:**
- `API-` – Backend API feature-ök (B1, B2, B3)
- `SCHED-` – Scheduler UI feature-ök (B4-B8)
- `JCF-` – Job Creation Form feature-ök (B9-B11)

---

### 5. FÁZIS: User review

**STOP – Mutasd be a feature listát és VÁRD MEG a jóváhagyást!**

Kérdezd meg:
- Hiányzik valami?
- Helyesek a feature leírások?
- Van deprecated amit nem vettem észre?

---

### 6. FÁZIS: Feature Katalógus frissítése

Csak a jóváhagyás után!

1. **Olvasd be a meglévő katalógust:** `docs/features/feature-catalog.md`

2. **Keresd meg a batch placeholder-ét** és cseréld le a feature táblázatra:
   ```
   *Pending - B{N} batch feldolgozás után*
   ```
   ↓
   ```markdown
   | ID | Feature | Leírás | Státusz | Release |
   |----|---------|--------|---------|---------|
   | ... | ... | ... | Active | v... |
   ```

3. **Ha vannak Deprecated feature-ök**, add hozzá külön szekcióban:
   ```markdown
   #### Deprecated Features (v{VERSION})

   | ID | Feature | Mi váltotta fel |
   |----|---------|-----------------|
   | ... | ... | ... |
   ```

4. **Frissítsd a Statistics táblát:**
   - Batch Status: `⏳ Pending` → `✅ Complete`
   - Features: összes feature szám
   - Active/Suspicious/Deprecated: bontás szerint
   - Total sor: összesítés frissítése

5. **Frissítsd a "Last Updated" dátumot** a fejlécben

---

## Output formátum

A batch feldolgozás végén mutasd be:

1. **3A Deprecation Scan eredménye (KÖTELEZŐ):**
   - Mely későbbi release-eket vizsgáltad?
   - Milyen kulcsszavakra kerestél?
   - **Találatok listája** (release + mit távolít el/cserél le)
   - Ha nincs találat: explicit írd ki "Nem található deprecation a későbbi release-ekben"

2. **Összefoglaló:**
   - Feldolgozott release-ek száma
   - Azonosított feature-ök száma
   - Active / Suspicious / Deprecated bontás

3. **Feature lista táblázat** (a 4. fázisban leírt formátumban)

4. **Deprecated feature-ök listája** (ha van):
   - Melyik későbbi release deprecálta?
   - Mi váltotta fel?

5. **Suspicious feature-ök listája** (ha van) – miért gyanús
