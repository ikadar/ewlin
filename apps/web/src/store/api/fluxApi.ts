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
import type { FluxJob, PrerequisiteColumn, PrerequisiteStatus } from '../../components/FluxTable/fluxTypes';

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
        // stationData is empty (K3.1 postponed)
        stations: {},
      })),
      transporteur: job.shipper,
      parti: {
        shipped: job.shipped,
        date: null, // shippedAt display not yet implemented (K5.1)
      },
    }));
  }

  // Already FluxJob shape (mock mode) — return as-is
  return response as FluxJob[];
}

// ============================================================================
// Mutation argument type
// ============================================================================

export interface UpdatePrerequisiteArg {
  /** Element GUID (used in the PATCH URL) */
  elementId: string;
  /** Parent job reference ID (used for optimistic cache update lookup) */
  jobId: string;
  column: PrerequisiteColumn;
  value: PrerequisiteStatus;
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
  }),
});

export const { useGetFluxJobsQuery, useUpdateElementPrerequisiteMutation } = fluxApi;
