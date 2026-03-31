/**
 * Chat API Slice
 *
 * RTK Query API for the AI Scheduler Assistant (MCP Server).
 * Connects to the MCP server on a separate base URL.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ChatResponse, ChatModelId } from '@flux/types';
import type { RootState } from '../index';
import { scheduleApi } from './scheduleApi';

function getMcpServerUrl(): string {
  return import.meta.env.VITE_MCP_SERVER_URL ?? 'http://localhost:3002';
}

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: fetchBaseQuery({
    baseUrl: getMcpServerUrl(),
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  endpoints: (builder) => ({
    sendMessage: builder.mutation<
      ChatResponse,
      { conversationId: string | null; message: string; model?: ChatModelId }
    >({
      query: (body) => ({
        url: '/chat',
        method: 'POST',
        body,
      }),
    }),

    confirmActions: builder.mutation<ChatResponse, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/chat/${conversationId}/confirm`,
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        // After actions are executed, invalidate the schedule snapshot
        dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
      },
    }),

    cancelActions: builder.mutation<ChatResponse, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/chat/${conversationId}/cancel`,
        method: 'POST',
      }),
    }),

    deleteConversation: builder.mutation<void, { conversationId: string }>({
      query: ({ conversationId }) => ({
        url: `/chat/${conversationId}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useSendMessageMutation,
  useConfirmActionsMutation,
  useCancelActionsMutation,
  useDeleteConversationMutation,
} = chatApi;
