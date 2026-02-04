# Feature Catalog Planning

> **Status:** Planning
>
> **Created:** 2026-02-03
>
> **Purpose:** Ez a dokumentum rögzíti a Feature Katalógus elkészítésének tervezési döntéseit és megközelítését.

---

## 1. Célkitűzés

A Manual QA Plan elkészítése előtt szükség van egy **Feature Katalógusra**, amely az alkalmazás összes aktív feature-jét tartalmazza. A katalógus a "Single Source of Truth" a feature-ökről, és a Manual QA Plan ebből származik.

A Feature Katalógus más célokra is használható:
- Onboarding dokumentáció
- Product overview
- Release notes generálás

---

## 2. Feature Katalógus struktúra

**Hely:** `docs/features/feature-catalog.md`

| Mező | Leírás |
|------|--------|
| Feature ID | Egyedi azonosító (pl. `SCHED-001`, `JCF-015`, `API-003`) |
| Feature név | Rövid, leíró név |
| Leírás | Capability formátum (lásd alább) |
| Státusz | `Active` / `Suspicious` / `Deprecated` |
| Release verzió | Melyik verzióban került be |
| QA dokumentum | Link a kapcsolódó QA dokumentumra |

---

## 3. Feature leírás formátum

A feature-ök leírására **kétszintű megközelítést** alkalmazunk.

### Katalógus szint (gyors áttekintés)

**Formátum:** Capability – 1 rövid mondat, max 10-15 szó

**Cél:** Gyorsan átlátható lista, scannable

**Példa:**
```markdown
| ID | Feature | Leírás |
|----|---------|--------|
| SCHED-012 | Context Menu | Right-click context menu on tiles (view details, toggle completion, swap position) |
| JCF-008 | Papier Autocomplete | Two-step paper selection: type first, then grammage |
```

### QA dokumentum szint (részletes)

**Formátum:** User Story + Acceptance Criteria

**Cél:** Tesztelő pontosan értse, mit és miért tesztel

**Példa:**
```markdown
## Feature: Context Menu

### User Story

As a scheduler, I want to right-click on a tile to access common actions,
so that I can quickly view details, mark completion, or reorder tiles
without using drag & drop.

### Acceptance Criteria

- [ ] Right-click opens menu at cursor position
- [ ] Menu shows: Voir détails, Marquer terminé, Déplacer vers le haut/bas
- [ ] Menu closes on click outside / ESC / scroll
- [ ] Move up/down disabled if no adjacent tile exists
```

---

## 4. Input források

A Feature Katalógus elkészítéséhez az alábbi forrásokat használjuk:

### 4.1 Release dokumentumok

- **Hely:** `docs/releases/v*.md`
- **Tartalom:** Feature leírások, Manual QA tervek, scope definíciók
- **Megjegyzés:** 91 release dokumentum tartalmaz Manual QA szekciót

### 4.2 Playwright E2E tesztek

- **Hely:** `apps/web/playwright/*.spec.ts`
- **Tartalom:** Automatizált teszt szcenáriók
- **Felhasználás:** Feature létezésének ellenőrzése, teszt szcenáriók azonosítása

---

## 5. Deprecated feature-ök kezelése

Későbbi release-ek felülírhatják a korábbi feature-öket. A deprecated feature-öket a katalógusban `Deprecated` státusszal jelöljük, és **nem** kerülnek be a Manual QA Plan-be.

### Azonosítási módszerek

| Módszer | Leírás | Megbízhatóság |
|---------|--------|---------------|
| **Kód ellenőrzés** | A komponens/fájl létezik-e még a kódbázisban? | Magas |
| **Playwright teszt** | Van-e aktív E2E teszt a feature-re? | Közepes |
| **Későbbi release doc** | Említi-e egy későbbi release, hogy felülírta/törölte? | Közepes |
| **"Out of Scope" szekciók** | Későbbi release explicit kizárja? | Alacsony |
| **User review** | Felhasználó jelzi a review során | Magas |

### Ellenőrzési workflow (minden feature-nél)

```
Feature azonosítva (release doc-ból)
         │
         ▼
┌────────────────────────────────┐
│ 1. Létezik a komponens/fájl?   │ ──No──→ DEPRECATED
└────────────────────────────────┘
         │ Yes
         ▼
┌────────────────────────────────┐
│ 2. Van aktív Playwright teszt? │ ──No──→ ⚠️ SUSPICIOUS
└────────────────────────────────┘
         │ Yes
         ▼
┌────────────────────────────────┐
│ 3. Későbbi release felülírta?  │ ──Yes─→ DEPRECATED
└────────────────────────────────┘
         │ No
         ▼
      ✅ ACTIVE
```

### Státuszok

| Státusz | Jelentés | Bekerül a QA Plan-be? |
|---------|----------|----------------------|
| `Active` | Működő, tesztelt feature | ✅ Igen |
| `Suspicious` | Gyanús (nincs teszt, de kód létezik) | ⚠️ Review után döntés |
| `Deprecated` | Felülírt vagy eltávolított | ❌ Nem |

---

## 6. Munkafolyamat

### Granularitás: Hibrid megközelítés

A Feature Katalógus elkészítése **Phase-alapú**, de a nagy phase-eket **tovább bontjuk** (~10-15 release / batch).

### Batch-ek

| Batch | Phase | Fókusz | Release-ek | Méret |
|-------|-------|--------|------------|-------|
| **B1** | 1A | Station Management API | v0.1.0 - v0.1.7 | 8 |
| **B2** | 1B | Job Management API | v0.1.9 - v0.1.19 | 11 |
| **B3** | 2B + 2C | Validation & Assignment API | v0.2.7 - v0.2.18 | 12 |
| **B4** | 3A + 3B + 3C | Mock Data, Layout, Grid | v0.3.0 - v0.3.10 | 11 |
| **B5** | 3D-3F | Drag & Drop alapok | v0.3.11 - v0.3.20 | 10 |
| **B6** | 3G-3H | Station compact, Fixes | v0.3.21 - v0.3.33 | 13 |
| **B7** | 3I-3J | Navigation, Layout, UX | v0.3.34 - v0.3.46 | 13 |
| **B8** | 3K-3L | DateStrip, Validation, Pick&Place | v0.3.47 - v0.3.60 | 14 |
| **B9** | 4A-4C | Element layer, JCF alapok | v0.4.0 - v0.4.12 | ~12 |
| **B10** | 4D-4F | JCF Autocomplete fields | v0.4.13 - v0.4.24 | ~12 |
| **B11** | 4G-4H | JCF Validation, Templates, API | v0.4.25 - v0.4.40 | ~12 |

> **Megjegyzés:** A batch határok finomíthatók a tényleges review során.

### Workflow (batch-enként)

```
┌────────────────────────────────────────────────────────────────┐
│  Batch N feldolgozása                                          │
├────────────────────────────────────────────────────────────────┤
│  1. Release dokumentumok átnézése (adott batch)                │
│  2. Playwright tesztek átnézése (kapcsolódó)                   │
│  3. Feature lista draft elkészítése                            │
│  4. Deprecated feature-ök azonosítása                          │
├────────────────────────────────────────────────────────────────┤
│  → USER REVIEW                                                 │
│    - Hiányzik valami?                                          │
│    - Helyesek a feature leírások?                              │
│    - Van deprecated amit nem vettem észre?                     │
├────────────────────────────────────────────────────────────────┤
│  5. Batch véglegesítés → Feature Katalógusba                   │
│  → Következő batch                                             │
└────────────────────────────────────────────────────────────────┘
```

