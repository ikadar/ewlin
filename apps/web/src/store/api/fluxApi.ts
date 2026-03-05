/**
 * RTK Query API Slice — Production Flow Dashboard (Flux)
 *
 * Provides:
 *   - getFluxJobs: GET /api/v1/flux/jobs — list active jobs
 *   - updateElementPrerequisite: PATCH /api/v1/flux/elements/{id} — update one prerequisite field
 *
 * In fixture/mock mode: the mock handler returns FLUX_STATIC_JOBS directly
 * (FluxJob[] shape, preserving station data for UI development).
 * In real API mode: the server returns FluxJobApiResponse[] which is
 * transformed to FluxJob[] via transformResponse.
 *
 * @see docs/releases/v0.5.18-production-flow-dashboard-api-integration.md
 * @see docs/releases/v0.5.19-prerequisite-persistence.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import { scheduleApi } from './scheduleApi';
import { shipperApi } from './shipperApi';
import type { FluxJob, FluxSTStatus, FluxOutsourcingTask, FluxStationData, PrerequisiteColumn, PrerequisiteStatus } from '../../components/FluxTable/fluxTypes';

// ============================================================================
// API Response Shape (from PHP backend)
// ============================================================================

/**
 * Element shape as returned by GET /api/v1/flux/jobs.
 * Status values are API enum strings (e.g. 'bat_approved', 'in_stock') matching @flux/types.
 */
interface FluxElementApiResponse {
  id: string;
  label: string;
  bat: PrerequisiteStatus;
  papier: PrerequisiteStatus;
  formes: PrerequisiteStatus;
  plaques: PrerequisiteStatus;
  /** Station state per category. Key = stationCategoryId, value.state = 'done'|'late'|'in-progress'|'planned'|'empty' */
  stations: Record<string, { state: string; taskId?: string }>;
  /** Outsourced tasks for this element. Always present, empty array if none (v0.5.22+). */
  outsourcing?: Array<{
    taskId: string;
    actionType: string;
    providerName: string;
    status: FluxSTStatus;
  }>;
}

/**
 * Job shape as returned by GET /api/v1/flux/jobs.
 */
interface FluxJobApiResponse {
  /** Job reference / display ID, e.g. "00042" */
  id: string;
  /** Job GUID — used for backend mutations */
  internalId: string;
  designation: string;
  client: string;
  /** Workshop exit date in JJ/MM format */
  sortie: string;
  elements: FluxElementApiResponse[];
  /** Station progress data — empty until K3.1 is implemented */
  stationData: Record<string, unknown>;
  shipper: string | null;
  shipped: boolean;
  shippedAt: string | null;
}

// ============================================================================
// Response Transformation
// ============================================================================

/**
 * Transform the API response to FluxJob[].
 *
 * Handles two response shapes:
 * - FluxJobApiResponse[] (real PHP API): converts shipper→transporteur, etc.
 * - FluxJob[] (mock handler): returned as-is, preserving station data.
 */
function transformFluxJobsResponse(
  response: FluxJob[] | FluxJobApiResponse[],
): FluxJob[] {
  if (response.length === 0) return [];

  // Discriminate: API format has `shipper` field, FluxJob has `transporteur`
  const first = response[0]!;
  if ('shipper' in first) {
    // Real API format — transform to FluxJob
    return (response as FluxJobApiResponse[]).map((job) => ({
      id: job.id,
      internalId: job.internalId,
      designation: job.designation,
      client: job.client,
      sortie: job.sortie,
      elements: job.elements.map((el) => ({
        id: el.id,
        label: el.label,
        bat: el.bat,
        papier: el.papier,
        formes: el.formes,
        plaques: el.plaques,
        stations: el.stations as Record<string, FluxStationData>,
        outsourcing: (el.outsourcing ?? []) as FluxOutsourcingTask[],
      })),
      transporteur: job.shipper,
      parti: {
        shipped: job.shipped,
        date: job.shippedAt ?? null,
      },
    }));
  }

  // Already FluxJob shape (mock mode) — return as-is
  return response as FluxJob[];
}

// ============================================================================
// Mutation argument type
// ============================================================================

export interface UpdateSTStatusArg {
  /** Task GUID (used in the PATCH URL) */
  taskId: string;
  status: FluxSTStatus;
}

export interface UpdateJobShipperArg {
  /** Job GUID (used in the PUT URL) */
  jobInternalId: string;
  /** Shipper UUID or null to clear */
  shipperId: string | null;
}

export interface UpdatePrerequisiteArg {
  /** Element GUID (used in the PATCH URL) */
  elementId: string;
  /** Parent job reference ID (used for optimistic cache update lookup) */
  jobId: string;
  column: PrerequisiteColumn;
  value: PrerequisiteStatus;
}

