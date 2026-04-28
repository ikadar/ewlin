import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  SquareSlash,
  Sparkles,
  Check,
  CircleCheckBig,
  TriangleAlert,
  LoaderCircle,
} from 'lucide-react';
import type { Command } from './useCommands';
import { SHORTCUT_ZONES, addRecentCommand } from './useCommands';
import type { JobSearchEntry } from './CommandCenterContext';
import {
  useExecuteCommandMutation,
  useApplyPlanMutation,
  type ConversationMessage,
  type ProposedAction,
  type ResolvedEntity,
  type ApplyResultEntry,
} from '../../store/api/consoleApi';
import { useAutoRecomputeCtx } from '../../contexts/AutoRecomputeContext';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  jobs?: JobSearchEntry[];
  onSelectJob?: ((jobId: string) => void) | null;
}

const KBD_CLASS =
  'inline-flex items-center justify-center min-w-[18px] min-h-[18px] px-1 py-px rounded-[3px] text-[10px] font-mono leading-none text-zinc-300 bg-gradient-to-b from-zinc-700 to-zinc-800 border border-zinc-600 border-b-zinc-500 shadow-[0_1px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]';

/** Render an array of key strings as styled keycaps */
function renderKeys(keys: string[]) {
  const elements: React.ReactNode[] = [];

  keys.forEach((k, i) => {
    const isCombo = k.includes('+') && k.length > 1 && k !== '+';
    const subKeys = isCombo ? k.split('+') : [k];

    if (i > 0) {
      elements.push(
        <span key={`plus-${i}`} className="text-zinc-500 text-[11px] font-mono">+</span>
      );
    }

    subKeys.forEach((sub, j) => {
      if (j > 0) {
        elements.push(
          <span key={`sub-plus-${i}-${j}`} className="text-zinc-500 text-[11px] font-mono">+</span>
        );
      }
      elements.push(
        <kbd key={`key-${i}-${j}`} className={KBD_CLASS}>{sub}</kbd>
      );
    });
  });

  return <span className="flex items-center gap-0.5">{elements}</span>;
}

/** Highlight matching text in a label */
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-500 text-zinc-950 rounded-sm px-px">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface PendingPlan {
  rawPrompt: string;
  narration: string;
  actions: ProposedAction[];
  resolvedEntities: ResolvedEntity[];
}

// ============================================================
// Chat thread timeline — UI-side state independent of the
// backend round-trip `conversation` array.
// ============================================================

type ChatTurn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; kind: 'pending' }
  | {
      id: string;
      role: 'assistant';
      kind: 'plan';
      plan: PendingPlan;
      status: 'pending' | 'applied' | 'cancelled' | 'superseded';
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'question';
      question: string;
      options?: string[];
      rawPrompt: string;
      status: 'pending' | 'answered' | 'cancelled';
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'result';
      ok: boolean;
      title: string;
      body: string;
    };

let turnIdCounter = 0;
const newTurnId = (): string => `t${++turnIdCounter}`;

const ENTITY_LABEL: Record<ResolvedEntity['kind'], string> = {
  operator: 'Opérateur',
  station: 'Machine',
  job: 'Dossier',
  task: 'Tâche',
};

const ENTITY_BORDER_COLOR: Record<ResolvedEntity['kind'], string> = {
  operator: 'rgba(244,114,182,0.55)',
  station: 'rgba(167,139,250,0.55)',
  job: 'rgba(96,165,250,0.55)',
  task: 'rgba(52,211,153,0.55)',
};

