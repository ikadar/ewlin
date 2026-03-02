import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SidebarButton } from './SidebarButton';
import { LayoutGrid } from 'lucide-react';

describe('Sidebar', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('navigation')).toHaveAttribute(
      'aria-label',
      'Main navigation'
    );
  });

  it('renders main navigation buttons', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByLabelText('Flux de production')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar view')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('User')).toBeInTheDocument();
  });

  it('shows flux view as active on root route', () => {
    render(<MemoryRouter initialEntries={['/']}><Sidebar /></MemoryRouter>);
    const fluxButton = screen.getByLabelText('Flux de production');
    expect(fluxButton).toHaveAttribute('aria-current', 'page');
  });

  it('shows settings as active on settings routes', () => {
    render(
      <MemoryRouter initialEntries={['/settings/stations']}>
        <Sidebar />
      </MemoryRouter>
    );
    const settingsButton = screen.getByLabelText('Settings');
    expect(settingsButton).toHaveAttribute('aria-current', 'page');
  });

  it('shows flux view as inactive on settings routes', () => {
    render(
      <MemoryRouter initialEntries={['/settings/clients']}>
        <Sidebar />
      </MemoryRouter>
    );
    const fluxButton = screen.getByLabelText('Flux de production');
    expect(fluxButton).not.toHaveAttribute('aria-current');
  });

  it('shows user button as disabled', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    const userButton = screen.getByLabelText('User');
    expect(userButton).toBeDisabled();
  });

  it('navigates to /flux on LayoutGrid click', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByLabelText('Flux de production')).toBeInTheDocument();
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
