---
description: Verify traceability for one or more specification items
---

# Spec Check: $ARGUMENTS

Verify traceability for the specified specification item(s).

**Input:** $ARGUMENTS (one or more spec IDs, comma-separated)

## Step 1: Parse Input

Parse the input to extract spec IDs. Supported formats:
- Single: `US-GATE-001`
- Multiple: `US-GATE-001, AC-GATE-001, BR-GATE-001`

## Step 2: Validate Each Spec

For each spec ID, perform validation based on its type:

### Validation Rules by Type

| Type | Check | Required | Optional |
|------|-------|----------|----------|
| US | ACs referencing this US | min 1 AC | - |
| AC | References line, US ref | US | BR, API/UX |
| BR | Referenced by AC or technical spec | min 1 ref | - |
| API | AC reference | AC | IC |
| IC | API reference | API | - |
| UX | US/AC reference | AC or US | DS |
| DS | Referenced by UX | min 1 UX | - |

### For Each Spec ID:

1. **Find the spec** in `docs/` using grep for the ID as h4 heading (`#### {ID}`)

2. **Extract spec content** - read the section

3. **Check "References FROM"** (what this spec references):
   - Parse the `> **References:**` line
   - Verify each referenced ID exists
   - Report missing/broken references

4. **Check "References TO"** (what references this spec):
   - Search `docs/` for references to this ID
   - Search `src/` and `apps/` for `@spec {ID}` annotations
   - Search `tests/` for test names containing the ID

5. **Apply type-specific rules** from the table above

6. **Determine status:**
   - ✅ Complete - all required references exist
   - ⚠️ Incomplete - optional references missing
   - ❌ Invalid - required references missing or broken

## Step 3: Generate Report

### Single Spec Output:

```markdown
## {ID} Traceability Report

**Spec found:** {file path}:{line number}
> {first line of spec content}

**References FROM this {type}:**
├── {type}: {ID} ✅/❌
├── {type}: {ID} ✅/❌
└── ...

**References TO this {type}:**
├── {ID} ({file}) ✅
├── Code: {file}:{line} (@spec {ID}) ✅
├── Test: {file}:{line} ✅
└── ...

**Status: {Complete/Incomplete/Invalid} {emoji}**
{list of issues if any}

**Suggested fix:** (if incomplete/invalid)
- {suggestion}
```

### Multiple Specs Output:

```markdown
## Spec Check Summary

| ID | Status | Issues |
|----|--------|--------|
| {ID} | ✅ Complete | - |
| {ID} | ⚠️ Incomplete | {brief issue} |
| {ID} | ❌ Invalid | {brief issue} |

**Overall: {n}/{total} complete**

---
**Show details for {first incomplete/invalid ID}? (yes / no / done)**
```

If user requests details, show the single spec output for that ID.

## Step 4: Interactive Details (if multiple specs)

If multiple specs were checked and some have issues:
1. Offer to show details for each incomplete/invalid spec
2. Allow user to navigate: `next / skip / done`

---

## Search Commands Reference

Use these patterns to find specs and references:

**Find spec definition:**
```bash
grep -rn "#### {ID}" docs/
```

**Find references to spec:**
```bash
grep -rn "{ID}" docs/
grep -rn "@spec {ID}" src/ apps/
grep -rn "{ID}" tests/
```

**Find all specs of a type:**
```bash
grep -rn "#### US-" docs/
grep -rn "#### AC-" docs/
grep -rn "#### BR-" docs/
```

---

## Important Rules

- **ALWAYS** check both "References FROM" and "References TO"
- **ALWAYS** verify referenced IDs actually exist
- **ALWAYS** check code traceability (@spec annotations) for AC and BR
- Report issues clearly with file locations
- Provide actionable suggested fixes
- Communication in the user's language (Hungarian for this project)
