---
tags:
  - specification
  - ux-ui
  - nfr
---

# Non-Functional Requirements – Flux Scheduling UI

This document specifies non-functional requirements (NFR) for the scheduling UI.

---

## NFR-UI-PERF: Performance Requirements

### NFR-UI-PERF-001: Drag Feedback Latency

| Attribute | Value |
|-----------|-------|
| **Requirement** | Drag preview must follow cursor with < 10ms latency |
| **Rationale** | Drag operations must feel instantaneous for power users |
| **Measurement** | Frame timing during drag operation |
| **Priority** | Critical |

### NFR-UI-PERF-002: Grid Render Time

| Attribute | Value |
|-----------|-------|
| **Requirement** | Grid with 100 tiles must render in < 100ms |
| **Rationale** | Typical daily view contains 50-100 tiles |
| **Measurement** | React profiler, Lighthouse |
| **Priority** | High |

### NFR-UI-PERF-003: Initial Load Time

| Attribute | Value |
|-----------|-------|
| **Requirement** | Application must be interactive within 2 seconds |
| **Rationale** | Schedulers start their day with the app |
| **Measurement** | Time to Interactive (TTI) |
| **Priority** | High |

### NFR-UI-PERF-004: Animation Frame Rate

| Attribute | Value |
|-----------|-------|
| **Requirement** | All animations must maintain 60 FPS |
| **Rationale** | Smooth visual feedback during interactions |
| **Measurement** | Chrome DevTools Performance panel |
| **Priority** | High |

### NFR-UI-PERF-005: Memory Usage

| Attribute | Value |
|-----------|-------|
| **Requirement** | Memory usage < 200MB for typical workload |
| **Rationale** | App may run all day without refresh |
| **Measurement** | Chrome Task Manager |
| **Priority** | Medium |

---

## NFR-UI-COMPAT: Browser Compatibility

### NFR-UI-COMPAT-001: Supported Browsers

| Browser | Minimum Version | Support Level |
|---------|-----------------|---------------|
| Chrome | 120+ | Full |
| Firefox | 120+ | Full |
| Safari | 17+ | Full |
| Edge | 120+ | Full |

### NFR-UI-COMPAT-002: Viewport Requirements

| Attribute | Value |
|-----------|-------|
| **Minimum Width** | 1280px |
| **Minimum Height** | 720px |
| **Recommended** | 1920x1080 |
| **Rationale** | Information-dense scheduling interface |

### NFR-UI-COMPAT-003: Touch Device Support

| Attribute | Value |
|-----------|-------|
| **Status** | Out of scope for MVP |
| **Rationale** | Power-user desktop application |
| **Future** | May add touch support post-MVP |

---

## NFR-UI-A11Y: Accessibility

### NFR-UI-A11Y-001: Keyboard Navigation

| Attribute | Value |
|-----------|-------|
| **Requirement** | All critical actions accessible via keyboard |
| **Coverage** | Job navigation, date navigation, quick placement |
| **Standard** | WCAG 2.1 Level A (keyboard) |
| **Priority** | High |

### NFR-UI-A11Y-002: Color Contrast

| Attribute | Value |
|-----------|-------|
| **Requirement** | WCAG AA compliance (4.5:1 for text) |
| **Exception** | Decorative elements, muted states |
| **Verification** | Automated contrast checking |
| **Priority** | Medium |

### NFR-UI-A11Y-003: Screen Reader Support

| Attribute | Value |
|-----------|-------|
| **Status** | Not required for MVP |
| **Rationale** | Internal tool for experienced users |
| **Future** | May add ARIA labels post-MVP |

### NFR-UI-A11Y-004: Reduced Motion

| Attribute | Value |
|-----------|-------|
| **Requirement** | Respect `prefers-reduced-motion` setting |
| **Implementation** | Disable animations when preference set |
| **Priority** | Low |

---

## NFR-UI-I18N: Internationalization

### NFR-UI-I18N-001: Date Format

| Attribute | Value |
|-----------|-------|
| **Primary** | French locale (DD/MM/YYYY) |
| **Configurability** | Locale-specific via settings |
| **Library** | date-fns with locale support |

