import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CenterPanelProps {
  children?: ReactNode;
  className?: string;
}

export function CenterPanel({ children, className }: CenterPanelProps) {
  return (
    <main
      className={cn(
        'flex-1 min-w-0 flex flex-col bg-background overflow-hidden',
        className
      )}
    >
      {children || <PlaceholderContent />}
    </main>
  );
}

function PlaceholderContent() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/20">
      <div className="text-center p-8">
        <h2 className="text-lg font-semibold text-muted-foreground mb-2">
          Scheduling Grid
        </h2>
        <p className="text-sm text-muted-foreground">
          Grid component will be implemented here
        </p>
      </div>
    </div>
  );
}
