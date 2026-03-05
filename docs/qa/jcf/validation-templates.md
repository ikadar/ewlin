# Flux Scheduler - JCF Validation, Templates, Infrastructure Manual QA

> **Feature Group:** JCF Validation, Templates, Infrastructure
> **Batch:** B11
> **Features:** JCF-112 – JCF-187 (76 Active)
> **Releases:** v0.4.29 – v0.4.40

---

## Overview

This document contains the Manual QA tests for the JCF (Job Creation Form) Validation, Templates, and Infrastructure features. The feature group covers the following main areas:

- **UI Scale & Submit Validation** - 13px root font, 80% zoom, Level 3 validation
- **Element Prerequisites** - PaperStatus, BatStatus, PlateStatus, FormeStatus, blocking logic
- **Scheduler Tile Blocking** - Dashed border, 2s hover tooltip
- **API Integration** - Job creation with elements, element naming
- **Template System** - Template CRUD, apply, save as template
- **Link Propagation** - Field linking, value inheritance, auto-propagation
- **JSON Editor** - Dual-mode editor, CodeMirror, contextual autocomplete
- **Frontend Infrastructure** - Redux, RTK Query, React Router

---

## Test Fixtures

| Fixture | URL | Description |
|---------|-----|-------------|
| `elements-table` | `?fixture=elements-table` | JCF modal with default element |
| `submit-validation` | `?fixture=submit-validation` | JCF modal with partial data for validation testing |
| `blocking-visual` | `?fixture=blocking-visual` | Tiles with various blocking states |
| `forme-date-tracking` | `?fixture=forme-date-tracking` | Elements with forme and date tracking |
| `template-crud` | `?fixture=template-crud` | Pre-populated templates |
| `router-test` | `?fixture=router-test` | Multiple jobs for navigation testing |

---

## Test Scenarios

### UI Scale & Submit Validation (v0.4.29-v0.4.30)

---

### VAL-001: UI Scale - Root Font Size

**Feature:** JCF-112 (UI Scale Harmonization)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Open JCF modal (`/job/new`)
2. Open browser DevTools
3. Inspect `html` element's computed styles

**Expected Results:**
- [ ] Root font-size is 13px (81.25% of 16px default)
- [ ] `text-sm` resolves to ~11.375px
- [ ] `text-base` resolves to 13px
- [ ] JCF modal text sizes match reference/jcf visually

---

### VAL-002: Zoom Levels at 80%

**Feature:** JCF-113, JCF-114 (80% Zoom Levels)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Load application
2. Check zoom level at 100%
3. Click zoom in/out to test all levels

**Expected Results:**
- [ ] 100% zoom uses 64px/hour (was 80px/hour before scaling)
- [ ] All zoom levels: 25%=16px, 50%=32px, 75%=48px, 100%=64px, 150%=96px, 200%=128px
- [ ] Tile heights scale correctly with zoom
- [ ] Grid lines align with hour markers

---

### VAL-003: Submit Validation - Required Fields

**Feature:** JCF-115, JCF-116 (Level 3 Validation)
**Fixture:** `submit-validation`
**Priority:** P1

**Steps:**
1. Open JCF modal
2. Leave required fields empty (triggered by BLOC SUPPORT)
3. Click "Enregistrer" (Save) button
4. Observe field indicators

**Expected Results:**
- [ ] Save button visible in modal footer
- [ ] Amber required indicators become red errors after save attempt
- [ ] hasAttemptedSubmit state triggers Level 3 errors
- [ ] Form submission blocked until errors resolved

---

### VAL-004: Submit Validation - French Error Messages

**Feature:** JCF-117 (French Error Messages)
**Fixture:** `submit-validation`
**Priority:** P2

**Steps:**
1. Open JCF modal
2. Trigger validation errors
3. Hover over error indicators to read tooltips

**Expected Results:**
- [ ] Error messages in French:
  - Séquence: "Séquence requise - Définissez au moins une opération..."
  - Papier: "Papier requis - Indiquez le type et grammage..."
  - Pagination: "Pagination requise - Nombre de pages..."
  - Format: "Format requis - Format du produit fini..."
  - qteFeuilles: "Quantité feuilles requise..."
  - Imposition: "Imposition requise..."
  - Impression: "Impression requise..."

