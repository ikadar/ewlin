# Job JSON Format — API Reference

This document describes the JSON format expected by the `POST /api/v1/jobs` endpoint for creating jobs in the Flux Scheduler system.

---

## Full Example

```json
{
  "reference": "ORD-2024-0142-A",
  "client": "Éditions Gallimard",
  "description": "Product catalog 48 pages",
  "workshopExitDate": "2026-04-15",
  "quantity": 5000,
  "status": "planned",
  "shipperId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requiredJobReferences": ["ORD-2024-0141"],
  "elements": [
    {
      "name": "COUV",
      "label": "A4 | 4p | Couché mat:135",
      "sequence": "G37(20+40)\nP137(10+5)\nStahl(15+30)",
      "prerequisiteNames": [],
      "format": "A4",
      "papier": "Couché mat:135",
      "pagination": 4,
      "quantite": 5000,
      "imposition": "50x70(8)",
      "impression": "Q/Q",
      "surfacage": "mat/mat",
      "autres": "Pantone 186C spot color",
      "qteFeuilles": 625,
      "commentaires": "Client requires exact Pantone match"
    },
    {
      "name": "INT",
      "label": "A4 | 48p | Offset:80",
      "sequence": "G37(15+60)\nP137(10+5)\nStahl(10+45)\nH(10+20)",
      "prerequisiteNames": ["COUV"],
      "format": "A4",
      "papier": "Offset:80",
      "pagination": 48,
      "quantite": 5000,
      "imposition": "65x90(16)",
      "impression": "Q/Q",
      "qteFeuilles": 940
    }
  ]
}
```

---

