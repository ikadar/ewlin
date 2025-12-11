import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setGridView } from '../../store/uiSlice';
import { Button } from '../common/Button';
import { Calendar, Printer, Truck, User } from 'lucide-react';

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
        <h1 className="text-lg font-semibold">Flux Print Shop</h1>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-1">
        <Button
          variant={gridView === 'stations' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(setGridView('stations'))}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Stations
        </Button>
        <Button
          variant={gridView === 'providers' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(setGridView('providers'))}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          Providers
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
