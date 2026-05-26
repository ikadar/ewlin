/**
 * RTK Query API Slice — Acompte (split-delivery commitments).
 *
 * Mirrors the backend AcompteController under /api/v1/jobs/{jobId}/...:
 *   GET    /acomptes                       — list
 *   POST   /acomptes                       — create or atomic-replace
 *   DELETE /acomptes                       — un-split
 *   GET    /acompte-progress-declarations  — list declarations
 *   POST   /acompte-progress-declarations  — write a (parent, logical_task) declaration
 *
 * See docs/releases/acomptes-kickoff.md for the design + the locked decisions.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface AcompteResponse {
  id: string;
  positionIndex: number;
  quantityShare: number;
  /** ISO 8601 with timezone. */
  deadline: string;
  /** 0=Vital, 1=Impératif, 2=Important, 3=Standard, 4=Flexible. null = inherit from parent. */
  deadlinePriority: number | null;
  createdAt: string;
  createdBy: string | null;
}

export interface AcompteListResponse {
  parentJobId: string;
  parentQuantity: number | null;
  acomptes: AcompteResponse[];
}

export interface AcompteSplitInput {
  /** Number of copies for this acompte. Sum must equal parent.quantity. */
  quantity_share: number;
  /** ISO 8601 datetime (with or without timezone — backend parses both). */
  deadline: string;
  /** 0-4 or null (inherit from parent). */
  deadline_priority?: number | null;
}

export interface AcompteReplaceInput {
  jobId: string;
  splits: AcompteSplitInput[];
}

export interface AcompteProgressDeclarationResponse {
  id: string;
  logicalTaskId: string;
  declaredTotalCopiesDone: number;
  declaredAt: string;
  declaredBy: string | null;
}

export interface AcompteProgressDeclarationListResponse {
  parentJobId: string;
  declarations: AcompteProgressDeclarationResponse[];
}

export interface AcompteProgressDeclarationWriteInput {
  jobId: string;
  logical_task_id: string;
  declared_total_copies_done: number;
}

export const acompteApi = createApi({
  reducerPath: 'acompteApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Acomptes', 'AcompteDeclarations'],
  endpoints: (builder) => ({
    getAcomptes: builder.query<AcompteListResponse, string>({
      query: (jobId) => `/jobs/${jobId}/acomptes`,
      providesTags: (_result, _err, jobId) => [{ type: 'Acomptes', id: jobId }],
    }),
    replaceAcomptes: builder.mutation<{ parentJobId: string; acomptes: AcompteResponse[] }, AcompteReplaceInput>({
      query: ({ jobId, splits }) => ({
        url: `/jobs/${jobId}/acomptes`,
        method: 'POST',
        body: { splits },
      }),
      invalidatesTags: (_result, _err, { jobId }) => [
        { type: 'Acomptes', id: jobId },
        { type: 'AcompteDeclarations', id: jobId },
      ],
    }),
    deleteAcomptes: builder.mutation<void, string>({
      query: (jobId) => ({
        url: `/jobs/${jobId}/acomptes`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, jobId) => [
        { type: 'Acomptes', id: jobId },
        { type: 'AcompteDeclarations', id: jobId },
      ],
    }),
    getAcompteProgressDeclarations: builder.query<AcompteProgressDeclarationListResponse, string>({
      query: (jobId) => `/jobs/${jobId}/acompte-progress-declarations`,
      providesTags: (_result, _err, jobId) => [{ type: 'AcompteDeclarations', id: jobId }],
    }),
    writeAcompteProgressDeclaration: builder.mutation<
      AcompteProgressDeclarationResponse,
      AcompteProgressDeclarationWriteInput
    >({
      query: ({ jobId, logical_task_id, declared_total_copies_done }) => ({
        url: `/jobs/${jobId}/acompte-progress-declarations`,
        method: 'POST',
        body: { logical_task_id, declared_total_copies_done },
      }),
      invalidatesTags: (_result, _err, { jobId }) => [{ type: 'AcompteDeclarations', id: jobId }],
    }),
  }),
});

export const {
  useGetAcomptesQuery,
  useReplaceAcomptesMutation,
  useDeleteAcomptesMutation,
  useGetAcompteProgressDeclarationsQuery,
  useWriteAcompteProgressDeclarationMutation,
} = acompteApi;
