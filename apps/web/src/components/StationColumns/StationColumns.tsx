import { useEffect, useState } from 'react';
import type { Station, Job } from '@flux/types';
import { PIXELS_PER_HOUR, timeToYPosition } from '../TimelineColumn';
import { StationColumn } from './StationColumn';

export interface StationColumnsProps {
  /** Stations to display as columns */
  stations: Station[];
  /** Currently selected job (for departure marker) */
  selectedJob?: Job | null;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour?: number;
  /** Number of hours to display */
  hoursToDisplay?: number;
}

/**
 * StationColumns - Main scheduling grid container with station columns,
 * now line, and departure date marker.
 */
export function StationColumns({
  stations,
  selectedJob,
  startHour = 6,
  hoursToDisplay = 24,
}: StationColumnsProps) {
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
    // Only show if departure is today (simplified for MVP)
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
    <div
      className="flex gap-3 px-3 bg-[#050505] relative"
      style={{ height: `${totalHeight}px` }}
      data-testid="station-columns-container"
    >
      {/* Now line spanning all columns */}
      <div
        className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
        style={{ top: `${nowPosition}px` }}
        data-testid="now-line"
      />

      {/* Departure date marker (only when job is selected) */}
      {departurePosition !== null && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-blue-500 z-20 pointer-events-none"
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
  );
}
