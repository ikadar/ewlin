import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DragStateProvider } from '../../dnd';
import { StationColumns } from './StationColumns';
import { StationColumn } from './StationColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import type { Station, Job, DaySchedule } from '@flux/types';

// Helper to wrap components with DragStateProvider
const DndWrapper = ({ children }: { children: React.ReactNode }) => (
  <DragStateProvider>{children}</DragStateProvider>
);

// Mock station with standard schedule
const mockStation: Station = {
  id: 'station-1',
  name: 'Komori G40',
  status: 'Available',
  categoryId: 'cat-1',
  groupId: 'group-1',
  capacity: 1,
  operatingSchedule: {
    monday: {
      isOperating: true,
      slots: [
        { start: '06:00', end: '12:00' },
        { start: '13:00', end: '22:00' },
      ],
    },
    tuesday: {
      isOperating: true,
      slots: [
        { start: '06:00', end: '12:00' },
        { start: '13:00', end: '22:00' },
      ],
    },
    wednesday: {
      isOperating: true,
      slots: [
        { start: '06:00', end: '12:00' },
        { start: '13:00', end: '22:00' },
      ],
    },
    thursday: {
      isOperating: true,
      slots: [
        { start: '06:00', end: '12:00' },
        { start: '13:00', end: '22:00' },
      ],
    },
    friday: {
      isOperating: true,
      slots: [
        { start: '06:00', end: '12:00' },
        { start: '13:00', end: '22:00' },
      ],
    },
    saturday: { isOperating: false, slots: [] },
    sunday: { isOperating: false, slots: [] },
  },
  exceptions: [],
};

const mockStations: Station[] = [
  mockStation,
  {
    ...mockStation,
    id: 'station-2',
    name: 'Polar 137',
  },
  {
    ...mockStation,
    id: 'station-3',
    name: 'Heidelberg XL',
  },
];

const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Autosphere',
  description: 'Brochures',
  status: 'Planned',
  workshopExitDate: new Date().toISOString(),
  color: '#8b5cf6',
  paperPurchaseStatus: 'InStock',
  platesStatus: 'Done',
  proofSentAt: null,
  proofApprovedAt: null,
  requiredJobIds: [],
};

describe('UnavailabilityOverlay', () => {
  const standardDaySchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '06:00', end: '12:00' },
      { start: '13:00', end: '22:00' },
    ],
  };

  const closedDaySchedule: DaySchedule = {
    isOperating: false,
    slots: [],
  };

  it('renders unavailability overlays for gaps in schedule', () => {
    render(
      <div style={{ position: 'relative', height: '1920px' }}>
        <UnavailabilityOverlay
          daySchedule={standardDaySchedule}
          startHour={6}
          hoursToDisplay={24}
        />
      </div>
    );

    const overlays = screen.getAllByTestId('unavailability-overlay');
    // Should have at least one overlay (the lunch break 12:00-13:00)
    expect(overlays.length).toBeGreaterThan(0);
  });

  it('renders full unavailability for closed day', () => {
    render(
      <div style={{ position: 'relative', height: '1920px' }}>
        <UnavailabilityOverlay
          daySchedule={closedDaySchedule}
          startHour={6}
          hoursToDisplay={24}
        />
      </div>
    );

    const overlays = screen.getAllByTestId('unavailability-overlay');
    expect(overlays.length).toBe(1);
    // Should cover the full display period
    const overlay = overlays[0];
    expect(overlay).toHaveStyle({ top: '0px' });
  });

  it('renders no overlay for 24h operating schedule', () => {
    const fullDaySchedule: DaySchedule = {
      isOperating: true,
      slots: [{ start: '00:00', end: '24:00' }],
    };

    render(
      <div style={{ position: 'relative', height: '1920px' }}>
        <UnavailabilityOverlay
          daySchedule={fullDaySchedule}
          startHour={0}
          hoursToDisplay={24}
        />
      </div>
    );

    const overlays = screen.queryAllByTestId('unavailability-overlay');
    expect(overlays.length).toBe(0);
  });
});

