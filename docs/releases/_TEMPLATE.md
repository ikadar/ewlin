# Release vX.Y.Z – {Release Title}

> **Status:** 🔴 Not Started | 🟡 In Progress | 🟢 Complete | 🚀 Released
>
> **Milestone:** M{N}
>
> **Target Date:** YYYY-MM-DD
>
> **Git Tag:** `vX.Y.Z`

---

## Overview

{Brief description of what this release delivers and why it matters.}

---

## Prerequisites

{List any releases or external dependencies that must be completed before this release.}

- [ ] `vX.Y.Z-1` released
- [ ] {Other prerequisite}

---

## Scope

### In Scope

- {Feature/capability 1}
- {Feature/capability 2}

### Out of Scope

- {Explicitly excluded item 1}
- {Explicitly excluded item 2}

---

## Related Documentation

### Requirements

| Document | Sections |
|----------|----------|
| [User Stories](../requirements/user-stories.md) | US-XXX-001, US-XXX-002 |
| [Acceptance Criteria](../requirements/acceptance-criteria.md) | AC-XXX-001 |
| [Non-Functional Requirements](../requirements/non-functional-requirements.md) | NFR-XXX |

### Domain Model

| Document | Sections |
|----------|----------|
| [Domain Vocabulary](../domain-model/domain-vocabulary.md) | {Entity}, {Value Object} |
| [Business Rules](../domain-model/business-rules.md) | BR-XXX-001, BR-XXX-002 |
| [Workflow Definitions](../domain-model/workflow-definitions.md) | {Workflow name} |

### Architecture

| Document | Sections |
|----------|----------|
| [Decision Records](../architecture/decision-records.md) | ADR-00X |
| [Service Boundaries](../architecture/service-boundaries.md) | {Service name} |
| [Interface Contracts](../architecture/interface-contracts.md) | {Contract section} |
| [Sequence Design](../architecture/sequence-design.md) | {Flow name} |

### API

| Document | Sections |
|----------|----------|
| [API Interface Drafts](../requirements/api-interface-drafts.md) | {Endpoint group} |

---

## Technical Notes

{Any technical considerations, constraints, or implementation guidance specific to this release.}

---

## Feature Checklist

### {Category 1}

- [ ] **{Feature name}**
  - Description: {What this feature does}
  - Files: `path/to/file.ts`, `path/to/other.php`
  - Tests: `path/to/test.spec.ts`

- [ ] **{Feature name}**
  - Description: {What this feature does}
  - Files: {Files to create/modify}
  - Tests: {Test files}

### {Category 2}

- [ ] **{Feature name}**
  - Description: {What this feature does}
  - Files: {Files to create/modify}
  - Tests: {Test files}

---

## Testing Requirements

### Unit Tests

- [ ] {Test category 1}
- [ ] {Test category 2}

### Integration Tests

- [ ] {Integration test 1}
- [ ] {Integration test 2}

### Manual Testing

- [ ] {Manual test scenario 1}
- [ ] {Manual test scenario 2}

---

## Definition of Done

All items must be checked for the release to be considered complete:

- [ ] All feature checklist items completed
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing completed
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers bumped
- [ ] Git tag created: `vX.Y.Z`

---

## Release Notes Draft

```markdown
## vX.Y.Z – {Release Title}

**Release Date:** YYYY-MM-DD

### Summary

{One paragraph summary of the release.}

### What's New

- {Feature 1}
- {Feature 2}

### Bug Fixes

- {Fix 1} (if applicable)

### Breaking Changes

- {Breaking change 1} (if applicable)

### Migration Guide

{Migration steps if applicable}

### Known Issues

- {Known issue 1} (if applicable)
```

---

## Post-Release

- [ ] GitHub/GitLab release created
- [ ] Team notified
- [ ] Deployment verified
- [ ] Monitoring checked
