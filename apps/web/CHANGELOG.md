# Changelog - Flux Scheduler Web App

All notable changes to the web application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.59] - 2026-01-15

### Added

- **Pick & Place Feature Parity**
  - DryingTimeIndicator (yellow arrow) now visible during Pick mode
  - Validation messages displayed on PickPreview ghost tile
  - Feature parity with Drag & Drop mode for visual indicators

### Fixed

- Preexisting test failures (workingTime.ts, PrecedenceLines, StationHeader, TaskTile)
- Stations without `operatingSchedule` now treated as 24/7 operation

---

## [0.3.58] - 2026-01-16

### Performance

- **Pick & Place Performance Optimization**
  - Ghost position via RAF + DOM direct manipulation (bypass React re-renders)
  - Validation throttled from 50ms to 100ms
  - Early exit if position within same 15-min slot (~80% reduction in validations)
  - CSS transition 100ms on ring color to mask latency
  - `ghostPositionRef` in PickStateContext for shared real-time position
  - PickPreview refactored to use requestAnimationFrame

### Performance Gains

| Metric | Before | After |
|--------|--------|-------|
| Ghost latency | ~50-100ms | < 16ms |
| Re-renders/sec | ~60 | ~6 |
| Validation calls/sec | ~20 | ~4 |

---

## [0.3.57] - 2026-01-15

### Added

- **Unified Pick & Place from Grid**
  - Click on grid tiles to pick and reschedule
  - Info button (i) on tiles for job details
  - Ghost placeholder for picked tiles
  - `pickSource` ('sidebar' | 'grid') to distinguish placement origin

---

## [0.3.56] - 2026-01-15

### Added

- **Precedence Labels**
  - Contextual labels on precedence lines showing task name and time
  - Format: `↑ TaskName · HH:MM` / `↓ TaskName · HH:MM`
  - Labels include drying time in effective time calculation

---

## [0.3.55] - 2026-01-14

### Added

- **Pick & Place Visual Feedback**
  - Real-time ring color validation during hover
  - Green/red/orange ring based on validation result
  - Throttled validation for performance
  - Scroll to station on pick

---

## [0.3.54] - 2026-01-13

### Added

- **Pick & Place Mode**
  - Click-to-pick, click-to-place pattern from sidebar
  - PickPreview component for WYSIWYG ghost
  - PickStateContext for state management
  - Escape key to cancel pick

---

## [0.3.53] - 2026-01-12

### Added

- **Precedence Lines + Working Hours**
  - Visual precedence constraint lines during drag
  - Working hours calculation in effective height
