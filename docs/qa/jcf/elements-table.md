# Flux Scheduler - JCF Elements Table Manual QA

> **Feature Group:** JCF Elements Table
> **Batch:** B9
> **Features:** SCHED-153 – SCHED-165, JCF-001 – JCF-054 (67 Active)
> **Releases:** v0.4.0 – v0.4.12

---

## Overview

Ez a dokumentum a JCF (Job Creation Form) alapvető feature-jeinek Manual QA tesztjeit tartalmazza. A feature csoport a következő fő területeket fedi le:

- **Element Layer** - Job és Task közötti köztes réteg (Element entity, Element → Task relationship)
- **JCF Type System** - ElementSpec value object, reference data types (Paper, Format, Imposition, stb.)
- **JCF Modal Shell** - Full-screen modal overlay, keyboard hints footer
- **Job Header** - Job ID, Intitulé, Quantité, Deadline fields + Client/Template autocomplete
- **Elements Table** - Grid layout (row-based), element header, add/remove buttons, name editing
- **Cell Navigation** - Tab/Shift+Tab, Alt+Arrow, Enter/Escape keyboard navigation
- **Autocomplete Integration** - onTabOut, onArrowNav delegation to table navigation
- **Session Learning** - In-memory session state for new values

---

## Test Fixtures

| Fixture | URL | Leírás |
|---------|-----|--------|
| `test` | `?fixture=test` | Standard test data with JCF modal access |
| `elements-table` | `?fixture=elements-table` | JCF modal with default element for grid layout testing |

---

## Test Scenarios

### EL-001: Element Layer No Regression

**Feature:** SCHED-153 - SCHED-165 (Element Layer)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- App running with `?fixture=test`
- Application loads without errors

**Steps:**
1. Open the application
2. Click on a job in the Jobs List
3. Verify Job Details Panel shows task list
4. Pick a task and place it on the grid
5. Verify tile appears correctly
6. Right-click on tile, select "Marquer terminé"
7. Verify completion state changes

**Expected Results:**
- [ ] Application loads without console errors
- [ ] Job selection works
- [ ] Task list displays correctly in Job Details Panel
- [ ] Pick & Place works
- [ ] Tile renders correctly
- [ ] Context menu works
- [ ] Completion toggle works

**Note:** Element layer is internal/structural — no visible UI changes expected.

---

### JCF-001: Modal Open/Close

**Feature:** JCF-018 - JCF-021 (JcfModal Component)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- App running with `?fixture=test`

**Steps:**
1. Click the "+" button in the JobsList header
2. Verify modal opens
3. Click the X button in modal header
4. Verify modal closes
5. Reopen modal, press Escape key
6. Verify modal closes
7. Reopen modal, click outside the dialog (on backdrop)
8. Verify modal closes

**Expected Results:**
- [ ] "+" button opens JCF modal
- [ ] Modal displays header with title "Nouveau Job"
- [ ] Modal backdrop is semi-transparent (scheduling grid visible behind)
- [ ] X button closes the modal
- [ ] Escape key closes the modal
- [ ] Backdrop click closes the modal

---

### JCF-002: Keyboard Hints Footer

**Feature:** JCF-019 (Modal Keyboard Hints)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Look at the bottom of the modal

**Expected Results:**
- [ ] Footer shows keyboard hints in small text
- [ ] Visible hints: Tab, Alt+arrows, ↑↓, Cmd+S (or Ctrl+S), Esc

---

### JCF-003: Job ID Field (Readonly)

**Feature:** JCF-022, JCF-028 (Job ID Field, generateJobId)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Look at the Job Header row
2. Find the first field (Job ID)
3. Try to click and edit the field

**Expected Results:**
- [ ] Job ID field visible with format `J-{YYYY}-{NNNN}` (e.g., J-2026-1234)
- [ ] Field is readonly (cannot edit)
- [ ] Field has monospace font
- [ ] Field is muted styling (grayed)
- [ ] Field is not in Tab order (tabIndex={-1})

---

### JCF-004: Intitulé Text Field

**Feature:** JCF-023 (Intitulé Field)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click the Intitulé field
2. Type "Brochure corporate 2026"
3. Tab to next field

**Expected Results:**
- [ ] Intitulé field visible with label
- [ ] Field accepts free text input
- [ ] Text displays correctly
- [ ] Field has focus ring on focus

---

### JCF-005: Quantité Numeric Field

**Feature:** JCF-024 (Quantité Field)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click the Quantité field
2. Type "5000"
3. Observe field styling

**Expected Results:**
- [ ] Quantité field visible with label
- [ ] Field accepts numeric input
- [ ] Text is right-aligned
- [ ] Field has monospace font
- [ ] Field has fixed narrow width

---

### JCF-006: Deadline Date Picker (French Format)

