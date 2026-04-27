/**
 * RTK Query API Slice — Logistics notes (anomalies / observations on movements).
 *
 * Powers the /logistique screen. Note that the *state transitions* (ST status,
 * Job.shipped) are handled by the existing fluxApi.updateSTStatus and
 * fluxApi.toggleJobShipped mutations — this slice only manages the free-text
 * comment table that lives alongside.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export type LogisticsRefType = 'task' | 'job';

export interface LogisticsNoteResponse {
  id: string;
  refType: LogisticsRefType;
  refId: string;
  note: string;
  createdAt: string;
}

export interface LogisticsNoteListArg {
  refType: LogisticsRefType;
  refIds: string[];
}

export interface CreateLogisticsNoteArg {
  refType: LogisticsRefType;
  refId: string;
  note: string;
}

export const logisticsApi = createApi({
  reducerPath: 'logisticsApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['LogisticsNotes'],
  endpoints: (builder) => ({
    getLogisticsNotes: builder.query<LogisticsNoteResponse[], LogisticsNoteListArg>({
      query: ({ refType, refIds }) => {
        const ids = refIds.join(',');
        return `/logistics-notes?refType=${refType}&refIds=${encodeURIComponent(ids)}`;
      },
      transformResponse: (response: { data: LogisticsNoteResponse[] } | LogisticsNoteResponse[]) =>
        Array.isArray(response) ? response : (response.data ?? []),
      providesTags: ['LogisticsNotes'],
    }),
    createLogisticsNote: builder.mutation<LogisticsNoteResponse, CreateLogisticsNoteArg>({
      query: (body) => ({
        url: '/logistics-notes',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['LogisticsNotes'],
    }),
    deleteLogisticsNote: builder.mutation<void, string>({
      query: (id) => ({
        url: `/logistics-notes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['LogisticsNotes'],
    }),
  }),
});

export const {
  useGetLogisticsNotesQuery,
  useCreateLogisticsNoteMutation,
  useDeleteLogisticsNoteMutation,
} = logisticsApi;
