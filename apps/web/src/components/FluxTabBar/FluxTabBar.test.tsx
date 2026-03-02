import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxTabBar } from './FluxTabBar';
import type { TabId } from '../FluxTable/fluxFilters';

const defaultCounts: Record<TabId, number> = {
  all: 5,
  prepresse: 3,
  papier: 2,
  formes: 1,
  plaques: 2,
};

describe('FluxTabBar', () => {
  it('renders all 5 tabs', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-prepresse')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-papier')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-formes')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-plaques')).toBeInTheDocument();
  });

  it('renders tab labels', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('A faire prepresse')).toBeInTheDocument();
    expect(screen.getByText('Cdes papier')).toBeInTheDocument();
    expect(screen.getByText('Cdes formes')).toBeInTheDocument();
    expect(screen.getByText('Plaques a produire')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    render(
      <FluxTabBar
        activeTab="papier"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-papier')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('flux-tab-all')).toHaveAttribute('aria-selected', 'false');
  });

  it('renders count badges with correct values', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('5');
    expect(screen.getByTestId('flux-tab-count-prepresse')).toHaveTextContent('3');
    expect(screen.getByTestId('flux-tab-count-papier')).toHaveTextContent('2');
    expect(screen.getByTestId('flux-tab-count-formes')).toHaveTextContent('1');
    expect(screen.getByTestId('flux-tab-count-plaques')).toHaveTextContent('2');
  });

  it('calls onTabChange with correct tab ID when tab is clicked', () => {
    const onTabChange = vi.fn();
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={onTabChange}
      />
    );
    fireEvent.click(screen.getByTestId('flux-tab-prepresse'));
    expect(onTabChange).toHaveBeenCalledWith('prepresse');
  });

  it('calls onTabChange for each tab correctly', () => {
    const onTabChange = vi.fn();
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByTestId('flux-tab-papier'));
    expect(onTabChange).toHaveBeenCalledWith('papier');

    fireEvent.click(screen.getByTestId('flux-tab-formes'));
    expect(onTabChange).toHaveBeenCalledWith('formes');

    fireEvent.click(screen.getByTestId('flux-tab-plaques'));
    expect(onTabChange).toHaveBeenCalledWith('plaques');
  });

  it('renders the keyboard hint bar', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-keyboard-hints')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts in hint bar', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    const hints = screen.getByTestId('flux-keyboard-hints');
    expect(hints).toHaveTextContent('Alt+←');
    expect(hints).toHaveTextContent('Alt+→');
    expect(hints).toHaveTextContent('Alt+↑');
    expect(hints).toHaveTextContent('Alt+↓');
    expect(hints).toHaveTextContent('Alt+F');
    expect(hints).toHaveTextContent('Alt+N');
  });

  it('tab list has correct aria role', () => {
    render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('count badges update when counts prop changes', () => {
    const { rerender } = render(
      <FluxTabBar
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('5');

    rerender(
      <FluxTabBar
        activeTab="all"
        counts={{ ...defaultCounts, all: 3 }}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('3');
  });
});
