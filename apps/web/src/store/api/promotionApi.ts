/**
 * RTK Query slice — Promotion endpoints.
 *
 * GET  /api/v1/promotion/preview — KPIs (jobs planifiés / en retard deltas)
 * POST /api/v1/promotion         — promote preprod → prod (returns undo TTL)
 * POST /api/v1/promotion/undo    — restore previous prod blob (5-min window)
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface PromotionPreviewKpiBucket {
  preprod: number;
  prod: number;
  delta: number;
}

export interface PromotionPreview {
  kpi: {
    planned: PromotionPreviewKpiBucket;
    late: PromotionPreviewKpiBucket;
  };
  prod: {
    id: string;
    promotedAt: string | null;
    promotedByUserId: string | null;
    undoAvailable: boolean;
    undoExpiresAt: string | null;
  } | null;
}

export interface PromotionResult {
  id: string;
  promotedAt: string | null;
  undoExpiresAt: string | null;
  undoAvailable: boolean;
}

export interface PromotionUndoResult {
  id: string;
  undoAvailable: false;
}

export const promotionApi = createApi({
  reducerPath: 'promotionApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Promotion'],
  endpoints: (builder) => ({
    getPromotionPreview: builder.query<PromotionPreview, void>({
      query: () => '/promotion/preview',
      providesTags: ['Promotion'],
    }),
    promote: builder.mutation<PromotionResult, void>({
      query: () => ({ url: '/promotion', method: 'POST' }),
      invalidatesTags: ['Promotion'],
      // The prod snapshot cache lives in a separate RTK Query slice
      // (prodSnapshotApi) — it doesn't see our 'Promotion' tag. Without
      // the cross-API invalidation below, the prod view keeps serving
      // the previous blob from cache after a successful promotion.
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          const { prodSnapshotApi } = await import('./prodSnapshotApi');
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
          const { scheduleApi } = await import('./scheduleApi');
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          // promotion failed — nothing to invalidate
        }
      },
    }),
    undoPromotion: builder.mutation<PromotionUndoResult, void>({
      query: () => ({ url: '/promotion/undo', method: 'POST' }),
      invalidatesTags: ['Promotion'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          const { prodSnapshotApi } = await import('./prodSnapshotApi');
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
          const { scheduleApi } = await import('./scheduleApi');
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        } catch {
          // undo failed — keep current cache
        }
      },
    }),
  }),
});

export const {
  useGetPromotionPreviewQuery,
  usePromoteMutation,
  useUndoPromotionMutation,
} = promotionApi;