export interface ToggleJobShippedArg {
  /** Job GUID (used in the PUT URL) */
  jobInternalId: string;
  /** New shipped state */
  shipped: boolean;
}

// ============================================================================
// API Slice
// ============================================================================

export const fluxApi = createApi({
  reducerPath: 'fluxApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['FluxJobs'],
  endpoints: (builder) => ({
    getFluxJobs: builder.query<FluxJob[], void>({
      query: () => '/flux/jobs',
      transformResponse: (response: FluxJob[] | FluxJobApiResponse[]) =>
        transformFluxJobsResponse(response),
      providesTags: ['FluxJobs'],
    }),

    /**
     * Update an outsourced task's status (ST column 3-state checkbox).
     *
     * Uses invalidatesTags to refetch jobs after status update.
     *
     * @see docs/releases/v0.5.23-st-column-frontend.md
     */
    updateSTStatus: builder.mutation<void, UpdateSTStatusArg>({
      query: ({ taskId, status }) => ({
        url: `/flux/tasks/${taskId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['FluxJobs'],
    }),

    /**
     * Update a single prerequisite field of an element.
     *
     * Uses optimistic update: the cache is updated immediately, and reverted
     * automatically if the API call fails (undo pattern).
     *
     * @see docs/releases/v0.5.19-prerequisite-persistence.md
     */
    updateElementPrerequisite: builder.mutation<void, UpdatePrerequisiteArg>({
      query: ({ elementId, column, value }) => ({
        url: `/flux/elements/${elementId}`,
        method: 'PATCH',
        body: { column, value },
      }),
      async onQueryStarted({ jobId, elementId, column, value }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          fluxApi.util.updateQueryData('getFluxJobs', undefined, (draft) => {
            const job = draft.find((j) => j.id === jobId);
            if (job) {
              const el = job.elements.find((e) => e.id === elementId);
              if (el) el[column] = value;
            }
          }),
        );
        try {
          await queryFulfilled;
          // Invalidate the scheduling snapshot so the scheduling view
          // reflects the updated prerequisite status on next render.
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Update a job's shipper (transporteur) via PUT /api/v1/jobs/{id}.
     *
     * Uses optimistic update: the cache is updated immediately with the new
     * shipper name, and reverted automatically if the API call fails.
     */
    updateJobShipper: builder.mutation<void, UpdateJobShipperArg>({
      query: ({ jobInternalId, shipperId }) => ({
        url: `/jobs/${jobInternalId}`,
        method: 'PUT',
        body: { shipperId },
      }),
      async onQueryStarted({ jobInternalId, shipperId }, { dispatch, queryFulfilled, getState }) {
        // Look up shipper name from the shipperApi cache for optimistic display
        let shipperName: string | null = null;
        if (shipperId) {
          const state = getState() as Record<string, unknown>;
          const shippersResult = shipperApi.endpoints.getShippers.select()(state as never);
          const shippers = shippersResult?.data;
          if (shippers) {
            const shipper = shippers.find((s) => s.id === shipperId);
            if (shipper) shipperName = shipper.name;
          }
        }

        const patchResult = dispatch(
          fluxApi.util.updateQueryData('getFluxJobs', undefined, (draft) => {
            const job = draft.find((j) => j.internalId === jobInternalId);
            if (job) job.transporteur = shipperName;
          }),
        );
        try {
          await queryFulfilled;
          // Invalidate scheduler snapshot so JCF edit mode sees updated shipperId
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Toggle a job's shipped (Parti) status.
     * Optimistic update: immediately shows CircleCheck + today's date or reverts to Circle.
     */
    toggleJobShipped: builder.mutation<void, ToggleJobShippedArg>({
      query: ({ jobInternalId, shipped }) => ({
        url: `/jobs/${jobInternalId}`,
        method: 'PUT',
        body: { shipped },
      }),
      async onQueryStarted({ jobInternalId, shipped }, { dispatch, queryFulfilled }) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');

        const patchResult = dispatch(
          fluxApi.util.updateQueryData('getFluxJobs', undefined, (draft) => {
            const job = draft.find((j) => j.internalId === jobInternalId);
            if (job) {
              job.parti = { shipped, date: shipped ? `${dd}/${mm}` : null };
            }
          }),
        );
        try {
          await queryFulfilled;
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

export const { useGetFluxJobsQuery, useUpdateSTStatusMutation, useUpdateElementPrerequisiteMutation, useUpdateJobShipperMutation, useToggleJobShippedMutation } = fluxApi;