---

### VAL-005: Submit Validation - Fix and Retry

**Feature:** JCF-115, JCF-116 (Submit Validation)
**Fixture:** `submit-validation`
**Priority:** P1

**Steps:**
1. Trigger validation errors by clicking Save with empty fields
2. Fill in required fields
3. Click Save again

**Expected Results:**
- [ ] Error indicators disappear as fields are filled
- [ ] Valid form submits successfully
- [ ] Modal closes on successful save

---

### Element Prerequisites (v0.4.32a-v0.4.32e)

---

### PREREQ-001: Prerequisite Dropdowns in Job Details

**Feature:** JCF-121, JCF-122, JCF-123, JCF-124 (Prerequisite Types)
**Fixture:** `blocking-visual`
**Priority:** P1

**Steps:**
1. Select a job with elements
2. Look at ElementSection in Job Details Panel
3. Observe prerequisite dropdowns

**Expected Results:**
- [ ] Paper dropdown visible with options:
  - Pas de papier, Sur stock, À commander, Commandé, Livré
- [ ] BAT dropdown visible with options:
  - Pas de BAT, Attente fichiers, Fichiers reçus, BAT transmis, BAT validé
- [ ] Plates dropdown visible (only for offset elements) with options:
  - Pas de plaques, À faire, Prêtes
- [ ] Assembly elements show "(pas de prérequis)" instead

---

### PREREQ-002: Forme Dropdown for Die-Cutting

**Feature:** JCF-128, JCF-130 (FormeStatus)
**Fixture:** `forme-date-tracking`
**Priority:** P2

**Steps:**
1. Select a job with die-cutting element
2. Look at ElementSection
3. Check for Forme dropdown

**Expected Results:**
- [ ] Forme dropdown visible ONLY for elements with die-cutting tasks
- [ ] Forme options: Pas de forme, Sur stock, À commander, Commandée, Livrée
- [ ] Non-die-cutting elements do NOT show Forme dropdown

---

### PREREQ-003: Date Tracking Display

**Feature:** JCF-129, JCF-131 (Date Tracking)
**Fixture:** `forme-date-tracking`
**Priority:** P2

**Steps:**
1. Select a job with elements that have status dates
2. Look at prerequisite dropdowns

**Expected Results:**
- [ ] Dates displayed inline next to dropdowns
- [ ] Format: DD/MM/YYYY (e.g., "Commandé 15/01/2026")
- [ ] Dates shown for: paperOrderedAt, paperDeliveredAt, filesReceivedAt, batSentAt, batApprovedAt, formeOrderedAt, formeDeliveredAt

---

### PREREQ-004: Blocking Logic - isElementBlocked

**Feature:** JCF-125, JCF-134 (isElementBlocked)
**Fixture:** `blocking-visual`
**Priority:** P1

**Steps:**
1. Select a job with blocked elements
2. Check tile borders on scheduler grid

**Expected Results:**
- [ ] Blocked elements: paperStatus not in (none, in_stock, delivered)
- [ ] Blocked elements: batStatus not in (none, bat_approved)
- [ ] Blocked elements: plateStatus not in (none, ready)
- [ ] Blocked elements: formeStatus not in (none, in_stock, delivered)
- [ ] Any blocking prerequisite → element is blocked

---

### PREREQ-005: Blocked Tile Visual - Dashed Border

**Feature:** JCF-126 (Blocked Tile Dashed Border)
**Fixture:** `blocking-visual`
**Priority:** P1

**Steps:**
1. Locate a tile for a blocked element on the grid
2. Compare with a tile for a ready element

**Expected Results:**
- [ ] Blocked tile: dashed left border (4px dashed job color)
- [ ] Ready tile: solid left border (4px solid job color)
- [ ] Visual distinction clear at a glance

---

### PREREQ-006: Prerequisite Tooltip on Hover

**Feature:** JCF-127 (PrerequisiteTooltip)
**Fixture:** `blocking-visual`
**Priority:** P2

