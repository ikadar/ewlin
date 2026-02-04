---
tags:
  - specification
  - architecture
---

# Project Structure — Flux Print Shop Scheduling System

This document defines the **repository structure** using a host application with git submodules.

---

## 1. Repository Layout

```
ewlin/                              # Host application (this repo)
├── docs/                           # Documentation
│   ├── roadmap/                    # Release roadmap
│   ├── releases/                   # Release documents
│   ├── architecture/               # ADRs, design docs
│   └── domain-model/               # Business rules, vocabulary
├── apps/
│   └── web/                        # React frontend application
├── packages/                       # Shared packages (git submodules)
│   ├── types/                      # @flux/types (submodule)
│   └── validator/                  # @flux/schedule-validator (submodule)
├── services/                       # Backend services
│   └── php-api/                    # PHP/Symfony backend (submodule)
├── docker-compose.yml
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
└── turbo.json                      # Turborepo config
```

---

## 2. Git Submodules

| Submodule | Repository | Purpose |
|-----------|------------|---------|
| `packages/types` | ewlin-types | Shared TypeScript type definitions (@flux/types) |
| `packages/validator` | ewlin-validator | Isomorphic schedule validation logic (@flux/schedule-validator) |
| `services/php-api` | ewlin-php-api | PHP/Symfony backend API |

---

## 3. Frontend Application Structure

