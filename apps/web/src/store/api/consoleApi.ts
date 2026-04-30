/**
 * RTK Query API slice for the natural-language ALT+I console.
 *
 * Talks to the console-service (Node) at /console/* — proxied by nginx
 * to console-service:3004. Distinct from the PHP API base URL because
 * the console-service is a separate process with its own routes; the
 * JWT we forward is the same one the user has in the auth slice.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AuthState } from '../slices/authSlice';
import { resolveScenarioHeader } from './realBaseQuery';

// ----------------------------------------------------------------------------
// Wire types — must stay in sync with services/console-service/src/llm/loop.ts
// ----------------------------------------------------------------------------

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  preview?: string;
}

export interface ResolvedEntity {
  kind: 'operator' | 'station' | 'job' | 'task';
  id: string;
  label: string;
}

/**
 * Mirror of services/console-service/src/llm/loop.ts ConversationMessage,
 * which itself mirrors Anthropic's wire format. The FE never reads
 * any field of these messages — we just round-trip the array back to
 * /execute on the next request so the model keeps prior tool-use
 * context. So the type is intentionally loose: anything the server
 * sends back, we send back.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

export type ExecuteResult =
  | {
      kind: 'plan';
      narration: string;
      actions: ProposedAction[];
      resolvedEntities: ResolvedEntity[];
      conversationAfter: ConversationMessage[];
    }
  | {
      kind: 'question';
      question: string;
      options?: string[];
      conversationAfter: ConversationMessage[];
    }
  | {
      kind: 'error';
      error: string;
      message?: string;
      conversationAfter: ConversationMessage[];
    };

export interface ExecuteRequest {
  prompt: string;
  conversation?: ConversationMessage[];
}

export interface ApplyRequest {
  rawPrompt: string;
  narration: string;
  actions: ProposedAction[];
}

export interface ApplyResultEntry {
  tool: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface ApplyResponse {
  success: boolean;
  results: ApplyResultEntry[];
  auditId: string | null;
}

export interface AuditEntry {
  id: string;
  userId: string;
  rawPrompt: string;
  narration: string | null;
  proposedActions: ProposedAction[] | null;
  appliedResults: ApplyResultEntry[] | null;
  success: boolean;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Base query
// ----------------------------------------------------------------------------

function getConsoleBaseUrl(): string {
  const url = import.meta.env.VITE_CONSOLE_URL;
  if (!url) {
    return '/console';
  }
  return url.replace(/\/$/, '');
}

const consoleBaseQuery = fetchBaseQuery({
  baseUrl: getConsoleBaseUrl(),
  credentials: 'same-origin',
  prepareHeaders: (headers, { getState }) => {
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    const token = (getState() as { auth: AuthState }).auth?.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    // Without this, /console/apply silently writes to Préprod even when
    // the chef is acting from inside a fork — the PUT succeeds but the
    // mutation lands on the wrong scenario, which the UI doesn't show.
    const scenario = resolveScenarioHeader();
    if (scenario !== null) {
      headers.set('X-Flux-Scenario', scenario);
    }
    return headers;
  },
});

// ----------------------------------------------------------------------------
// API slice
// ----------------------------------------------------------------------------

export const consoleApi = createApi({
  reducerPath: 'consoleApi',
  baseQuery: consoleBaseQuery,
  tagTypes: ['ConsoleHistory'],
  endpoints: (builder) => ({
    executeCommand: builder.mutation<ExecuteResult, ExecuteRequest>({
      query: (body) => ({
        url: '/execute',
        method: 'POST',
        body,
      }),
    }),
    applyPlan: builder.mutation<ApplyResponse, ApplyRequest>({
      query: (body) => ({
        url: '/apply',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ConsoleHistory'],
    }),
    getHistory: builder.query<AuditEntry[], { limit?: number } | void>({
      query: (args) => {
        const limit = args && 'limit' in args && args.limit ? args.limit : 20;
        return `/history?limit=${limit}`;
      },
      providesTags: ['ConsoleHistory'],
    }),
  }),
});

export const {
  useExecuteCommandMutation,
  useApplyPlanMutation,
  useGetHistoryQuery,
} = consoleApi;
