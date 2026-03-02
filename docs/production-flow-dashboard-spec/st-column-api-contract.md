# API Contract — ST Column (Sous-traitance)

**Status:** Draft
**Date:** 2026-03-02
**Related spec:** `upgrade-colonne-st-en.md`
**Visual reference:** `mockup2.html`

---

## 1. Backend Data Model (existing)

The ST feature maps entirely onto the existing `tasks` table. No new table is needed.

```
Job → Element → Task (task_type = 'Outsourced')
                   ├── id              GUID
                   ├── element_id      FK → elements.id
                   ├── provider_id     FK → outsourced_providers.id
                   ├── action_type     VARCHAR(50)   ← "task name" in spec
                   ├── task_type       'Outsourced'
                   └── status          TaskStatus enum
```

The supplier name is resolved via `outsourced_providers.name` (e.g. "Faco 37", "Clement", "SIPAP").

---

## 2. Status Mapping

The Flux dashboard uses a simplified 3-state vocabulary. It maps onto the existing `TaskStatus` enum:

| Dashboard (`FluxSTStatus`) | Backend (`TaskStatus`) |
|---|---|
| `pending` | `defined`, `ready` |
| `progress` | `assigned` |
| `done` | `completed` |
| _(hidden)_ | `cancelled` |

Cancelled tasks are **not included** in the API response.

On write, the dashboard value maps to a single backend value:

| Dashboard → | Backend |
|---|---|
| `pending` → | `defined` |
| `progress` → | `assigned` |
| `done` → | `completed` |

---

## 3. Read — Extend `GET /api/v1/flux/jobs`

### Current situation

`FluxElementResponse.php` explicitly skips outsourced tasks:

```php
foreach ($element->getTasks() as $task) {
    if (!$task->isInternal()) {  // ← outsourced tasks are filtered out
        continue;
    }
    // ... build station data
}
```

### Required change

Add an `outsourcing` array to `FluxElementResponse`. Each entry contains:

```json
{
  "taskId":      "550e8400-e29b-41d4-a716-446655440000",
  "actionType":  "Vernis UV sélectif",
  "providerName": "Faco 37",
  "status":      "done"
}
```

### Full updated element response shape

```json
{
  "id":     "element-uuid",
  "label":  "Couverture",
  "bat":    "bat_approved",
  "papier": "in_stock",
  "formes": "delivered",
  "plaques": "ready",
  "stations": {
    "cat-offset": { "state": "done" }
  },
  "outsourcing": [
    {
      "taskId":       "uuid-1",
      "actionType":   "Vernis UV sélectif",
      "providerName": "Faco 37",
      "status":       "done"
    },
    {
      "taskId":       "uuid-2",
      "actionType":   "Pelliculage mat",
      "providerName": "SIPAP",
      "status":       "pending"
    }
  ]
}
```

`outsourcing` is always present: empty array `[]` if the element has no outsourced tasks.

### Backend files to change

| File | Change |
|---|---|
| `src/DTO/Flux/FluxElementResponse.php` | Add `outsourcing` array, resolve `providerName` via provider relation, map `TaskStatus` → dashboard status |
| `src/Controller/Api/V1/FluxController.php` | No change needed (response built by DTO) |

---

## 4. Write — Update Task Status

### Endpoint

```
PATCH /api/v1/flux/tasks/{taskId}/status
```

### Request body

```json
{ "status": "progress" }
```

Accepted values: `"pending"` | `"progress"` | `"done"`

### Response

- `204 No Content` on success
- `400 Bad Request` if the task is not of `task_type = 'Outsourced'`
- `404 Not Found` if `taskId` does not exist
- `422 Unprocessable Entity` if `status` value is invalid

### Backend mapping on write

```
"pending"  → TaskStatus::defined
"progress" → TaskStatus::assigned
"done"     → TaskStatus::completed
```

### Backend files to create/change

| File | Change |
|---|---|
| `src/Controller/Api/V1/FluxController.php` | Add `patchTaskStatus()` action, route `PATCH /flux/tasks/{taskId}/status` |
| `src/DTO/Flux/FluxTaskStatusRequest.php` | New DTO: validates `status` ∈ {pending, progress, done} |
| `src/Service/FluxService.php` (or `TaskService`) | Map dashboard status → `TaskStatus`, persist |

---

## 5. Frontend TypeScript

### New types (`fluxTypes.ts`)

```typescript
export type FluxSTStatus = 'pending' | 'progress' | 'done';

export interface FluxOutsourcingTask {
  taskId:       string;
  actionType:   string;
  providerName: string;
  status:       FluxSTStatus;
}
```

### Extended `FluxElement`

