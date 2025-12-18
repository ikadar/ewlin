import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateStrip } from './DateStrip';
import { DateCell } from './DateCell';

describe('DateCell', () => {
  it('renders day abbreviation and number', () => {
    // Monday, December 9, 2024
    const date = new Date(2024, 11, 9);
    render(<DateCell date={date} />);

    expect(screen.getByText('Lu')).toBeInTheDocument();
    expect(screen.getByText('09')).toBeInTheDocument();
  });

  it('displays French day abbreviations correctly', () => {
    // Test all days of the week
    const testCases = [
      { date: new Date(2024, 11, 9), abbrev: 'Lu' }, // Monday
      { date: new Date(2024, 11, 10), abbrev: 'Ma' }, // Tuesday
      { date: new Date(2024, 11, 11), abbrev: 'Me' }, // Wednesday
      { date: new Date(2024, 11, 12), abbrev: 'Je' }, // Thursday
      { date: new Date(2024, 11, 13), abbrev: 'Ve' }, // Friday
      { date: new Date(2024, 11, 14), abbrev: 'Sa' }, // Saturday
      { date: new Date(2024, 11, 15), abbrev: 'Di' }, // Sunday
    ];

    testCases.forEach(({ date, abbrev }) => {
      const { unmount } = render(<DateCell date={date} />);
      expect(screen.getByText(abbrev)).toBeInTheDocument();
      unmount();
    });
  });

  it('displays day number with leading zero', () => {
    const date = new Date(2024, 11, 5);
    render(<DateCell date={date} />);
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('applies today styling when isToday is true', () => {
    const date = new Date();
    const { container } = render(<DateCell date={date} isToday />);

    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass('bg-amber-500/15');
    expect(cell).toHaveClass('text-amber-200');
    expect(cell).toHaveClass('border-amber-500/30');
  });

  it('applies normal styling when isToday is false', () => {
    const date = new Date(2024, 11, 9);
    const { container } = render(<DateCell date={date} isToday={false} />);

    const cell = container.firstChild as HTMLElement;
    expect(cell).toHaveClass('text-zinc-500');
    expect(cell).toHaveClass('border-white/5');
    expect(cell).toHaveClass('hover:bg-white/5');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    const date = new Date(2024, 11, 9);
    render(<DateCell date={date} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is a focusable button element', () => {
    const date = new Date(2024, 11, 9);
    render(<DateCell date={date} />);

    // Button elements are implicitly focusable and handle Enter key natively
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });
});

describe('DateStrip', () => {
  it('renders the correct number of days', () => {
    const startDate = new Date(2024, 11, 9);
    render(<DateStrip startDate={startDate} dayCount={7} />);

    // Should render 7 day cells
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
  });

  it('renders days in sequence', () => {
    const startDate = new Date(2024, 11, 9); // Monday
    render(<DateStrip startDate={startDate} dayCount={3} />);

    expect(screen.getByText('Lu')).toBeInTheDocument(); // Monday
    expect(screen.getByText('Ma')).toBeInTheDocument(); // Tuesday
    expect(screen.getByText('Me')).toBeInTheDocument(); // Wednesday
  });

  it('highlights today', () => {
    // Create a date range that includes today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 3);

    const { container } = render(<DateStrip startDate={startDate} dayCount={7} />);

    // Find the cell with amber styling (today)
    const todayCell = container.querySelector('.bg-amber-500\\/15');
    expect(todayCell).toBeInTheDocument();
  });

  it('calls onDateClick with correct date when day is clicked', () => {
    const handleDateClick = vi.fn();
    const startDate = new Date(2024, 11, 9);
    render(<DateStrip startDate={startDate} dayCount={3} onDateClick={handleDateClick} />);

    // Click the first day (Monday Dec 9)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(handleDateClick).toHaveBeenCalledTimes(1);
    const clickedDate = handleDateClick.mock.calls[0][0] as Date;
    expect(clickedDate.getDate()).toBe(9);
    expect(clickedDate.getMonth()).toBe(11); // December
  });

  it('uses default dayCount of 21', () => {
    const startDate = new Date(2024, 11, 9);
    render(<DateStrip startDate={startDate} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(21);
  });

  it('has correct container styling', () => {
    const startDate = new Date(2024, 11, 9);
    const { container } = render(<DateStrip startDate={startDate} dayCount={3} />);

    const stripContainer = container.firstChild as HTMLElement;
    expect(stripContainer).toHaveClass('w-12');
    expect(stripContainer).toHaveClass('shrink-0');
    expect(stripContainer).toHaveClass('bg-zinc-950');
    expect(stripContainer).toHaveClass('overflow-y-auto');
    expect(stripContainer).toHaveClass('border-r');
    expect(stripContainer).toHaveClass('border-white/5');
  });
});