**Feature:** JCF-025 - JCF-027 (Deadline Field, parseFrenchDate, formatToFrench)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click the Deadline field
2. Type "15/03" (short format, assumes current year)
3. Blur the field (click outside)
4. Observe the displayed value
5. Clear and type "15/03/2026" (full format)
6. Blur the field

**Expected Results:**
- [ ] Deadline field visible with label
- [ ] Short format "15/03" accepted
- [ ] On blur, short format converts to full French format "15/03/2026" (with current year)
- [ ] Full format "15/03/2026" accepted
- [ ] Field has calendar icon (Lucide Calendar)
- [ ] Field has monospace font

---

### JCF-007: Client Autocomplete Field

**Feature:** JCF-029 - JCF-032, JCF-034 (JcfAutocomplete, Client Field)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click the Client field
2. Observe dropdown opens
3. Type "La" to filter
4. Use Arrow Down to highlight "La Poste"
5. Press Enter to select
6. Observe focus moves to Template field

**Expected Results:**
- [ ] Client field visible with label
- [ ] Click opens dropdown with client suggestions (8 clients)
- [ ] Typing filters suggestions (case-insensitive)
- [ ] Arrow Down/Up navigates suggestions
- [ ] Highlighted suggestion has blue background
- [ ] Enter selects suggestion and closes dropdown
- [ ] Focus moves to Template field after selection

---

### JCF-008: Template Autocomplete Field (Client-Filtered)

**Feature:** JCF-033, JCF-034 (Template Field, Focus Chain)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open
- Client "La Poste" selected

**Steps:**
1. Focus Template field (should auto-focus after client selection)
2. Observe suggestions
3. Select a template

**Expected Results:**
- [ ] Template field visible with placeholder "Aucun"
- [ ] Dropdown shows client-specific templates first (with "La Poste" badge)
- [ ] Universal templates shown below (with "universel" badge)
- [ ] Focus moves to Intitulé field after template selection

---

### JCF-009: Autocomplete Text Highlighting

**Feature:** JCF-030 (highlightMatch Utility)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click Client field
2. Type "pos" to filter

**Expected Results:**
- [ ] Matching text "pos" in "La Poste" is bold and blue
- [ ] Non-matching text is normal styling

---

### JCF-010: Autocomplete Lazy Loading

**Feature:** JCF-031 (useLazyLoadSuggestions)
**Fixture:** `test`
**Priority:** P3

**Preconditions:**
- JCF modal is open
- Field has more than 10 suggestions

**Steps:**
1. Focus a field with many suggestions
2. Scroll down in dropdown
3. Observe more items load

**Expected Results:**
- [ ] Initially shows first 10 items
- [ ] Scrolling loads more items
- [ ] Maximum 25 items shown
- [ ] "Scroll pour plus de suggestions" indicator visible when more available

---

### JCF-011: Autocomplete Keyboard Navigation

**Feature:** JCF-029 (JcfAutocomplete Keyboard)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Focus Client field
2. Press Arrow Down (dropdown opens)
3. Press Arrow Down to highlight second item
4. Press Arrow Up to go back
5. Press Enter to select
6. Focus Client field again
7. Press Escape to close dropdown without selecting

**Expected Results:**
- [ ] Arrow Down opens dropdown
- [ ] Arrow Down/Up navigates suggestions
- [ ] Enter selects highlighted suggestion
- [ ] Escape closes dropdown without selecting
- [ ] Escape on dropdown does NOT close the modal

---

### JCF-012: Client Session Learning

