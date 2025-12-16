import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StationHeaders } from './StationHeaders';
import { StationHeader } from './StationHeader';
import { OffScreenIndicator } from './OffScreenIndicator';
import type { Station } from '@flux/types';

// Mock stations
const mockStations: Station[] = [
  {
    id: 'station-1',
    name: 'Komori G40',
    status: 'Operational',
    categoryId: 'cat-1',
    groupId: 'group-1',
    capacity: 1,
    operatingSchedule: {
      monday: { start: '07:00', end: '19:00' },
      tuesday: { start: '07:00', end: '19:00' },
      wednesday: { start: '07:00', end: '19:00' },
      thursday: { start: '07:00', end: '19:00' },
      friday: { start: '07:00', end: '19:00' },
      saturday: null,
      sunday: null,
    },
    exceptions: [],
  },
  {
    id: 'station-2',
    name: 'Polar 137',
    status: 'Operational',
    categoryId: 'cat-2',
    groupId: 'group-2',
    capacity: 1,
    operatingSchedule: {
      monday: { start: '07:00', end: '19:00' },
      tuesday: { start: '07:00', end: '19:00' },
      wednesday: { start: '07:00', end: '19:00' },
      thursday: { start: '07:00', end: '19:00' },
      friday: { start: '07:00', end: '19:00' },
      saturday: null,
      sunday: null,
    },
    exceptions: [],
  },
  {
    id: 'station-3',
    name: 'Heidelberg XL',
    status: 'Operational',
    categoryId: 'cat-1',
    groupId: 'group-1',
    capacity: 1,
    operatingSchedule: {
      monday: { start: '07:00', end: '19:00' },
      tuesday: { start: '07:00', end: '19:00' },
      wednesday: { start: '07:00', end: '19:00' },
      thursday: { start: '07:00', end: '19:00' },
      friday: { start: '07:00', end: '19:00' },
      saturday: null,
      sunday: null,
    },
    exceptions: [],
  },
];

describe('OffScreenIndicator', () => {
  it('renders count and up chevron when direction is up', () => {
    render(<OffScreenIndicator count={2} direction="up" />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders count and down chevron when direction is down', () => {
    render(<OffScreenIndicator count={3} direction="down" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render when count is 0', () => {
    const { container } = render(<OffScreenIndicator count={0} direction="up" />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render when count is negative', () => {
    const { container } = render(<OffScreenIndicator count={-1} direction="up" />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<OffScreenIndicator count={2} direction="up" onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Enter key press', () => {
    const handleClick = vi.fn();
    render(<OffScreenIndicator count={2} direction="up" onClick={handleClick} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has correct title for single tile', () => {
    render(<OffScreenIndicator count={1} direction="up" />);
    expect(screen.getByTitle('1 tile above')).toBeInTheDocument();
  });

  it('has correct title for multiple tiles', () => {
    render(<OffScreenIndicator count={3} direction="down" />);
    expect(screen.getByTitle('3 tiles below')).toBeInTheDocument();
  });
});

describe('StationHeader', () => {
  it('renders station name', () => {
    render(<StationHeader station={mockStations[0]} />);
    expect(screen.getByText('Komori G40')).toBeInTheDocument();
  });

  it('has correct width class', () => {
    const { container } = render(<StationHeader station={mockStations[0]} />);
    expect(container.firstChild).toHaveClass('w-60');
  });

  it('renders off-screen indicator when above count > 0', () => {
    render(
      <StationHeader
        station={mockStations[0]}
        offScreen={{ above: 2, below: 0 }}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders off-screen indicator when below count > 0', () => {
    render(
      <StationHeader
        station={mockStations[0]}
        offScreen={{ above: 0, below: 3 }}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render indicator when counts are 0', () => {
    render(
      <StationHeader
        station={mockStations[0]}
        offScreen={{ above: 0, below: 0 }}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onOffScreenClick with correct direction', () => {
    const handleClick = vi.fn();
    render(
      <StationHeader
        station={mockStations[0]}
        offScreen={{ above: 2, below: 0 }}
        onOffScreenClick={handleClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('up');
  });
});

describe('StationHeaders', () => {
  it('renders all station names', () => {
    render(<StationHeaders stations={mockStations} />);

    expect(screen.getByText('Komori G40')).toBeInTheDocument();
    expect(screen.getByText('Polar 137')).toBeInTheDocument();
    expect(screen.getByText('Heidelberg XL')).toBeInTheDocument();
  });

  it('has sticky positioning', () => {
    const { container } = render(<StationHeaders stations={mockStations} />);
    expect(container.firstChild).toHaveClass('sticky');
    expect(container.firstChild).toHaveClass('top-0');
    expect(container.firstChild).toHaveClass('z-30');
  });

  it('has correct background and border', () => {
    const { container } = render(<StationHeaders stations={mockStations} />);
    expect(container.firstChild).toHaveClass('bg-zinc-900');
    expect(container.firstChild).toHaveClass('border-b');
  });

  it('renders off-screen indicators for specified stations', () => {
    render(
      <StationHeaders
        stations={mockStations}
        offScreenByStation={{
          'station-1': { above: 2, below: 0 },
          'station-3': { above: 1, below: 0 },
        }}
      />
    );

    // Should have two indicators
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('calls onOffScreenClick with station ID and direction', () => {
    const handleClick = vi.fn();
    render(
      <StationHeaders
        stations={mockStations}
        offScreenByStation={{
          'station-1': { above: 2, below: 0 },
        }}
        onOffScreenClick={handleClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('station-1', 'up');
  });

  it('renders empty when no stations', () => {
    const { container } = render(<StationHeaders stations={[]} />);
    expect(container.firstChild?.childNodes.length).toBe(0);
  });
});
