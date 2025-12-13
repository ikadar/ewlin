---
tags:
  - specification
  - architecture
---

# Project Structure — Operations Research System

This document defines the **repository structure** using a host application with git submodules.

---

## 1. Repository Layout

```
ewlin/                              # Host application (this repo)
├── docs/                           # Documentation (existing)
├── apps/
│   └── web/                        # React frontend application
├── packages/                       # Shared packages (git submodules)
│   ├── validator/                  # @ewlin/schedule-validator (submodule)
│   ├── ui-components/              # @ewlin/ui-components (submodule, future)
│   └── types/                      # @ewlin/types (submodule)
├── services/                       # Backend services
│   ├── php-api/                    # PHP/Symfony monolith (submodule)
│   └── validation-service/         # Node.js validation service (submodule)
├── docker-compose.yml
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
└── turbo.json                      # Turborepo config
```

---

## 2. Git Submodules

| Submodule | Repository | Purpose |
|-----------|------------|---------|
| `packages/validator` | ewlin-validator | Isomorphic validation logic (shared client/server) |
| `packages/types` | ewlin-types | Shared TypeScript type definitions |
| `services/php-api` | ewlin-php-api | PHP/Symfony backend services |
| `services/validation-service` | ewlin-validation-service | Node.js validation API |

**Note:** For initial development, submodules can be local directories. Convert to actual submodules when repos are created.

---

## 3. Frontend Application Structure

```
apps/web/
├── public/
├── src/
│   ├── components/
│   │   ├── scheduling/             # Scheduling grid components
│   │   │   ├── SchedulingGrid.tsx
│   │   │   ├── EquipmentGrid.tsx
│   │   │   ├── OperatorGrid.tsx
│   │   │   ├── TaskBlock.tsx
│   │   │   ├── TimeAxis.tsx
│   │   │   └── ResourceRow.tsx
│   │   ├── panels/                 # Side panels
│   │   │   ├── UnassignedTasksPanel.tsx
│   │   │   ├── TaskDetailPanel.tsx
│   │   │   ├── ResourceInfoPanel.tsx
│   │   │   └── ConflictResolutionPanel.tsx
│   │   ├── crud/                   # CRUD components
│   │   │   ├── OperatorList.tsx
│   │   │   ├── OperatorForm.tsx
│   │   │   ├── EquipmentList.tsx
│   │   │   ├── EquipmentForm.tsx
│   │   │   ├── JobList.tsx
│   │   │   ├── JobForm.tsx
│   │   │   └── TaskForm.tsx
│   │   └── common/                 # Shared UI components
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── DataTable.tsx
│   │       └── ...
│   ├── pages/
│   │   └── SchedulingPage.tsx      # Main scheduling page (grid + CRUD)
│   ├── hooks/
│   │   ├── useScheduleSnapshot.ts
│   │   ├── useValidation.ts
│   │   └── useDragAndDrop.ts
│   ├── services/
│   │   ├── api.ts                  # API client (real)
│   │   └── mockApi.ts              # Mock API (for UI development)
│   ├── store/
│   │   ├── scheduleStore.ts        # Schedule state (Zustand)
│   │   └── uiStore.ts              # UI state
│   ├── mock/                       # Mock data
│   │   ├── generators/
│   │   │   ├── operators.ts
│   │   │   ├── equipment.ts
│   │   │   ├── jobs.ts
│   │   │   └── assignments.ts
│   │   ├── data/
│   │   │   └── snapshot.ts         # Pre-generated snapshot
│   │   └── index.ts
│   ├── types/                      # Local types (mirrors @ewlin/types)
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 4. Scheduling Page Layout

The main scheduling page combines the grid with CRUD panels in a single view:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Scheduling          [Equipment View] [Operator View]    [User] ▼   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ ┌─────────────┐ │
│ │                                                         │ │ Unassigned  │ │
│ │                                                         │ │ Tasks       │ │
│ │                                                         │ │ ─────────── │ │
│ │                 SCHEDULING GRID                         │ │ [Job-1]     │ │
│ │                 (Equipment × Time)                      │ │  └─Task A   │ │
│ │                                                         │ │  └─Task B   │ │
│ │                                                         │ │ [Job-2]     │ │
│ │                                                         │ │  └─Task C   │ │
│ │                                                         │ │             │ │
│ ├─────────────────────────────────────────────────────────┤ ├─────────────┤ │
│ │ [Operators ▼] [Equipment ▼] [Jobs ▼]                    │ │ Task Detail │ │
│ ├─────────────────────────────────────────────────────────┤ │ ─────────── │ │
│ │                                                         │ │ Name: ...   │ │
│ │         CRUD PANEL (contextual)                         │ │ Job: ...    │ │
│ │         - Operator list/form                            │ │ Duration:   │ │
│ │         - Equipment list/form                           │ │ Status:     │ │
│ │         - Job/Task list/form                            │ │             │ │
│ │                                                         │ │ [Edit]      │ │
│ └─────────────────────────────────────────────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Panel Behavior:**
- Bottom panel has tabs: Operators | Equipment | Jobs
- Each tab shows a list + inline add/edit forms
- Right panel shows selected task details or conflict resolution
- Grid takes primary focus (~60% height)

---

## 5. Mock Mode vs Real Mode

The application supports two modes controlled by environment variable:

```typescript
// src/services/api.ts
import { mockApi } from './mockApi';
import { realApi } from './realApi';

