/**
 * RTK Query slice — Archive browser endpoints.
 *
 * GET  /api/v1/scenarios/archives           — list archives newest-first
 * GET  /api/v1/scenarios/archives/{id}      — archive detail (includes payload)
 * POST /api/v1/scenarios/archives/{id}/restore — roll archive into prod
 *
 * Restore behaves exactly like a promotion from the cache invalidation
 * standpoint — the prod blob changes, so we kick prodSnapshotApi and
 * scheduleApi the same way promotionApi does. Promotion-related caches
 * (preview KPIs, undo state) are also invalidated so the FAB widgets
 * pick up the new undo TTL without a refresh.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface ArchiveSummary {
  id: string;
  promotedAt: string | null;
  promotedByUserId: string | null;
  engineVersion: string | null;
  algoParamsHash: string | null;
  archivedFromId: string | null;
  promotedFromId: string | null;
  createdAt: string;
}

export interface ArchiveListResponse {
  archives: ArchiveSummary[];
  count: number;
}

export interface ArchiveDetail extends ArchiveSummary {
  /** Decoded JSON snapshot — null if the archive payload was malformed. */
  payload: Record<string, unknown> | null;
}

export interface ArchiveRestoreResult {
  id: string;
  restoredFromArchiveId: string;
  undoExpiresAt: string | null;
  undoAvailable: boolean;
}

export interface ArchiveListArgs {
  limit?: number;
  before?: string;
}

export const archiveApi = createApi({
  reducerPath: 'archiveApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Archive'],
  endpoints: (builder) => ({
    getArchives: builder.query<ArchiveListResponse, ArchiveListArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.limit !== undefined) params.set('limit', String(args.limit));
        if (args?.before) params.set('before', args.before);
        const qs = params.toString();
        return `/scenarios/archives${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.archives.map((a) => ({ type: 'Archive' as const, id: a.id })),
              { type: 'Archive' as const, id: 'LIST' },
            ]
          : [{ type: 'Archive' as const, id: 'LIST' }],
    }),
    getArchive: builder.query<ArchiveDetail, string>({
      query: (id) => `/scenarios/archives/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Archive', id }],
    }),
    restoreArchive: builder.mutation<ArchiveRestoreResult, string>({
      query: (id) => ({ url: `/scenarios/archives/${id}/restore`, method: 'POST' }),
      // Restore creates a new archive row (the rotated prod state) AND
      // changes prod, so we burn the LIST tag plus all prod views.
      invalidatesTags: [{ type: 'Archive', id: 'LIST' }],
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          const { prodSnapshotApi } = await import('./prodSnapshotApi');
          dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
          const { scheduleApi } = await import('./scheduleApi');
          dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
          const { promotionApi } = await import('./promotionApi');
          dispatch(promotionApi.util.invalidateTags(['Promotion']));
        } catch {
          // restore failed — keep current cache
        }
      },
    }),
  }),
});

export const {
  useGetArchivesQuery,
  useGetArchiveQuery,
  useRestoreArchiveMutation,
} = archiveApi;
