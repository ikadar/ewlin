/**
 * RTK Query API Slice - QA Tracker API
 *
 * Provides endpoints for the QA Tracker tool:
 * - Folders listing with progress
 * - Files listing with progress
 * - Test content with status
 * - Status updates
 * - KO logs
 * - Fixture change requests
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  QAFolder,
  QAFile,
  ParsedQAFileWithStatus,
  TestStatusEntry,
  KOLogEntry,
  FixtureRequest,
  ResultStatus,
  SelectionState,
} from '../types';

export const qaApi = createApi({
  reducerPath: 'qaApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/qa-api' }),
  tagTypes: ['Folders', 'Files', 'Content', 'Status', 'KOLogs', 'FixtureRequests'],

  endpoints: (builder) => ({
    // Get all folders with progress
    getFolders: builder.query<QAFolder[], void>({
      query: () => '/folders',
      providesTags: ['Folders'],
    }),

    // Get files in a folder with progress
    getFiles: builder.query<QAFile[], string>({
      query: (folder) => `/files/${folder}`,
      providesTags: (_result, _error, folder) => [{ type: 'Files', id: folder }],
    }),

    // Get parsed content with status
    getContent: builder.query<ParsedQAFileWithStatus, { folder: string; file: string }>({
      query: ({ folder, file }) => `/content/${folder}/${file}`,
      providesTags: (_result, _error, { folder, file }) => [
        { type: 'Content', id: `${folder}/${file}` },
      ],
    }),

    // Update result status
    updateStatus: builder.mutation<
      TestStatusEntry,
      { testId: string; resultIndex: number; status: ResultStatus }
    >({
      query: (body) => ({
        url: '/status',
        method: 'PUT',
        body,
      }),
      // Optimistic update
      async onQueryStarted({ testId, resultIndex, status }, { dispatch, queryFulfilled }) {
        // We'll invalidate tags on success to refresh the data
        try {
          await queryFulfilled;
          // Invalidate all relevant caches
          dispatch(qaApi.util.invalidateTags(['Folders', 'Files', 'Content']));
        } catch {
          // Error handled by RTK Query
        }
      },
    }),

    // Get all KO logs
    getKOLogs: builder.query<KOLogEntry[], string | void>({
      query: (testId) => (testId ? `/ko-logs?testId=${testId}` : '/ko-logs'),
      providesTags: ['KOLogs'],
    }),

    // Create KO log
    createKOLog: builder.mutation<
      KOLogEntry,
      {
        testId: string;
        description: string;
        severity: 'blocker' | 'major' | 'minor';
      }
    >({
      query: (body) => ({
        url: '/ko-logs',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['KOLogs'],
    }),

    // Resolve KO log
    resolveKOLog: builder.mutation<KOLogEntry, string>({
      query: (id) => ({
        url: `/ko-logs/${id}/resolve`,
        method: 'PUT',
      }),
      invalidatesTags: ['KOLogs'],
    }),

    // Reopen KO log
    reopenKOLog: builder.mutation<KOLogEntry, string>({
      query: (id) => ({
        url: `/ko-logs/${id}/reopen`,
        method: 'PUT',
      }),
      invalidatesTags: ['KOLogs'],
    }),

    // Delete KO log
    deleteKOLog: builder.mutation<void, string>({
      query: (id) => ({
        url: `/ko-logs/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['KOLogs'],
    }),

    // Get fixture requests
    getFixtureRequests: builder.query<FixtureRequest[], string | void>({
      query: (testId) =>
        testId ? `/fixture-requests?testId=${testId}` : '/fixture-requests',
      providesTags: ['FixtureRequests'],
    }),

    // Create fixture request
    createFixtureRequest: builder.mutation<
      FixtureRequest,
      {
        testId: string;
        fixture: string;
        currentNotes: string;
        requestedChange: string;
      }
    >({
      query: (body) => ({
        url: '/fixture-requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FixtureRequests'],
    }),

    // Update fixture request status
    updateFixtureRequestStatus: builder.mutation<
      FixtureRequest,
      { id: string; status: 'pending' | 'implemented' | 'rejected' }
    >({
      query: ({ id, status }) => ({
        url: `/fixture-requests/${id}/status`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: ['FixtureRequests'],
    }),

    // Delete fixture request
    deleteFixtureRequest: builder.mutation<void, string>({
      query: (id) => ({
        url: `/fixture-requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FixtureRequests'],
    }),

    // Get selection from file
    getSelection: builder.query<SelectionState, void>({
      query: () => '/selection',
    }),

    // Save selection to file
    saveSelection: builder.mutation<SelectionState, SelectionState>({
      query: (body) => ({
        url: '/selection',
        method: 'PUT',
        body,
      }),
    }),
  }),
});

export const {
  useGetFoldersQuery,
  useGetFilesQuery,
  useGetContentQuery,
  useUpdateStatusMutation,
  useGetKOLogsQuery,
  useCreateKOLogMutation,
  useResolveKOLogMutation,
  useReopenKOLogMutation,
  useDeleteKOLogMutation,
  useGetFixtureRequestsQuery,
  useCreateFixtureRequestMutation,
  useUpdateFixtureRequestStatusMutation,
  useDeleteFixtureRequestMutation,
  useGetSelectionQuery,
  useSaveSelectionMutation,
} = qaApi;
