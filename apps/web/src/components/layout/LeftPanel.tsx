import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { toggleLeftPanel } from '../../store/uiSlice';
import { PanelHeader } from './PanelHeader';
import { Briefcase, ListTodo, Calendar, Activity } from 'lucide-react';

interface LeftPanelProps {
  children?: ReactNode;
  className?: string;
}

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 48;

export function LeftPanel({ children, className }: LeftPanelProps) {
  const collapsed = useAppSelector((state) => state.ui.leftPanelCollapsed);
  const dispatch = useAppDispatch();

  const handleToggle = () => {
    dispatch(toggleLeftPanel());
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background transition-all duration-200 shrink-0',
        className
      )}
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
      <PanelHeader
        title="Jobs"
        collapsed={collapsed}
        onToggle={handleToggle}
        collapseDirection="left"
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
        title="Jobs"
      >
        <Briefcase className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Tasks"
      >
        <ListTodo className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Status"
      >
        <Activity className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        title="Date"
      >
        <Calendar className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}

function PlaceholderContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 bg-muted/30">
        <h3 className="text-sm font-medium mb-2">Jobs List</h3>
        <p className="text-xs text-muted-foreground">
          Job list component will be added in v0.3.3
        </p>
      </div>
      <div className="rounded-md border p-3 bg-muted/30">
        <h3 className="text-sm font-medium mb-2">Task List</h3>
        <p className="text-xs text-muted-foreground">
          Task list component will be added in v0.3.4
        </p>
      </div>
      <div className="rounded-md border p-3 bg-muted/30">
        <h3 className="text-sm font-medium mb-2">Status Bar</h3>
        <p className="text-xs text-muted-foreground">
          Status bar will be added in v0.3.5
        </p>
      </div>
    </div>
  );
}
