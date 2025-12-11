import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setGridView } from '../../store/uiSlice';
import { Button } from '../common/Button';
import { Calendar, Cpu, User } from 'lucide-react';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const gridView = useAppSelector((state) => state.ui.gridView);
  const dispatch = useAppDispatch();

  return (
    <header
      className={cn(
        'h-14 border-b bg-background flex items-center justify-between px-4',
        className
      )}
    >
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Scheduling</h1>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-1">
        <Button
          variant={gridView === 'equipment' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(setGridView('equipment'))}
          className="gap-2"
        >
          <Cpu className="h-4 w-4" />
          Equipment View
        </Button>
        <Button
          variant={gridView === 'operator' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(setGridView('operator'))}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Operator View
        </Button>
      </div>

      {/* User Menu placeholder */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          <User className="h-4 w-4 mr-2" />
          User
        </Button>
      </div>
    </header>
  );
}
