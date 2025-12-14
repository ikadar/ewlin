import { cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
  collapseDirection?: 'left' | 'right';
  className?: string;
}

export function PanelHeader({
  title,
  collapsed = false,
  onToggle,
  collapseDirection = 'left',
  className,
}: PanelHeaderProps) {
  const CollapseIcon = collapseDirection === 'left' ? ChevronLeft : ChevronRight;
  const ExpandIcon = collapseDirection === 'left' ? ChevronRight : ChevronLeft;

  return (
    <div
      className={cn(
        'h-12 border-b bg-muted/50 flex items-center justify-between px-3',
        collapsed && 'justify-center px-0',
        className
      )}
    >
      {!collapsed && (
        <h2 className="text-sm font-semibold text-foreground truncate">
          {title}
        </h2>
      )}
      {onToggle && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0 shrink-0"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          {collapsed ? (
            <ExpandIcon className="h-4 w-4" />
          ) : (
            <CollapseIcon className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
