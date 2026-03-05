/**
 * RTK Query API Slice - Template API
 *
 * Provides template listing and update via RTK Query.
 * Uses baseQueryWithFixtureSupport for hybrid mock/real API support.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type { JcfTemplate, JcfTemplateCreateInput, JcfTemplateUpdateInput } from '@flux/types';
import { baseQueryWithFixtureSupport } from './baseApi';

interface TemplateListResponse {
  items: JcfTemplate[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const templateApi = createApi({
  reducerPath: 'templateApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['Templates'],
  endpoints: (builder) => ({
    getTemplates: builder.query<TemplateListResponse, void>({
      query: () => '/templates?limit=100',
      providesTags: ['Templates'],
    }),
    createTemplate: builder.mutation<JcfTemplate, JcfTemplateCreateInput>({
      query: (body) => ({
        url: '/templates',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Templates'],
    }),
    updateTemplate: builder.mutation<JcfTemplate, { id: string; body: JcfTemplateUpdateInput }>({
      query: ({ id, body }) => ({
        url: `/templates/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Templates'],
    }),
    deleteTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Templates'],
    }),
  }),
});

export const { useGetTemplatesQuery, useCreateTemplateMutation, useUpdateTemplateMutation, useDeleteTemplateMutation } = templateApi;
