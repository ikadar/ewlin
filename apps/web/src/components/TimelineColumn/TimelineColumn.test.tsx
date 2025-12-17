import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineColumn } from './TimelineColumn';
import { HourMarker, PIXELS_PER_HOUR } from './HourMarker';
import { NowLine } from './NowLine';
import { timeToYPosition } from './utils';

describe('HourMarker', () => {
  it('renders hour label', () => {
    render(<HourMarker hour={6} yPosition={0} />);
    expect(screen.getByText('6h')).toBeInTheDocument();
  });

  it('renders hour label with correct format', () => {
    render(<HourMarker hour={14} yPosition={0} />);
    expect(screen.getByText('14h')).toBeInTheDocument();
  });

  it('renders midnight as 0h', () => {
    render(<HourMarker hour={0} yPosition={0} />);
    expect(screen.getByText('0h')).toBeInTheDocument();
  });

  it('positions hour line correctly', () => {
    const { container } = render(<HourMarker hour={6} yPosition={160} />);
    const hourLine = container.querySelector('.bg-zinc-700\\/50.h-px');
    expect(hourLine).toHaveStyle({ top: '160px' });
  });

  it('positions tick marks at correct offsets', () => {
    const { container } = render(<HourMarker hour={6} yPosition={0} />);
    const ticks = container.querySelectorAll('[class*="bg-zinc-"]');

    // Hour line at 0px
    expect(ticks[0]).toHaveStyle({ top: '0px' });
    // 15 min tick at 20px
    expect(ticks[1]).toHaveStyle({ top: '20px' });
    // 30 min tick at 40px
    expect(ticks[2]).toHaveStyle({ top: '40px' });
    // 45 min tick at 60px
    expect(ticks[3]).toHaveStyle({ top: '60px' });
  });
});

describe('PIXELS_PER_HOUR', () => {
  it('equals 80', () => {
    expect(PIXELS_PER_HOUR).toBe(80);
  });
});

describe('NowLine', () => {
  it('renders now line', () => {
    const time = new Date(2024, 11, 16, 11, 10);
    render(<NowLine currentTime={time} startHour={6} />);
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
  });

  it('renders time label', () => {
    const time = new Date(2024, 11, 16, 11, 10);
    render(<NowLine currentTime={time} startHour={6} />);
    expect(screen.getByText('11:10')).toBeInTheDocument();
  });

  it('formats single digit time with leading zeros', () => {
    const time = new Date(2024, 11, 16, 9, 5);
    render(<NowLine currentTime={time} startHour={6} />);
    expect(screen.getByText('09:05')).toBeInTheDocument();
  });

  it('positions line correctly based on time', () => {
    // 11:10 with startHour=6 => (11-6)*80 + (10/60)*80 = 5*80 + 13.33 = 413.33
    const time = new Date(2024, 11, 16, 11, 10);
    render(<NowLine currentTime={time} startHour={6} />);
    const line = screen.getByTestId('now-line');
    const top = parseFloat(line.style.top);
    expect(top).toBeCloseTo(413.33, 0);
  });
});

describe('timeToYPosition', () => {
  it('calculates position for exact hour', () => {
    const time = new Date(2024, 11, 16, 8, 0);
    expect(timeToYPosition(time, 6)).toBe(160); // (8-6) * 80
  });

  it('calculates position for half hour', () => {
    const time = new Date(2024, 11, 16, 8, 30);
    expect(timeToYPosition(time, 6)).toBe(200); // (8-6) * 80 + 40
  });

  it('handles times after midnight with wrap-around', () => {
    const time = new Date(2024, 11, 16, 2, 0);
    // 2h with startHour=6 => (2+24-6) * 80 = 20 * 80 = 1600
    expect(timeToYPosition(time, 6)).toBe(1600);
  });

  it('handles times at startHour', () => {
    const time = new Date(2024, 11, 16, 6, 0);
    expect(timeToYPosition(time, 6)).toBe(0);
  });
});

describe('TimelineColumn', () => {
  it('renders with correct width', () => {
    const { container } = render(<TimelineColumn />);
    const column = container.firstChild as HTMLElement;
    expect(column).toHaveClass('w-12');
  });

  it('renders with sticky positioning', () => {
    const { container } = render(<TimelineColumn />);
    const column = container.firstChild as HTMLElement;
    expect(column).toHaveClass('sticky');
    expect(column).toHaveClass('left-0');
    expect(column).toHaveClass('z-10');
  });

  it('renders hour markers starting from startHour', () => {
    render(<TimelineColumn startHour={6} hourCount={3} />);
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('7h')).toBeInTheDocument();
    expect(screen.getByText('8h')).toBeInTheDocument();
  });

  it('wraps hours past 23 to 0', () => {
    render(<TimelineColumn startHour={22} hourCount={4} />);
    expect(screen.getByText('22h')).toBeInTheDocument();
    expect(screen.getByText('23h')).toBeInTheDocument();
    expect(screen.getByText('0h')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
  });

  it('renders default 24 hours', () => {
    render(<TimelineColumn startHour={6} />);
    // Should have all hours from 6 to 5 (24 total)
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('5h')).toBeInTheDocument();
    expect(screen.getByText('12h')).toBeInTheDocument();
    expect(screen.getByText('0h')).toBeInTheDocument();
  });

  it('renders NowLine by default', () => {
    const time = new Date(2024, 11, 16, 10, 30);
    render(<TimelineColumn currentTime={time} />);
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
  });

  it('hides NowLine when showNowLine is false', () => {
    const time = new Date(2024, 11, 16, 10, 30);
    render(<TimelineColumn currentTime={time} showNowLine={false} />);
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument();
  });

  it('has correct total height', () => {
    const { container } = render(<TimelineColumn hourCount={24} />);
    const inner = container.querySelector('.relative');
    expect(inner).toHaveStyle({ height: '1920px' }); // 24 * 80
  });

  it('has correct height for custom hourCount', () => {
    const { container } = render(<TimelineColumn hourCount={12} />);
    const inner = container.querySelector('.relative');
    expect(inner).toHaveStyle({ height: '960px' }); // 12 * 80
  });
});