## Job-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reference` | `string` | **Yes** | Order reference. Max 100 characters. |
| `client` | `string` | **Yes** | Customer name. Max 100 characters. |
| `description` | `string` | **Yes** | Product description (title of the job). |
| `workshopExitDate` | `string` | **Yes** | Deadline — date the job must leave the factory. Format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. |
| `status` | `string` | No | Initial status. Default: `"draft"`. See [Status Values](#status-values). |
| `quantity` | `integer` | No | Total print run quantity (finished products). Must be >= 0. |
| `shipperId` | `string` | No | UUID of the shipper (transporteur). Must be a valid UUID if provided. |
| `elements` | `array` | No | Array of element objects for multi-element jobs. See [Element Fields](#element-fields). |
| `tasksDsl` | `string` | No | Task DSL string for single-element jobs. Mutually exclusive with `elements` — if both are provided, `elements` takes precedence. See [Task DSL](#task-dsl-syntax). |
| `requiredJobReferences` | `string[]` | No | Array of job reference strings that this job depends on. Backend resolves references to IDs and validates existence + no circular dependencies. |

### Status Values

| Value | Description |
|-------|-------------|
| `"draft"` | Default. Job is still being defined — visible on the scheduler grid but **hidden from the Flux production flow page**. |
| `"planned"` | Job is ready for production — visible everywhere. **Use this when importing fully-defined jobs.** |
| `"in_progress"` | Job is currently being produced. |
| `"delayed"` | Job is behind schedule. |
| `"completed"` | Job is finished. |
| `"cancelled"` | Job has been cancelled. |

---

## Element Fields

Each object in the `elements` array represents one production element (e.g., cover, interior, insert).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | **Yes** | Short identifier. Max 20 characters. Examples: `"COUV"`, `"INT"`, `"ELT"`, `"INSERT"`. |
| `label` | `string` | No | Display label. Max 100 characters. Format: `"format \| pagination \| papier"`. Example: `"A4 \| 4p \| Couché mat:135"`. Used as fallback when `spec` fields are not stored. |
| `sequence` | `string` | No | Task DSL for this element's production sequence. See [Task DSL](#task-dsl-syntax). |
| `prerequisiteNames` | `string[]` | No | Names of other elements in the same job that must be completed first. Default: `[]`. |
| `format` | `string` | No | Product format. See [Format Values](#format-product-format). |
| `papier` | `string` | No | Paper type and grammage. See [Papier Values](#papier-paper-type). |
| `pagination` | `integer` | No | Page count. Must be **2** (feuillet) or a **multiple of 4** (cahier). See [Pagination](#pagination-page-count). |
| `quantite` | `integer` | No | Element-level quantity multiplier. |
| `imposition` | `string` | No | Sheet imposition. See [Imposition Values](#imposition-sheet-format). |
| `impression` | `string` | No | Printing specification. See [Impression Values](#impression-printing-spec). |
| `surfacage` | `string` | No | Finishing/coating. See [Surfacage Values](#surfacage-finishingcoating). |
| `autres` | `string` | No | Free-text production notes. |
| `qteFeuilles` | `integer` | No | Sheet quantity (typically calculated from quantity + imposition). |
| `commentaires` | `string` | No | Free-text comments. |

---

## Authorized Values

### `format` — Product Format

**ISO standard names** or **custom dimensions** in `WxH` mm.

Suffix variants:
- *(none)* — open format (à plat)
- `f` — closed format (fermé)
- `fi` — closed landscape format (fermé italienne)

**A-series:**

| Name | Dimensions (mm) |
|------|-----------------|
| A1 | 594 × 841 |
| A2 | 420 × 594 |
| A3 | 297 × 420 |
| A4 / A4f / A4fi | 210 × 297 |
| A5 / A5f / A5fi | 148 × 210 |
| A6 / A6f / A6fi | 105 × 148 |
| A7 | 74 × 105 |
| A8 | 52 × 74 |
| A9 | 37 × 52 |
| A10 | 26 × 37 |

**B-series:**

| Name | Dimensions (mm) |
|------|-----------------|
| B1 | 707 × 1000 |
| B2 | 500 × 707 |
| B3 | 353 × 500 |
| B4 / B4f / B4fi | 250 × 353 |
| B5 / B5f / B5fi | 176 × 250 |
| B6 / B6f / B6fi | 125 × 176 |
| B7 | 88 × 125 |
| B8 | 62 × 88 |
| B9 | 44 × 62 |
| B10 | 31 × 44 |

**SRA-series:**

| Name | Dimensions (mm) |
|------|-----------------|
| SRA1 | 640 × 900 |
| SRA2 | 450 × 640 |
| SRA3 | 320 × 450 |
| SRA4 | 225 × 320 |

**Custom dimensions:** `"210x297"` (width × height in mm)

---

### `papier` — Paper Type

**Format:** `Type:Grammage` (e.g., `"Couché mat:135"`)

**Standard paper types** (grammages: 60, 70, 80, 90, 100, 115, 130, 135, 150, 170, 200, 250, 300, 320, 350, 400 g/m²):

| Type | Example |
|------|---------|
| `Couché mat` | `"Couché mat:135"` |
| `Couché satin` | `"Couché satin:150"` |
| `Couché brillant` | `"Couché brillant:200"` |
| `Offset` | `"Offset:80"` |
| `Laser` | `"Laser:100"` |

**Autocopiant types** (grammages: 50, 55, 60, 80 g/m² only):

| Type | Example |
|------|---------|
| `Autocopiant` | `"Autocopiant:60"` |
| `Autocopiant CB blanc` | `"Autocopiant CB blanc:55"` |
| `Autocopiant CFB rose` | `"Autocopiant CFB rose:60"` |
| `Autocopiant CF jaune` | `"Autocopiant CF jaune:80"` |

---

### `pagination` — Page Count

Must be **2** (feuillet / single sheet) or a **multiple of 4** (cahier / booklet signature).

Valid: `2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, ...`
Invalid: `1, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, ...`

---

### `imposition` — Sheet Format

**Format:** `LxH(poses)` — sheet dimensions in cm followed by number of poses in parentheses.

Poses must be a **power of 2**: 1, 2, 4, 8, 16, 32, 64, 128.

**Authorized sheet formats:**

| Format | Example |
|--------|---------|
| `32x45` | `"32x45(4)"` |
| `45x64` | `"45x64(8)"` |
| `50x70` | `"50x70(8)"` |
| `52x72` | `"52x72(8)"` |
| `54x74` | `"54x74(16)"` |
| `63x88` | `"63x88(16)"` |
| `64x90` | `"64x90(16)"` |
| `65x90` | `"65x90(16)"` |
| `65x92` | `"65x92(16)"` |
| `70x100` | `"70x100(32)"` |

---

### `impression` — Printing Spec

**Format:** `recto/verso` — must contain `/`.

| Value | Description |
|-------|-------------|
| `Q/Q` | Quadri recto/verso |
| `Q/` | Quadri recto only |
| `Q+V/Q+V` | Quadri + Vernis recto/verso |
| `Q+V/Q` | Quadri + Vernis recto, Quadri verso |
| `Q+V/` | Quadri + Vernis recto only |
| `N/N` | Noir (black) recto/verso |
| `N/` | Noir recto only |
| `Q/N` | Quadri recto, Noir verso |
| `N/Q` | Noir recto, Quadri verso |

Custom values are accepted as long as they contain `/`.

---

### `surfacage` — Finishing/Coating

**Format:** `recto/verso` — must contain `/`.

| Value | Description |
|-------|-------------|
| `mat/mat` | Pelliculage mat recto/verso |
| `satin/satin` | Pelliculage satin recto/verso |
| `brillant/brillant` | Pelliculage brillant recto/verso |
| `UV/UV` | Vernis UV recto/verso |
| `dorure/dorure` | Dorure (gilding) recto/verso |
| `mat/` | Pelliculage mat recto only |
| `satin/` | Pelliculage satin recto only |
| `brillant/` | Pelliculage brillant recto only |
| `UV/` | Vernis UV recto only |
| `dorure/` | Dorure recto only |

Custom values are accepted as long as they contain `/`.

---

## Task DSL Syntax

The `sequence` and `tasksDsl` fields use a compact text DSL where each line defines one task. Lines can also be separated by `|` (pipe). Empty lines are ignored. Lines starting with `#` are comments.

### Internal Task (performed on a station)

```
StationName(setup+run)
StationName(run)
```

- `StationName` — Station name (use underscores for spaces, e.g., `Komori_G37`).
- `(setup+run)` — Setup time + run time in minutes (e.g., `(20+40)`).
- `(run)` — Run time only, setup defaults to 0 (e.g., `(35)`).

### Outsourced Task (performed by external provider)

```
ST:ProviderName(Nj):description
```

- `ST:` — Literal prefix indicating outsourced (sous-traité) task.
- `ProviderName` — Provider name (use underscores for spaces).
- `(Nj)` — Duration in open/business days (jours ouvrés). E.g., `(2j)`, `(3j)`.
- `:description` — Action type / description (required). E.g., `:pelliculage`, `:dos carré collé`.

### Authorized Station Names (postes)

| Name | Category |
|------|----------|
| `G37` | Presse offset |
| `754` | Presse offset |
| `GTO` | Presse offset |
| `C9500` | Presse numérique |
| `P137` | Massicot |
| `VM` | Massicot |
| `SBG` | Typo |
| `SBB` | Typo |
| `Stahl` | Plieuse |
| `MBO` | Plieuse |
| `Horizon` | Plieuse |
| `H` | Encarteuse-piqueuse |
| `Duplo10` | Assembleuse-piqueuse |
| `Duplo20` | Assembleuse-piqueuse |
| `Carton` | Conditionnement |
| `Film` | Conditionnement |

### Authorized Provider Names (sous-traitants)

| Name |
|------|
| `MCA` |
| `F37` |
| `LGI` |
| `AVN` |
| `JF` |

### Task DSL Examples

```
# Internal tasks
G37(20+40)
P137(15+5)
Stahl(15+30)
Carton(15)

# Outsourced tasks
ST:MCA(2j):pelliculage
ST:LGI(3j):dorure
ST:F37(4j):reliure dos carré collé
```

Multi-line sequence in JSON (newline or pipe separated):

```json
"sequence": "G37(20+40)\nP137(15+5)\nStahl(15+30)"
```

---

## Minimal Examples

### Single-element job (using `tasksDsl`)

```json
{
  "reference": "ORD-001",
  "client": "La Poste",
  "description": "Simple flyer A5",
  "workshopExitDate": "2026-04-01",
  "tasksDsl": "G37(15+30)\nP137(5+10)"
}
```

### Multi-element job (using `elements`)

```json
{
  "reference": "ORD-002",
  "client": "Hachette Livre",
  "description": "Brochure with cover",
  "workshopExitDate": "2026-04-10",
  "status": "planned",
  "quantity": 3000,
  "elements": [
    {
      "name": "COUV",
      "sequence": "G37(20+40)\nP137(10+5)\nStahl(10+25)",
      "format": "A4",
      "papier": "Couché mat:135",
      "pagination": 4,
      "imposition": "50x70(8)",
      "impression": "Q/Q",
      "surfacage": "mat/mat"
    },
    {
      "name": "INT",
      "sequence": "G37(15+60)\nP137(10+5)\nStahl(10+45)\nH(10+20)",
      "prerequisiteNames": ["COUV"],
      "format": "A4",
      "papier": "Offset:80",
      "pagination": 48,
      "imposition": "65x90(16)",
      "impression": "Q/Q"
    }
  ]
}
```

### Job with outsourced tasks

```json
{
  "reference": "ORD-003",
  "client": "Publicis France",
  "description": "Premium brochure with gilding",
  "workshopExitDate": "2026-04-20",
  "quantity": 1000,
  "elements": [
    {
      "name": "ELT",
      "sequence": "G37(25+50)\nP137(10+5)\nST:LGI(3j):dorure\nStahl(10+20)\nFilm(10+15)",
      "format": "A4f",
      "papier": "Couché brillant:250",
      "pagination": 12,
      "imposition": "50x70(4)",
      "impression": "Q+V/Q+V",
      "surfacage": "brillant/brillant"
    }
  ]
}
```

### Job with dependencies on other jobs

```json
{
  "reference": "ORD-004-B",
  "client": "Carrefour Marketing",
  "description": "Box (requires insert from ORD-004-A)",
  "workshopExitDate": "2026-04-25",
  "requiredJobReferences": ["ORD-004-A"],
  "elements": [
    {
      "name": "BOX",
      "sequence": "SBG(30+90)\nP137(10+10)\nCarton(10+20)"
    }
  ]
}
```

---

## Validation Rules

The backend enforces these constraints:

**Job level:**
- `reference`, `client`, `description`, `workshopExitDate` are **required** and must not be blank.
- `reference` and `client` max **100 characters**.
- `workshopExitDate` must match `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`.
- `status` must be one of the 6 allowed values (defaults to `"draft"`).
- `quantity` must be >= 0 if provided.
- `shipperId` must be a valid UUID if provided.
- `requiredJobReferences` entries must reference existing jobs; circular dependencies are rejected.

**Element level:**
- `name` is **required**, max **20 characters**.
- `label` max **100 characters**.
- Each entry in `prerequisiteNames` must be non-blank, max 20 characters, and must match the `name` of another element in the same job.

**Spec field formats:**
- `papier` must contain `:` separator (e.g., `"Couché mat:135"`).
- `impression` must contain `/` separator (e.g., `"Q/Q"`).
- `surfacage` must contain `/` separator (e.g., `"mat/mat"`).
- `imposition` must contain poses in parentheses (e.g., `"50x70(8)"`). Poses must be a power of 2.
- `pagination` must be 2 or a multiple of 4.

**Task DSL:**
- Station names must exist in the system.
- Provider names must exist in the system.
- Duration values must be positive integers.
- Outsourced duration must end with `JO` suffix.