```
apps/web/
├── public/
├── src/
│   ├── components/
│   │   ├── DateStrip/              # Date strip with task markers and exit triangles
│   │   │   ├── DateStrip.tsx
│   │   │   ├── DateCell.tsx
│   │   │   ├── ExitTriangle.tsx
│   │   │   ├── TaskMarkers.tsx
│   │   │   └── ViewportIndicator.tsx
│   │   ├── DragPreview/            # Drag preview with validation feedback
│   │   │   ├── DragPreview.tsx
│   │   │   ├── ValidationMessage.tsx
│   │   │   └── snapUtils.ts
│   │   ├── DryingTimeIndicator/    # Visual dry time indicator
│   │   │   └── DryingTimeIndicator.tsx
│   │   ├── JobDetailsPanel/        # Job detail side panel with elements
│   │   │   ├── JobDetailsPanel.tsx
│   │   │   ├── ElementSection.tsx  # Element layer UI
│   │   │   ├── JobInfo.tsx
│   │   │   ├── JobStatus.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskTile.tsx
│   │   │   ├── DryTimeLabel.tsx
│   │   │   └── InfoField.tsx
│   │   ├── JobsList/               # Jobs list sidebar
│   │   │   ├── JobsList.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobsListHeader.tsx
│   │   │   ├── JobsSection.tsx
│   │   │   ├── ProblemsSection.tsx
│   │   │   ├── ProgressDots.tsx
│   │   │   └── ProgressSegments.tsx
│   │   ├── PlacementIndicator/     # Visual placement indicator
│   │   │   └── PlacementIndicator.tsx
│   │   ├── PrecedenceLines/        # Precedence constraint visualization
│   │   │   └── PrecedenceLines.tsx
│   │   ├── ProviderColumn/         # Outsourced provider column
│   │   │   ├── ProviderColumn.tsx
│   │   │   └── ProviderHeader.tsx
│   │   ├── SchedulingGrid/         # Main scheduling grid
│   │   │   └── SchedulingGrid.tsx
│   │   ├── Sidebar/                # Collapsible sidebar
│   │   │   ├── Sidebar.tsx
│   │   │   └── SidebarButton.tsx
│   │   ├── StationColumns/         # Station column layout
│   │   │   ├── StationColumns.tsx
│   │   │   ├── StationColumn.tsx
│   │   │   └── UnavailabilityOverlay.tsx
│   │   ├── StationHeaders/         # Station header row
│   │   │   ├── StationHeaders.tsx
│   │   │   ├── StationHeader.tsx
│   │   │   └── OffScreenIndicator.tsx
│   │   ├── Tile/                   # Task tile (assignment block)
│   │   │   ├── Tile.tsx
│   │   │   ├── TileContextMenu.tsx
│   │   │   ├── SimilarityIndicators.tsx
│   │   │   ├── SwapButtons.tsx
│   │   │   ├── colorUtils.ts
│   │   │   └── similarityUtils.ts
│   │   ├── TimelineColumn/         # Time axis
│   │   │   ├── TimelineColumn.tsx
│   │   │   ├── HourMarker.tsx
│   │   │   └── NowLine.tsx
│   │   ├── TopNavBar/              # Top navigation bar
│   │   │   └── TopNavBar.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useDropValidation.ts    # Drop target validation
│   │   └── useVirtualScroll.ts     # Virtual scrolling for large grids
│   ├── pick/                       # Pick & place interaction
│   │   ├── PickPreview.tsx
│   │   └── PickStateContext.tsx
│   ├── mock/                       # Mock data system
│   │   ├── api.ts                  # Mock API implementation
│   │   ├── snapshot.ts             # Snapshot generation
│   │   ├── generators/
│   │   │   ├── stations.ts
│   │   │   ├── jobs.ts
│   │   │   ├── elements.ts         # Element generator
│   │   │   └── assignments.ts
│   │   ├── fixtures/               # Test fixtures (24 scenario files)
│   │   │   ├── basic.ts
│   │   │   ├── element-precedence.ts
│   │   │   ├── precedence.ts
│   │   │   ├── drying-time.ts
│   │   │   ├── drag-snapping.ts
│   │   │   ├── pick-place.ts
│   │   │   ├── swap.ts
│   │   │   └── ...                 # 17 more fixture files
│   │   ├── testFixtures.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── compactTimeline.ts      # Timeline compaction
│   │   ├── dragOffset.ts           # Drag offset calculations
│   │   ├── generateId.ts           # ID generation
│   │   ├── groupCapacity.ts        # Station group capacity
│   │   ├── keyboardNavigation.ts   # Keyboard nav helpers
│   │   ├── precedenceConstraints.ts # Precedence constraint logic
│   │   ├── pushDown.ts             # Push-down collision resolution
│   │   ├── quickPlacement.ts       # Quick placement calculations
│   │   ├── subcolumnLayout.ts      # Subcolumn layout engine
│   │   ├── swap.ts                 # Task swap logic
│   │   ├── taskHelpers.ts          # Task utility functions
│   │   ├── timeCalculations.ts     # Time math utilities
│   │   ├── validationMessages.ts   # Validation message formatting
│   │   └── workingTime.ts          # Working time calculations
│   ├── test/
│   │   └── setup.ts                # Test setup (Vitest)
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 4. Scheduling Page Layout

The main scheduling page uses a grid-based layout with stations as columns and time as the vertical axis:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Flux Scheduler                              [Zoom] [Nav]  [User] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ ┌────────────┐ │
│ │  DATE STRIP (workshop exit dates, task markers)          │ │            │ │
│ ├────────┬──────────┬──────────┬──────────┬───────────────┤ │  SIDEBAR   │ │
│ │Timeline│Station 1 │Station 2 │Station 3 │ Provider Col  │ │            │ │
│ │        │(headers with group names)       │ (outsourced)  │ │ Jobs List  │ │
│ │ 08:00  │┌────────┐│          │          │               │ │ ────────── │ │
│ │        ││ Tile   ││          │┌────────┐│               │ │ [Job-1]    │ │
│ │ 09:00  ││(job    ││┌────────┐││ Tile   ││  ┌────────┐  │ │  Elements  │ │
│ │        ││ color) │││ Tile   │││        ││  │Provider│  │ │  Tasks     │ │
│ │ 10:00  │└────────┘││        ││└────────┘│  │  Tile  │  │ │ [Job-2]    │ │
│ │        │┌────────┐│└────────┘│          │  └────────┘  │ │  Elements  │ │
│ │ 11:00  ││ Tile   ││          │          │               │ │  Tasks     │ │
│ │        ││(simil.)││          │          │               │ │            │ │
│ │ 12:00  │└────────┘│          │          │               │ ├────────────┤ │
│ │        │          │          │          │               │ │Job Details │ │
│ │ 13:00  │ ╎drying╎ │          │          │               │ │────────────│ │
│ │        │ ╎ time  ╎ │          │          │               │ │ Elements   │ │
│ │ 14:00  │          │          │          │               │ │ Tasks      │ │
│ │        │          │          │          │               │ │ Status     │ │
│ └────────┴──────────┴──────────┴──────────┴───────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Layout Components:**
- **DateStrip**: Shows workshop exit dates with task markers and viewport indicator
- **TimelineColumn**: Vertical time axis with hour markers and now-line
- **StationColumns**: One column per station, grouped by station groups
- **StationHeaders**: Station name + group name, with off-screen indicators
- **ProviderColumn**: Separate column for outsourced provider assignments
- **Tiles**: Task assignment blocks with job color, similarity indicators, swap buttons
- **DryingTimeIndicator**: Visual indicator for 4h dry time after printing tasks
- **PrecedenceLines**: Lines connecting related tiles (intra-element and cross-element)
- **Sidebar**: Collapsible panel with jobs list and job detail panel
- **JobDetailsPanel**: Shows job info, elements, tasks per element, proof approval status

**Interaction Patterns:**
- Drag & drop tiles from sidebar to station columns (with validation feedback)
- Pick & place mode for keyboard-accessible assignment
- Context menu on tiles (reschedule, unassign, swap, toggle completion)
- Alt-key bypass for precedence override

---

## 5. Mock Data System

The frontend uses a mock data system with fixture-based scenarios for development and testing:

```
mock/
├── api.ts              # Mock API with simulated latency
├── snapshot.ts         # ScheduleSnapshot assembly
├── generators/         # Data generators using @faker-js/faker
│   ├── stations.ts     # Station, category, group generators
│   ├── jobs.ts         # Job generator with elements
│   ├── elements.ts     # Element generator with tasks
│   └── assignments.ts  # Assignment generator
├── fixtures/           # Scenario-specific test data
│   ├── basic.ts        # Basic scheduling scenario
│   ├── element-precedence.ts  # Cross-element precedence
│   ├── drying-time.ts  # Dry time visualization
│   ├── precedence.ts   # Intra-element precedence
│   └── ...             # 20+ fixture files for specific features
└── testFixtures.ts     # Shared fixture utilities
```

Each fixture file exports a complete `ScheduleSnapshot` for a specific testing scenario. The mock API serves these fixtures based on configuration.

---

## 6. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.2 |
| State Management | Redux Toolkit | 2.11 |
| Styling | Tailwind CSS | 4.1 |
| Icons | Lucide React | 0.560 |
| Date utilities | date-fns | 4.1 |
| Mock data | @faker-js/faker | 10.1 |
| Build tool | Vite | — |
| Unit tests | Vitest | 4.0 |
| E2E tests | Playwright | 1.57 |
| E2E tests (legacy) | Cypress | 15.8 |
| Shared types | @flux/types | local |
| Shared validation | @flux/schedule-validator | local |
| Backend | PHP/Symfony 7 | — |
| Database | MariaDB | — |
| Package manager | pnpm | — |
| Monorepo | Turborepo | — |

---

## 7. Development Workflow

### UI Developer
```bash
# Clone and setup
git clone ewlin
cd ewlin
pnpm install

