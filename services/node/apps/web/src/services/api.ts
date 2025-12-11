import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ScheduleSnapshot } from '@flux/types';

/**
 * RTK Query API service for schedule data.
 *
 * In development, this will connect to mock endpoints.
 * In production, it connects to the actual API server.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  }),
  tagTypes: ['Schedule', 'Job', 'Station'],
  endpoints: (builder) => ({
    /**
     * Fetch the current schedule snapshot.
     * Contains all stations, jobs, tasks, and assignments.
     */
    getSnapshot: builder.query<ScheduleSnapshot, void>({
      query: () => '/schedule/snapshot',
      providesTags: ['Schedule'],
    }),
  }),
});

export const { useGetSnapshotQuery } = api;
