/**
 * V2 scenarios page — Flux-style branch list.
 *
 * Visual + interaction language modeled on /flux:
 *   - Card wrapper (bg-flux-elevated rounded border) hosting the
 *     toolbar + table.
 *   - Toolbar: title, primary CTA "Nouveau scénario", search input
 *     with Alt+F shortcut and lucide search icon.
 *   - Sortable column headers (click to cycle asc/desc), with the
 *     standard ▲▼ indicator.
 *   - Inline "Promouvoir" pill on each row when the scenario has
 *     pending modifications (hyper short-circuit to the merge dialog
 *     without entering the shell).
 *   - ShortcutFooter at the bottom with Alt+F / Alt+N / Alt+↑↓ / Enter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Trash2, FolderOpen, Clock, AlertTriangle, Check, GitMerge,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import {
  useGetSimulationsQuery,
  useForkSimulationMutation,
  useDeleteSimulationMutation,
} from '../store';
import type { SimulationSummary } from '../store/api/simulationApi';
import { ForkSimulationDialog } from '../components/SimulationBrowser/ForkSimulationDialog';
import { ShortcutFooter } from '../components/ShortcutFooter/ShortcutFooter';
import { isAltLetter, detectKeyboardLayout } from '../utils/keyboardLayout';
import { MergePreviewDialog } from '../components/ScenarioShell/MergePreviewDialog';

type SortColumn = 'name' | 'createdAt' | 'lastTouchedAt' | 'ttlExpiresAt' | 'modifications';
type SortDirection = 'asc' | 'desc';

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function describeTtl(iso: string | null): { label: string; expired: boolean } {
  if (!iso) return { label: 'Sans expiration', expired: false };
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining <= 0) return { label: 'Expirée', expired: true };
  const hours = Math.floor(remaining / 3_600_000);
  if (hours < 1) {
    const minutes = Math.floor(remaining / 60_000);
    return { label: `${minutes} min`, expired: false };
  }
  if (hours < 24) return { label: `${hours} h`, expired: false };
  const days = Math.floor(hours / 24);
  return { label: `${days} j`, expired: false };
}

function compareScenarios(a: SimulationSummary, b: SimulationSummary, col: SortColumn, dir: SortDirection): number {
  const sign = dir === 'asc' ? 1 : -1;
  switch (col) {
    case 'name':
      return sign * ((a.name ?? '').localeCompare(b.name ?? ''));
    case 'createdAt':
      return sign * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'lastTouchedAt':
      return sign * ((a.lastTouchedAt ? new Date(a.lastTouchedAt).getTime() : 0) - (b.lastTouchedAt ? new Date(b.lastTouchedAt).getTime() : 0));
    case 'ttlExpiresAt':
      return sign * ((a.ttlExpiresAt ? new Date(a.ttlExpiresAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.ttlExpiresAt ? new Date(b.ttlExpiresAt).getTime() : Number.MAX_SAFE_INTEGER));
    case 'modifications':
      return sign * (a.modificationCount - b.modificationCount);
  }
}

export function ScenariosPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetSimulationsQuery();
  const [forkOpen, setForkOpen] = useState(false);
  const [forkSimulation] = useForkSimulationMutation();
  const [deleteSimulation] = useDeleteSimulationMutation();
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastTouchedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const scenarios = useMemo(() => {
    const all = data?.simulations ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term === '' ? all : all.filter((s) =>
      (s.name ?? '').toLowerCase().includes(term),
    );
    return [...filtered].sort((a, b) => compareScenarios(a, b, sortColumn, sortDirection));
  }, [data?.simulations, search, sortColumn, sortDirection]);

  const handleSortChange = useCallback((col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'name' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  const handleFork = useCallback(
    async (name: string) => {
      try {
        // No ttlHours — backend defaults to 48 h.
        const result = await forkSimulation({ name }).unwrap();
        setForkOpen(false);
        navigate(`/scenarios/${result.id}`);
      } catch {
        // Error stays visible via the dialog
      }
    },
    [forkSimulation, navigate],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const sim = data?.simulations.find((s) => s.id === id);
      if (!sim) return;
      const ok = window.confirm(`Supprimer le scénario "${sim.name ?? id}" ? Toutes ses modifications seront perdues.`);
      if (!ok) return;
      await deleteSimulation(id);
    },
    [data?.simulations, deleteSimulation],
  );

  const mergeTargetScenario = useMemo(
    () => mergeTargetId ? data?.simulations.find((s) => s.id === mergeTargetId) ?? null : null,
    [mergeTargetId, data?.simulations],
  );

  // Keyboard shortcuts (mirrors Flux): Alt+F, Alt+N, Alt+↑↓, Enter.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      detectKeyboardLayout(e);
      if (isAltLetter(e, 'f')) {
        e.preventDefault();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.select();
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }
      if (isAltLetter(e, 'n')) {
        e.preventDefault();
        setForkOpen(true);
        return;
      }
      if (e.altKey && e.code === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(scenarios.length - 1, i + 1));
        return;
      }
      if (e.altKey && e.code === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.code === 'Enter' && focusedIdx >= 0 && focusedIdx < scenarios.length) {
        const s = scenarios[focusedIdx];
        if (s) {
          e.preventDefault();
          navigate(`/scenarios/${s.id}`);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [focusedIdx, scenarios, navigate]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-flux-base" data-testid="scenarios-page">
      <div className="flex-1 overflow-hidden">
        <div className="p-4 h-full">
          <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="border-b border-flux-border bg-flux-elevated px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold text-flux-text-primary">
                  Scénarios
                </h1>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 border border-violet-600 text-white text-base font-medium rounded-[0.25rem] transition-colors"
                  onClick={() => setForkOpen(true)}
                  data-testid="scenarios-new-button"
                  title="Nouveau scénario (Alt+N)"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Forker la préprod
                </button>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary pointer-events-none"
                  strokeWidth={2}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIdx(-1); }}
                  placeholder="Rechercher un scénario..."
                  className="w-full pl-10 pr-4 py-2 text-base bg-flux-hover border border-flux-border rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
                  data-testid="scenarios-search"
                  aria-label="Rechercher dans la liste des scénarios"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {isLoading && <div className="p-6 text-xs text-flux-text-muted">Chargement…</div>}
              {error && (
                <div className="p-6 text-xs text-rose-300">Impossible de charger la liste des scénarios.</div>
              )}
              {data && scenarios.length === 0 && data.simulations.length === 0 && (
                <div className="p-12 text-center text-xs text-flux-text-muted">
                  <div className="font-medium text-flux-text-secondary mb-1">Aucun scénario</div>
                  <div>Forke la préprod pour créer une branche éditable sans toucher au plan vivant.</div>
                </div>
              )}
              {data && scenarios.length === 0 && data.simulations.length > 0 && (
                <div className="p-6 text-center text-xs text-flux-text-muted">
                  Aucun scénario ne correspond à « {search} ».
                </div>
              )}
              {data && scenarios.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-flux-hover">
                    <tr className="bg-flux-hover border-b border-flux-border">
                      <SortableHeader col="name"           current={sortColumn} dir={sortDirection} onSort={handleSortChange}>Nom</SortableHeader>
                      <SortableHeader col="createdAt"      current={sortColumn} dir={sortDirection} onSort={handleSortChange}>Forké le</SortableHeader>
                      <SortableHeader col="lastTouchedAt"  current={sortColumn} dir={sortDirection} onSort={handleSortChange}>Dernière vue</SortableHeader>
                      <SortableHeader col="ttlExpiresAt"   current={sortColumn} dir={sortDirection} onSort={handleSortChange}>Expire dans</SortableHeader>
                      <SortableHeader col="modifications"  current={sortColumn} dir={sortDirection} onSort={handleSortChange} align="right">Modifs</SortableHeader>
                      <th className="px-2 py-3 text-right text-sm font-medium whitespace-nowrap text-flux-text-secondary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scenario, idx) => (
                      <ScenarioRow
                        key={scenario.id}
                        scenario={scenario}
                        focused={idx === focusedIdx}
                        onOpen={() => navigate(`/scenarios/${scenario.id}`)}
                        onDelete={() => handleDelete(scenario.id)}
                        onPromote={() => setMergeTargetId(scenario.id)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShortcutFooter mode="scenarios" />

      <ForkSimulationDialog
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        onConfirm={handleFork}
      />
      {mergeTargetScenario && (
        <MergePreviewDialog
          open={true}
          scenarioId={mergeTargetScenario.id}
          scenarioName={mergeTargetScenario.name ?? mergeTargetScenario.id}
          onClose={() => setMergeTargetId(null)}
          onMerged={() => setMergeTargetId(null)}
        />
      )}
    </div>
  );
}

/**
 * Sort indicator chevron — same shape and behaviour as
 * FluxTable.SortChevron: inactive-but-sortable shows a faded
 * up/down chevrons that fades in on group-hover; active shows a
 * single blue arrow pointing in the sort direction.
 */