describe('StationColumn', () => {
  it('renders with correct width class', () => {
    render(
      <DndWrapper>
        <StationColumn station={mockStation} dayOfWeek={1} />
      </DndWrapper>
    );

    const column = screen.getByTestId('station-column-station-1');
    expect(column).toHaveClass('w-60');
  });

  it('renders hour grid lines', () => {
    render(
      <DndWrapper>
        <StationColumn station={mockStation} startHour={6} hoursToDisplay={24} dayOfWeek={1} />
      </DndWrapper>
    );

    const gridLines = screen.getAllByTestId('hour-grid-line');
    // 24 hours + 1 for the final line = 25 lines
    expect(gridLines.length).toBe(25);
  });

  it('renders unavailability overlay', () => {
    render(
      <DndWrapper>
        <StationColumn station={mockStation} dayOfWeek={1} />
      </DndWrapper>
    );

    const overlays = screen.getAllByTestId('unavailability-overlay');
    expect(overlays.length).toBeGreaterThan(0);
  });

  it('has correct background color', () => {
    render(
      <DndWrapper>
        <StationColumn station={mockStation} dayOfWeek={1} />
      </DndWrapper>
    );

    const column = screen.getByTestId('station-column-station-1');
    expect(column).toHaveClass('bg-[#0a0a0a]');
  });

  it('is a droppable target', () => {
    render(
      <DndWrapper>
        <StationColumn station={mockStation} dayOfWeek={1} />
      </DndWrapper>
    );

    const column = screen.getByTestId('station-column-station-1');
    // Column should have transition class for drag highlighting
    expect(column).toHaveClass('transition-all');
    expect(column).toHaveClass('duration-150');
  });

  describe('column collapse during drag', () => {
    it('collapses to 120px (w-30) when isCollapsed is true', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} isCollapsed={true} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('w-30');
      expect(column).not.toHaveClass('w-60');
    });

    it('stays full width (w-60) when isCollapsed is false', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} isCollapsed={false} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('w-60');
      expect(column).not.toHaveClass('w-30');
    });

    it('stays full width (w-60) when isCollapsed is not provided', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('w-60');
    });

    it('has ease-out transition for smooth animation', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('ease-out');
    });
  });

  describe('validation visual feedback', () => {
    it('shows green highlight when isValidDrop is true', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} isValidDrop={true} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('ring-2');
      expect(column).toHaveClass('ring-green-500');
      expect(column).toHaveClass('bg-green-500/10');
    });

    it('shows red highlight when isInvalidDrop is true', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} isInvalidDrop={true} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('ring-2');
      expect(column).toHaveClass('ring-red-500');
      expect(column).toHaveClass('bg-red-500/10');
    });

    it('shows amber highlight when showBypassWarning is true', () => {
      render(
        <DndWrapper>
          <StationColumn station={mockStation} dayOfWeek={1} showBypassWarning={true} />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).toHaveClass('ring-2');
      expect(column).toHaveClass('ring-amber-500');
      expect(column).toHaveClass('bg-amber-500/10');
    });

    it('prioritizes bypass warning over valid/invalid states', () => {
      render(
        <DndWrapper>
          <StationColumn
            station={mockStation}
            dayOfWeek={1}
            isValidDrop={true}
            isInvalidDrop={false}
            showBypassWarning={true}
          />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      // Should show amber (bypass), not green (valid)
      expect(column).toHaveClass('ring-amber-500');
      expect(column).not.toHaveClass('ring-green-500');
    });

    it('prioritizes invalid state over valid state', () => {
      render(
        <DndWrapper>
          <StationColumn
            station={mockStation}
            dayOfWeek={1}
            isValidDrop={true}
            isInvalidDrop={true}
          />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      // Should show red (invalid), not green (valid)
      expect(column).toHaveClass('ring-red-500');
      expect(column).not.toHaveClass('ring-green-500');
    });

    it('shows no validation highlight when all validation states are false', () => {
      render(
        <DndWrapper>
          <StationColumn
            station={mockStation}
            dayOfWeek={1}
            isValidDrop={false}
            isInvalidDrop={false}
            showBypassWarning={false}
          />
        </DndWrapper>
      );

      const column = screen.getByTestId('station-column-station-1');
      expect(column).not.toHaveClass('ring-green-500');
      expect(column).not.toHaveClass('ring-red-500');
      expect(column).not.toHaveClass('ring-amber-500');
    });
  });
});