# Start frontend (uses mock data by default)
cd apps/web
pnpm dev

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

### Backend Developer
```bash
# Work on PHP API
cd services/php-api
# ... develop backend (Symfony CLI or Docker)

# Work on validation package
cd packages/validator
pnpm test

# Run full stack
docker-compose up
```

### Shared Types Workflow
```bash
# Update types
cd packages/types
# Edit type definitions
pnpm build

# Both frontend and validator consume @flux/types
# Changes propagate through pnpm workspace linking
```

---

## 8. Key Files for Development

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main application entry, layout assembly |
| `src/components/SchedulingGrid/` | Main scheduling grid orchestration |
| `src/components/StationColumns/` | Station column rendering |
| `src/components/Tile/` | Task tile (assignment block) rendering |
| `src/components/JobDetailsPanel/` | Job details with element sections |
| `src/components/PrecedenceLines/` | Precedence constraint visualization |
| `src/hooks/useDropValidation.ts` | Drop target validation logic |
| `src/mock/fixtures/` | Test scenario data |
| `src/mock/generators/elements.ts` | Element mock data generation |
| `src/utils/precedenceConstraints.ts` | Precedence constraint calculations |
| `src/utils/subcolumnLayout.ts` | Subcolumn layout engine |

---

## 9. Notes

- The frontend operates with mock data by default — no backend required for UI development
- `@flux/schedule-validator` provides isomorphic validation (same logic on client and server)
- `@flux/types` defines all shared interfaces: Station, Job, Element, Task, Assignment, ScheduleSnapshot
- Mock fixtures cover specific scenarios (element precedence, drying time, drag snapping, etc.)
- The Element layer is fully integrated in the frontend (ElementSection, element generators, element-precedence fixture)
- Tests use Vitest for unit tests and Playwright for E2E tests