**Steps:**
1. Hover over a blocked tile
2. Wait 2 seconds
3. Observe tooltip

**Expected Results:**
- [ ] Tooltip appears ONLY after 2 seconds of hover
- [ ] Tooltip shows prerequisite status:
  ```
  ⚠ Papier: Commandé
  ⚠ BAT: Attente fichiers
  ✓ Plaques: Prêtes
  ```
- [ ] ⚠ for blocking items, ✓ for ready items
- [ ] Tooltip disappears when mouse leaves tile
- [ ] Ready tiles do NOT show tooltip (regardless of hover duration)

---

### PREREQ-007: Prerequisites API Endpoint

**Feature:** JCF-133 (Element Prerequisites API)
**Fixture:** N/A (API testing)
**Priority:** P2

**Steps:**
1. Open Swagger UI (`/api/doc`)
2. Find PUT `/api/v1/elements/{id}/prerequisites`
3. Test the endpoint

**Expected Results:**
- [ ] Endpoint accepts paperStatus, batStatus, plateStatus, formeStatus
- [ ] Returns updated element with new status
- [ ] Domain events emitted for status changes

---

### API Integration (v0.4.33)

---

### API-001: Element Name Property

**Feature:** JCF-139 (Element suffix → name Rename)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Create a job with multiple elements
2. Check API response
3. Check frontend display

**Expected Results:**
- [ ] API returns `name` (not `suffix`) for elements
- [ ] Frontend displays element.name correctly
- [ ] Element names: INT, COUV, FEUILLET, FINITION, etc.

---

### API-002: Multi-Element Job Creation

**Feature:** JCF-140, JCF-141, JCF-142 (Multi-Element Job)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Open JCF modal
2. Add multiple elements
3. Fill in element data including precedences
4. Save the job

**Expected Results:**
- [ ] Job created with multiple elements
- [ ] Each element has its own tasks (from sequence parsing)
- [ ] Precedences resolved by name (prerequisiteNames → IDs)
- [ ] Job appears in scheduler with all elements

---

### API-003: JCF to API Transform

**Feature:** JCF-143, JCF-144 (Frontend Job API)
**Fixture:** `elements-table`
**Priority:** P2

**Steps:**
1. Fill JCF form with test data
2. Open DevTools Network tab
3. Save the job
4. Inspect the request payload

**Expected Results:**
- [ ] Request format matches API contract:
  ```json
  {
    "reference": "J-2026-0001",
    "client": "Test Client",
    "description": "Test Description",
    "workshopExitDate": "2026-02-15",
    "elements": [
      {
        "name": "INT",
        "label": "...",
        "sequence": "[Heidelberg] 20+30",
        "prerequisiteNames": []
      }
    ]
  }
  ```
- [ ] Successful response creates job

---

### Template System (v0.4.34-v0.4.35)

---

### TMPL-001: Template List Display

**Feature:** JCF-147 (JcfTemplateList)
**Fixture:** `template-crud`
**Priority:** P2

**Steps:**
1. Access template list (via template autocomplete or dedicated view)
2. Observe table layout

**Expected Results:**
- [ ] Columns: Name, Client, Category, Elements count, Modified date
- [ ] Sortable by clicking column headers
- [ ] Sort indicator (ChevronUp/ChevronDown) shows direction
- [ ] Action buttons per row: Delete, Edit, Use

---

### TMPL-002: Template Create from Job

**Feature:** JCF-151 (Save as Template)
**Fixture:** `elements-table`
**Priority:** P1

**Steps:**
1. Open JCF modal and create elements
2. Click "Enregistrer comme template" button
3. Fill template name and metadata
4. Save template

**Expected Results:**
- [ ] Template editor modal opens with current elements
- [ ] Name field required
- [ ] Category autocomplete with session learning
- [ ] Client autocomplete optional
- [ ] Template saved to localStorage

---

### TMPL-003: Template Apply to Job

**Feature:** JCF-150 (Template Apply)
**Fixture:** `template-crud`
**Priority:** P1

