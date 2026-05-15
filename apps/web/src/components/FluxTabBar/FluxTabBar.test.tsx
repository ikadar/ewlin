import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxTabBar } from './FluxTabBar';

type TestTab = 'all' | 'bat' | 'papier' | 'formes' | 'plaques' | 'soustraitance' | 'a-facturer';

const TABS: { key: TestTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'bat', label: 'BAT à traiter' },
  { key: 'papier', label: 'Cdes papier' },
  { key: 'formes', label: 'Cdes formes' },
  { key: 'plaques', label: 'Plaques à produire' },
  { key: 'soustraitance', label: 'S-T à faire' },
  { key: 'a-facturer', label: 'À facturer' },
];

const defaultCounts: Record<TestTab, number> = {
  all: 5,
  bat: 3,
  papier: 2,
  formes: 1,
  plaques: 2,
  soustraitance: 0,
  'a-facturer': 1,
};

describe('FluxTabBar', () => {
  it('renders all tabs', () => {
    render(
      <FluxTabBar
        tabs={TABS}
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-bat')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-papier')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-formes')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-plaques')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-soustraitance')).toBeInTheDocument();
    expect(screen.getByTestId('flux-tab-a-facturer')).toBeInTheDocument();
  });

  it('renders tab labels', () => {
    render(
      <FluxTabBar
        tabs={TABS}
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('BAT à traiter')).toBeInTheDocument();
    expect(screen.getByText('Cdes papier')).toBeInTheDocument();
    expect(screen.getByText('Cdes formes')).toBeInTheDocument();
    expect(screen.getByText('Plaques à produire')).toBeInTheDocument();
    expect(screen.getByText('S-T à faire')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    render(
      <FluxTabBar
        tabs={TABS}
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
        tabs={TABS}
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('5');
    expect(screen.getByTestId('flux-tab-count-bat')).toHaveTextContent('3');
    expect(screen.getByTestId('flux-tab-count-papier')).toHaveTextContent('2');
    expect(screen.getByTestId('flux-tab-count-formes')).toHaveTextContent('1');
    expect(screen.getByTestId('flux-tab-count-plaques')).toHaveTextContent('2');
  });

  it('calls onTabChange with correct tab ID when tab is clicked', () => {
    const onTabChange = vi.fn();
    render(
      <FluxTabBar
        tabs={TABS}
        activeTab="all"
        counts={defaultCounts}
        onTabChange={onTabChange}
      />
    );
    fireEvent.click(screen.getByTestId('flux-tab-bat'));
    expect(onTabChange).toHaveBeenCalledWith('bat');
  });

  it('calls onTabChange for each tab correctly', () => {
    const onTabChange = vi.fn();
    render(
      <FluxTabBar
        tabs={TABS}
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

  it('tab list has correct aria role', () => {
    render(
      <FluxTabBar
        tabs={TABS}
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
        tabs={TABS}
        activeTab="all"
        counts={defaultCounts}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('5');

    rerender(
      <FluxTabBar
        tabs={TABS}
        activeTab="all"
        counts={{ ...defaultCounts, all: 3 }}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-tab-count-all')).toHaveTextContent('3');
  });

  it('supports custom testIdPrefix', () => {
    render(
      <FluxTabBar
        tabs={[{ key: 'x', label: 'X' }]}
        activeTab="x"
        counts={{ x: 1 }}
        onTabChange={vi.fn()}
        testIdPrefix="custom"
      />
    );
    expect(screen.getByTestId('custom-bar')).toBeInTheDocument();
    expect(screen.getByTestId('custom-x')).toBeInTheDocument();
  });
});
