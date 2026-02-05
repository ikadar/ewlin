# Mock Data Guidelines

> **Status:** Draft
> **Last updated:** 2026-02-04
> **Sources:** Git history, release docs, existing code

---

## General Principles

Mock data must be **realistic** and reflect the context of a real French print shop. The goal is to enable UI development that is faithful to real-world use cases.

---

## 1. Stations and Equipment

### Categories and Groups (1:1 mapping)

Categories map to groups. Each group contains real machines:

| Category | Group | Stations |
|----------|-------|----------|
| Presse offset | grp-offset | G37, 754, GTO |
| Presse numérique | grp-digital | C9500 |
| Massicot | grp-cutting | P137, VM |
| Typo | grp-typo | SBG, SBB |
| Plieuse | grp-folding | Stahl, MBO, Horizon |
| Encarteuse-piqueuse | grp-saddle-stitch | H |
| Assembleuse-piqueuse | grp-booklet | Duplo10, Duplo20 |
| Conditionnement | grp-packaging | Carton, Film |

### Outsourced Providers

| Provider | Actions |
|----------|---------|
| Clément | Reliure dos carré collé, Dorure, Vernis UV |
| Faco37 | Reliure dos carré collé, Pelliculage |

**Source:** Commit `7a0c028` - "Update station mock data with real equipment"

---

## 2. Jobs and Descriptions

### Description Format

Pattern: `{Product type} - {Format} - {Paper} - {Quantity}`

**Realistic examples:**
- "Cartes de voeux - 9,9 x 21 cm - off 350g - 350 ex"
- "Brochures A4 - CB 135g - 1000 ex"
- "Affiches A2 - brillant - 500 ex"
- "Dépliants 3 volets"
- "Catalogues 48 pages"
- "Flyers A5 - recto/verso"
- "Calendriers muraux"
- "Chemises à rabats"
- "Enveloppes personnalisées"
- "Carnets de bons"

**Source:** `docs/releases/v0.3.0-mock-data-generators.md`, `apps/web/src/mock/generators/jobs.ts`

---

## 3. Clients

### Client Name List

Use well-known French retail/company names:

typescript
const CLIENT_NAMES = [
'Autosphere',
'Carrefour',
'Décathlon',
'E.Leclerc',
'FNAC',
'Galeries Lafayette',
'Ikea',
'Leroy Merlin',
'Mairie de Paris',
'Orange',
];

**Source:** `apps/web/src/mock/generators/jobs.ts`

---

## 4. Paper and Substrates

### Paper Types

typescript
const PAPER_TYPES = [
'CB 135g',      // Couché brillant
'CB 300g',
'CB 350g',
'Couché mat 170g',
'Couché brillant 250g',
'Offset 80g',
'Kraft 120g',
];

### Paper Formats

typescript
const PAPER_FORMATS = [
'45x64',
'52x74',
'63x88',
'70x100',
'A4',
'A3',
'SRA3',
];

### Paper Weights

typescript
const PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350];

**Source:** `apps/web/src/mock/generators/jobs.ts`

---

## 5. Inking

typescript
const INKINGS = [
'CMYK',
'4C+0',
'4C+4C',
'2C+0',
'Pantone 485+Black',
'1C+0',
];

**Source:** `apps/web/src/mock/generators/jobs.ts`

---

## 6. Job Colors

Palette of 10 distinct colors to visually differentiate jobs:

typescript
const JOB_COLORS = [
'#3B82F6', // blue
'#8B5CF6', // violet
'#EC4899', // pink
'#F59E0B', // amber
'#10B981', // emerald
'#EF4444', // red
'#06B6D4', // cyan
'#84CC16', // lime
'#F97316', // orange
'#6366F1', // indigo
];

**Source:** `apps/web/src/mock/generators/jobs.ts`

---

## 7. Working Hours

### Schedule Types

| Type | Hours | Days |
|------|-------|------|
| standard | 8h-12h, 14h-18h | Mon-Fri |
| extended | 6h-22h | Mon-Sat |

**Source:** `apps/web/src/mock/generators/stations.ts`

---

## 8. Task Durations

Durations should be realistic for a print shop:

- **Offset printing**: 30min - 4h depending on run length
- **Digital printing**: 15min - 2h
- **Cutting (Massicotage)**: 15min - 1h
- **Folding (Pliage)**: 30min - 2h
- **Binding (Reliure)**: 1h - 4h
- **Outsourcing (Sous-traitance)**: 1-5 business days

---

## 9. ID Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Job | `job-{NNNNN}` | `job-00001` |
| Task | `task-{jobId}-{N}` | `task-job-00001-1` |
| Element | `elem-{jobId}-{code}` | `elem-job-00001-couv` |
| Station | `sta-{code}` | `sta-g37` |
| Category | `cat-{code}` | `cat-offset` |
| Group | `grp-{code}` | `grp-offset` |
| Provider | `prov-{name}` | `prov-clement` |

---

## 10. French Terminology

Always use **French print industry terminology**:

| English | French |
|---------|--------|
| Offset press | Presse offset |
| Digital press | Presse numérique |
| Cutter / Guillotine | Massicot |
| Folder | Plieuse |
| Saddle stitcher | Encarteuse-piqueuse |
| Perfect binder | Dos carré collé |
| Lamination | Pelliculage |
| Foil stamping | Dorure |
| Coated paper | Papier couché |