**Steps:**
1. Open JCF modal for new job
2. Select a template from template autocomplete
3. Observe elements table

**Expected Results:**
- [ ] Elements populated from template
- [ ] All field values inherited
- [ ] Template workflow activates (★ markers in sequence)
- [ ] Can modify after applying

---

### TMPL-004: Template Editor Modal

**Feature:** JCF-148, JCF-149 (TemplateEditorModal)
**Fixture:** `template-crud`
**Priority:** P2

**Steps:**
1. Create or edit a template
2. Observe modal structure

**Expected Results:**
- [ ] Header form: Name, Description, Category, Client
- [ ] Elements table in template mode
- [ ] Save and Cancel buttons
- [ ] Cmd+S saves, Escape cancels

---

### TMPL-005: Relative Date Formatting

**Feature:** JCF-153 (Relative Date Formatting)
**Fixture:** `template-crud`
**Priority:** P3

**Steps:**
1. View template list
2. Check Modified date column

**Expected Results:**
- [ ] Dates formatted in French relative format:
  - "il y a 5 min" (5 minutes ago)
  - "hier" (yesterday)
  - "il y a 3 jours" (3 days ago)

---

### TMPL-006: Link Toggle Visual

**Feature:** JCF-154, JCF-159 (JcfLinkToggle)
**Fixture:** `template-crud`
**Priority:** P2

**Steps:**
1. Open template editor with multiple elements
2. Look at linkable fields (format, papier, imposition, impression, surfacage)
3. Toggle link on element 2

**Expected Results:**
- [ ] Link toggle button visible (Link2/Unlink icon)
- [ ] First element's link toggles are disabled (no previous element)
- [ ] Linked: blue icon, blue text, blue background (`bg-blue-900/30`)
- [ ] Unlinked: gray icon, normal text

---

### TMPL-007: Value Inheritance on Link

**Feature:** JCF-157 (Value Inheritance)
**Fixture:** `template-crud`
**Priority:** P1

**Steps:**
1. Open template with 2+ elements
2. Set format value on element 1: "A4"
3. Click link toggle for format on element 2

**Expected Results:**
- [ ] Element 2 format immediately copies "A4" from element 1
- [ ] Field becomes read-only (click to unlink)
- [ ] Blue styling indicates linked state

---

### TMPL-008: Auto-Propagation on Source Change

**Feature:** JCF-158 (Auto-Propagation)
**Fixture:** `template-crud`
**Priority:** P1

**Steps:**
1. Link format field from element 2 to element 1
2. Change element 1 format to "A3"

**Expected Results:**
- [ ] Element 2 format automatically updates to "A3"
- [ ] Propagation cascades through all linked downstream elements
- [ ] No manual intervention needed

---

### TMPL-009: Dual-Mode Template Editor

**Feature:** JCF-160, JCF-161 (Dual-Mode Editor)
**Fixture:** `template-crud`
**Priority:** P2

**Steps:**
1. Open template editor
2. Click "JSON" tab
3. Modify JSON
4. Click "Form" tab

**Expected Results:**
- [ ] Form and JSON tabs visible
- [ ] JSON editor shows template data with syntax highlighting
- [ ] Changes in JSON reflect in Form view
- [ ] Changes in Form reflect in JSON view
- [ ] Invalid JSON shows error, prevents save

---

### TMPL-010: JSON Editor Autocomplete

**Feature:** JCF-185, JCF-186, JCF-187 (JSON Autocomplete)
**Fixture:** `template-crud`
**Priority:** P3

**Steps:**
1. Open template editor, switch to JSON tab
2. Place cursor inside `"name": ""`
3. Observe autocomplete dropdown

**Expected Results:**
- [ ] Autocomplete triggers when cursor in autocompletable field
- [ ] Fields with autocomplete: name, format, papier, impression, surfacage, sequence
- [ ] Suggestions filtered by typed text
- [ ] Enter/Tab selects suggestion

---

### Frontend Infrastructure (v0.4.36-v0.4.40)

---

### INFRA-001: Redux DevTools

**Feature:** JCF-169, JCF-174 (Redux Store)
**Fixture:** `test`
**Priority:** P3

