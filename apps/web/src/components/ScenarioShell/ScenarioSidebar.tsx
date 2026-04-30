/**
 * Scoped sidebar for the V2 scenario shell — exactly the 5 entries
 * the user spec'd: Planning op, Planning stations, Flux, Stations
 * config, Opérateurs config. No Logistique / Audit / Stats / Archives
 * / global Settings — those are préprod-wide views that don't make
 * sense from inside a fork.
 */
import { useNavigate } from 'react-router-dom';
import { Users, CalendarDays, TowerControl, Cog, UserCog, ArrowLeft } from 'lucide-react';
import { SidebarButton } from '../Sidebar/SidebarButton';

interface ScenarioSidebarProps {
  scenarioId: string;
  currentPath: string;
}

export function ScenarioSidebar({ scenarioId, currentPath }: ScenarioSidebarProps) {
  const navigate = useNavigate();
  const base = `/scenarios/${scenarioId}`;

  const isPlanningOp = currentPath === base || currentPath === `${base}/`;
  const isPlanningStations = currentPath.startsWith(`${base}/stations`) && !currentPath.startsWith(`${base}/settings`);
  const isFlux = currentPath.startsWith(`${base}/flux`);
  const isStationsConfig = currentPath.startsWith(`${base}/settings/stations`);
  const isOperatorsConfig = currentPath.startsWith(`${base}/settings/operators`);

  return (
    <nav
      className="w-14 shrink-0 bg-violet-950/30 border-r border-violet-900/40 h-full relative z-10"
      aria-label="Scenario navigation"
      data-testid="scenario-sidebar"
    >
      <div className="h-full flex flex-col items-center py-3 gap-2">
        <SidebarButton
          icon={ArrowLeft}
          label="Retour à la liste des scénarios"
          onClick={() => navigate('/scenarios')}
          testId="scenario-shell-back"
        />
        <div className="my-2 w-6 border-t border-violet-900/40" />
        <SidebarButton
          icon={Users}
          label="Planning opérateurs"
          isActive={isPlanningOp}
          onClick={() => navigate(base)}
        />
        <SidebarButton
          icon={CalendarDays}
          label="Planning machines"
          isActive={isPlanningStations}
          onClick={() => navigate(`${base}/stations`)}
        />
        <SidebarButton
          icon={TowerControl}
          label="Flux de production"
          isActive={isFlux}
          onClick={() => navigate(`${base}/flux`)}
        />
        <div className="my-2 w-6 border-t border-violet-900/40" />
        <SidebarButton
          icon={Cog}
          label="Stations"
          isActive={isStationsConfig}
          onClick={() => navigate(`${base}/settings/stations`)}
        />
        <SidebarButton
          icon={UserCog}
          label="Opérateurs"
          isActive={isOperatorsConfig}
          onClick={() => navigate(`${base}/settings/operators`)}
        />
      </div>
    </nav>
  );
}
