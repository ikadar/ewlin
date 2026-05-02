import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompactCalendar } from './CompactCalendar';

const TODAY = new Date(2026, 4, 1); // Friday 1 May 2026

describe('CompactCalendar', () => {
  it('renders the month label in French', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
      />,
    );
    expect(screen.getByTestId('cal-month-label').textContent).toBe('mai 2026');
  });

  it('marks today with the today state', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 5)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
      />,
    );
    expect(screen.getByTestId('cal-day-1').dataset.state).toBe('today');
  });

  it('marks the selected day with the selected state', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 5)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
      />,
    );
    expect(screen.getByTestId('cal-day-5').dataset.state).toBe('selected');
  });

  it('marks past days as disabled and not clickable', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 5)}
        today={new Date(2026, 4, 5)}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
      />,
    );
    const past = screen.getByTestId('cal-day-2');
    expect(past.dataset.state).toBe('past');
    expect((past as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks weekends as closures (red dashed)', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
      />,
    );
    // 2 May 2026 is a Saturday
    expect(screen.getByTestId('cal-day-2').dataset.state).toBe('closure');
    // 3 May 2026 is a Sunday
    expect(screen.getByTestId('cal-day-3').dataset.state).toBe('closure');
  });

  it('marks supplied closureDays as closures', () => {
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={() => {}}
        closureDays={[new Date(2026, 4, 8)]}
      />,
    );
    expect(screen.getByTestId('cal-day-8').dataset.state).toBe('closure');
  });

  it('fires onSelectDay when a non-past day is clicked', () => {
    const onSelectDay = vi.fn();
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={onSelectDay}
        onChangeMonth={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('cal-day-15'));
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    const callArg = onSelectDay.mock.calls[0][0];
    expect(callArg.getDate()).toBe(15);
    expect(callArg.getMonth()).toBe(4);
  });

  it('does not fire onSelectDay for past days', () => {
    const onSelectDay = vi.fn();
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 5)}
        today={new Date(2026, 4, 5)}
        onSelectDay={onSelectDay}
        onChangeMonth={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('cal-day-2'));
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('navigates to previous month when ‹ is clicked', () => {
    const onChangeMonth = vi.fn();
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={onChangeMonth}
      />,
    );
    fireEvent.click(screen.getByTestId('cal-prev-month'));
    const callArg = onChangeMonth.mock.calls[0][0];
    expect(callArg.getMonth()).toBe(3); // April
    expect(callArg.getFullYear()).toBe(2026);
  });

  it('navigates to next month when › is clicked', () => {
    const onChangeMonth = vi.fn();
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 4, 1)}
        selectedDay={new Date(2026, 4, 1)}
        today={TODAY}
        onSelectDay={() => {}}
        onChangeMonth={onChangeMonth}
      />,
    );
    fireEvent.click(screen.getByTestId('cal-next-month'));
    const callArg = onChangeMonth.mock.calls[0][0];
    expect(callArg.getMonth()).toBe(5); // June
    expect(callArg.getFullYear()).toBe(2026);
  });

  it('handles month rollover for January (previous → December previous year)', () => {
    const onChangeMonth = vi.fn();
    render(
      <CompactCalendar
        currentMonth={new Date(2026, 0, 1)}
        selectedDay={new Date(2026, 0, 1)}
        today={new Date(2026, 0, 1)}
        onSelectDay={() => {}}
        onChangeMonth={onChangeMonth}
      />,
    );
    fireEvent.click(screen.getByTestId('cal-prev-month'));
    const callArg = onChangeMonth.mock.calls[0][0];
    expect(callArg.getMonth()).toBe(11); // December
    expect(callArg.getFullYear()).toBe(2025);
  });
});