**Steps:**
1. Open browser with Redux DevTools extension
2. Load application
3. Open DevTools and check Redux tab

**Expected Results:**
- [ ] State tree visible
- [ ] Actions logged when dispatched
- [ ] Time-travel debugging works
- [ ] State diff visible

---

### INFRA-002: URL-Based Job Selection

**Feature:** JCF-176 (URL-Based Selection)
**Fixture:** `router-test`
**Priority:** P2

**Steps:**
1. Load application at `/`
2. Click on a job in sidebar
3. Check URL

**Expected Results:**
- [ ] URL changes to `/job/{jobId}`
- [ ] Job details panel shows selected job
- [ ] Direct URL `/job/{jobId}` loads with job selected

---

### INFRA-003: JCF Modal Route

**Feature:** JCF-177 (JCF Modal Route)
**Fixture:** `router-test`
**Priority:** P2

**Steps:**
1. Click "+" button to open JCF modal
2. Check URL
3. Close modal
4. Navigate directly to `/job/new`

**Expected Results:**
- [ ] URL changes to `/job/new` when modal opens
- [ ] URL changes back when modal closes
- [ ] Direct URL `/job/new` loads with modal open

---

### INFRA-004: Browser History Support

**Feature:** JCF-178, JCF-179 (Browser History)
**Fixture:** `router-test`
**Priority:** P2

**Steps:**
1. Click several jobs to navigate
2. Click browser back button
3. Click browser forward button
4. Bookmark a job URL

**Expected Results:**
- [ ] Back button returns to previous job/view
- [ ] Forward button goes to next job/view
- [ ] Bookmarked URL loads correct job

---

### INFRA-005: SonarQube Integration

**Feature:** JCF-180, JCF-181 (SonarQube)
**Fixture:** N/A (development tool)
**Priority:** P3

**Steps:**
1. Run `/sonar` command in terminal
2. Check SonarQube analysis results

**Expected Results:**
- [ ] SonarQube scanner runs successfully
- [ ] CRITICAL issues: 0
- [ ] MAJOR issues: ≤4
- [ ] Results summary displayed

---

## Visual Checklist

### Submit Validation
- [ ] Save button in modal footer with "Enregistrer" label
- [ ] Amber indicators for required fields (before submit)
- [ ] Red indicators for errors (after failed submit)
- [ ] Error tooltips show French messages

### Element Prerequisites
- [ ] Dropdowns with French labels
- [ ] Dates in DD/MM/YYYY format
- [ ] Dashed border on blocked tiles
- [ ] Tooltip with ⚠/✓ indicators

### Template System
- [ ] Sortable table with column indicators
- [ ] Action buttons: trash, pencil, play icons
- [ ] Modal with Form/JSON tabs
- [ ] Link toggle with Link2/Unlink icons
- [ ] Blue styling for linked fields

### JSON Editor
- [ ] CodeMirror with dark theme
- [ ] Line numbers visible
- [ ] Syntax highlighting for JSON
- [ ] Autocomplete dropdown

### Infrastructure
- [ ] URL reflects current state
- [ ] No visual regressions after Redux migration
- [ ] DevTools shows state correctly

---

## Edge Cases

### VAL-E01: All Fields Invalid
**Feature:** JCF-115
**Steps:** Click Save with all fields empty or invalid
**Expected:** All error indicators visible, form blocked

### VAL-E02: Fix Partial Errors
**Feature:** JCF-116
**Steps:** Fix some errors, leave others, try Save
**Expected:** Remaining errors shown, form still blocked

### PREREQ-E01: Change Status Backward
**Feature:** JCF-129
**Steps:** Change status from "Livré" back to "Commandé"
**Expected:** Date fields NOT cleared (dates only set on forward transition)

### PREREQ-E02: Remove Element with Prerequisites
**Feature:** JCF-133
**Steps:** Delete element referenced in other elements' prerequisites
**Expected:** References removed from all precedences

### TMPL-E01: Template with No Elements
**Feature:** JCF-148
**Steps:** Try to save template with 0 elements
**Expected:** Validation error, save blocked

