import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SquareSlash,
  Sparkles,
  Check,
  PencilLine,
  X,
  CircleCheckBig,
  TriangleAlert,
  LoaderCircle,
  ChevronRight,
  UserRound,
  Wrench,
  Folder,
  Clock,
  type LucideIcon,
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
    // A key like "Alt+C" is a combo — split on + (but not if the key IS "+")
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

type AIView =
  | { kind: 'menu' }
  | { kind: 'plan'; plan: PendingPlan }
  | { kind: 'question'; question: string; options?: string[]; rawPrompt: string }
  | { kind: 'result'; ok: boolean; title: string; body: string };

const ENTITY_ICON: Record<ResolvedEntity['kind'], LucideIcon> = {
  operator: UserRound,
  station: Wrench,
  job: Folder,
  task: Clock,
};

const ENTITY_LABEL: Record<ResolvedEntity['kind'], string> = {
  operator: 'Opérateur',
  station: 'Machine',
  job: 'Dossier',
  task: 'Tâche',
};

export function CommandPalette({ isOpen, onClose, commands, jobs = [], onSelectJob }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<AIView>({ kind: 'menu' });
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [executeCommand, executeState] = useExecuteCommandMutation();
  const [applyPlan, applyState] = useApplyPlanMutation();
  const { trigger: triggerAutoRecompute } = useAutoRecomputeCtx();

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setView({ kind: 'menu' });
      setConversation([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Auto-close after a successful AI action so the user gets back to the planning view.
  useEffect(() => {
    if (view.kind === 'result' && view.ok) {
      const t = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(t);
    }
  }, [view, onClose]);

  // Filter commands for dropdown
  const filteredCommands = useMemo(() => {
    if (!search.trim() || view.kind !== 'menu') return [];

    const q = search.toLowerCase();

    const matched = commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords && c.keywords.toLowerCase().includes(q))
    );

    // Search jobs by reference, client, description
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

      // When digits typed, if no exact ref match found, show "Go to Job #xxx"
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
  }, [search, commands, jobs, onSelectJob, view]);

  // The "Demander à l'IA" entry sits above the filtered shortcuts whenever the
  // user has typed something in menu view — it's always reachable, even when
  // shortcuts also match.
  const hasAIItem = search.trim().length > 0 && view.kind === 'menu';
  const totalDropdownItems = (hasAIItem ? 1 : 0) + filteredCommands.length;
  const hasDropdown = view.kind === 'menu' && totalDropdownItems > 0 && search.trim().length > 0;

  // Clamp active index
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, totalDropdownItems - 1)));
  }, [totalDropdownItems]);

  const executeAIPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    try {
      const result = await executeCommand({ prompt: trimmed, conversation }).unwrap();
      setConversation(result.conversationAfter);
      if (result.kind === 'plan') {
        setView({
          kind: 'plan',
          plan: {
            rawPrompt: trimmed,
            narration: result.narration,
            actions: result.actions,
            resolvedEntities: result.resolvedEntities,
          },
        });
      } else if (result.kind === 'question') {
        setView({
          kind: 'question',
          question: result.question,
          options: result.options,
          rawPrompt: trimmed,
        });
      } else {
        setView({ kind: 'result', ok: false, title: result.error, body: result.message ?? '' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setView({ kind: 'result', ok: false, title: 'Échec de l\u2019IA', body: message });
    }
  }, [executeCommand, conversation]);

  const handleApply = useCallback(async () => {
    if (view.kind !== 'plan' || applyState.isLoading) return;
    try {
      const response = await applyPlan({
        rawPrompt: view.plan.rawPrompt,
        narration: view.plan.narration,
        actions: view.plan.actions,
      }).unwrap();
      const summary = formatApplyResults(response.results);
      setView({
        kind: 'result',
        ok: response.success,
        title: response.success ? 'Action appliquée' : 'Application partielle',
        body: summary,
      });
      setConversation([]);
      // The console-service bypasses the RTK mutation layer, so the
      // autoRecomputeMiddleware allow-list never fires on its own. Trigger
      // the same debounced compute the admin pages use.
      if (response.results.some(r => r.ok)) {
        triggerAutoRecompute('console apply');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l\u2019application';
      setView({ kind: 'result', ok: false, title: 'Échec de l\u2019application', body: message });
    }
  }, [view, applyPlan, applyState.isLoading, triggerAutoRecompute]);

  const handleEdit = useCallback(() => {
    if (view.kind !== 'plan') return;
    setSearch(view.plan.rawPrompt);
    setView({ kind: 'menu' });
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [view]);

  const handleCancel = useCallback(() => {
    setView({ kind: 'menu' });
    setConversation([]);
  }, []);

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (view.kind === 'plan' || view.kind === 'question' || view.kind === 'result') {
          handleCancel();
        } else if (search) {
          setSearch('');
        } else {
          onClose();
        }
        return;
      }

      if (view.kind === 'plan') {
        if (e.key === 'Enter' && !applyState.isLoading) {
          e.preventDefault();
          void handleApply();
        }
        return;
      }

      if (view.kind === 'result') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCancel();
        }
        return;
      }

      // Question view: 1..N picks the option
      if (view.kind === 'question' && view.options && view.options.length > 0) {
        const num = Number(e.key);
        if (Number.isInteger(num) && num >= 1 && num <= view.options.length) {
          e.preventDefault();
          handlePickQuestionOption(view.options[num - 1]);
        }
        return;
      }

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
    view,
    activeIndex,
    totalDropdownItems,
    hasDropdown,
    onClose,
    handleDropdownSelect,
    handleApply,
    handleCancel,
    handlePickQuestionOption,
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
        className="fixed top-24 left-1/2 -translate-x-1/2 w-[70vw] max-w-[800px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50"
        data-testid="command-palette"
      >
        {/* Search bar */}
        <div className="relative z-20 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <SquareSlash size={16} className="text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setActiveIndex(0);
                if (view.kind !== 'menu') setView({ kind: 'menu' });
              }}
              placeholder="Rechercher une commande, ou demander à l'IA..."
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
                {renderKeys(['Alt', 'K'])}
              </span>
            )}
          </div>

          {/* Dropdown — appears on typing in menu view */}
          {view.kind === 'menu' && hasDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 bg-zinc-900 border-t-2 border-blue-500 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-h-[280px] overflow-y-auto rounded-b-xl z-30"
              data-testid="command-dropdown"
            >
              {/* AI item — always first when search is non-empty */}
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
                  <span className="shrink-0">{renderKeys(['\u23CE'])}</span>
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
                  {renderKeys(['\u2191\u2193'])}
                  <span>selectionner</span>
                  {renderKeys(['\u23CE'])}
                  <span>executer</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AI Plan view — replaces dropdown/zones when an AI plan is pending */}
        {view.kind === 'plan' && (
          <PlanCardInline
            plan={view.plan}
            isApplying={applyState.isLoading}
            onApply={handleApply}
            onEdit={handleEdit}
            onCancel={handleCancel}
          />
        )}

        {/* AI Question view — disambiguation prompt */}
        {view.kind === 'question' && (
          <QuestionInline
            question={view.question}
            options={view.options}
            onPick={handlePickQuestionOption}
            isExecuting={executeState.isLoading}
          />
        )}

        {/* AI Result view — success or error strip */}
        {view.kind === 'result' && (
          <ResultStripInline ok={view.ok} title={view.title} body={view.body} />
        )}

        {/* Shortcut zones — only in menu view, dimmed when dropdown open */}
        {view.kind === 'menu' && (
          <div
            className={`grid grid-cols-2 gap-0.5 p-2 transition-opacity duration-200 ${
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

        {/* Footer — hint text changes by view */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500">
          {view.kind === 'plan' ? (
            <>
              <span className="flex items-center gap-1.5">
                {renderKeys(['\u23CE'])}
                <span>appliquer</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                {renderKeys(['Esc'])}
                <span>annuler</span>
              </span>
            </>
          ) : view.kind === 'question' ? (
            <>
              <span className="flex items-center gap-1.5">
                {renderKeys(['1', '2', '3'])}
                <span>choisir</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                {renderKeys(['Esc'])}
                <span>annuler</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                {renderKeys(['\u2191\u2193'])}
                <span>naviguer</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                {renderKeys(['\u23CE'])}
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
// Inline subcomponents for the AI flow
// ============================================================

interface PlanCardInlineProps {
  plan: PendingPlan;
  isApplying: boolean;
  onApply: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

function PlanCardInline({ plan, isApplying, onApply, onEdit, onCancel }: PlanCardInlineProps) {
  return (
    <div className="p-3">
      <div className="border border-blue-500/40 bg-blue-500/10 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-md bg-zinc-900 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-100 whitespace-pre-wrap">{plan.narration}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">
              Plan à confirmer
            </div>
          </div>
        </div>

        {plan.resolvedEntities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plan.resolvedEntities.map(e => {
              const Icon = ENTITY_ICON[e.kind];
              return (
                <span
                  key={`${e.kind}-${e.id}`}
                  className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded-full text-[11px]"
                  title={e.id}
                >
                  <Icon size={12} className="text-zinc-500" />
                  <span className="text-zinc-500">{ENTITY_LABEL[e.kind]} :</span>
                  <span className="text-zinc-100 font-semibold">{e.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {plan.actions.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-xs">
            {plan.actions.map((a, i) => (
              <li
                key={i}
                className="flex gap-2 items-start text-zinc-300 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md"
              >
                <ChevronRight size={13} className="text-blue-400 shrink-0 mt-0.5" />
                <span>{a.preview ?? <code className="font-mono text-zinc-300">{a.tool}</code>}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-700">
          <button
            type="button"
            onClick={onApply}
            disabled={isApplying || plan.actions.length === 0}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            data-testid="ai-apply-button"
          >
            {isApplying ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
            {isApplying ? 'Application…' : 'Appliquer'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-100 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            data-testid="ai-edit-button"
          >
            <PencilLine size={13} />
            Modifier
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 hover:bg-zinc-800 disabled:opacity-50 text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            data-testid="ai-cancel-button"
          >
            <X size={13} />
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

interface QuestionInlineProps {
  question: string;
  options?: string[];
  onPick: (option: string) => void;
  isExecuting: boolean;
}

function QuestionInline({ question, options, onPick, isExecuting }: QuestionInlineProps) {
  return (
    <div className="p-3">
      <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-md bg-zinc-900 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-zinc-100 whitespace-pre-wrap">{question}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">
              Question de désambiguïsation
            </div>
          </div>
        </div>
        {options && options.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={isExecuting}
                onClick={() => onPick(opt)}
                className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 rounded-md px-3 py-2 text-left text-sm text-zinc-100 transition-colors disabled:opacity-60"
              >
                <span className="font-mono text-[11px] w-5 h-5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ResultStripInlineProps {
  ok: boolean;
  title: string;
  body: string;
}

function ResultStripInline({ ok, title, body }: ResultStripInlineProps) {
  const Icon = ok ? CircleCheckBig : TriangleAlert;
  return (
    <div className="p-3">
      <div
        className={`rounded-lg p-4 flex gap-3 items-start ${
          ok
            ? 'bg-green-500/10 border border-green-500/50'
            : 'bg-red-500/10 border border-red-500/50'
        }`}
      >
        <Icon size={20} className={`${ok ? 'text-green-400' : 'text-red-400'} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          {body && <div className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">{body}</div>}
        </div>
      </div>
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
