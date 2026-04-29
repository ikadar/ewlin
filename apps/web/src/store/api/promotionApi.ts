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
    }),
    undoPromotion: builder.mutation<PromotionUndoResult, void>({
      query: () => ({ url: '/promotion/undo', method: 'POST' }),
      invalidatesTags: ['Promotion'],
    }),
  }),
});

export const {
  useGetPromotionPreviewQuery,
  usePromoteMutation,
  useUndoPromotionMutation,
} = promotionApi;
