import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Command } from './useCommands';
import { getRecentCommandIds, addRecentCommand } from './useCommands';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CATEGORIES = ['Navigation', 'Actions', 'Affichage', 'Aide'] as const;

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      // Auto-focus with delay to ensure mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      // Show recent first, then all by category
      const recentIds = getRecentCommandIds();
      const recent = recentIds
        .map(id => commands.find(c => c.id === id))
        .filter((c): c is Command => c !== undefined);

      return { recent, byCategory: commands };
    }

    const q = search.toLowerCase();

    // Job ID shortcut: if input is digits only, prepend "Go to Job"
    const isJobId = /^\d+$/.test(search.trim());

    const matched = commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords && c.keywords.toLowerCase().includes(q))
    );

    if (isJobId) {
      const goToJob: Command = {
        id: `go-job-${search.trim()}`,
        label: `Aller au Job #${search.trim()}`,
        category: 'Navigation',
        icon: 'hash',
        keywords: '',
        action: () => {
          // This will be handled by the consumer
        },
      };
      return { recent: [], byCategory: [goToJob, ...matched] };
    }

    return { recent: [], byCategory: matched };
  }, [search, commands]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items: Command[] = [];
    if (filteredCommands.recent.length > 0) {
      items.push(...filteredCommands.recent);
    }
    items.push(...filteredCommands.byCategory.filter(c =>
      !filteredCommands.recent.some(r => r.id === c.id)
    ));
    return items;
  }, [filteredCommands]);

  // Clamp active index
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, flatList.length - 1)));
  }, [flatList.length]);

  const executeCommand = useCallback((command: Command) => {
    addRecentCommand(command.id);
    command.action();
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => Math.min(prev + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[activeIndex]) {
            executeCommand(flatList[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, activeIndex, flatList, onClose, executeCommand]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  // Group commands by category for display
  let itemIndex = 0;
  const recentItems = filteredCommands.recent;
  const nonRecentCommands = filteredCommands.byCategory.filter(c =>
    !recentItems.some(r => r.id === c.id)
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        data-testid="command-palette-backdrop"
      />

      {/* Panel */}
      <div
        className="fixed top-24 left-1/2 -translate-x-1/2 w-[520px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50"
        data-testid="command-palette"
      >
        {/* Search input */}
        <div className="border-b border-zinc-800">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tapez une commande ou recherchez..."
            className="w-full bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            data-testid="command-palette-input"
          />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {flatList.length === 0 && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">Aucune commande trouvée</div>
          )}

          {/* Recent section */}
          {recentItems.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Récents</span>
              </div>
              {recentItems.map(cmd => {
                const idx = itemIndex++;
                return (
                  <CommandRow
                    key={`recent-${cmd.id}`}
                    command={cmd}
                    isActive={idx === activeIndex}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  />
                );
              })}
            </>
          )}

          {/* Categorized sections */}
          {CATEGORIES.map(cat => {
            const catCommands = nonRecentCommands.filter(c => c.category === cat);
            if (catCommands.length === 0) return null;

            return (
              <div key={cat}>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{cat}</span>
                </div>
                {catCommands.map(cmd => {
                  const idx = itemIndex++;
                  return (
                    <CommandRow
                      key={cmd.id}
                      command={cmd}
                      isActive={idx === activeIndex}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function CommandRow({
  command,
  isActive,
  onClick,
  onMouseEnter,
}: {
  command: Command;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-pointer ${
        isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-active={isActive}
      data-testid={`command-${command.id}`}
    >
      <span className="text-sm text-zinc-200 flex-1">{command.label}</span>
      {command.shortcut && (
        <span className="flex items-center gap-0.5">
          {command.shortcut.split('+').map((part, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-zinc-500 text-[11px] font-mono">+</span>}
              <kbd className="inline-flex items-center justify-center min-w-[18px] min-h-[18px] px-1 py-px rounded-[3px] text-[10px] font-mono leading-none text-zinc-300 bg-gradient-to-b from-zinc-700 to-zinc-800 border border-zinc-600 border-b-zinc-500 shadow-[0_1px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                {part}
              </kbd>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