export const api = import.meta.env.VITE_USE_MOCK === 'true'
  ? mockApi
  : realApi;
```

**Environment files:**
```bash
# .env.development (UI developer uses this)
VITE_USE_MOCK=true

# .env.production
VITE_USE_MOCK=false
VITE_API_URL=https://api.example.com
```

---

## 6. Mock API Interface

```typescript
// src/services/mockApi.ts
import { generateMockSnapshot } from '../mock';

interface MockApiConfig {
  latency: number;          // Simulated network delay (ms)
  failureRate: number;      // Random failure rate (0-1)
}

const config: MockApiConfig = {
  latency: 200,
  failureRate: 0.05,
};

export const mockApi = {
  // Snapshot
  getSnapshot: async (timeRange: string): Promise<ScheduleSnapshot> => {
    await simulateLatency();
    return generateMockSnapshot(timeRange);
  },

  // Assignments
  createAssignment: async (assignment: ProposedAssignment): Promise<Assignment> => {
    await simulateLatency();
    // Validate using @ewlin/schedule-validator
    // Update local mock state
    return { ...assignment, id: generateId() };
  },

  updateAssignment: async (id: string, updates: Partial<Assignment>): Promise<Assignment> => { ... },
  deleteAssignment: async (id: string): Promise<void> => { ... },

  // Operators CRUD
  getOperators: async (): Promise<Operator[]> => { ... },
  createOperator: async (data: CreateOperatorDto): Promise<Operator> => { ... },
  updateOperator: async (id: string, data: UpdateOperatorDto): Promise<Operator> => { ... },
  deleteOperator: async (id: string): Promise<void> => { ... },

  // Equipment CRUD
  getEquipment: async (): Promise<Equipment[]> => { ... },
  createEquipment: async (data: CreateEquipmentDto): Promise<Equipment> => { ... },
  updateEquipment: async (id: string, data: UpdateEquipmentDto): Promise<Equipment> => { ... },
  deleteEquipment: async (id: string): Promise<void> => { ... },

  // Jobs CRUD
  getJobs: async (): Promise<Job[]> => { ... },
  createJob: async (data: CreateJobDto): Promise<Job> => { ... },
  updateJob: async (id: string, data: UpdateJobDto): Promise<Job> => { ... },
  addTaskToJob: async (jobId: string, task: CreateTaskDto): Promise<Task> => { ... },
  deleteJob: async (id: string): Promise<void> => { ... },
};
```

---

## 7. Mock Data Generators

```typescript
// src/mock/generators/operators.ts
import { faker } from '@faker-js/faker';

export function generateOperators(count: number = 20): Operator[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    status: faker.helpers.arrayElement(['Active', 'Active', 'Active', 'Inactive']),
    availability: generateAvailabilitySlots(),
    skills: generateSkills(),
  }));
}

// Similar generators for equipment, jobs, tasks, assignments
```

---

## 8. Development Workflow

### UI Developer (Colleague)
```bash
# Clone and setup
git clone ewlin
cd ewlin/apps/web
pnpm install

# Start in mock mode (default)
pnpm dev

# Mock mode is enabled by default in .env.development
# All API calls return mock data
# Can create/edit/delete - changes persist in memory during session
```

### Backend Developer (You)
```bash
# Work on PHP API
cd services/php-api
# ... develop backend

# Work on validation service
cd services/validation-service
# ... develop validator

# Run full stack
docker-compose up
```

### Integration
```bash
# Switch frontend to real API
VITE_USE_MOCK=false pnpm dev

# Or update .env.local
echo "VITE_USE_MOCK=false" > apps/web/.env.local
```

---

## 9. Key Files for UI Development

These are the files the UI developer will primarily work with:

| File | Purpose |
|------|---------|
| `src/pages/SchedulingPage.tsx` | Main page layout |
| `src/components/scheduling/*` | Grid components |
| `src/components/panels/*` | Side panels |
| `src/components/crud/*` | CRUD forms/lists |
| `src/mock/data/snapshot.ts` | Pre-generated realistic data |
| `src/hooks/useDragAndDrop.ts` | Drag & drop logic |

---

## 10. Notes

- Mock mode uses in-memory state - resets on page refresh
- The `@ewlin/schedule-validator` package works the same in mock and real mode
- UI developer can adjust mock data in `src/mock/data/` for specific scenarios
- Add `localStorage` persistence to mock state if needed for longer sessions
