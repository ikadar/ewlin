---
tags:
  - meta
  - standards
---

# Documentation Standards

This folder contains the documentation standards and conventions for the Flux project.

## Documents

| Document | Description |
|----------|-------------|
| [Document Structure](document-structure.md) | ID naming, cross-references, content formats, links, maintenance |
| [Source Code Traceability](source-code-traceability.md) | @spec annotations, layer-specific references, coverage goals |
| [Spec-First Development](spec-first-development.md) | Philosophy, workflow, prompt templates, bug handling |
| [Change Governance](change-governance.md) | Top-down change principle, change categories, anti-patterns |

## Quick Reference

### ID Prefixes

| Prefix | Document |
|--------|----------|
| US | User Stories |
| AC | Acceptance Criteria |
| BR | Business Rules |
| WF | Workflow Definitions |
| DM | Domain Model |
| API | API Interface Drafts |
| IC | Interface Contracts |
| AGG | Aggregate Design |
| SB | Service Boundaries |
| UX | UX/UI Specifications |
| DS | Design System |

### Document Hierarchy

```
                    User Stories (US)
                         ↓ 1:n
                 Acceptance Criteria (AC)
                    ↓              ↓
            Backend path      Frontend path
                 ↓                  ↓
    API Interface Drafts (API)   UX/UI Specifications (UX)
                 ↓                  ↓
    Interface Contracts (IC)    Design System (DS)
                 ↓                  ↓
    Aggregate Design (AGG)      Frontend Components
                 ↓
    Service Boundaries (SB)
                 ↓
          Backend Code
```

### Change Categories

| Category | Trigger Required |
|----------|------------------|
| A - Domain | US, AC, or BR (mandatory) |
| B - UI/UX | DS-*, UX-*, or PO approval |
| C - Technical | Justification in commit |

See [Change Governance](change-governance.md) for details.
