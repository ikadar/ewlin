# Scheduling UI - Frontend Application

Operations Research System frontend application for production scheduling.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application is available at: `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components (Button, Card, Badge, Tabs)
│   ├── scheduling/      # Scheduling grid components
│   │   ├── SchedulingGrid.tsx   # Main grid component
│   │   ├── TaskBlock.tsx        # Task display on grid
│   │   └── TimeAxis.tsx         # Time axis
│   ├── panels/          # Side panels
│   │   ├── UnassignedTasksPanel.tsx  # Unscheduled tasks list
│   │   └── TaskDetailPanel.tsx       # Selected task details
│   ├── crud/            # CRUD components
│   │   ├── OperatorList.tsx
│   │   ├── EquipmentList.tsx
│   │   ├── JobList.tsx
│   │   └── CrudPanel.tsx        # Tabbed CRUD panel
│   └── layout/          # Layout components
│       └── Header.tsx           # Header with view toggle
├── pages/
│   └── SchedulingPage.tsx       # Main page
├── store/               # Redux Toolkit store
│   ├── index.ts                 # Store configuration
│   ├── scheduleSlice.ts         # Schedule state and async thunks
│   ├── uiSlice.ts               # UI state (view, selection, etc.)
│   └── hooks.ts                 # Typed hooks
├── services/
│   ├── api.ts                   # API export (mock/real switch)
│   └── mockApi.ts               # Mock API implementation
├── mock/
│   ├── generators/              # Data generators
│   │   ├── operators.ts
│   │   ├── equipment.ts
│   │   ├── jobs.ts
│   │   └── assignments.ts
│   └── data/
│       └── snapshot.ts          # Snapshot cache
├── types/
│   └── index.ts                 # TypeScript types
└── lib/
    └── utils.ts                 # Utility functions (cn)
```

## Mock Mode

The application runs in **mock mode** by default, which means:

- No backend required
- Data is automatically generated at startup
- All CRUD operations work (stored in memory)
- Data regenerates on page reload

### Generated Data

- **20 operators** with different statuses and skills
- **15 machines** with different types and maintenance windows
- **12 jobs** with 2-6 tasks each
- **Assignments** for tasks with "Assigned" and "Executing" status

### Mock API Configuration

```typescript
import { mockApi } from './services/mockApi';

// Set latency (ms)
mockApi.configure({ latency: 200 });

// Set failure rate (0-1)
mockApi.configure({ failureRate: 0.05 });
```

## Main Features

### 1. Scheduling Grid

- **Equipment View**: Machines as rows, time as columns
- **Operator View**: Operators as rows, time as columns
- View toggle in the header

### 2. Task Management

- Tasks displayed as color-coded blocks
- Click on task: show details in right panel
- Status-based coloring:
  - Blue: Assigned
  - Green: Executing
  - Gray: Completed
  - Red: Failed

### 3. CRUD Panels

- **Operators tab**: Operator list with status
- **Equipment tab**: Equipment list with status and location
- **Jobs tab**: Job list with deadline and task count

### 4. Side Panels

- **Unassigned Tasks**: Unscheduled tasks grouped by job
- **Task Detail**: Selected task details (job, schedule, resources, dependencies)

## Types

Main domain types are in `src/types/index.ts`:

```typescript
// Status enums
type OperatorStatus = 'Active' | 'Inactive' | 'Deactivated';
type EquipmentStatus = 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
type JobStatus = 'Draft' | 'Planned' | 'InProgress' | 'Delayed' | 'Completed' | 'Cancelled';
type TaskStatus = 'Defined' | 'Ready' | 'Assigned' | 'Executing' | 'Completed' | 'Failed' | 'Cancelled';

// Main entities
interface Operator { id, name, status, availability, skills }
interface Equipment { id, name, status, supportedTaskTypes, location, maintenanceWindows }
interface Job { id, name, description, deadline, status }
interface Task { id, jobId, type, duration, requiresOperator, requiresEquipment, dependencies, status }
interface Assignment { id, taskId, operatorId, equipmentId, scheduledStart, scheduledEnd }
```

## Development Guide

### Adding New Components

1. Create the component in the appropriate folder
2. Export from `index.ts`
3. Use the `cn()` utility for class composition
4. Use `useAppSelector` and `useAppDispatch` hooks for store access

### State Management

```typescript
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setSelectedTask } from '../store/uiSlice';
import { fetchSnapshot } from '../store/scheduleSlice';

function MyComponent() {
  const dispatch = useAppDispatch();
  const snapshot = useAppSelector((state) => state.schedule.snapshot);

  // Dispatch action
  dispatch(setSelectedTask({ taskId: '...', task: {...} }));

  // Async thunk
  dispatch(fetchSnapshot('2025-01-01/2025-01-14'));
}
```

### API Calls

The mock API uses the same interface as the future real API:

```typescript
import { api } from '../services/api';

// Get snapshot
const snapshot = await api.getSnapshot('2025-01-01/2025-01-14');

// CRUD operations
const operator = await api.createOperator({ name: '...', availability: [], skills: [] });
await api.updateOperator(id, { name: '...' });
await api.deleteOperator(id);

// Create assignment
const assignment = await api.createAssignment({
  taskId: '...',
  operatorId: '...',
  equipmentId: '...',
  scheduledStart: '2025-01-10T08:00:00Z'
});
```

## Scripts

```bash
pnpm dev      # Development server
pnpm build    # Production build
pnpm preview  # Build preview
pnpm lint     # ESLint
```

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** - Build tool
- **Redux Toolkit** - State management
- **Tailwind CSS 4** - Styling
- **date-fns** - Date handling
- **Faker.js** - Mock data generation
- **Lucide React** - Icons

## Documentation

Detailed domain documentation is in the `/docs` folder:

- `docs/requirements/scheduling-ui-design.md` - UI specification
- `docs/requirements/api-interface-drafts.md` - API contracts
- `docs/architecture/project-structure.md` - Project structure
- `docs/domain-model/domain-vocabulary.md` - Domain vocabulary
- `docs/roadmap/release-roadmap.md` - Release roadmap
