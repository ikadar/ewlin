import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { toggleRightPanel } from '../../store/uiSlice';
import { PanelHeader } from './PanelHeader';
import { AlertTriangle, Clock, AlertCircle } from 'lucide-react';

interface RightPanelProps {
  children?: ReactNode;
  className?: string;
}

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 48;

export function RightPanel({ children, className }: RightPanelProps) {
  const collapsed = useAppSelector((state) => state.ui.rightPanelCollapsed);
  const dispatch = useAppDispatch();

  const handleToggle = () => {
    dispatch(toggleRightPanel());
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-l bg-background transition-all duration-200 shrink-0',
        className
      )}
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
      <PanelHeader
        title="Schedule Health"
        collapsed={collapsed}
        onToggle={handleToggle}
        collapseDirection="right"
      />
      <div className="flex-1 overflow-hidden">
        {collapsed ? (
          <CollapsedContent />
        ) : (
          <div className="h-full overflow-y-auto p-3">
            {children || <PlaceholderContent />}
          </div>
        )}
      </div>
    </aside>
  );
}

function CollapsedContent() {
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Late Jobs"
      >
        <Clock className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Violations"
      >
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Warnings"
      >
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}

function PlaceholderContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 bg-muted/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Late Jobs
        </h3>
        <p className="text-xs text-muted-foreground">
          Late jobs section will be added in v0.3.9
        </p>
      </div>
      <div className="rounded-md border p-3 bg-muted/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Violations
        </h3>
        <p className="text-xs text-muted-foreground">
          Violations section will be added in v0.3.10
        </p>
      </div>
    </div>
  );
}
