/**
 * RTK Query API Slice — Production Flow Dashboard (Flux)
 *
 * Provides:
 *   - getFluxJobs: GET /api/v1/flux/jobs — list active jobs
 *
 * In fixture/mock mode: the mock handler returns FLUX_STATIC_JOBS directly
 * (FluxJob[] shape, preserving station data for UI development).
 * In real API mode: the server returns FluxJobApiResponse[] which is
 * transformed to FluxJob[] via transformResponse.
 *
 * @see docs/releases/v0.5.18-production-flow-dashboard-api-integration.md
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';
import type { FluxJob } from '../../components/FluxTable/fluxTypes';
import type { PrerequisiteStatus } from '../../components/FluxTable/fluxTypes';

// ============================================================================
// API Response Shape (from PHP backend)
// ============================================================================

/**
 * Element shape as returned by GET /api/v1/flux/jobs.
 * Status values are already French UI display strings (mapped server-side).
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
  }),
});

export const { useGetFluxJobsQuery } = fluxApi;
