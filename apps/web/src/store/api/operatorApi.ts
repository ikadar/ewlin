/**
 * RTK Query API Slice - Operator API
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface OperatorSkillResponse {
  stationId: string;
  proficiency: number;
}

export interface OperatorResponse {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  operatingSchedule: Record<string, { isOperating: boolean; slots: { start: string; end: string }[] }> | null;
  scheduleExceptions: Array<{ date: string; type: string; schedule: unknown; reason: string | null }> | null;
  skills: OperatorSkillResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface OperatorInput {
  firstName: string;
  lastName: string;
  role?: string | null;
  operatingSchedule?: Record<string, unknown> | null;
  scheduleExceptions?: unknown[] | null;
  skills?: OperatorSkillResponse[] | null;
}

export const operatorApi = createApi({
  reducerPath: 'operatorApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Operators'],
  endpoints: (builder) => ({
    getOperators: builder.query<OperatorResponse[], void>({
      query: () => '/operators',
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
    replaceSkills: builder.mutation<OperatorResponse, { id: string; skills: OperatorSkillResponse[] }>({
      query: ({ id, skills }) => ({
        url: `/operators/${id}/skills`,
        method: 'PUT',
        body: skills,
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
  useReplaceSkillsMutation,
} = operatorApi;