function SortChevron({ col, active, dir }: { col: SortColumn; active: SortColumn; dir: SortDirection }) {
  if (col !== active) {
    return (
      <ChevronsUpDown
        className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5"
        strokeWidth={2}
      />
    );
  }
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />
    : <ChevronDown className="w-3 h-3 text-blue-400 inline ml-0.5" strokeWidth={2.5} />;
}

/**
 * Header cell — clickable th itself (mirrors FluxTable's
 * sortableHeader pattern), with the chevron group-hover behaviour.
 */
function SortableHeader({
  col, current, dir, onSort, align, children,
}: {
  col: SortColumn;
  current: SortColumn;
  dir: SortDirection;
  onSort: (col: SortColumn) => void;
  align?: 'right';
  children: React.ReactNode;
}) {
  const base = 'px-2 py-3 text-sm font-medium whitespace-nowrap text-flux-text-secondary';
  const sortable = `${base} ${align === 'right' ? 'text-right' : 'text-left'} group cursor-pointer select-none`;
  return (
    <th className={sortable} onClick={() => onSort(col)}>
      {children}
      <SortChevron col={col} active={current} dir={dir} />
    </th>
  );
}

function ScenarioRow({
  scenario, focused, onOpen, onDelete, onPromote,
}: {
  scenario: SimulationSummary;
  focused: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onPromote: () => void;
}) {
  const ttl = describeTtl(scenario.ttlExpiresAt);
  const merged = scenario.mergedAt !== null;
  const hasMods = scenario.modificationCount > 0;

  // Row classes verbatim from FluxTable :
  //   border-b border-flux-border + group + transition-colors +
  //   cursor-pointer + hover:bg-flux-hover. Focus = ring inset
  //   indigo, fixed height 2.25rem, cells px-4 py-0 text-sm.
  const cellBase = 'px-4 py-0 text-sm text-flux-text-secondary';
  const rowClass = `border-b border-flux-border group transition-colors cursor-pointer hover:bg-flux-hover${focused ? ' ring-1 ring-inset ring-indigo-500/40' : ''}`;
  const rowBg = focused ? 'rgba(99,102,241,0.08)' : undefined;

  return (
    <tr
      className={rowClass}
      style={{ height: '2.25rem', backgroundColor: rowBg }}
      onClick={onOpen}
      data-testid={`scenario-row-${scenario.id}`}
    >
      <td className={`${cellBase} text-flux-text-primary font-medium`}>
        <div className="flex items-center gap-2">
          <span className="truncate">{scenario.name ?? '(sans nom)'}</span>
          {merged && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600/20 border border-emerald-600/40 text-emerald-300" title={`Mergé ${formatStamp(scenario.mergedAt)}`}>
              <Check size={10} />
              Mergé
            </span>
          )}
        </div>
      </td>
      <td className={cellBase}>{formatStamp(scenario.createdAt)}</td>
      <td className={cellBase}>{formatStamp(scenario.lastTouchedAt)}</td>
      <td className={cellBase}>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            ttl.expired
              ? 'bg-rose-600/15 border border-rose-600/30 text-rose-300'
              : 'bg-flux-hover border border-flux-border text-flux-text-secondary'
          }`}
        >
          {ttl.expired ? <AlertTriangle size={10} /> : <Clock size={10} />}
          {ttl.label}
        </span>
      </td>
      <td className={`${cellBase} text-right`}>
        {hasMods ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-violet-600/15 border border-violet-600/30 text-violet-300">
            Δ {scenario.modificationCount}
          </span>
        ) : (
          <span className="text-[10px] text-flux-text-muted">—</span>
        )}
      </td>
      <td className={`${cellBase} text-right whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          {hasMods && !merged && (
            <button
              type="button"
              onClick={onPromote}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-violet-600 hover:bg-violet-500 text-white mr-1"
              title="Promouvoir cette branche vers la préprod"
              data-testid={`scenario-row-promote-${scenario.id}`}
            >
              <GitMerge size={11} />
              Promouvoir
            </button>
          )}
          {/* Pair "supprimer / ouvrir" alignée verbatim sur Flux :
              Trash2 rouge, FolderOpen bleu, icon-only, sans border. */}
          <button
            className="text-red-400 hover:text-red-300 transition-colors"
            onClick={onDelete}
            title="Supprimer"
            data-testid="scenario-action-delete"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            className="text-blue-400 hover:text-blue-300 transition-colors"
            onClick={onOpen}
            title="Ouvrir"
            data-testid="scenario-action-open"
          >
            <FolderOpen className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}
