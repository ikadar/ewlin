import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionsRow } from './QuickActionsRow';

const baseProps = {
  plannedEndMin: 720,    // 12h00
  lowerBoundMin: 645,    // 10h45
  currentTimeMin: 720,
};

describe('QuickActionsRow', () => {
  it('renders the À l\'heure button + 6 adjustments', () => {
    render(<QuickActionsRow {...baseProps} onSelect={() => {}} />);
    expect(screen.getByTestId('pm-quick-ontime')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-minus60')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-minus30')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-minus15')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-plus15')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-plus30')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-plus60')).toBeInTheDocument();
  });

  it('marks À l\'heure as active when currentTimeMin === plannedEndMin', () => {
    render(<QuickActionsRow {...baseProps} onSelect={() => {}} />);
    expect(screen.getByTestId('pm-quick-ontime').className).toMatch(/is-active/);
    // No adjustment should be active
    expect(screen.getByTestId('pm-quick-plus15').className).not.toMatch(/is-active/);
  });

  it('marks the matching adjustment button as active', () => {
    render(<QuickActionsRow {...baseProps} currentTimeMin={750} onSelect={() => {}} />);
    expect(screen.getByTestId('pm-quick-plus30').className).toMatch(/is-active/);
    expect(screen.getByTestId('pm-quick-ontime').className).not.toMatch(/is-active/);
  });

  it('fires onSelect with plannedEndMin when À l\'heure is clicked', () => {
    const onSelect = vi.fn();
    render(<QuickActionsRow {...baseProps} currentTimeMin={750} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('pm-quick-ontime'));
    expect(onSelect).toHaveBeenCalledWith(720);
  });

  it('fires onSelect with the offset target when an adjustment is clicked', () => {
    const onSelect = vi.fn();
    render(<QuickActionsRow {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('pm-quick-plus30'));
    expect(onSelect).toHaveBeenCalledWith(750);
  });

  it('clamps below lowerBoundMin (cannot report a past finish time)', () => {
    const onSelect = vi.fn();
    // planned 12h00, lower 11h45 — clicking −1h would resolve to 11h00 → clamp to 11h45
    render(<QuickActionsRow plannedEndMin={720} currentTimeMin={720} lowerBoundMin={705} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('pm-quick-minus60'));
    expect(onSelect).toHaveBeenCalledWith(705);
  });

  it('uses the symmetric variant classes (is-early / is-late)', () => {
    render(<QuickActionsRow {...baseProps} onSelect={() => {}} />);
    expect(screen.getByTestId('pm-quick-minus60').className).toMatch(/is-early/);
    expect(screen.getByTestId('pm-quick-minus30').className).toMatch(/is-early/);
    expect(screen.getByTestId('pm-quick-minus15').className).toMatch(/is-early/);
    expect(screen.getByTestId('pm-quick-plus15').className).toMatch(/is-late/);
    expect(screen.getByTestId('pm-quick-plus30').className).toMatch(/is-late/);
    expect(screen.getByTestId('pm-quick-plus60').className).toMatch(/is-late/);
  });
});
