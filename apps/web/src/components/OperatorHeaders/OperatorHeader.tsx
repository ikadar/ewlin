import { Link, useLocation } from 'react-router-dom';
import { ExternalLink, Smartphone } from 'lucide-react';
import type { Operator } from '@flux/types';
import { OperatorSettingsButton } from './OperatorSettingsButton';
import { useScenarioMode } from '../../contexts/ScenarioContext';

export interface OperatorHeaderProps {
  operator: Operator;
  columnWidth: number;
}

/**
 * OperatorHeader — single operator column header cell.
 * Shows first name + last name, optional role in muted text, and a
 * link icon to the operator focus view (always visible on mobile,
 * hover-only on desktop).
 */
export function OperatorHeader({ operator, columnWidth }: OperatorHeaderProps) {
  const fullName = `${operator.firstName} ${operator.lastName}`;
  const location = useLocation();
  const { mode } = useScenarioMode();
  return (
    <div
      className="group w-60 shrink-0 py-2 px-3 text-sm flex items-center justify-between gap-2"
      style={{ width: `${columnWidth}px` }}
      data-testid={`operator-header-${operator.id}`}
    >
      <span className="font-medium text-zinc-300 truncate min-w-0">
        {operator.firstName} {operator.lastName}
        {operator.role && (
          <span className="text-zinc-500 font-normal ml-1">({operator.role})</span>
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {mode !== 'prod' && (
          <OperatorSettingsButton operatorId={operator.id} operatorLabel={fullName} />
        )}
        {mode === 'prod' && (
          <>
            <Link
              to={`/focus/operator/${operator.id}${location.search}`}
              aria-label={`Ouvrir la vue focus de ${fullName}`}
              className="shrink-0 text-zinc-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-zinc-200"
              data-testid={`operator-header-focus-link-${operator.id}`}
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              to={`/mobile/operator/${operator.id}`}
              aria-label={`Ouvrir la vue mobile de ${fullName}`}
              className="shrink-0 text-zinc-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-emerald-300"
              data-testid={`operator-header-mobile-link-${operator.id}`}
            >
              <Smartphone className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
