# Deterministic Operator Scheduling Algorithm — Analysis & Discussion

> **Date:** 2026-03-28 (updated 2026-04-04)
> **Source:** `docs/external/algo-déterministe-opérateurs.pdf`

This document captures the full analysis and discussion of the deterministic two-pass scheduling algorithm with integrated operator assignment.

## Key Corrections (2026-04-04 review)

### §4.8 — Sub-Loop LAST Check (CORRECTED)
The LAST safety check fires **unconditionally at every Ut** of the sub-loop — regardless of whether the operator is available or not. It is NOT nested inside the "no resource" branch. The original analysis incorrectly placed the LAST check inside the NON cascade; the algorithm as designed checks LAST at every Ut in both branches.

Confirmed by Julien (2026-04-04).

### §5.1 — RESOLVED
The LAST check is unconditional. No action needed. Pre-split (§4.10) further reduces monopolization but is not the primary safeguard.

---

*Full document to be migrated from previous sandbox.*
