import type { Station, Job } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { useEffect, useState } from 'react';
import { timeToYPosition } from '../TimelineColumn';

export interface SchedulingGridProps {
  /** Stations to display */
  stations: Station[];
  /** Currently selected job */
  selectedJob?: Job | null;
  /** Starting hour of the grid (default: 6) */
  startHour?: number;
  /** Number of hours to display (default: 24) */
  hoursToDisplay?: number;
}

/**
 * SchedulingGrid - Unified grid component with synchronized scrolling.
 * Contains Timeline, Station Headers, and Station Columns in a single scroll container.
 */
export function SchedulingGrid({
  stations,
  selectedJob,
  startHour = 6,
  hoursToDisplay = 24,
}: SchedulingGridProps) {
  const [now, setNow] = useState(() => new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total height
  const totalHeight = hoursToDisplay * PIXELS_PER_HOUR;

  // Calculate now line position
  const nowPosition = timeToYPosition(now, startHour);

  // Calculate departure marker position (if job has workshopExitDate)
  let departurePosition: number | null = null;
  if (selectedJob?.workshopExitDate) {
    const departureDate = new Date(selectedJob.workshopExitDate);
    const today = new Date();
    if (
      departureDate.getDate() === today.getDate() &&
      departureDate.getMonth() === today.getMonth() &&
      departureDate.getFullYear() === today.getFullYear()
    ) {
      departurePosition = timeToYPosition(departureDate, startHour);
    }
  }

  return (
    <div className="flex-1 overflow-auto min-w-0" data-testid="scheduling-grid">
      {/* Grid content wrapper - enables horizontal scrolling */}
      <div className="inline-flex flex-col" style={{ minWidth: 'fit-content', minHeight: '100%' }}>
        {/* Header row - sticky top */}
        <div className="flex sticky top-0 z-30 bg-zinc-900">
          {/* Timeline header placeholder - sticky left */}
          <div className="w-12 shrink-0 bg-zinc-900 border-r border-white/5 border-b border-white/10 sticky left-0 z-40" />
          {/* Station headers */}
          <div className="flex gap-3 px-3 border-b border-white/10">
            {stations.map((station) => (
              <StationHeader key={station.id} station={station} />
            ))}
          </div>
        </div>

        {/* Content row */}
        <div className="flex relative" style={{ height: `${totalHeight}px` }}>
          {/* Timeline column - sticky left */}
          <div className="sticky left-0 z-20">
            <TimelineColumn
              startHour={startHour}
              hourCount={hoursToDisplay}
              currentTime={now}
              showNowLine={false}
            />
          </div>

          {/* Station columns area */}
          <div className="flex gap-3 px-3 bg-[#050505] relative">
            {/* Now line spanning all station columns */}
            <div
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ top: `${nowPosition}px` }}
              data-testid="now-line"
            />

            {/* Departure date marker */}
            {departurePosition !== null && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none"
                style={{ top: `${departurePosition}px` }}
                data-testid="departure-marker"
              />
            )}

            {/* Station columns */}
            {stations.map((station) => (
              <StationColumn
                key={station.id}
                station={station}
                startHour={startHour}
                hoursToDisplay={hoursToDisplay}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