---

## 11. Production Routes

Typical production routes for common print products. Use these when building fixtures.

### Flyer (job simple, 1 élément)

```
Offset → Massicot → Conditionnement
```

### Dépliant (job simple, 1 élément)

```
Offset → Massicot → Plieuse → Conditionnement
```

### Brochure piquée (job multi-éléments, 4 éléments)

```
Element "couv" (Couverture) :    Offset → Massicot
Element "cah1" (Cahier 1) :      Offset → Plieuse
Element "cah2" (Cahier 2) :      Offset → Plieuse
Element "fin"  (Finalisation) :  Encarteuse-Piqueuse → Conditionnement
                                  prérequis: couv + cah1 + cah2
```

### Key rules

- Les cahiers vont **directement** de l'offset à la plieuse (PAS de massicot — on plie la feuille entière)
- Seule la couverture passe par le massicot (on coupe au format)
- La finalisation (encartage + conditionnement) attend que TOUS les éléments précédents soient terminés
- Séchage 4h entre offset et le poste suivant (règle BR-ELEM-005)
- Tous les éléments ne commencent pas par l'impression — l'élément "fin" commence par l'encarteuse

### Precedence rules

1. Le conditionnement est TOUJOURS la dernière opération interne
2. Séchage 4h après impression offset avant toute opération suivante
3. Un élément d'assemblage/finalisation n'a pas d'impression — il commence directement au poste d'assemblage

### Duration guidelines for fixtures

| Poste | Durée | Ratio | Exemples |
|---|---|---|---|
| Impression (offset) | 30min - 2h | Base | setup 15min + run 15min à 1h45 |
| Massicot | 15min ou 30min | Fixe, court | setup 5-10min + run 10-20min |
| Plieuse | 2× impression | Plus lent | Si impression = 1h → plieuse = 2h |
| Encarteuse-piqueuse | 3× impression | Le plus lent | Si impression = 1h → encarteuse = 3h |
| Conditionnement | 15min, 30min ou 45min | Fixe, court | setup 5-10min + run 10-35min |

---

## 12. Multi-Element Jobs

### When to use multi-element jobs

A job is multi-element when the finished product is **assembled from parts manufactured separately**. Canonical example: the saddle-stitched brochure.

### Reference pattern: Brochure piquée

```
Job "Brochure A4 - 16 pages - 1000 ex" (client: Carrefour)
│
├─ Element "couv" (Couverture)
│  ├─ Task 1: Offset (station-offset)      [setup: 15min, run: 45min] = 1h
│  └─ Task 2: Massicot (station-massicot)  [setup: 5min, run: 10min]  = 15min
│     (séchage 4h entre task 1 et task 2)
│
├─ Element "cah1" (Cahier 1)
│  ├─ Task 1: Offset (station-offset)      [setup: 15min, run: 45min] = 1h
│  └─ Task 2: Plieuse (station-plieuse)    [setup: 15min, run: 105min] = 2h (2× impression)
│     (séchage 4h entre task 1 et task 2)
│
├─ Element "cah2" (Cahier 2)
│  ├─ Task 1: Offset (station-offset)      [setup: 15min, run: 45min] = 1h
│  └─ Task 2: Plieuse (station-plieuse)    [setup: 15min, run: 105min] = 2h (2× impression)
│     (séchage 4h entre task 1 et task 2)
│
└─ Element "fin" (Finalisation)
   │  prerequisiteElementIds: [couv, cah1, cah2]
   │  (PAS d'impression — commence directement à l'encarteuse)
   ├─ Task 1: Encarteuse (station-encarteuse)       [setup: 15min, run: 165min] = 3h (3× impression)
   └─ Task 2: Conditionnement (station-conditionnement) [setup: 5min, run: 25min] = 30min
```

### Naming conventions

| Element name | Label | Usage |
|---|---|---|
| `couv` | Couverture | Partie couverture |
| `cah1`, `cah2`... | Cahier 1, Cahier 2... | Cahiers intérieurs |
| `fin` | Finalisation | Assemblage + conditionnement final |
| `ELT` | (élément unique) | Job simple, un seul élément |

### Prerequisites by element type

| Element | paperStatus | batStatus | plateStatus | formeStatus |
|---|---|---|---|---|
| Couverture (offset) | in_stock ou to_order | bat_sent→approved | to_make→ready | none |
| Cahier (offset) | in_stock ou to_order | bat_sent→approved | to_make→ready | none |
| Finalisation | none | none | none | none |

---

## Historical Changes

| Date | Commit | Description |
|------|--------|-------------|
| 2025-12-16 | `d077f30` | v0.3.0 - Initial Mock Data Generators |
| 2026-01-16 | `7a0c028` | Update to real equipment names |
| 2026-01-19 | `999fe42` | allAssigned mode, jobCount URL param |

---

## To Be Clarified

- [ ] Exact source of equipment names (G37, 754, C9500, etc.) - which print shop?
- [ ] Exhaustive list of clients to use
- [ ] Rules for generating job/order numbers