export function CommandPalette({ isOpen, onClose, commands, jobs = [], onSelectJob }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const morphCaptureRef = useRef<{ inputFirst: DOMRect; paletteFirst: DOMRect } | null>(null);
  const prevChatModeRef = useRef(false);

  const [executeCommand, executeState] = useExecuteCommandMutation();
  const [applyPlan, applyState] = useApplyPlanMutation();
  const { trigger: triggerAutoRecompute } = useAutoRecomputeCtx();

  const chatMode = chatTurns.length > 0;

  // Reset state when opening (next opening = fresh command mode)
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setConversation([]);
      setChatTurns([]);
      prevChatModeRef.current = false;
      morphCaptureRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Latest pending assistant turn (plan or question), if any
  const latestPendingTurn = useMemo<ChatTurn | null>(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      const t = chatTurns[i];
      if (t.role !== 'assistant') continue;
      if (t.kind === 'pending') return t;
      if ((t.kind === 'plan' || t.kind === 'question') && t.status === 'pending') return t;
    }
    return null;
  }, [chatTurns]);

  const latestPlanTurn = useMemo(() => {
    for (let i = chatTurns.length - 1; i >= 0; i--) {
      const t = chatTurns[i];
      if (t.role === 'assistant' && t.kind === 'plan') return t;
    }
    return null;
  }, [chatTurns]);

  // Filter commands for dropdown — only relevant in command mode
  const filteredCommands = useMemo(() => {
    if (!search.trim() || chatMode) return [];

    const q = search.toLowerCase();

    const matched = commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords && c.keywords.toLowerCase().includes(q))
    );

    const jobResults: Command[] = [];
    if (onSelectJob && jobs.length > 0) {
      const isDigitsOnly = /^\d+$/.test(search.trim());

      for (const job of jobs) {
        if (jobResults.length >= 10) break;
        const matchesRef = job.reference.toLowerCase().includes(q);
        const matchesClient = job.client.toLowerCase().includes(q);
        const matchesDesc = job.description.toLowerCase().includes(q);
        if (matchesRef || matchesClient || matchesDesc) {
          const selectJob = onSelectJob;
          const jobId = job.id;
          jobResults.push({
            id: `job-${job.id}`,
            label: `#${job.reference} — ${job.client} — ${job.description}`,
            category: 'Jobs',
            icon: 'hash',
            keywords: '',
            action: () => selectJob(jobId),
          });
        }
      }

      if (isDigitsOnly && !jobResults.some(j => j.label.includes(`#${search.trim()} `))) {
        const refMatch = jobs.find(j => j.reference.includes(search.trim()));
        if (refMatch) {
          const selectJob = onSelectJob;
          const jobId = refMatch.id;
          const goToJob: Command = {
            id: `go-job-${search.trim()}`,
            label: `Aller au Job #${refMatch.reference}`,
            category: 'Navigation',
            icon: 'hash',
            keywords: '',
            action: () => selectJob(jobId),
          };
          return [goToJob, ...matched, ...jobResults.filter(j => j.id !== `job-${refMatch.id}`)];
        }
      }
    }

    return [...matched, ...jobResults];
  }, [search, commands, jobs, onSelectJob, chatMode]);

  const hasAIItem = search.trim().length > 0 && !chatMode;
  const totalDropdownItems = (hasAIItem ? 1 : 0) + filteredCommands.length;
  const hasDropdown = !chatMode && totalDropdownItems > 0 && search.trim().length > 0;

  // Clamp active index when dropdown shrinks
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, totalDropdownItems - 1)));
  }, [totalDropdownItems]);

  // Capture rects right before we flip into chat mode (used by the FLIP effect below)
  const captureMorphPositions = useCallback(() => {
    if (chatMode) return;
    if (!inputBarRef.current || !paletteRef.current) return;
    morphCaptureRef.current = {
      inputFirst: inputBarRef.current.getBoundingClientRect(),
      paletteFirst: paletteRef.current.getBoundingClientRect(),
    };
  }, [chatMode]);

  // Send AI prompt — handles both initial entry into chat mode and follow-ups.
  const executeAIPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    if (!chatMode) captureMorphPositions();

    const userTurn: ChatTurn = { id: newTurnId(), role: 'user', text: trimmed };
    const pendingTurn: ChatTurn = { id: newTurnId(), role: 'assistant', kind: 'pending' };

    setChatTurns(prev => {
      // Mark any prior pending plan/question as superseded — only one live turn at a time.
      const aged = prev.map((t): ChatTurn => {
        if (t.role !== 'assistant') return t;
        if (t.kind === 'plan' && t.status === 'pending') return { ...t, status: 'superseded' };
        if (t.kind === 'question' && t.status === 'pending') return { ...t, status: 'cancelled' };
        return t;
      });
      return [...aged, userTurn, pendingTurn];
    });
    setSearch('');

    try {
      const result = await executeCommand({ prompt: trimmed, conversation }).unwrap();
      setConversation(result.conversationAfter);

      setChatTurns(prev => prev.map((t): ChatTurn => {
        if (t.id !== pendingTurn.id) return t;
        if (result.kind === 'plan') {
          return {
            id: t.id,
            role: 'assistant',
            kind: 'plan',
            plan: {
              rawPrompt: trimmed,
              narration: result.narration,
              actions: result.actions,
              resolvedEntities: result.resolvedEntities,
            },
            status: 'pending',
          };
        }
        if (result.kind === 'question') {
          return {
            id: t.id,
            role: 'assistant',
            kind: 'question',
            question: result.question,
            options: result.options,
            rawPrompt: trimmed,
            status: 'pending',
          };
        }
        return {
          id: t.id,
          role: 'assistant',
          kind: 'result',
          ok: false,
          title: result.error,
          body: result.message ?? '',
        };
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setChatTurns(prev => prev.map((t): ChatTurn => {
        if (t.id !== pendingTurn.id) return t;
        return {
          id: t.id,
          role: 'assistant',
          kind: 'result',
          ok: false,
          title: 'Échec de l’IA',
          body: message,
        };
      }));
    }
  }, [executeCommand, conversation, chatMode, captureMorphPositions]);

  const handleApply = useCallback(async () => {
    const planTurn = latestPlanTurn;
    if (!planTurn || planTurn.status !== 'pending' || applyState.isLoading) return;

    try {
      const response = await applyPlan({
        rawPrompt: planTurn.plan.rawPrompt,
        narration: planTurn.plan.narration,
        actions: planTurn.plan.actions,
      }).unwrap();
      const summary = formatApplyResults(response.results);

      setChatTurns(prev => [
        ...prev.map((t): ChatTurn => {
          if (t.id === planTurn.id && t.role === 'assistant' && t.kind === 'plan') {
            return { ...t, status: 'applied' };
          }
          return t;
        }),
        {
          id: newTurnId(),
          role: 'assistant',
          kind: 'result',
          ok: response.success,
          title: response.success ? 'Action appliquée' : 'Application partielle',
          body: summary,
        },
      ]);

      // The apply is the end of a logical exchange — reset the backend conversation
      // so the next prompt starts fresh.
      setConversation([]);

      if (response.results.some(r => r.ok)) {
        triggerAutoRecompute('console apply');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l’application';
      setChatTurns(prev => [...prev, {
        id: newTurnId(),
        role: 'assistant',
        kind: 'result',
        ok: false,
        title: 'Échec de l’application',
        body: message,
      }]);
    }
  }, [latestPlanTurn, applyPlan, applyState.isLoading, triggerAutoRecompute]);

  const handlePickQuestionOption = useCallback((option: string) => {
    void executeAIPrompt(option);
  }, [executeAIPrompt]);

  const handleDropdownSelect = useCallback((i: number) => {
    if (hasAIItem && i === 0) {
      void executeAIPrompt(search);
      return;
    }
    const cmdIndex = hasAIItem ? i - 1 : i;
    const cmd = filteredCommands[cmdIndex];
    if (cmd) {
      addRecentCommand(cmd.id);
      cmd.action();
      onClose();
    }
  }, [hasAIItem, executeAIPrompt, search, filteredCommands, onClose]);

  const cancelLatestPending = useCallback(() => {
    setChatTurns(prev => prev.map((t): ChatTurn => {
      if (t.role !== 'assistant') return t;
      if (t.kind === 'plan' && t.status === 'pending') return { ...t, status: 'cancelled' };
      if (t.kind === 'question' && t.status === 'pending') return { ...t, status: 'cancelled' };
      return t;
    }));
  }, []);

  // Auto-close after a successful apply (legacy behavior preserved)
  useEffect(() => {
    if (chatTurns.length === 0) return;
    const last = chatTurns[chatTurns.length - 1];
    if (last.role === 'assistant' && last.kind === 'result' && last.ok) {
      const t = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(t);
    }
  }, [chatTurns, onClose]);

  // Auto-scroll thread to bottom when new turns arrive (only if user is near bottom)
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatTurns.length]);

  // Refocus input when entering chat mode (so user can immediately type a follow-up)
  useEffect(() => {
    if (chatMode) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chatMode]);

  // ── FLIP morph: animates input position + palette height when entering chat mode ──
  useLayoutEffect(() => {
    const wasChat = prevChatModeRef.current;
    prevChatModeRef.current = chatMode;
    if (!chatMode || wasChat) return;
    if (!morphCaptureRef.current) return;

    const palette = paletteRef.current;
    const input = inputBarRef.current;
    const body = threadRef.current;
    if (!palette || !input || !body) {
      morphCaptureRef.current = null;
      return;
    }

    const { inputFirst, paletteFirst } = morphCaptureRef.current;
    morphCaptureRef.current = null;

    const inputLast = input.getBoundingClientRect();
    const paletteLast = palette.getBoundingClientRect();
    const dy = inputFirst.top - inputLast.top;

    const easing = 'cubic-bezier(.25,.8,.25,1)';

    // INVERT — pin elements to their pre-morph layout
    palette.style.transition = 'none';
    palette.style.height = `${paletteFirst.height}px`;
    input.style.transition = 'none';
    input.style.transform = `translateY(${dy}px)`;
    body.style.transition = 'none';
    body.style.opacity = '0';

    // Force reflow so the inverted state is committed before animating
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    palette.offsetHeight;

    // PLAY — both transitions share duration & easing → coordinated movement
    const raf = requestAnimationFrame(() => {
      palette.style.transition = `height 0.42s ${easing}`;
      palette.style.height = `${paletteLast.height}px`;
      input.style.transition = `transform 0.42s ${easing}`;
      input.style.transform = 'translateY(0)';
      body.style.transition = 'opacity 0.32s 0.18s ease';
      body.style.opacity = '1';
    });

    const cleanupTimer = setTimeout(() => {
      palette.style.transition = '';
      palette.style.height = '';
      input.style.transition = '';
      input.style.transform = '';
      body.style.transition = '';
      body.style.opacity = '';
    }, 720);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cleanupTimer);
      // Best-effort cleanup if effect tears down mid-animation
      palette.style.transition = '';
      palette.style.height = '';
      input.style.transition = '';
      input.style.transform = '';
      body.style.transition = '';
      body.style.opacity = '';
    };
  }, [chatMode]);

  // ── Keyboard ──
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (chatMode) {
          if (latestPendingTurn) {
            cancelLatestPending();
          } else {
            onClose();
          }
        } else if (search) {
          setSearch('');
        } else {
          onClose();
        }
        return;
      }

      // Chat mode keyboard handling
      if (chatMode) {
        if (e.key === 'Enter') {
          // Typed follow-up has priority
          if (search.trim()) {
            e.preventDefault();
            void executeAIPrompt(search);
            return;
          }
          // Empty input + pending plan = apply
          if (latestPlanTurn && latestPlanTurn.status === 'pending' && !applyState.isLoading) {
            e.preventDefault();
            void handleApply();
            return;
          }
        }

        // Number keys pick question option (only when input empty)
        if (
          latestPendingTurn &&
          latestPendingTurn.role === 'assistant' &&
          latestPendingTurn.kind === 'question' &&
          latestPendingTurn.options &&
          latestPendingTurn.options.length > 0 &&
          !search.trim()
        ) {
          const num = Number(e.key);
          if (Number.isInteger(num) && num >= 1 && num <= latestPendingTurn.options.length) {
            e.preventDefault();
            handlePickQuestionOption(latestPendingTurn.options[num - 1]);
          }
        }
        return;
      }

      // Command mode dropdown nav
      if (!hasDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => Math.min(prev + 1, totalDropdownItems - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          handleDropdownSelect(activeIndex);
          break;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [
    isOpen,
    chatMode,
    latestPendingTurn,
    latestPlanTurn,
    activeIndex,
    totalDropdownItems,
    hasDropdown,
    onClose,
    handleDropdownSelect,
    handleApply,
    cancelLatestPending,
    handlePickQuestionOption,
    executeAIPrompt,
    search,
    applyState.isLoading,
  ]);

  // Auto-scroll active dropdown item into view
  useEffect(() => {
    if (!dropdownRef.current) return;
    const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        data-testid="command-palette-backdrop"
      />

      {/* Command Center panel */}
      <div
        ref={paletteRef}
        className={`fixed top-24 left-1/2 -translate-x-1/2 w-[70vw] max-w-[800px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[calc(100vh-110px)]${
          chatMode ? ' min-h-[clamp(280px,45vh,460px)]' : ''
        }`}
        data-testid="command-palette"
        data-mode={chatMode ? 'chat' : 'command'}
      >
        {/* ── Search bar — order swaps with mode ── */}
        <div
          ref={inputBarRef}
          className={`relative z-20 ${
            chatMode
              ? 'order-2 border-t border-zinc-800'
              : 'order-1 border-b border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2.5 px-4 py-3">
            {chatMode ? (
              <Sparkles size={16} className="text-blue-400 shrink-0" />
            ) : (
              <SquareSlash size={16} className="text-zinc-500 shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={
                chatMode
                  ? 'Continuer la conversation avec l’IA…'
                  : "Rechercher une commande, ou demander à l'IA..."
              }
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
              data-testid="command-palette-input"
            />
            {executeState.isLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
                <LoaderCircle size={12} className="animate-spin" />
                Réflexion…
              </span>
            ) : (
              <span className="shrink-0">
                {chatMode ? renderKeys(['⏎']) : renderKeys(['Alt', 'K'])}
              </span>
            )}
          </div>

          {/* Dropdown — only in command mode */}
          {!chatMode && hasDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 bg-zinc-900 border-t-2 border-blue-500 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-h-[280px] overflow-y-auto rounded-b-xl z-30"
              data-testid="command-dropdown"
            >
              {hasAIItem && (
                <div
                  className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors ${
                    activeIndex === 0 ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                  onClick={() => handleDropdownSelect(0)}
                  onMouseEnter={() => setActiveIndex(0)}
                  data-active={activeIndex === 0}
                  data-testid="dropdown-ai-prompt"
                >
                  <Sparkles size={14} className="text-blue-400 shrink-0" />
                  <span className="text-sm flex-1 truncate">
                    <span className="text-zinc-500">Demander à l&apos;IA :</span>
                    <span className="text-zinc-100 ml-1.5">{search}</span>
                  </span>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">IA</span>
                  <span className="shrink-0">{renderKeys(['⏎'])}</span>
                </div>
              )}
              {filteredCommands.map((cmd, i) => {
                const idx = (hasAIItem ? 1 : 0) + i;
                return (
                  <div
                    key={cmd.id}
                    className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors ${
                      idx === activeIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                    }`}
                    onClick={() => handleDropdownSelect(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    data-active={idx === activeIndex}
                    data-testid={`dropdown-${cmd.id}`}
                  >
                    <span className="text-sm text-zinc-200 flex-1">
                      {highlightMatch(cmd.label, search)}
                    </span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <span className="shrink-0">
                        {renderKeys(cmd.shortcut.split(/\s+/))}
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center gap-3 px-4 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
                <span>{totalDropdownItems} resultat{totalDropdownItems > 1 ? 's' : ''}</span>
                <span className="ml-auto flex items-center gap-2">
                  {renderKeys(['↑↓'])}
                  <span>selectionner</span>
                  {renderKeys(['⏎'])}
                  <span>executer</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Body: chat thread (chat mode only) ── */}
        {chatMode && (
          <div
            ref={threadRef}
            className="order-1 flex-1 min-h-0 overflow-y-auto p-3"
            data-testid="chat-thread"
          >
            <ChatThread
              turns={chatTurns}
              isApplying={applyState.isLoading}
              onApply={handleApply}
              onPickOption={handlePickQuestionOption}
            />
          </div>
        )}

        {/* ── Shortcut zones (command mode only) ── */}
        {!chatMode && (
          <div
            className={`order-2 grid grid-cols-2 gap-0.5 p-2 transition-opacity duration-200 ${
              hasDropdown ? 'opacity-30 pointer-events-none' : ''
            }`}
            data-testid="shortcut-zones"
          >
            {SHORTCUT_ZONES.map(zone => (
              <div key={zone.id} className="px-3 py-2.5">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  {zone.title}
                </div>
                {zone.shortcuts.map((sc, i) => (
                  <div key={i} className="flex items-center gap-2 py-[3px]">
                    <span className="text-[11px] text-zinc-500 flex-1">{sc.label}</span>
                    <span className="shrink-0">{renderKeys(sc.keys)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="order-3 flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500">
          {chatMode ? (
            <ChatFooterHints
              latestPendingTurn={latestPendingTurn}
              latestPlanTurn={latestPlanTurn}
              hasInputText={!!search.trim()}
            />
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                {renderKeys(['↑↓'])}
                <span>naviguer</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                {renderKeys(['⏎'])}
                <span>executer</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                {renderKeys(['Esc'])}
                <span>fermer</span>
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// ChatThread + per-turn renderers (Proposal A — Threaded chat)
// ============================================================

interface ChatThreadProps {
  turns: ChatTurn[];
  isApplying: boolean;
  onApply: () => void;
  onPickOption: (option: string) => void;
}

function ChatThread({ turns, isApplying, onApply, onPickOption }: ChatThreadProps) {
  const latestPendingId = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (t.role !== 'assistant') continue;
      if (t.kind === 'pending') return t.id;
      if ((t.kind === 'plan' || t.kind === 'question') && t.status === 'pending') return t.id;
    }
    return null;
  }, [turns]);

  return (
    <div className="flex flex-col gap-3">
      {turns.map(turn => {
        if (turn.role === 'user') {
          return <UserTurn key={turn.id} text={turn.text} />;
        }
        if (turn.kind === 'pending') {
          return <AssistantPendingTurn key={turn.id} />;
        }
        if (turn.kind === 'plan') {
          return (
            <AssistantPlanTurn
              key={turn.id}
              plan={turn.plan}
              status={turn.status}
              isLatest={turn.id === latestPendingId}
              isApplying={isApplying}
              onApply={onApply}
            />
          );
        }
        if (turn.kind === 'question') {
          return (
            <AssistantQuestionTurn
              key={turn.id}
              question={turn.question}
              options={turn.options}
              status={turn.status}
              isLatest={turn.id === latestPendingId}
              onPick={onPickOption}
            />
          );
        }
        return <AssistantResultTurn key={turn.id} ok={turn.ok} title={turn.title} body={turn.body} />;
      })}
    </div>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] bg-zinc-800 border border-zinc-700 rounded-[14px_14px_4px_14px] px-3 py-1.5 text-sm text-zinc-200 whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}

function AssistantPendingTurn() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="text-blue-400 leading-tight pt-0.5 text-base shrink-0">✦</div>
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <LoaderCircle size={13} className="animate-spin" />
        <span>Réflexion…</span>
      </div>
    </div>
  );
}

interface AssistantPlanTurnProps {
  plan: PendingPlan;
  status: 'pending' | 'applied' | 'cancelled' | 'superseded';
  isLatest: boolean;
  isApplying: boolean;
  onApply: () => void;
}

function AssistantPlanTurn({ plan, status, isLatest, isApplying, onApply }: AssistantPlanTurnProps) {
  const [expanded, setExpanded] = useState(false);
  const stale = status !== 'pending';
  const showApply = isLatest && status === 'pending';

  return (
    <div className={`flex gap-2.5 items-start ${stale ? 'opacity-55' : ''}`}>
      <div className="text-blue-400 leading-tight pt-0.5 text-base shrink-0">✦</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {renderNarrationWithEntities(plan.narration, plan.resolvedEntities)}
        </div>

        {plan.actions.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-dashed border-zinc-700 hover:bg-zinc-800/60 transition-colors"
          >
            <span className="font-mono">⌥</span>
            <b className="font-semibold">{plan.actions.length}</b>
            <span>modification{plan.actions.length > 1 ? 's' : ''} ·</span>
            <span>{expanded ? 'masquer' : 'voir le détail'}</span>
          </button>
        )}

        {expanded && plan.actions.length > 0 && (
          <ol className="mt-2 pl-5 border-l-2 border-blue-500/50 bg-zinc-900/40 py-2 pr-2 rounded-r text-xs text-zinc-300 list-decimal flex flex-col gap-0.5">
            {plan.actions.map((a, i) => (
              <li key={i} className="pl-1">
                {a.preview ?? <code className="font-mono text-zinc-400">{a.tool}</code>}
              </li>
            ))}
          </ol>
        )}

        {showApply && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying || plan.actions.length === 0}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm"
              data-testid="ai-apply-button"
            >
              {isApplying ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} />}
              <span>{isApplying ? 'Application…' : 'Appliquer'}</span>
              <span className="font-mono text-[10px] bg-black/25 px-1.5 py-0.5 rounded">⏎</span>
            </button>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Annulé</div>
        )}
        {status === 'superseded' && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Plan précédent</div>
        )}
      </div>
    </div>
  );
}

interface AssistantQuestionTurnProps {
  question: string;
  options?: string[];
  status: 'pending' | 'answered' | 'cancelled';
  isLatest: boolean;
  onPick: (option: string) => void;
}

function AssistantQuestionTurn({ question, options, status, isLatest, onPick }: AssistantQuestionTurnProps) {
  const stale = status !== 'pending';
  return (
    <div className={`flex gap-2.5 items-start ${stale ? 'opacity-55' : ''}`}>
      <div className="text-amber-400 leading-tight pt-0.5 text-base shrink-0">✦</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">{question}</div>

        {options && options.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={!isLatest || stale}
                onClick={() => onPick(opt)}
                className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-zinc-700"
              >
                <span className="font-mono text-[11px] w-5 h-5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
          </div>
        )}

        {status === 'cancelled' && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Annulé</div>
        )}
      </div>
    </div>
  );
}

function AssistantResultTurn({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  const Icon = ok ? CircleCheckBig : TriangleAlert;
  return (
    <div className="flex gap-2.5 items-start">
      <Icon size={16} className={`${ok ? 'text-green-400' : 'text-red-400'} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {body && <div className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap">{body}</div>}
      </div>
    </div>
  );
}

// Render the AI's narration with each resolved entity highlighted inline
// (dotted underline color-coded by kind). No separate pill row.
function renderNarrationWithEntities(narration: string, entities: ResolvedEntity[]): React.ReactNode {
  if (entities.length === 0) return narration;
  const sortedEntities = [...entities].sort((a, b) => b.label.length - a.label.length);
  let parts: React.ReactNode[] = [narration];
  let keyCounter = 0;

  for (const entity of sortedEntities) {
    const next: React.ReactNode[] = [];
    for (const part of parts) {
      if (typeof part !== 'string') {
        next.push(part);
        continue;
      }
      let cursor = 0;
      let str = part;
      while (true) {
        const idx = str.indexOf(entity.label, cursor);
        if (idx === -1) {
          next.push(str.slice(cursor));
          break;
        }
        if (idx > cursor) next.push(str.slice(cursor, idx));
        next.push(
          <span
            key={`e-${keyCounter++}`}
            className="font-semibold border-b border-dotted text-zinc-50"
            style={{ borderColor: ENTITY_BORDER_COLOR[entity.kind] }}
            title={`${ENTITY_LABEL[entity.kind]} ${entity.id}`}
          >
            {entity.label}
          </span>
        );
        cursor = idx + entity.label.length;
        str = part;
        if (cursor >= str.length) break;
      }
    }
    parts = next;
  }
  return <>{parts}</>;
}

// ============================================================
// Footer hint helper
// ============================================================

interface ChatFooterHintsProps {
  latestPendingTurn: ChatTurn | null;
  latestPlanTurn:
    | (Extract<ChatTurn, { role: 'assistant'; kind: 'plan' }>)
    | null;
  hasInputText: boolean;
}

function ChatFooterHints({ latestPendingTurn, latestPlanTurn, hasInputText }: ChatFooterHintsProps) {
  const planPending = latestPlanTurn?.status === 'pending';
  const enterAction = hasInputText
    ? 'envoyer'
    : planPending
      ? 'appliquer'
      : 'envoyer';
  const escAction = latestPendingTurn ? 'annuler ce tour' : 'fermer';
  return (
    <>
      <span className="flex items-center gap-1.5">
        {renderKeys(['⏎'])}
        <span>{enterAction}</span>
      </span>
      <span className="text-zinc-700">|</span>
      <span className="flex items-center gap-1.5">
        {renderKeys(['Esc'])}
        <span>{escAction}</span>
      </span>
    </>
  );
}

// ============================================================
// Apply result formatter (preserved from previous version)
// ============================================================

function formatApplyResults(results: ApplyResultEntry[]): string {
  if (results.length === 0) return 'Aucune action à appliquer.';
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const warnings: string[] = [];
  for (const r of results) {
    if (!r.ok || !r.result || typeof r.result !== 'object') continue;
    const w = (r.result as { warning?: unknown }).warning;
    if (typeof w === 'string' && w.length > 0) warnings.push(w);
  }
  let summary: string;
  if (failed === 0) {
    summary = `${ok} action${ok > 1 ? 's' : ''} appliquée${ok > 1 ? 's' : ''}.`;
  } else {
    const firstError = results.find((r) => !r.ok)?.error ?? 'erreur inconnue';
    summary = `${ok}/${results.length} appliquées. Échec : ${firstError}`;
  }
  if (warnings.length > 0) {
    summary += `\n\n${warnings.map((w) => `⚠ ${w}`).join('\n')}`;
  }
  return summary;
}
