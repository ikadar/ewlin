import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ProductionEventResponse {
  id: string;
  taskId: string;
  jobInternalId: string;
  jobReference: string | null;
  jobClient: string | null;
  taskName: string | null;
  stationName: string | null;
  operatorName: string | null;
  type: string;
  offsetMinutes: number | null;
  seen: boolean;
  seenAt: string | null;
  createdAt: string;
}

export const productionReportApi = createApi({
  reducerPath: 'productionReportApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['ProductionReport'],
  endpoints: (builder) => ({
    createProductionEvent: builder.mutation<ProductionEventResponse, { taskId: string; jobInternalId: string; type: string; operatorId?: string; stationId: string }>({
      query: (body) => ({
        url: '/production-events',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ProductionReport'],
    }),
    getProductionEvents: builder.query<ProductionEventResponse[], void>({
      query: () => '/production-events',
      providesTags: ['ProductionReport'],
    }),
    toggleEventSeen: builder.mutation<ProductionEventResponse, { id: string; seen: boolean }>({
      query: ({ id, seen }) => ({
        url: `/production-events/${encodeURIComponent(id)}/seen`,
        method: 'PATCH',
        body: { seen },
      }),
      async onQueryStarted({ id, seen }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          productionReportApi.util.updateQueryData('getProductionEvents', undefined, (draft) => {
            const ev = draft.find((e) => e.id === id);
            if (ev) {
              ev.seen = seen;
              ev.seenAt = seen ? new Date().toISOString() : null;
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const { useGetProductionEventsQuery, useToggleEventSeenMutation, useCreateProductionEventMutation } = productionReportApi;