describe('StationColumns', () => {
  beforeEach(() => {
    // Mock date to a specific Monday
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-15T11:10:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all station columns', () => {
    render(
      <DndWrapper>
        <StationColumns stations={mockStations} />
      </DndWrapper>
    );

    expect(screen.getByTestId('station-column-station-1')).toBeInTheDocument();
    expect(screen.getByTestId('station-column-station-2')).toBeInTheDocument();
    expect(screen.getByTestId('station-column-station-3')).toBeInTheDocument();
  });

  it('renders now line', () => {
    render(
      <DndWrapper>
        <StationColumns stations={mockStations} />
      </DndWrapper>
    );

    const nowLine = screen.getByTestId('now-line');
    expect(nowLine).toBeInTheDocument();
    expect(nowLine).toHaveClass('bg-red-500');
    expect(nowLine).toHaveClass('z-20');
  });

  it('renders departure marker when job is selected with workshopExitDate today', () => {
    const jobToday: Job = {
      ...mockJob,
      workshopExitDate: new Date('2025-12-15T14:00:00').toISOString(),
    };

    render(
      <DndWrapper>
        <StationColumns stations={mockStations} selectedJob={jobToday} />
      </DndWrapper>
    );

    const departureMarker = screen.getByTestId('departure-marker');
    expect(departureMarker).toBeInTheDocument();
    expect(departureMarker).toHaveClass('bg-blue-500');
  });

  it('does not render departure marker when no job is selected', () => {
    render(
      <DndWrapper>
        <StationColumns stations={mockStations} />
      </DndWrapper>
    );

    const departureMarker = screen.queryByTestId('departure-marker');
    expect(departureMarker).not.toBeInTheDocument();
  });

  it('does not render departure marker when job has no workshopExitDate', () => {
    const jobNoDate: Job = {
      ...mockJob,
      workshopExitDate: null as unknown as string,
    };

    render(
      <DndWrapper>
        <StationColumns stations={mockStations} selectedJob={jobNoDate} />
      </DndWrapper>
    );

    const departureMarker = screen.queryByTestId('departure-marker');
    expect(departureMarker).not.toBeInTheDocument();
  });

  it('has correct container styling', () => {
    render(
      <DndWrapper>
        <StationColumns stations={mockStations} />
      </DndWrapper>
    );

    const container = screen.getByTestId('station-columns-container');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('gap-3');
    expect(container).toHaveClass('px-3');
    expect(container).toHaveClass('bg-[#050505]');
  });

  it('renders empty when no stations', () => {
    render(
      <DndWrapper>
        <StationColumns stations={[]} />
      </DndWrapper>
    );

    const container = screen.getByTestId('station-columns-container');
    // Should still render container with now line but no station columns
    expect(container).toBeInTheDocument();
    expect(screen.queryByTestId(/station-column-/)).not.toBeInTheDocument();
  });

  it('uses default startHour of 6', () => {
    render(
      <DndWrapper>
        <StationColumns stations={mockStations} />
      </DndWrapper>
    );

    // The now line should be positioned based on startHour=6
    // At 11:10, that's 5h10m from startHour=6, so 5.167 * 80 = ~413px
    const nowLine = screen.getByTestId('now-line');
    const top = parseFloat(nowLine.style.top);
    expect(top).toBeCloseTo(413.33, 0);
  });
});
