/**
 * RTK Query API Slice - Operator API
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface OperatorSkillResponse {
  stationId: string;
  /** @deprecated Use setupProficiency / runProficiency. Mirrors run proficiency. */
  proficiency: number;
  setupProficiency: number;
  runProficiency: number;
}

/**
 * A pair of stations an operator can supervise simultaneously, with a
 * per-station effective productivity for that pair. Models the operator's
 * "masked time" capability — see services/php-api Entity/OperatorConcurrentGroup.
 */
export interface ConcurrentGroupResponse {
  id: string;
  /** Exactly 2 station UUIDs, sorted canonically by the backend. */
  stationIds: readonly [string, string];
  /** Productivity per station within this pair, ∈ [0.0, 1.5]. */
  effectiveProductivity: Record<string, number>;
}

/** Payload for replacing or creating a group (no id, server assigns it). */
export interface ConcurrentGroupPayload {
  stationIds: readonly [string, string];
  effectiveProductivity: Record<string, number>;
}

/**
 * A datetime-range absence (vacation, sick leave, appointment…).
 * Endpoints are ISO 8601 naive local datetimes — e.g. `"2026-04-20T14:00:00"`.
 * The Rust scheduler excludes any tick inside the range (inclusive on both sides).
 */
export interface AbsencePayload {
  startAt: string;
  endAt: string;
  reason: string | null;
}

/**
 * A datetime-range overtime slot (heures supplémentaires).
 * Same shape as `AbsencePayload`, opposite semantic: additive availability.
 * Must be disjoint from any absence of the same operator — the backend
 * rejects overlapping payloads with HTTP 400.
 */
export interface OvertimePayload {
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface OperatorResponse {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  operatingSchedules: Array<Record<string, { isOperating: boolean; slots: { start: string; end: string }[] }>> | null;
  scheduleRotationReferenceWeek: number | null;
  scheduleNames: string[] | null;
  absences: AbsencePayload[] | null;
  overtimes: OvertimePayload[] | null;
  skills: OperatorSkillResponse[];
  concurrentGroups: ConcurrentGroupResponse[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface OperatorInput {
  firstName: string;
  lastName: string;
  role?: string | null;
  operatingSchedules?: Array<Record<string, unknown>> | null;
  scheduleRotationReferenceWeek?: number | null;
  scheduleNames?: string[] | null;
  absences?: AbsencePayload[] | null;
  overtimes?: OvertimePayload[] | null;
  skills?: OperatorSkillResponse[] | null;
}

export const operatorApi = createApi({
  reducerPath: 'operatorApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Operators'],
  endpoints: (builder) => ({
    getOperators: builder.query<OperatorResponse[], { includeArchived?: boolean } | void>({
      query: (params) => {
        const includeArchived = params && 'includeArchived' in params && params.includeArchived;
        return includeArchived ? '/operators?includeArchived=true' : '/operators';
      },
      transformResponse: (response: OperatorResponse[] | { items: OperatorResponse[] }) =>
        Array.isArray(response) ? response : (response.items ?? []),
      providesTags: ['Operators'],
    }),
    createOperator: builder.mutation<OperatorResponse, OperatorInput>({
      query: (body) => ({
        url: '/operators',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Operators'],
    }),
    updateOperator: builder.mutation<OperatorResponse, { id: string; body: Partial<OperatorInput> }>({
      query: ({ id, body }) => ({
        url: `/operators/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Operators'],
    }),
    deleteOperator: builder.mutation<void, string>({
      query: (id) => ({
        url: `/operators/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Operators'],
    }),
    restoreOperator: builder.mutation<OperatorResponse, string>({
      query: (id) => ({
        url: `/operators/${id}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Operators'],
    }),
    replaceSkills: builder.mutation<OperatorResponse, { id: string; skills: OperatorSkillResponse[] }>({
      query: ({ id, skills }) => ({
        url: `/operators/${id}/skills`,
        method: 'PUT',
        body: skills,
      }),
      invalidatesTags: ['Operators'],
    }),
    replaceConcurrentGroups: builder.mutation<OperatorResponse, { id: string; groups: ConcurrentGroupPayload[] }>({
      query: ({ id, groups }) => ({
        url: `/operators/${id}/concurrent-groups`,
        method: 'PUT',
        body: groups,
      }),
      invalidatesTags: ['Operators'],
    }),
    addOperatorAbsence: builder.mutation<
      { startAt: string; endAt: string; reason: string | null },
      { operatorId: string; startAt: string; endAt: string; reason?: string }
    >({
      query: ({ operatorId, ...body }) => ({
        url: `/operators/${encodeURIComponent(operatorId)}/absences`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Operators'],
    }),
  }),
});

export const {
  useGetOperatorsQuery,
  useCreateOperatorMutation,
  useUpdateOperatorMutation,
  useDeleteOperatorMutation,
  useRestoreOperatorMutation,
  useReplaceSkillsMutation,
  useReplaceConcurrentGroupsMutation,
  useAddOperatorAbsenceMutation,
} = operatorApi;