**Feature:** JCF-032, JCF-050 - JCF-051 (Session Learning)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click Client field
2. Type "NouveauClient" (doesn't exist in suggestions)
3. Blur the field (click outside)
4. Click Client field again

**Expected Results:**
- [ ] New client name "NouveauClient" appears in suggestions
- [ ] New client has "nouveau" category badge
- [ ] Session-learned values appear first in suggestions

---

### JCF-013: Elements Table Grid Layout

**Feature:** JCF-035 - JCF-038, JCF-041 (Elements Table Layout)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open (via `?fixture=elements-table` or "+" button)

**Steps:**
1. Look at the Elements Table below Job Header
2. Count visible rows
3. Scroll horizontally if needed

**Expected Results:**
- [ ] Elements Table visible below Job Header
- [ ] Default element "ELT" displayed in header
- [ ] 12 row labels visible: Precedences, Quantité, Pagination, Format, Papier, Impression, Surfacage, Autres, Imposition, Qté feuilles, Commentaires
- [ ] Sequence row visible as last row
- [ ] Left label column is sticky (stays visible on horizontal scroll)

---

### JCF-014: Elements Table Precedences Row

**Feature:** JCF-038 (Precedences Row)
**Fixture:** `elements-table`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Look at the first row (Precedences)

**Expected Results:**
- [ ] Precedences row has dimmed styling (darker background)
- [ ] Git-branch icon (Lucide) visible in label
- [ ] Text color is muted (zinc-600)

---

### JCF-015: Element Name Display and Editing

**Feature:** JCF-036, JCF-037 (Element Header, Name Editing)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open with default element

**Steps:**
1. Click on element name "ELT" in header
2. Verify edit mode activates
3. Type "COUV"
4. Press Enter
5. Verify name saved
6. Click on name again
7. Type "TEST"
8. Press Escape
9. Verify original name restored

**Expected Results:**
- [ ] Click on name "ELT" opens inline edit input
- [ ] Input has autoFocus and text selected
- [ ] Enter key saves new name "COUV"
- [ ] Escape key cancels edit, restores original name
- [ ] Blur (click outside) also saves new name
- [ ] Empty name cancels edit

---

### JCF-016: Add Element Button

**Feature:** JCF-040 (Add/Remove Element)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open with default element

**Steps:**
1. Click the "+" button next to element name
2. Observe new element added
3. Click "+" again

**Expected Results:**
- [ ] "+" button visible in element header
- [ ] Click adds new element "ELEM1" to the right
- [ ] Click again adds "ELEM2"
- [ ] New elements have all field rows

---

### JCF-017: Remove Element Button

**Feature:** JCF-040 (Add/Remove Element)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open with multiple elements

**Steps:**
1. Add a second element
2. Click the "−" button on second element
3. Observe element removed
4. Try to remove last remaining element

**Expected Results:**
- [ ] "−" button visible in element header
- [ ] Click removes the element
- [ ] With only 1 element: "−" button is disabled
- [ ] Cannot delete last element

---

### JCF-018: Sequence Row (Multi-line Textarea)

**Feature:** JCF-039 (Sequence Row)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click Sequence field
2. Type multiple lines:
   ```
   Komori(30+60)
   Polar 115(20)
   ```
3. Observe textarea expands

**Expected Results:**
- [ ] Sequence field is multi-line textarea
- [ ] Textarea auto-expands as content grows
- [ ] Multiple lines can be entered
- [ ] Monospace font

---

### JCF-019: Commentaires Row (Auto-expanding Textarea)

**Feature:** JCF-038 (Commentaires Field)
**Fixture:** `elements-table`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click Commentaires field
2. Type a long multi-line comment

**Expected Results:**
- [ ] Commentaires field is textarea
- [ ] Auto-expands on multi-line input
- [ ] No visible scrollbar initially

---

### JCF-020: Tab Navigation in Elements Table

**Feature:** JCF-042 - JCF-044 (Cell ID, focusCell, Tab Navigation)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click into first element's Quantité field
2. Press Tab repeatedly through all rows
3. Observe navigation pattern

**Expected Results:**
- [ ] Tab moves focus down within the column (vertical movement)
- [ ] Tab from last row (Sequence) moves to first row (Precedences) of next element
- [ ] Tab from last cell of entire table exits table naturally
- [ ] Shift+Tab moves in reverse direction

---

### JCF-021: Alt+Arrow Navigation (Circular Wrap)

**Feature:** JCF-045 (Alt+Arrow Navigation)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open with multiple elements

**Steps:**
1. Click into middle row of first element
2. Press Alt+↓ repeatedly until wrap
3. Press Alt+→ to move to next column
4. Press Alt+→ on last column

**Expected Results:**
- [ ] Alt+↓ moves down within column
- [ ] Alt+↓ from last row wraps to first row (Precedences)
- [ ] Alt+↑ from first row wraps to last row
- [ ] Alt+→ moves to next column (same row)
- [ ] Alt+→ from last column wraps to first column
- [ ] Alt+← moves to previous column
- [ ] Alt+← from first column wraps to last column

---

### JCF-022: Enter Key in Table Cells

**Feature:** JCF-046 (Enter Key Behavior)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click into Quantité field
2. Type "500"
3. Press Enter
4. Observe focus moves
5. Click into Commentaires field (textarea)
6. Type some text
7. Press Enter

**Expected Results:**
- [ ] Enter in text input moves focus to next cell (same as Tab)
- [ ] Enter in Commentaires textarea adds newline (does NOT navigate)
- [ ] Enter in Sequence textarea adds newline

---

### JCF-023: Escape Key in Table Cells

**Feature:** JCF-047 (Escape Key Behavior)
**Fixture:** `elements-table`
**Priority:** P1

**Preconditions:**
- JCF modal is open

**Steps:**
1. Click into any table cell
2. Type some text
3. Press Escape
4. Press Escape again

**Expected Results:**
- [ ] First Escape blurs the cell (focus leaves input)
- [ ] Second Escape closes the modal (as expected)

---

### JCF-024: Autocomplete Tab/Arrow Delegation

**Feature:** JCF-048, JCF-049 (onTabOut, onArrowNav)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Focus Client autocomplete in Job Header
2. Open dropdown
3. Press Tab

**Expected Results:**
- [ ] Tab closes dropdown
- [ ] Focus moves to next field normally
- [ ] Dropdown does not interfere with table navigation

---

### JCF-025: Numeric Field Alignment

**Feature:** JCF-038 (Numeric Alignment)
**Fixture:** `elements-table`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Type values in Quantité, Pagination, Qté feuilles fields
2. Observe text alignment

**Expected Results:**
- [ ] Quantité field text is right-aligned
- [ ] Pagination field text is right-aligned
- [ ] Qté feuilles field text is right-aligned
- [ ] All use monospace font

---

### JCF-026: Default Element Values

**Feature:** JCF-038 (Default Element)
**Fixture:** `elements-table`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Look at default element values

**Expected Results:**
- [ ] Element name is "ELT"
- [ ] Quantité default value is "1"
- [ ] All other fields are empty

---

### JCF-027: Element Name Auto-Generation

**Feature:** JCF-037 (Name Generation)
**Fixture:** `elements-table`
**Priority:** P2

**Preconditions:**
- JCF modal is open

**Steps:**
1. Add element → "ELEM1"
2. Add element → "ELEM2"
3. Remove "ELEM1"
4. Add element → observe name

**Expected Results:**
- [ ] Auto-generated names follow pattern: ELEM1, ELEM2, ELEM3...
- [ ] After removing ELEM1, next add creates ELEM3 (not ELEM1)
- [ ] Name generation scans existing names for max number

---

### JCF-028: Modal Reset on Close

**Feature:** JCF-018 (Modal State Reset)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- JCF modal is open with entered data

**Steps:**
1. Enter data in Job Header fields
2. Add elements to table
3. Close modal
4. Reopen modal

**Expected Results:**
- [ ] All fields reset to default
- [ ] Job ID is regenerated (new ID)
- [ ] Elements table resets to single default element

---

## Visual Checklist

### JCF Modal
- [ ] Modal is 70vw wide, max 1400px, max 90vh tall
- [ ] Backdrop is bg-black/60 with backdrop-blur-sm
- [ ] Header shows "Nouveau Job" title with X close button
- [ ] Footer has keyboard hints in small text

### Job Header
- [ ] Fields in horizontal row: ID, Client, Template, Intitulé, Quantité, Deadline
- [ ] Job ID has monospace font, muted styling
- [ ] Deadline has calendar icon
- [ ] Autocomplete dropdowns have dark background (zinc-800)

### Elements Table
- [ ] Grid column width ~288px per element
- [ ] Label column ~100px, sticky on scroll
- [ ] Precedences row has dimmed styling with git-branch icon
- [ ] Input fields are transparent with border on hover/focus
- [ ] Monospace font for all inputs
- [ ] Add (+) button is green on hover
- [ ] Remove (−) button is red on hover

### Autocomplete Dropdown
- [ ] Highlighted item: blue-600 background, white text
- [ ] Category badges: right-aligned, small rounded pill
- [ ] Text highlighting: matching substring bold+blue

---

## Edge Cases

### JCF-E01: Close Modal with Unsaved Data
**Feature:** JCF-020
**Steps:** Enter data, click backdrop to close
**Expected:** Modal closes, data lost (no confirmation dialog)

### JCF-E02: Empty Client Name Session Learning
**Feature:** JCF-032
**Steps:** Focus Client, blur without typing anything
**Expected:** No empty entry added to session

### JCF-E03: Escape Key Priority
**Feature:** JCF-047
**Steps:** Focus autocomplete with dropdown open, press Escape twice
**Expected:** First Escape closes dropdown, second Escape blurs cell, third Escape closes modal

### JCF-E04: Tab at Table Boundary
**Feature:** JCF-044
**Steps:** Tab from last cell of last element
**Expected:** Focus exits table naturally (native Tab behavior)

### JCF-E05: Invalid Date Input
**Feature:** JCF-026
**Steps:** Type "31/02/2026" in Deadline field
**Expected:** Invalid date handled gracefully (returns empty or shows error)

---

## Cross-Feature Interactions

### Modal + Elements Table
- Escape key handled correctly (cell blur vs modal close)
- Modal close resets all table state

### Autocomplete + Table Navigation
- Tab in autocomplete delegates to table navigation
- Dropdown closes before navigation occurs

### Session Learning + Autocomplete
- Session values appear first in suggestions
- New values persist within the same session

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Modal open | < 100ms | Visual inspection |
| Autocomplete filter | < 50ms | Visual inspection |
| Table navigation | Instant | Visual inspection |
| Session learning merge | < 10ms | Code inspection |
