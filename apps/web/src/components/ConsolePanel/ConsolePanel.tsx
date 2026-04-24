/**
 * Natural-language console panel — slides up from the bottom on ALT+I.
 *
 * Flow:
 *   1. User types a French command, presses Enter.
 *   2. POST /console/execute → kind=plan|question|error.
 *   3. If plan: render PlanCard with [Appliquer] / [Modifier] / [Annuler].
 *   4. On Appliquer: POST /console/apply, render results in the message stream.
 *
 * Conversation state lives entirely client-side here so re-prompts can
 * carry the prior tool-call context back to the LLM via conversationAfter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useExecuteCommandMutation,
  useApplyPlanMutation,
  type ConversationMessage,
  type ExecuteResult,
  type ProposedAction,
  type ResolvedEntity,
  type ApplyResultEntry,
} from '../../store/api/consoleApi';
import { useAutoRecomputeCtx } from '../../contexts/AutoRecomputeContext';
import { PlanCard } from './PlanCard';
import { MessageBubble } from './MessageBubble';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'result';
  text: string;
}

interface PendingPlan {
  rawPrompt: string;
  narration: string;
  actions: ProposedAction[];
  resolvedEntities: ResolvedEntity[];
}

interface ConsolePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

let messageCounter = 0;
const newId = () => `msg-${++messageCounter}`;

export function ConsolePanel({ isOpen, onClose }: ConsolePanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);

  const [executeCommand, executeState] = useExecuteCommandMutation();
  const [applyPlan, applyState] = useApplyPlanMutation();
  const { trigger: triggerAutoRecompute } = useAutoRecomputeCtx();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus textarea when opening.
  useEffect(() => {
    if (isOpen) {
      // Defer to allow slide-in animation to start.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingPlan]);

  // Esc closes the panel (unless input is focused mid-typing — handled by handleKeyDown).
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const handleResult = useCallback(
    (result: ExecuteResult, rawPrompt: string) => {
      setConversation(result.conversationAfter);

      if (result.kind === 'plan') {
        setPendingPlan({
          rawPrompt,
          narration: result.narration,
          actions: result.actions,
          resolvedEntities: result.resolvedEntities,
        });
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', text: result.narration },
        ]);
      } else if (result.kind === 'question') {
        setPendingPlan(null);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            text: result.options?.length
              ? `${result.question}\n${result.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
              : result.question,
          },
        ]);
      } else {
        setPendingPlan(null);
        const detail = result.message ? `\n${result.message}` : '';
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', text: `❌ ${result.error}${detail}` },
        ]);
      }
    },
    [],
  );

  const submitPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || executeState.isLoading) return;

      setInput('');
      setPendingPlan(null);
      setMessages((prev) => [...prev, { id: newId(), role: 'user', text: trimmed }]);

      try {
        const result = await executeCommand({
          prompt: trimmed,
          conversation,
        }).unwrap();
        handleResult(result, trimmed);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', text: `❌ ${message}` },
        ]);
      }
    },
    [conversation, executeCommand, executeState.isLoading, handleResult],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(input);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt(input);
    }
  };

  const handleApply = async () => {
    if (!pendingPlan || applyState.isLoading) return;
    try {
      const response = await applyPlan({
        rawPrompt: pendingPlan.rawPrompt,
        narration: pendingPlan.narration,
        actions: pendingPlan.actions,
      }).unwrap();
      const summary = formatApplyResults(response.results);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'result',
          text: response.success ? `✅ ${summary}` : `⚠️ ${summary}`,
        },
      ]);
      setPendingPlan(null);
      setConversation([]);
      // The console-service bypasses the RTK mutation layer, so the
      // autoRecomputeMiddleware allow-list would never fire on its own.
      // Any successful action here may have changed scheduling constraints
      // (operator absence, station exception, task deadline, …), so trigger
      // the same debounced compute the admin pages use.
      if (response.results.some((r) => r.ok)) {
        triggerAutoRecompute('console apply');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l’application';
      setMessages((prev) => [...prev, { id: newId(), role: 'result', text: `❌ ${message}` }]);
    }
  };

  const handleEdit = () => {
    if (!pendingPlan) return;
    setInput(pendingPlan.rawPrompt);
    setPendingPlan(null);
    inputRef.current?.focus();
  };

  const handleCancelPlan = () => {
    setPendingPlan(null);
    setConversation([]);
  };

  const handleResetConversation = () => {
    setMessages([]);
    setConversation([]);
    setPendingPlan(null);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col border-t border-zinc-700 bg-zinc-900/95 text-zinc-100 shadow-2xl backdrop-blur"
      style={{ height: '40vh', minHeight: 320 }}
      role="dialog"
      aria-label="Console en langage naturel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span aria-hidden="true">⚡</span>
          <span>Console (ALT+I)</span>
          {executeState.isLoading && (
            <span className="text-xs text-zinc-400">…réflexion</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetConversation}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Nouvelle conversation
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Fermer la console"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && !pendingPlan && (
          <div className="text-center text-xs text-zinc-500">
            Tapez une commande en français. Exemples : « Frédéric absent du 13 au 15 avril »,
            « Décale la deadline du dossier 35202 de 4 jours », « Maintenance MBO XL le 14 avril
            de 10h à 13h ».
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {pendingPlan && (
          <PlanCard
            narration={pendingPlan.narration}
            actions={pendingPlan.actions}
            resolvedEntities={pendingPlan.resolvedEntities}
            isApplying={applyState.isLoading}
            onApply={handleApply}
            onEdit={handleEdit}
            onCancel={handleCancelPlan}
          />
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-700 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Que voulez-vous faire ?"
            rows={2}
            disabled={executeState.isLoading}
            className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || executeState.isLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {executeState.isLoading ? '…' : 'Envoyer'}
          </button>
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">
          Entrée pour envoyer • Shift+Entrée pour aller à la ligne • Échap pour fermer
        </div>
      </form>
    </div>
  );
}

function formatApplyResults(results: ApplyResultEntry[]): string {
  if (results.length === 0) return 'Aucune action à appliquer.';
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  if (failed === 0) {
    return `${ok} action${ok > 1 ? 's' : ''} appliquée${ok > 1 ? 's' : ''}.`;
  }
  const firstError = results.find((r) => !r.ok)?.error ?? 'erreur inconnue';
  return `${ok}/${results.length} appliquées. Échec : ${firstError}`;
}
