import { format, eachDayOfInterval } from 'date-fns';
import { cn } from '../../lib/utils';

interface TimeAxisProps {
  startDate: Date;
  endDate: Date;
  hours: number[];
  className?: string;
}

export function TimeAxis({ startDate, endDate, hours, className }: TimeAxisProps) {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className={cn('flex border-b bg-muted/30', className)}>
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className="flex-shrink-0 border-r"
          style={{ width: `${hours.length * 60}px` }}
        >
          <div className="text-center py-1 border-b font-medium text-sm">
            {format(day, 'EEE, MMM d')}
          </div>
          <div className="flex">
            {hours.map((hour) => (
              <div
                key={hour}
                className="w-[60px] text-center text-xs text-muted-foreground py-1 border-r last:border-r-0"
              >
                {hour}:00
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
