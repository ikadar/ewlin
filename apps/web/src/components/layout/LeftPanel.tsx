import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { toggleLeftPanel } from '../../store/uiSlice';
import { PanelHeader } from './PanelHeader';
import { JobsList } from '../left-panel/JobsList';
import { TaskList } from '../left-panel/TaskList';
import { StatusBar } from '../left-panel/StatusBar';
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
          <div className="h-full flex flex-col">
            {children || <DefaultContent />}
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

function DefaultContent() {
  return (
    <>
      {/* Jobs List - takes about 40% of space */}
      <div className="h-[40%] min-h-[120px] shrink-0">
        <JobsList className="h-full" />
      </div>
      {/* Status Bar - only shown when job selected */}
      <StatusBar />
      {/* Task List - takes remaining space */}
      <div className="flex-1 min-h-0 border-t">
        <TaskList className="h-full" />
      </div>
    </>
  );
}
