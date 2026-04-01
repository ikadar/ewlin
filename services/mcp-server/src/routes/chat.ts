import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { processMessage } from '../llm/client.js';
import { executeWriteTool } from '../llm/toolExecutor.js';
import { PhpApiClient } from '../api/phpClient.js';
import type { ConversationState, ChatResponse, ChatMessage } from '../types/conversation.js';
import { emptyTokenUsage } from '../types/conversation.js';

const chatRequestSchema = z.object({
  conversationId: z.string().nullable(),
  message: z.string().min(1),
  model: z.enum(['sonnet', 'haiku']).optional(),
});

/** In-memory conversation store with TTL cleanup. */
const conversations = new Map<string, ConversationState>();
const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, conv] of conversations) {
    if (now - conv.updatedAt > CONVERSATION_TTL_MS) {
      conversations.delete(id);
    }
  }
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getPhpApiUrl(): string {
  return process.env.PHP_API_URL ?? 'http://localhost:8080/api/v1';
}

function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return '';
}

export function createChatRouter(): RouterType {
  const router: RouterType = Router();

  /**
   * POST /chat — Send a message to the AI scheduler assistant.
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      cleanupExpired();

      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'InvalidRequest',
          message: parsed.error.errors.map((e) => e.message).join(', '),
        });
        return;
      }

      const { conversationId, message, model } = parsed.data;
      const token = extractToken(req);
      const phpClient = new PhpApiClient(getPhpApiUrl(), token);

      // Get or create conversation
      let conversation: ConversationState;
      if (conversationId && conversations.has(conversationId)) {
        conversation = conversations.get(conversationId)!;
        conversation.updatedAt = Date.now();
      } else {
        const newId = generateConversationId();
        conversation = {
          id: newId,
          messages: [],
          pendingActions: [],
          status: 'idle',
          jwtToken: token,
          totalUsage: emptyTokenUsage(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        conversations.set(newId, conversation);
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: message,
      });

      // Process through Claude
      const { assistantMessages, pendingActions, usage } = await processMessage(
        conversation,
        phpClient,
        model
      );

      // Accumulate token usage into session total
      conversation.totalUsage.inputTokens += usage.inputTokens;
      conversation.totalUsage.outputTokens += usage.outputTokens;
      conversation.totalUsage.cacheReadTokens += usage.cacheReadTokens;
      conversation.totalUsage.cacheCreationTokens += usage.cacheCreationTokens;

      // Update conversation state
      if (pendingActions.length > 0) {
        conversation.pendingActions = pendingActions;
        conversation.status = 'awaiting_confirmation';
      } else {
        conversation.status = 'completed';
      }

      const response: ChatResponse = {
        conversationId: conversation.id,
        messages: assistantMessages,
        status: conversation.status,
        pendingActions: conversation.pendingActions,
        usage: conversation.totalUsage,
      };

      res.json(response);
    } catch (error) {
      console.error('[chat] Error processing message:', error);
      res.status(500).json({
        error: 'InternalError',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /chat/:id/confirm — Execute pending actions.
   */
  router.post('/chat/:id/confirm', async (req: Request, res: Response) => {
    try {
      const conversation = conversations.get(req.params.id!);
      if (!conversation) {
        res.status(404).json({ error: 'NotFound', message: 'Conversation not found' });
        return;
      }

      if (conversation.status !== 'awaiting_confirmation') {
        res.status(400).json({
          error: 'InvalidState',
          message: `Conversation is in "${conversation.status}" state, not "awaiting_confirmation"`,
        });
        return;
      }

      conversation.status = 'executing';
      const token = extractToken(req) || conversation.jwtToken;
      const phpClient = new PhpApiClient(getPhpApiUrl(), token);

      const executedMessages: ChatMessage[] = [];

      for (const action of conversation.pendingActions) {
        try {
          const result = await executeWriteTool(action.toolName, action.input, phpClient);
          action.result = result;
          action.status = 'executed';
        } catch (e) {
          action.status = 'failed';
          action.result = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      // Build a single summary message with all tool call results attached
      const succeeded = conversation.pendingActions.filter((a) => a.status === 'executed');
      const failed = conversation.pendingActions.filter((a) => a.status === 'failed');

      let summary = '';
      if (succeeded.length > 0) {
        summary += `${succeeded.length} action${succeeded.length > 1 ? 's' : ''} executed.`;
      }
      if (failed.length > 0) {
        summary += ` ${failed.length} failed.`;
      }

      executedMessages.push({
        id: `exec-${Date.now()}`,
        role: 'assistant',
        content: summary.trim(),
        timestamp: new Date().toISOString(),
        toolCalls: [...conversation.pendingActions],
      });

      conversation.status = 'completed';
      conversation.updatedAt = Date.now();

      const response: ChatResponse = {
        conversationId: conversation.id,
        messages: executedMessages,
        status: 'completed',
        pendingActions: conversation.pendingActions,
      };

      // Clear pending actions after execution
      conversation.pendingActions = [];

      res.json(response);
    } catch (error) {
      console.error('[chat] Error confirming actions:', error);
      res.status(500).json({
        error: 'InternalError',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /chat/:id/cancel — Cancel pending actions.
   */
  router.post('/chat/:id/cancel', async (req: Request, res: Response) => {
    const conversation = conversations.get(req.params.id!);
    if (!conversation) {
      res.status(404).json({ error: 'NotFound', message: 'Conversation not found' });
      return;
    }

    for (const action of conversation.pendingActions) {
      action.status = 'cancelled';
    }

    conversation.status = 'idle';
    conversation.pendingActions = [];
    conversation.updatedAt = Date.now();

    res.json({
      conversationId: conversation.id,
      messages: [
        {
          id: `cancel-${Date.now()}`,
          role: 'assistant',
          content: 'Actions cancelled.',
          timestamp: new Date().toISOString(),
        },
      ],
      status: 'idle',
      pendingActions: [],
    } satisfies ChatResponse);
  });

  /**
   * DELETE /chat/:id — Delete a conversation.
   */
  router.delete('/chat/:id', (req: Request, res: Response) => {
    conversations.delete(req.params.id!);
    res.status(204).send();
  });

  return router;
}
