/**
 * RTK Query API slice — Jobs de test (settings page).
 *
 * Routes :
 *   GET  /api/v1/job-test/recipes
 *   POST /api/v1/job-test/recipes
 *   PUT  /api/v1/job-test/recipes/:id
 *   DEL  /api/v1/job-test/recipes/:id
 *   POST /api/v1/job-test/recipes/:id/generate
 *   GET  /api/v1/job-test/scenarios
 *   POST /api/v1/job-test/scenarios
 *   PUT  /api/v1/job-test/scenarios/:id
 *   DEL  /api/v1/job-test/scenarios/:id
 *   POST /api/v1/job-test/scenarios/:id/execute
 *   POST /api/v1/job-test/scenarios/:id/duplicate
 *   POST /api/v1/job-test/generate-one-of-each
 *   POST /api/v1/job-test/wipe
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithFixtureSupport } from './baseApi';

export interface JobTestRecipeResponse {
  id: string;
  baseJobId: string;
  baseJobReference: string | null;
  baseJobDescription: string | null;
  baseJobQuantity: number | null;
  baseJobMissing: boolean;
  quantity: number | null;
  workshopExitDate: string | null;
  deadlineRelativeWorkingDays: number | null;
  batDeadline: string | null;
  deadlinePriority: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobTestRecipeInput {
  baseJobId: string;
  quantity: number | null;
  workshopExitDate: string | null;
  deadlineRelativeWorkingDays: number | null;
  batDeadline: string | null;
  deadlinePriority: number;
}

export interface JobTestScenarioItemResponse {
  recipeId: string;
  count: number;
  position: number;
  recipe: JobTestRecipeResponse;
}

export interface JobTestScenarioInputItem {
  recipeId: string;
  count: number;
}

export interface JobTestScenarioResponse {
  id: string;
  name: string;
  description: string | null;
  items: JobTestScenarioItemResponse[];
  totalJobs: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobTestScenarioInput {
  name: string;
  description: string | null;
  items: JobTestScenarioInputItem[];
}

export interface JobTestGeneratedJob {
  id: string;
  reference: string;
  description: string;
  quantity: number | null;
}

export interface JobTestGenerateResponse {
  createdJobs: JobTestGeneratedJob[];
  generatedAt: string;
  totalJobs: number;
}

export interface JobTestWipeResponse {
  countsBefore: Record<string, number>;
  totalRowsWiped: number;
  wipedAt: string;
}

export const jobTestApi = createApi({
  reducerPath: 'jobTestApi',
  baseQuery: baseQueryWithFixtureSupport,
  tagTypes: ['JobTestRecipes', 'JobTestScenarios'],
  endpoints: (builder) => ({
    getRecipes: builder.query<JobTestRecipeResponse[], void>({
      query: () => '/job-test/recipes',
      transformResponse: (response: { items: JobTestRecipeResponse[] } | JobTestRecipeResponse[]) =>
        Array.isArray(response) ? response : (response.items ?? []),
      providesTags: ['JobTestRecipes'],
    }),
    createRecipe: builder.mutation<JobTestRecipeResponse, JobTestRecipeInput>({
      query: (body) => ({ url: '/job-test/recipes', method: 'POST', body }),
      invalidatesTags: ['JobTestRecipes', 'JobTestScenarios'],
    }),
    updateRecipe: builder.mutation<JobTestRecipeResponse, { id: string; body: JobTestRecipeInput }>({
      query: ({ id, body }) => ({ url: `/job-test/recipes/${id}`, method: 'PUT', body }),
      invalidatesTags: ['JobTestRecipes', 'JobTestScenarios'],
    }),
    deleteRecipe: builder.mutation<void, string>({
      query: (id) => ({ url: `/job-test/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['JobTestRecipes', 'JobTestScenarios'],
    }),
    generateRecipe: builder.mutation<JobTestGenerateResponse, string>({
      query: (id) => ({ url: `/job-test/recipes/${id}/generate`, method: 'POST' }),
    }),
    generateOneOfEach: builder.mutation<JobTestGenerateResponse, void>({
      query: () => ({ url: '/job-test/generate-one-of-each', method: 'POST' }),
    }),

    getScenarios: builder.query<JobTestScenarioResponse[], void>({
      query: () => '/job-test/scenarios',
      transformResponse: (response: { items: JobTestScenarioResponse[] } | JobTestScenarioResponse[]) =>
        Array.isArray(response) ? response : (response.items ?? []),
      providesTags: ['JobTestScenarios'],
    }),
    createScenario: builder.mutation<JobTestScenarioResponse, JobTestScenarioInput>({
      query: (body) => ({ url: '/job-test/scenarios', method: 'POST', body }),
      invalidatesTags: ['JobTestScenarios'],
    }),
    updateScenario: builder.mutation<JobTestScenarioResponse, { id: string; body: JobTestScenarioInput }>({
      query: ({ id, body }) => ({ url: `/job-test/scenarios/${id}`, method: 'PUT', body }),
      invalidatesTags: ['JobTestScenarios'],
    }),
    deleteScenario: builder.mutation<void, string>({
      query: (id) => ({ url: `/job-test/scenarios/${id}`, method: 'DELETE' }),
      invalidatesTags: ['JobTestScenarios'],
    }),
    executeScenario: builder.mutation<JobTestGenerateResponse, string>({
      query: (id) => ({ url: `/job-test/scenarios/${id}/execute`, method: 'POST' }),
    }),
    duplicateScenario: builder.mutation<JobTestScenarioResponse, string>({
      query: (id) => ({ url: `/job-test/scenarios/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: ['JobTestScenarios'],
    }),

    wipe: builder.mutation<JobTestWipeResponse, void>({
      query: () => ({ url: '/job-test/wipe', method: 'POST' }),
    }),
  }),
});

export const {
  useGetRecipesQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useDeleteRecipeMutation,
  useGenerateRecipeMutation,
  useGenerateOneOfEachMutation,
  useGetScenariosQuery,
  useCreateScenarioMutation,
  useUpdateScenarioMutation,
  useDeleteScenarioMutation,
  useExecuteScenarioMutation,
  useDuplicateScenarioMutation,
  useWipeMutation,
} = jobTestApi;