```typescript
export interface FluxElement {
  id:      string;
  label:   string;
  bat:     PrerequisiteStatus;
  papier:  PrerequisiteStatus;
  formes:  PrerequisiteStatus;
  plaques: PrerequisiteStatus;
  stations: Partial<Record<string, FluxStationData>>;
  outsourcing: FluxOutsourcingTask[];   // NEW — empty array if none
}
```

### New RTK Query mutation (`fluxApi.ts`)

```typescript
updateSTStatus: builder.mutation<void, {
  taskId:    string;
  status:    FluxSTStatus;
}>({
  query: ({ taskId, status }) => ({
    url:    `/flux/tasks/${taskId}/status`,
    method: 'PATCH',
    body:   { status },
  }),
  invalidatesTags: ['FluxJobs'],
}),
```

---

## 6. Visual spec (from `mockup2.html`)

### Cell layout

```
td.td-st  { padding: 0 6px; max-width: 160px; vertical-align: middle; }
.st-cell  { display: flex; flex-direction: column; gap: 1px; font-size: 11px; }
.st-line  { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.st-label { overflow: hidden; text-overflow: ellipsis; }
```

### Label format

Each line: **"ProviderName · ActionType"**
Examples: `Faco 37 · Vernis UV sélectif`, `Clement · Découpe mi-chair`

### 3-state icon colors

| State | Color | CSS class |
|---|---|---|
| `pending` | `rgb(128 128 128)` gray | `.st-pending` |
| `progress` | `rgb(251 146 60)` orange | `.st-progress` |
| `done` | `rgb(74 222 128)` green | `.st-done` |

### Tooltip

Custom non-native tooltip (not `title` attribute):
`div.st-tooltip { position: fixed; z-index: 9999; opacity: 0; transition: opacity 0.12s; }`
Shows full "ProviderName · ActionType" on `.st-line` hover (guards truncated labels).

### ST column header

- Header label: **"ST"**, `title="Sous-traitance"` tooltip
- **Not sortable** (no chevron — consistent with station columns)
- Column width: `w-56` (14rem / 224px) in mockup colgroup

### Multi-element collapsed row

All element ST tasks are **flattened** into one list. The checkbox click must identify the correct `taskId` from the flat list (index-based in mockup; in React, use `taskId` directly from the data).

### Multi-element expanded sub-rows

Each sub-row renders only its own element's ST tasks via `outsourcing[]` on the element.

---

## 7. "S-T à faire" Tab

### Filter criterion

A job is included if **at least one** of its elements has at least one outsourced task with `status !== 'done'`.

```typescript
// In fluxFilters.ts
function filterByTab(job: FluxJob, tab: TabId): boolean {
  // ...existing cases...
  case 'soustraitance':
    return job.elements.some(el =>
      el.outsourcing.some(t => t.status !== 'done')
    );
}
```

### Tab ID and URL path

| Tab ID | URL path | Label |
|---|---|---|
| `'soustraitance'` | `/flux/soustraitance` | S-T à faire |

### Verification (initial fixture data)

| Job | Non-done ST tasks | Visible in tab? |
|---|---|---|
| 00042 | 0 (1 done) | No |
| 00078 | 2 (Découpe pending, Gaufrage progress) | **Yes** |
| 00091 | 1 (Vernis UV progress) | **Yes** |
| 00103 | 1 (Reliure Singer pending) | **Yes** |
| 00117 | 0 (no tasks) | No |

**Expected count badge: 3**

---

## 8. Summary of changes

### Backend (`services/php-api`)

| File | Type | Description |
|---|---|---|
| `src/DTO/Flux/FluxElementResponse.php` | Modify | Add `outsourcing[]` from outsourced tasks |
| `src/Controller/Api/V1/FluxController.php` | Modify | Add `PATCH /flux/tasks/{taskId}/status` |
| `src/DTO/Flux/FluxTaskStatusRequest.php` | New | Validates pending/progress/done |

### Frontend (`apps/web`)

| File | Type | Description |
|---|---|---|
| `src/components/FluxTable/fluxTypes.ts` | Modify | `FluxSTStatus`, `FluxOutsourcingTask`, extend `FluxElement` |
| `src/store/api/fluxApi.ts` | Modify | Add `updateSTStatus` mutation, extend `transformFluxJobsResponse` |
| `src/components/FluxTable/fluxFilters.ts` | Modify | Add `soustraitance` tab filter, extend `TAB_IDS` |
| `src/components/FluxTable/FluxTable.tsx` | Modify | Add ST column header + `<STCell>` rendering |
| `src/components/FluxTable/STCell.tsx` | New | ST cell component with checkbox cycle + tooltip |
| `src/pages/FluxPage.tsx` | Modify | Pass `onUpdateSTStatus` callback down |
| `src/mock/fluxStaticData.ts` | Modify | Add `outsourcing[]` to fixture elements |
| `src/index.css` | Modify | `.st-pending`, `.st-progress`, `.st-done`, `.st-tooltip` |
