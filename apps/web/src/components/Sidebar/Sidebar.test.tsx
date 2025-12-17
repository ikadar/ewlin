import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { SidebarButton } from './SidebarButton';
import { LayoutGrid } from 'lucide-react';

describe('Sidebar', () => {
  it('renders without crashing', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation')).toHaveAttribute(
      'aria-label',
      'Main navigation'
    );
  });

  it('renders all three navigation buttons', () => {
    render(<Sidebar />);
    expect(screen.getByLabelText('Scheduling view')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar view')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('shows schedule view as active by default', () => {
    render(<Sidebar />);
    const scheduleButton = screen.getByLabelText('Scheduling view');
    expect(scheduleButton).toHaveAttribute('aria-current', 'page');
  });

  it('shows calendar view as inactive by default', () => {
    render(<Sidebar />);
    const calendarButton = screen.getByLabelText('Calendar view');
    expect(calendarButton).not.toHaveAttribute('aria-current');
  });

  it('shows settings button as disabled', () => {
    render(<Sidebar />);
    const settingsButton = screen.getByLabelText('Settings');
    expect(settingsButton).toBeDisabled();
  });

  it('calls onNavigate when clicking schedule button', () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);
    fireEvent.click(screen.getByLabelText('Scheduling view'));
    expect(onNavigate).toHaveBeenCalledWith('schedule');
  });

  it('calls onNavigate when clicking calendar button', () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);
    fireEvent.click(screen.getByLabelText('Calendar view'));
    expect(onNavigate).toHaveBeenCalledWith('calendar');
  });

  it('does not call onNavigate when clicking disabled settings button', () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('respects activeView prop', () => {
    render(<Sidebar activeView="calendar" />);
    const scheduleButton = screen.getByLabelText('Scheduling view');
    const calendarButton = screen.getByLabelText('Calendar view');
    expect(scheduleButton).not.toHaveAttribute('aria-current');
    expect(calendarButton).toHaveAttribute('aria-current', 'page');
  });
});

describe('SidebarButton', () => {
  it('renders with icon and label', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" />);
    expect(screen.getByLabelText('Test button')).toBeInTheDocument();
  });

  it('applies active styles when isActive is true', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" isActive />);
    const button = screen.getByLabelText('Test button');
    expect(button).toHaveAttribute('aria-current', 'page');
    expect(button).toHaveClass('bg-white/10');
  });

  it('does not have aria-current when inactive', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" />);
    const button = screen.getByLabelText('Test button');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('is disabled when isDisabled is true', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" isDisabled />);
    const button = screen.getByLabelText('Test button');
    expect(button).toBeDisabled();
  });

  it('applies disabled styles', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" isDisabled />);
    const button = screen.getByLabelText('Test button');
    expect(button).toHaveClass('cursor-not-allowed');
    expect(button).toHaveClass('text-zinc-700');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <SidebarButton icon={LayoutGrid} label="Test button" onClick={onClick} />
    );
    fireEvent.click(screen.getByLabelText('Test button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <SidebarButton
        icon={LayoutGrid}
        label="Test button"
        isDisabled
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByLabelText('Test button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has focus ring styles for keyboard navigation', () => {
    render(<SidebarButton icon={LayoutGrid} label="Test button" />);
    const button = screen.getByLabelText('Test button');
    expect(button).toHaveClass('focus:ring-2');
  });
});
