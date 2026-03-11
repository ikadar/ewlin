import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SquareSlash } from 'lucide-react';
import type { Command } from './useCommands';
import { SHORTCUT_ZONES, addRecentCommand } from './useCommands';
import type { JobSearchEntry } from './CommandCenterContext';

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

export function CommandPalette({ isOpen, onClose, commands, jobs = [], onSelectJob }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Filter commands for dropdown
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return [];

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
  }, [search, commands, jobs, onSelectJob]);

  const hasDropdown = filteredCommands.length > 0 && search.trim().length > 0;
  const showNoResults = search.trim().length > 0 && filteredCommands.length === 0;

  // Clamp active index
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, filteredCommands.length - 1)));
  }, [filteredCommands.length]);

  const executeCommand = useCallback((command: Command) => {
    addRecentCommand(command.id);
    command.action();
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (search) {
          setSearch('');
        } else {
          onClose();
        }
        return;
      }

      if (!hasDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[activeIndex]) {
            executeCommand(filteredCommands[activeIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, activeIndex, filteredCommands, hasDropdown, onClose, executeCommand, search]);

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
              onChange={e => { setSearch(e.target.value); setActiveIndex(0); }}
              placeholder="Saisissez une commande..."
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
              data-testid="command-palette-input"
            />
            <span className="shrink-0">
              {renderKeys(['Alt', 'K'])}
            </span>
          </div>

          {/* Dropdown — appears on typing */}
          {(hasDropdown || showNoResults) && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 bg-zinc-900 border-t-2 border-blue-500 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-h-[280px] overflow-y-auto rounded-b-xl z-30"
              data-testid="command-dropdown"
            >
              {showNoResults ? (
                <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                  Aucune commande trouvée
                </div>
              ) : (
                <>
                  {filteredCommands.map((cmd, i) => (
                    <div
                      key={cmd.id}
                      className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors ${
                        i === activeIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setActiveIndex(i)}
                      data-active={i === activeIndex}
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
                  ))}
                  <div className="flex items-center gap-3 px-4 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
                    <span>{filteredCommands.length} resultat{filteredCommands.length > 1 ? 's' : ''}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {renderKeys(['\u2191\u2193'])}
                      <span>selectionner</span>
                      {renderKeys(['\u23CE'])}
                      <span>executer</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Shortcut zones — static reference grid */}
        <div
          className={`grid grid-cols-2 gap-0.5 p-2 transition-opacity duration-200 ${
            hasDropdown || showNoResults ? 'opacity-30 pointer-events-none' : ''
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

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500">
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
        </div>
      </div>
    </>
  );
}
