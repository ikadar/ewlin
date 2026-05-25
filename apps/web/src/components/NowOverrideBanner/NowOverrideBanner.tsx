/**
 * Persistent top banner shown whenever the global now-override is enabled.
 *
 * The override is a test-environment feature — when active, every page
 * (lateness, "en cours", deadlines, gates, scheduler) reads a virtual
 * clock instead of the wall clock. This banner makes that mode visible
 * at all times so the user can't forget the system is in time-warp
 * mode and misread results as bugs.
 *
 * Click anywhere on the banner to navigate to the settings page.
 */

import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNowOverride, useNow } from '../../contexts/NowContext';
import { useScenarioMode } from '../../contexts/ScenarioContext';

function formatOffsetCompact(seconds: number): string {
  if (seconds === 0) return '0';
  const sign = seconds > 0 ? '+' : '−';
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}min`);
  return `${sign}${parts.join(' ') || '0'}`;
}

export function NowOverrideBanner() {
  const { isOverridden, offsetSeconds } = useNowOverride();
  const { mode } = useScenarioMode();
  const now = useNow();

  if (!isOverridden) return null;
  // Préprod has its own temporal anchor (the freshness counter); the
  // global now() override is a Prod-only test/debug mechanism going
  // forward. See project_preprod_freshness_counter.md memory.
  if (mode === 'preprod') return null;

  return (
    <Link
      to="/settings/now-override"
      className="block bg-amber-500/15 border-b border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors"
      title="Cliquer pour ouvrir la page de configuration"
    >
      <div className="px-4 py-1.5 text-xs flex items-center justify-center gap-3">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>Now override actif</strong>
          {' — '}
          décalage <span className="font-mono">{formatOffsetCompact(offsetSeconds)}</span>
          {' — '}
          temps virtuel{' '}
          <span className="font-mono tabular-nums">{now.toLocaleString('fr-FR')}</span>
        </span>
      </div>
    </Link>
  );
}