### TMPL-E02: Link Chain with 5+ Elements
**Feature:** JCF-158
**Steps:** Create 5 elements, link all format fields
**Expected:** Change in element 1 propagates to all 4 linked elements

### TMPL-E03: Invalid JSON in Editor
**Feature:** JCF-160
**Steps:** Type invalid JSON and try to save
**Expected:** Error indicator, save blocked, error message

### INFRA-E01: Invalid Job ID in URL
**Feature:** JCF-176
**Steps:** Navigate to `/job/invalid-id-123`
**Expected:** Handles gracefully (shows empty selection or error)

### INFRA-E02: Deep Link with Fixture
**Feature:** JCF-179
**Steps:** Navigate to `/job/job-a?fixture=test`
**Expected:** Both fixture and job ID honored

---

## Cross-Feature Interactions

### Validation + Prerequisites
- Required field validation includes prerequisite-triggered fields
- BLOC SUPPORT triggers require papier, pagination, format, etc.

### Templates + Link Propagation
- Templates can store default link states
- Applying template preserves link configuration
- Link propagation works in template editor

### Prerequisites + Scheduler Tiles
- Blocked elements show dashed border on grid
- Status changes update tile visual immediately
- Tooltip shows current prerequisite status

### Redux + React Router
- URL changes dispatch Redux actions
- Redux state reflects URL
- DevTools shows navigation actions

### JSON Editor + Autocomplete Fields
- Same reference data used
- Session learning shared
- Field validation consistent

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Submit validation | < 100ms | Immediate feedback |
| Template apply | < 200ms | Populate elements |
| Link propagation | < 50ms | Cascade updates |
| JSON editor init | < 300ms | CodeMirror load |
| Route navigation | < 100ms | URL → view update |

---

## API Endpoints (Backend Testing)

### Element Prerequisites
- **PUT** `/api/v1/elements/{id}/prerequisites`
- Body: `{ paperStatus, batStatus, plateStatus, formeStatus }`
- Response: Updated element with status fields

### Job Creation with Elements
- **POST** `/api/v1/jobs`
- Body: `{ reference, client, description, workshopExitDate, elements[] }`
- Response: Created job with element IDs

### Domain Events (v0.4.32e)
- ElementPaperStatusUpdated
- ElementBatStatusUpdated
- ElementPlateStatusUpdated
- ElementFormeStatusUpdated

---

## Testing Data Requirements

### Prerequisite Status Values

**PaperStatus:**
- none, in_stock, to_order, ordered, delivered

**BatStatus:**
- none, waiting_files, files_received, bat_sent, bat_approved

**PlateStatus:**
- none, to_make, ready

**FormeStatus:**
- none, in_stock, to_order, ordered, delivered

### Blocking Logic

| Status | Paper Ready | BAT Ready | Plates Ready | Forme Ready |
|--------|-------------|-----------|--------------|-------------|
| none | ✓ | ✓ | ✓ | ✓ |
| in_stock | ✓ | - | - | ✓ |
| to_order | ✗ | - | - | ✗ |
| ordered | ✗ | - | - | ✗ |
| delivered | ✓ | - | - | ✓ |
| waiting_files | - | ✗ | - | - |
| files_received | - | ✗ | - | - |
| bat_sent | - | ✗ | - | - |
| bat_approved | - | ✓ | - | - |
| to_make | - | - | ✗ | - |
| ready | - | - | ✓ | - |

### Template Type Structure

```typescript
interface JcfTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  clientName?: string;
  elements: JcfTemplateElement[];
  createdAt: string;
  updatedAt: string;
}

interface JcfTemplateElement {
  name: string;
  precedences: string;
  quantite: string;
  format: string;
  pagination: string;
  papier: string;
  imposition: string;
  impression: string;
  surfacage: string;
  autres: string;
  qteFeuilles: string;
  commentaires: string;
  sequence: string;
  sequenceWorkflow?: string[];
  links?: Partial<Record<JcfLinkableField, boolean>>;
}

type JcfLinkableField = 'format' | 'papier' | 'imposition' | 'impression' | 'surfacage';
```