### NFR-UI-I18N-002: Time Format

| Attribute | Value |
|-----------|-------|
| **Format** | 24-hour (HH:mm) |
| **Rationale** | French standard, no AM/PM ambiguity |
| **Example** | 14:30, not 2:30 PM |

### NFR-UI-I18N-003: Language Support

| Attribute | Value |
|-----------|-------|
| **Primary** | French |
| **Future** | English, other languages post-MVP |
| **RTL Support** | Not required |

---

## NFR-UI-UX: User Experience

### NFR-UI-UX-001: Response Feedback

| Attribute | Value |
|-----------|-------|
| **Requirement** | All user actions must have immediate visual feedback |
| **Examples** | Hover states, click feedback, drag preview |
| **Latency** | < 50ms for visual acknowledgment |

### NFR-UI-UX-002: Error Recovery

| Attribute | Value |
|-----------|-------|
| **Requirement** | Users must be able to undo or recover from errors |
| **Mechanisms** | Tile recall, drag cancel (Escape), validation warnings |
| **Data Loss** | No data loss on network errors |

### NFR-UI-UX-003: Consistency

| Attribute | Value |
|-----------|-------|
| **Requirement** | Consistent interaction patterns throughout UI |
| **Examples** | Same keyboard shortcuts, same visual feedback colors |
| **Documentation** | All patterns documented in this specification |

### NFR-UI-UX-004: Learning Curve

| Attribute | Value |
|-----------|-------|
| **Target** | Power users productive within 1 hour |
| **Support** | Keyboard shortcuts help (post-MVP) |
| **Tooltips** | Show shortcuts on hover (post-MVP) |

---

## NFR-UI-MAINT: Maintainability

### NFR-UI-MAINT-001: Component Architecture

| Attribute | Value |
|-----------|-------|
| **Pattern** | Modular React components |
| **Styling** | Tailwind CSS with design tokens |
| **State** | React Context for shared state |

### NFR-UI-MAINT-002: Type Safety

| Attribute | Value |
|-----------|-------|
| **Requirement** | Full TypeScript coverage |
| **Strict Mode** | Enabled |
| **External Types** | @flux/types package |

### NFR-UI-MAINT-003: Testing

| Attribute | Value |
|-----------|-------|
| **E2E Tests** | Playwright for critical paths |
| **Reliability** | 100% pass rate target |
| **Coverage** | All drag-drop interactions |

---

## NFR-UI-SEC: Security

### NFR-UI-SEC-001: Input Validation

| Attribute | Value |
|-----------|-------|
| **Requirement** | All user inputs validated client-side AND server-side |
| **XSS Prevention** | React's built-in escaping |
| **CSRF** | Token-based protection via API |

### NFR-UI-SEC-002: Data Exposure

| Attribute | Value |
|-----------|-------|
| **Requirement** | No sensitive data in browser console or network requests |
| **Logging** | Minimal client-side logging in production |

---

## Compliance Matrix

| NFR ID | Status | Test Method |
|--------|--------|-------------|
| NFR-UI-PERF-001 | Implemented | Manual timing |
| NFR-UI-PERF-002 | Implemented | React Profiler |
| NFR-UI-PERF-003 | Implemented | Lighthouse |
| NFR-UI-PERF-004 | Implemented | DevTools |
| NFR-UI-COMPAT-001 | Implemented | Manual testing |
| NFR-UI-COMPAT-002 | Implemented | Responsive testing |
| NFR-UI-A11Y-001 | Implemented | Manual keyboard testing |
| NFR-UI-A11Y-002 | Partial | Contrast checker |
| NFR-UI-I18N-002 | Implemented | Code inspection |
| NFR-UI-UX-001 | Implemented | Visual inspection |
| NFR-UI-MAINT-002 | Implemented | TypeScript compilation |
| NFR-UI-MAINT-003 | Implemented | Playwright CI |

---

## Related Documents

- [Performance Targets](../07-open-questions.md#performance-targets-validated)
- [Accessibility](../07-open-questions.md#accessibility-resolved)
- [Internationalization](../07-open-questions.md#internationalization-resolved)
