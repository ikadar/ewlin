# Flux Scheduler - JCF Autocomplete Fields Manual QA

> **Feature Group:** JCF Autocomplete Fields
> **Batch:** B10
> **Features:** JCF-055 – JCF-111 (57 Active)
> **Releases:** v0.4.13 – v0.4.24

---

## Overview

This document contains the Manual QA tests for the JCF (Job Creation Form) Autocomplete fields. The feature group covers the following main areas:

- **Field-Specific Autocompletes** - Format, Impression, Surfacage, Quantité, Pagination fields
- **Two-Step Autocompletes** - Papier (type→grammage), Imposition (format→poses), Precedences
- **Sequence Multi-line Editor** - Poste mode, ST mode, Workflow-guided suggestions
- **Validation & Calculated Fields** - Live DSL validation, Required field indicators, qteFeuilles auto-calculation

---

## Test Fixtures

| Fixture | URL | Description |
|---------|-----|-------------|
| `elements-table` | `?fixture=elements-table` | JCF modal with default element for grid layout testing |
| `test` | `?fixture=test` | Standard test data with multiple jobs |

---

## Test Scenarios

### AUTO-001: Format Autocomplete - ISO Formats

**Feature:** JCF-055, JCF-056 (JcfFormatAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Open JCF modal (`/job/new`)
2. Click on the "format" cell in Elements Table
3. Type "A4"
4. Select from suggestions
5. Click outside the field (blur)

**Expected Results:**
- [ ] ISO format suggestions appear (A0-A10, B series, SRA series)
- [ ] "A4" appears in suggestions with dimensions shown
- [ ] Selected value: "A4"
- [ ] On blur, pretty display shows "A4 — 210×297mm"
- [ ] "f" suffix supported for folded (A4f)

**Related Tests:** `jcf-format-autocomplete.spec.ts`

---

### AUTO-002: Format Autocomplete - Custom Dimensions

**Feature:** JCF-055, JCF-056 (Custom Format)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "format" cell
2. Type "210x297"
3. Press Enter or select suggestion

**Expected Results:**
- [ ] Custom dimension format accepted (LxH pattern)
- [ ] Value stored as "210x297"
- [ ] Pretty display shows dimensions
- [ ] Validation passes for numeric dimensions

---

### AUTO-003: Format Autocomplete - Composite Formats

**Feature:** JCF-055 (Composite Format)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "format" cell
2. Type "A3/A6"
3. Press Enter

**Expected Results:**
- [ ] Composite format accepted (A3/A6 pattern)
- [ ] Multiple formats separated by "/" allowed
- [ ] Value stored as "A3/A6"
- [ ] Valid composite combinations accepted

---

### AUTO-004: Impression Autocomplete - DSL Format

**Feature:** JCF-059, JCF-060, JCF-061 (JcfImpressionAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "impression" cell
2. Observe suggestions dropdown
3. Select "Q/Q" (quadri recto-verso)
4. Click outside field

**Expected Results:**
- [ ] 9 impression presets shown in suggestions
- [ ] Presets include: Q/Q, Q/, Q+V/Q+V, Q+V/Q, Q+V/, N/N, N/, Q/N, N/Q
- [ ] Each preset has French description (e.g., "Quadri recto-verso")
- [ ] Selected value follows DSL: recto/verso pattern
- [ ] On blur, pretty format displayed
- [ ] There is validation for correct impression format

---

### AUTO-005: Impression Autocomplete - Recto Only

**Feature:** JCF-059, JCF-060 (Impression DSL)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "impression" cell
2. Select "Q/" (quadri recto only)
3. Verify value

**Expected Results:**
- [ ] Recto-only format ends with "/" (e.g., "Q/")
- [ ] Description shows "recto seul" or similar
- [ ] Value stored correctly

---

### AUTO-006: Surfacage Autocomplete - Recto/Verso

**Feature:** JCF-062, JCF-063, JCF-064 (JcfSurfacageAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "surfacage" cell
2. Observe suggestions dropdown
3. Select "mat/mat" (matte both sides)
4. Click outside field

**Expected Results:**
- [ ] 10 surfacage presets shown
- [ ] Presets include: mat/mat, brillant/brillant, UV/UV, pelliculage mat/, etc.
- [ ] DSL format: recto/verso (e.g., "mat/mat")
- [ ] Recto-only options end with "/" (e.g., "UV/")
- [ ] On blur, pretty format displayed

---

### AUTO-007: Quantité Input - Numeric Only

**Feature:** JCF-065 (JcfQuantiteInput)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "quantité" cell
2. Try typing non-numeric characters
3. Type "1000"
4. Click outside field

**Expected Results:**
- [ ] Only digits accepted (0-9)
- [ ] Non-numeric characters ignored
- [ ] Value "1000" stored
- [ ] Right-aligned, monospace font

---

### AUTO-008: Quantité Input - Blur to Default

**Feature:** JCF-065 (Blur-to-1)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "quantité" cell
2. Clear the field completely
3. Click outside field

**Expected Results:**
- [ ] Empty field defaults to "1" on blur
- [ ] Value never stays empty
- [ ] "1" is minimum default value

---

### AUTO-009: Quantité Input - Arrow Keys

**Feature:** JCF-065 (Arrow Increment)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "quantité" cell
2. Press Arrow Up
3. Press Arrow Down

**Expected Results:**
- [ ] Arrow Up increments value by 1
- [ ] Arrow Down decrements value by 1
- [ ] Minimum value is 1 (cannot go below)

---

### AUTO-010: Pagination Input - Valid Values

**Feature:** JCF-066, JCF-067 (JcfPaginationInput)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "pagination" cell
2. Type "4"
3. Click outside
4. Type "2"
5. Click outside
6. Type "16"
7. Click outside

**Expected Results:**
- [ ] "2" accepted (feuillet - single folded sheet)
- [ ] "4" accepted (cahier - 4 pages)
- [ ] "8", "12", "16", etc. accepted (multiples of 4)
- [ ] Validation passes for valid values

---

### AUTO-011: Pagination Input - Invalid Values

**Feature:** JCF-066, JCF-067 (Pagination Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "pagination" cell
2. Type "3"
3. Click outside field
4. Observe validation

**Expected Results:**
- [ ] "3" triggers validation error (not 2 or multiple of 4)
- [ ] Error indicator visible (red background or tooltip)
- [ ] "1", "3", "5", "6", "7" all invalid
- [ ] Only digits accepted

---

### AUTO-012: Papier Autocomplete - Two-Step Selection

**Feature:** JCF-068, JCF-069, JCF-070 (JcfPapierAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "papier" cell
2. Observe Step 1: paper types
3. Select "Couché mat"
4. Observe Step 2: grammages
5. Select "135"
6. Click outside field

**Expected Results:**
- [ ] Step 1: Paper type suggestions (Couché mat, Couché brillant, Offset, etc.)
- [ ] Selecting type advances to Step 2
- [ ] Step 2: Grammage suggestions (80g, 90g, 100g, 115g, 135g, etc.)
- [ ] Final DSL format: "Couché mat:135"
- [ ] On blur, pretty display: "Couché mat 135g"

---

### AUTO-013: Papier Autocomplete - Direct DSL Input

**Feature:** JCF-068, JCF-069 (Papier DSL)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on "papier" cell
2. Type "Offset:80" directly
3. Press Enter

**Expected Results:**
- [ ] Direct DSL input accepted
- [ ] Format: Type:Grammage
- [ ] Value stored as "Offset:80"
- [ ] Pretty display: "Offset 80g"

---

### AUTO-014: Papier Session Learning

**Feature:** JCF-052 (Papier Session Learning)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Enter a paper type not in presets (if possible via direct input)
2. Go to another element
3. Click on "papier" cell
4. Check suggestions

**Expected Results:**
- [ ] Session-learned paper types appear first in suggestions
- [ ] Replace-merge strategy: new type replaces same type
- [ ] Session values persist during session

---

### AUTO-015: Imposition Autocomplete - Two-Step Selection

**Feature:** JCF-071, JCF-072, JCF-073 (JcfImpositionAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "imposition" cell
2. Observe Step 1: sheet formats
3. Select "50x70"
4. Observe Step 2: poses (pages per sheet)
5. Select "8"
6. Click outside field

**Expected Results:**
- [ ] Step 1: Sheet format suggestions (50x70, 70x100, 65x90, etc.)
- [ ] Selecting format advances to Step 2
- [ ] Step 2: Poses suggestions (2, 4, 8, 16, 32, 64, etc. - powers of 2)
- [ ] Final DSL format: "50x70(8)"
- [ ] On blur, pretty display: "50x70cm 8poses/f"

---

### AUTO-016: Imposition Session Learning

**Feature:** JCF-053 (FeuilleFormat Session Learning)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Enter an imposition value
2. Add new element
3. Click on "imposition" cell
4. Check suggestions

**Expected Results:**
- [ ] Session-learned formats appear first
- [ ] Poses-merge strategy: new poses merge with existing format
- [ ] Session values include newly used poses

---

### AUTO-017: Precedences Autocomplete - Element Names

**Feature:** JCF-074, JCF-075, JCF-076 (JcfPrecedencesAutocomplete)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Add a second element (ELEM2)
2. Click on "precedences" cell for ELEM2
3. Observe suggestions
4. Select "ELEM1"

**Expected Results:**
- [ ] Only other element names shown in suggestions
- [ ] Current element (ELEM2) NOT in suggestions (self-reference prevention)
- [ ] Selected value: "ELEM1"
- [ ] Multi-value supported (comma-separated)

---

### AUTO-018: Precedences - Multi-Value Input

**Feature:** JCF-074 (Multi-value Precedences)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Add three elements (ELEM1, ELEM2, ELEM3)
2. Click on "precedences" for ELEM3
3. Select "ELEM1"
4. Type ", " (comma space)
5. Select "ELEM2" from suggestions

**Expected Results:**
- [ ] Comma-separated multiple values supported
- [ ] After selecting ELEM1, can add more
- [ ] Already-selected elements excluded from suggestions
- [ ] Final value: "ELEM1, ELEM2"

---

### AUTO-019: Precedences - Cascading on Rename

**Feature:** JCF-077 (Cascading on Rename)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Create ELEM1, ELEM2 with ELEM2 precedence = "ELEM1"
2. Rename ELEM1 to "Cover"
3. Check ELEM2 precedence

**Expected Results:**
- [ ] ELEM2 precedence automatically updated to "Cover"
- [ ] All references to renamed element updated
- [ ] No broken references

---

### AUTO-020: Precedences - Cascading on Remove

**Feature:** JCF-078 (Cascading on Remove)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Create ELEM1, ELEM2, ELEM3 with ELEM3 precedences = "ELEM1, ELEM2"
2. Delete ELEM1
3. Check ELEM3 precedence

**Expected Results:**
- [ ] ELEM3 precedence updated to "ELEM2" only
- [ ] Deleted element removed from all precedences
- [ ] No orphan references

---

### AUTO-021: Sequence - Poste Mode Basic

**Feature:** JCF-079, JCF-080, JCF-083 (JcfSequenceAutocomplete Poste Mode)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on "sequence" cell
2. Observe suggestions dropdown
3. Type "Heidelberg"
4. Select from suggestions
5. Select duration "30"

**Expected Results:**
- [ ] Multi-line textarea displayed
- [ ] Poste suggestions appear from 16 presets
- [ ] Category badge shown for each poste (e.g., "Presse offset")
- [ ] Duration suggestions after poste: 20, 30, 40, 60, 20+30, 20+40, 30+60
- [ ] Final format: "Heidelberg(30)"

---

### AUTO-022: Sequence - Multi-Line Entry

**Feature:** JCF-079 (Multi-line Sequence)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter first line: "Heidelberg(30)"
2. Press Enter for new line
3. Enter second line: "Massicot(20)"
4. Press Enter
5. Enter third line: "Plieuse(40)"

**Expected Results:**
- [ ] Each line on separate row
- [ ] Autocomplete works for each line
- [ ] Complete lines show no error
- [ ] Multiple production steps defined

---

### AUTO-023: Sequence - Portal-Based Dropdown

**Feature:** JCF-082 (Portal Dropdown)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click in sequence cell
2. Position cursor mid-text
3. Observe dropdown position

**Expected Results:**
- [ ] Dropdown appears at cursor position within textarea
- [ ] Portal renders outside table constraints
- [ ] Dropdown follows cursor as you type
- [ ] No clipping by parent elements

---

### AUTO-024: Sequence - Incomplete Line Validation

**Feature:** JCF-084 (Smart Validation)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on sequence cell
2. Type "Heidelberg" (no duration yet)
3. Observe validation state
4. Complete with "(30)"
5. Observe validation state

**Expected Results:**
- [ ] Incomplete line (no closing paren) NOT flagged as error
- [ ] User can continue typing without error distraction
- [ ] Complete line validates successfully
- [ ] Only truly invalid lines show error

---

### AUTO-025: Sequence - ST Mode Selection

**Feature:** JCF-085, JCF-086, JCF-087 (Sequence ST Mode)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Click on sequence cell
2. Type "ST:" or select ST from suggestions
3. Observe ST name suggestions
4. Select "MCA"
5. Observe duration suggestions
6. Select "3j"
7. Type description "dos carré collé"

**Expected Results:**
- [ ] "ST:" option in poste suggestions
- [ ] After "ST:", 5 sous-traitant names shown (MCA, F37, LGI, AVN, JF)
- [ ] After name selection, duration suggestions with j/h suffixes (1j, 2j, 3j, 4j, 5j)
- [ ] After duration, free-text description (no autocomplete)
- [ ] Final format: "ST:MCA(3j):dos carré collé"

---

### AUTO-026: Sequence - ST 3-Step Flow

**Feature:** JCF-085, JCF-088 (ST Flow)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Type "ST:"
2. Select name → observe dropdown stays open
3. Select duration → observe dropdown closes
4. Type description
5. Press Enter for new line

**Expected Results:**
- [ ] Dropdown stays open through ST: → name selection
- [ ] Dropdown stays open through name → duration selection
- [ ] Dropdown closes after duration selection (description is free text)
- [ ] Cursor positioned for description typing
- [ ] Enter starts new line

---

### AUTO-027: Sequence - ST Session Learning

**Feature:** JCF-089 (learnSoustraitant)
**Fixture:** `elements-table`
**Priority:** P3

**Steps:**
1. Enter a custom ST name (if direct input supported)
2. Start new ST line
3. Check ST name suggestions

**Expected Results:**
- [ ] Session-learned ST names appear first
- [ ] Custom names persist during session

---

### AUTO-028: Sequence - Workflow Priority Sorting

**Feature:** JCF-090, JCF-091, JCF-094, JCF-095 (Workflow Suggestions)
**Fixture:** `elements-table` (with sequenceWorkflow)
**Priority:** P2

**Steps:**
1. Open element with sequenceWorkflow defined
2. Click on sequence cell (first line)
3. Observe suggestion order
4. Complete first line
5. Move to second line
6. Observe suggestion order changes

**Expected Results:**
- [ ] Matching category postes appear FIRST in suggestions
- [ ] Step advances after each completed line
- [ ] Non-matching postes still visible (after priority postes)
- [ ] Step detection counts completed lines (with closing paren)

---

### AUTO-029: Sequence - Workflow Star Marker

**Feature:** JCF-092 (Star Marker)
**Fixture:** `elements-table` (with sequenceWorkflow)
**Priority:** P2

**Steps:**
1. Open element with workflow: `['Presse offset, Presse numérique', 'Massicot']`
2. Click sequence cell
3. Look at category badges in suggestions

**Expected Results:**
- [ ] Priority postes show "★ Presse offset" or "★ Presse numérique"
- [ ] Non-priority postes show normal badge (no star)
- [ ] Star marker indicates expected workflow step

---

### AUTO-030: Sequence - Multi-Category Workflow Step

**Feature:** JCF-093 (Multi-Category Steps)
**Fixture:** `elements-table`
**Priority:** P3

**Steps:**
1. Set workflow with comma-separated categories: "Presse offset, Presse numérique"
2. Click sequence cell
3. Observe which postes are prioritized

**Expected Results:**
- [ ] Both "Presse offset" AND "Presse numérique" postes prioritized
- [ ] Either category satisfies the step
- [ ] Both show star markers

---

### AUTO-031: Error Tooltip Display

**Feature:** JCF-096 (JcfErrorTooltip)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter invalid value in pagination cell (e.g., "3")
2. Click outside field
3. Hover over error indicator
4. Tab to focus the cell

**Expected Results:**
- [ ] "!" badge appears on invalid cell
- [ ] Hover shows tooltip with error message
- [ ] Focus also shows tooltip
- [ ] Red background on invalid cell

---

### AUTO-032: Live Format Validation

**Feature:** JCF-097, JCF-103 (Format Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter invalid format: "ABC123"
2. Click outside field
3. Enter valid format: "A4"
4. Click outside field

**Expected Results:**
- [ ] Invalid format shows red background
- [ ] Error tooltip: format must be ISO, LxH, or composite
- [ ] Valid format clears error
- [ ] No red background on valid value

---

### AUTO-033: Papier Validation

**Feature:** JCF-099 (Papier Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter "Couché mat" without grammage (no colon)
2. Click outside field
3. Enter "Couché mat:135"
4. Click outside field

**Expected Results:**
- [ ] Value without ":" triggers validation error
- [ ] Error: must contain ":" character
- [ ] "Couché mat:135" passes validation

---

### AUTO-034: Imposition Validation

**Feature:** JCF-100 (Imposition Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter "50x70" without poses
2. Click outside field
3. Enter "50x70(8)"
4. Click outside field

**Expected Results:**
- [ ] Value without (N) pattern triggers error
- [ ] Error: must contain poses in parentheses
- [ ] "50x70(8)" passes validation

---

### AUTO-035: Impression Validation

**Feature:** JCF-101 (Impression Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter "QQ" without slash
2. Click outside field
3. Enter "Q/Q"
4. Click outside field

**Expected Results:**
- [ ] Value without "/" triggers validation error
- [ ] Error: must contain "/" character
- [ ] "Q/Q" passes validation

---

### AUTO-036: Surfacage Validation

**Feature:** JCF-102 (Surfacage Validation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Enter "mat" without slash
2. Click outside field
3. Enter "mat/mat"
4. Click outside field

**Expected Results:**
- [ ] Value without "/" triggers validation error
- [ ] Error: must contain "/" character
- [ ] "mat/mat" passes validation

---

### AUTO-037: Lenient Typing Validation

**Feature:** JCF-104 (Lenient Validation)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Click on papier cell
2. Start typing "Couché"
3. Observe validation state while typing
4. Continue to "Couché mat:"
5. Complete with "Couché mat:135"

**Expected Results:**
- [ ] No error shown while typing incomplete value
- [ ] Validation only triggers on blur
- [ ] Partial values tolerated during input
- [ ] Final validation on field exit

---

### AUTO-038: Required Field Indicators

**Feature:** JCF-105 (Required Field Amber Dot)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Add element with imposition or impression value (triggers BLOC SUPPORT)
2. Observe required-but-empty fields
3. Fill in required fields

**Expected Results:**
- [ ] Amber dot appears on required-but-empty fields
- [ ] Dot visible next to field label or in cell
- [ ] Dot disappears when field filled
- [ ] Required fields: papier, pagination, format, qteFeuilles, imposition (per rule)

---

### AUTO-039: BLOC SUPPORT Required Logic

**Feature:** JCF-106 (Required Logic)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Start with empty element
2. Enter value in "imposition" field
3. Observe which fields become required

**Expected Results:**
- [ ] Imposition/impression/surfacage/format triggers BLOC SUPPORT
- [ ] Required fields after trigger: papier, pagination, format, qteFeuilles, imposition
- [ ] Amber dots appear on empty required fields

---

### AUTO-040: BLOC IMPRESSION Required Logic

**Feature:** JCF-107 (Impression Required Logic)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Start with empty element
2. Enter value in "imposition" field
3. Check if "impression" becomes required

**Expected Results:**
- [ ] Imposition/impression triggers BLOC IMPRESSION
- [ ] "impression" field becomes required
- [ ] Amber dot on empty impression field

---

### AUTO-041: qteFeuilles Auto-Calculation

**Feature:** JCF-108, JCF-111 (Auto-Calculation)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Set job quantité: 1000
2. Set element quantité: 2
3. Set imposition: "50x70(8)" (8 poses)
4. Observe qteFeuilles field

**Expected Results:**
- [ ] qteFeuilles auto-calculated: ceil((1000 × 2) / 8) = 250
- [ ] Formula: ceil((jobQty × elementQty) / poses)
- [ ] Value updates when inputs change
- [ ] Green indicator for auto mode

---

### AUTO-042: qteFeuilles Auto/Manual Toggle

**Feature:** JCF-109, JCF-110 (Auto/Manual Toggle)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. With auto-calculated qteFeuilles
2. Click calculator icon to switch to manual
3. Enter custom value "300"
4. Click calculator icon to switch back to auto

**Expected Results:**
- [ ] Calculator icon toggles between auto and manual
- [ ] Auto mode: green text and icon, calculated value
- [ ] Manual mode: normal text, user-editable
- [ ] Switching to auto recalculates value

---

### AUTO-043: Poses Extraction from Imposition

**Feature:** JCF-111 (Poses Extraction)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Enter imposition "65x90(16)"
2. Observe qteFeuilles calculation

**Expected Results:**
- [ ] Poses "16" correctly extracted from "(16)"
- [ ] Calculation uses extracted poses
- [ ] Works with various formats: (8), (16p), etc.

---

## Visual Checklist

### Autocomplete Dropdowns
- [ ] Suggestions appear below/above input based on space
- [ ] Filtering works as you type
- [ ] Keyboard navigation (↑↓) works
- [ ] Enter selects highlighted item
- [ ] Escape closes dropdown
- [ ] Click outside closes dropdown

### Two-Step Autocompletes
- [ ] Step 1 → Step 2 transition smooth
- [ ] Backspace can return to Step 1
- [ ] Both steps have suggestions
- [ ] Pretty display on blur

### Sequence Editor
- [ ] Multi-line textarea resizable or auto-grow
- [ ] Per-line autocomplete at cursor position
- [ ] Portal dropdown not clipped
- [ ] ST mode 3-step flow works
- [ ] Workflow star markers visible

### Validation
- [ ] Red background on invalid cells
- [ ] "!" error badge visible
- [ ] Tooltips on hover/focus
- [ ] Amber dot for required fields
- [ ] Green indicator for auto-calculated fields

---

## Edge Cases

### AUTO-E01: Empty Dropdown
**Feature:** All autocompletes
**Steps:** Type text that matches no suggestions
**Expected:** Dropdown shows "No results" or closes

### AUTO-E02: Very Long Values
**Feature:** All text fields
**Steps:** Enter 200+ character value
**Expected:** Text truncated or scrollable, no overflow

### AUTO-E03: Special Characters in Values
**Feature:** JCF-055 (Format)
**Steps:** Enter format with special chars "A4/A5+B6"
**Expected:** Handled gracefully, validated appropriately

### AUTO-E04: Rapid Field Switching
**Feature:** All autocompletes
**Steps:** Tab rapidly through all fields
**Expected:** No race conditions, dropdowns close properly

### AUTO-E05: Sequence with 20+ Lines
**Feature:** JCF-079
**Steps:** Enter 20+ production steps
**Expected:** Textarea handles many lines, dropdown still works

### AUTO-E06: Zero Poses in Calculation
**Feature:** JCF-108
**Steps:** Clear imposition (poses = undefined)
**Expected:** qteFeuilles shows placeholder or 0, no division error

### AUTO-E07: All Fields Invalid
**Feature:** JCF-096-104
**Steps:** Enter invalid values in all validatable fields
**Expected:** All show error indicators, form shows validation summary

---

## Cross-Feature Interactions

### Cell Navigation + Autocomplete
- Tab/Shift+Tab navigation respects autocomplete state
- onTabOut prop delegates to table navigation
- Alt+Arrow works with dropdown open

### Validation + Required Fields
- Invalid field can also be required
- Both amber dot and red error can appear
- Clearing required field shows amber, not red

### Session Learning + Suggestions
- Session-learned values appear first
- Multiple fields share session state
- Session persists until page refresh

### qteFeuilles + Imposition
- Changing imposition recalculates qteFeuilles
- Manual mode ignores imposition changes
- Switching to auto recalculates immediately

### Sequence + Workflow
- Workflow prop enables priority sorting
- Empty workflow = normal behavior
- Beyond workflow length = no priority

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Dropdown open | < 50ms | DevTools → Performance |
| Suggestion filtering | < 16ms | No visible lag |
| Validation feedback | < 100ms | Immediate on blur |
| Auto-calculation | < 16ms | Instant update |

---

## Testing Data Requirements

### Paper Types (5 types × 14 grammages)
- Couché mat: 80g - 350g
- Couché brillant: 80g - 350g
- Offset: 80g - 250g
- Bristol: 200g - 350g
- Carton: 280g - 450g

### Product Formats (36 ISO formats)
- A series: A0 - A10
- B series: B0 - B10
- SRA series: SRA0 - SRA4
- Custom: LxH dimensions

### Feuille Formats (10 formats × 8 poses)
- 50x70, 70x100, 65x90, etc.
- Poses: 2, 4, 8, 16, 32, 64, 128, 256

### Impression Presets (9)
- Q/Q, Q/, Q+V/Q+V, Q+V/Q, Q+V/, N/N, N/, Q/N, N/Q

### Surfacage Presets (10)
- mat/mat, brillant/brillant, UV/UV, pelliculage mat/, vernis/, etc.

### Poste Presets (16 across 8 categories)
- Categories: Presse offset, Presse numérique, Massicot, Typo, Plieuse, Assemblage, Conditionnement, Finition

### ST Presets (5)
- MCA, F37, LGI, AVN, JF
