import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchedulingGrid } from './SchedulingGrid';
import type { Station, Job } from '@flux/types';

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

describe('SchedulingGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-15T11:10:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the scheduling grid container', () => {
    render(<SchedulingGrid stations={mockStations} />);

    expect(screen.getByTestId('scheduling-grid')).toBeInTheDocument();
  });

  it('renders all station headers', () => {
    render(<SchedulingGrid stations={mockStations} />);

    expect(screen.getByText('Komori G40')).toBeInTheDocument();
    expect(screen.getByText('Polar 137')).toBeInTheDocument();
    expect(screen.getByText('Heidelberg XL')).toBeInTheDocument();
  });

  it('renders all station columns', () => {
    render(<SchedulingGrid stations={mockStations} />);

    expect(screen.getByTestId('station-column-station-1')).toBeInTheDocument();
    expect(screen.getByTestId('station-column-station-2')).toBeInTheDocument();
    expect(screen.getByTestId('station-column-station-3')).toBeInTheDocument();
  });

  it('renders the timeline column', () => {
    render(<SchedulingGrid stations={mockStations} />);

    // Timeline shows hour markers
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('12h')).toBeInTheDocument();
  });

  it('renders the now line', () => {
    render(<SchedulingGrid stations={mockStations} />);

    const nowLine = screen.getByTestId('now-line');
    expect(nowLine).toBeInTheDocument();
    expect(nowLine).toHaveClass('bg-red-500');
  });

  it('renders departure marker when job is selected with workshopExitDate today', () => {
    const jobToday: Job = {
      ...mockJob,
      workshopExitDate: new Date('2025-12-15T14:00:00').toISOString(),
    };

    render(
      <SchedulingGrid
        stations={mockStations}
        jobs={[jobToday]}
        selectedJobId={jobToday.id}
      />
    );

    const departureMarker = screen.getByTestId('departure-marker');
    expect(departureMarker).toBeInTheDocument();
    expect(departureMarker).toHaveClass('bg-blue-500');
  });

  it('does not render departure marker when no job is selected', () => {
    render(<SchedulingGrid stations={mockStations} />);

    expect(screen.queryByTestId('departure-marker')).not.toBeInTheDocument();
  });

  it('does not render departure marker when job date is not today', () => {
    const jobTomorrow: Job = {
      ...mockJob,
      workshopExitDate: new Date('2025-12-16T14:00:00').toISOString(),
    };

    render(
      <SchedulingGrid
        stations={mockStations}
        jobs={[jobTomorrow]}
        selectedJobId={jobTomorrow.id}
      />
    );

    expect(screen.queryByTestId('departure-marker')).not.toBeInTheDocument();
  });

  it('has scrollable container', () => {
    render(<SchedulingGrid stations={mockStations} />);

    const container = screen.getByTestId('scheduling-grid');
    expect(container).toHaveClass('overflow-auto');
  });

  it('renders hour grid lines in station columns', () => {
    render(<SchedulingGrid stations={mockStations} />);

    const gridLines = screen.getAllByTestId('hour-grid-line');
    // Each station has 25 lines (24 hours + 1), 3 stations = 75 lines
    expect(gridLines.length).toBe(75);
  });

  it('renders unavailability overlays', () => {
    render(<SchedulingGrid stations={mockStations} />);

    const overlays = screen.getAllByTestId('unavailability-overlay');
    expect(overlays.length).toBeGreaterThan(0);
  });
});
