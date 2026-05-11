import { Users, Factory } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEnvAwareNavigate, useScenarioMode } from '../../contexts/ScenarioContext';
import { useAppSelector } from '../../store';
import type { SidebarButtonTone } from '../Sidebar/SidebarButton';

const TONE_CLASSES: Record<SidebarButtonTone, string> = {
  neutral: 'bg-white/10 text-white',
  preprod: 'bg-emerald-500/20 text-emerald-100',
  prod: 'bg-amber-500/20 text-amber-100',
};

export function PlanningViewToggle() {
  const location = useLocation();
  const navigate = useEnvAwareNavigate();
  const { mode } = useScenarioMode();
  const tone: SidebarButtonTone = mode === 'preprod' ? 'preprod' : mode === 'prod' ? 'prod' : 'neutral';
  const focusedDate = useAppSelector((s) => s.ui.focusedDate);

  const isStations = location.pathname.startsWith('/stations');

  const go = (path: string) => {
    navigate(path, { state: { focusedDate } });
  };

  return (
    <div
      className="flex bg-white/[0.04] rounded-md overflow-hidden"
      role="tablist"
      aria-label="Vue planning"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isStations}
        onClick={() => { if (isStations) go('/'); }}
        className={`flex-1 text-[11px] px-2 py-[6px] flex items-center justify-center gap-[5px] font-medium transition-colors ${
          !isStations ? TONE_CLASSES[tone] : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Users className="w-[13px] h-[13px]" />
        <span>Opérateurs</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isStations}
        onClick={() => { if (!isStations) go('/stations'); }}
        className={`flex-1 text-[11px] px-2 py-[6px] flex items-center justify-center gap-[5px] font-medium transition-colors ${
          isStations ? TONE_CLASSES[tone] : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Factory className="w-[13px] h-[13px]" />
        <span>Machines</span>
      </button>
    </div>
  );
}
