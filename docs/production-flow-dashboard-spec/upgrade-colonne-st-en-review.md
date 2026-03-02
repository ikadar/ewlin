# Review: `upgrade-colonne-st-en.md`

**Date:** 2026-03-02

---

## Summary

Adds an ST (Sous-traitance / Subcontracting) column to the Flux table with a 3-state checkbox system and a new "S-T a faire" tab. The spec is well-structured, but contains several architectural incompatibilities with the React codebase.

---

## What Works Well

**Reference data detail** — The reference data table (§3.3) is populated with concrete jobs and statuses. The verification matrix in §7.5 explicitly validates the filter logic (3 visible rows). Always useful.

**3-state cycle** — Clearly defined: `pending → progress → done → pending`. SVG icons are precisely specified.

**Filter criterion** — Well-stated: both `pending` and `progress` keep a job in the "S-T a faire" filter; only `done` on all tasks removes it.

---

## Issues and Open Questions

### 1. Missing `mockup2.html`

§8 references an interactive `mockup2.html` and screenshots that do not yet exist. This is the most critical gap — the entire visual intent cannot be verified without it.

### 2. Data model — element key (label vs id)

The multi-element structure uses the element **label** as the dictionary key:

```
ST[jobId] = { 'Couverture': [...], 'Interieur': [...] }
```

In the current codebase, elements have both an `id` and a `label`. If two elements share the same label (not impossible), a collision occurs. **The `id` field should be used as the key.**

### 3. API contract is entirely absent

The spec is built on static mock data and does not define:

- Where does ST data come from? Does the `/api/flux-jobs` response extend? Separate endpoint?
- How does a checkbox click persist? (`PATCH /api/jobs/{id}/subcontracting`?)
- Backend schema: does the PHP API already have this field?

This is a blocking question — without it, any implementation remains mock-only.

### 4. Implementation checklist uses vanilla JS patterns

The §9 checklist and §5–6 descriptions are written entirely in terms of the `mockup.html` vanilla JS approach (`initSTCheckboxes`, `renderSTCell`, `_stInit` flag, document-level event delegation). The React app cannot use these patterns. The equivalent React architecture:

| Mockup pattern | React equivalent |
|---|---|
| `initSTCheckboxes()` + `_stInit` flag | React state / `useCallback` |
| `renderSTCell()` / `renderFlatSTCell()` | `<STCell>` component |
| `data-st-pending` attribute on rows | `computeTabCounts()` extension |
| `updateSTPending(jobId)` | RTK Query cache update (optimistic) |
| Document-level tooltip delegation | Floating UI / custom hook |

### 5. Tooltip — not React-compatible

The `fixed`-positioned, `mousemove`-following tooltip (§4.3) is a vanilla JS pattern. In React this would be handled with Radix Tooltip or Floating UI — though it is worth asking: is this complexity necessary at all, given the label is already clipped by `max-width: 160px`?

### 6. Misleading CSS class assumption

> *".st-done and .st-pending classes already existed in the station theme"*

This is true in `mockup.html`, but these classes **do not exist** in the React app — Tailwind utility classes are used throughout. This statement is misleading.

### 7. Is the ST column sortable?

Not defined. The v0.5.21 spec treats station columns as non-sortable; ST is a similar category, but explicit confirmation is absent.

---

## Summary Assessment

| Dimension | Assessment |
|---|---|
| Visual spec | ⚠️ Incomplete — `mockup2.html` missing |
| Data model | ✅ Good, but element key (label vs id) needs fixing |
| API contract | ❌ Missing |
| React architecture compatibility | ❌ Not adapted |
| Filter / tab logic | ✅ Well defined |
| Implementation checklist | ⚠️ Mockup-specific, needs React translation |

**Status: not implementable in current form.** The two prerequisites for moving forward:

1. Create `mockup2.html` (visual reference)
2. Define the API contract (backend schema + endpoints)
