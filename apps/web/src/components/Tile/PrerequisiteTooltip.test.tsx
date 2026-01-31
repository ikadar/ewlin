/**
 * PrerequisiteTooltip Component Tests
 * v0.4.32b: Scheduler Tile Blocking Visual & Tooltip
 * v0.4.32c: Forme Status & Date Tracking
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrerequisiteTooltip } from './PrerequisiteTooltip';
import type { PrerequisiteBlockingInfo } from '../../utils';

// Helper to create blocking info
function createBlockingInfo(
  paperStatus: string,
  paperReady: boolean,
  batStatus: string,
  batReady: boolean,
  platesStatus: string,
  platesReady: boolean,
  formeStatus: string = 'none',
  formeReady: boolean = true
): PrerequisiteBlockingInfo {
  return {
    isBlocked: !paperReady || !batReady || !platesReady || !formeReady,
    paper: {
      status: paperStatus as PrerequisiteBlockingInfo['paper']['status'],
      isReady: paperReady,
    },
    bat: {
      status: batStatus as PrerequisiteBlockingInfo['bat']['status'],
      isReady: batReady,
    },
    plates: {
      status: platesStatus as PrerequisiteBlockingInfo['plates']['status'],
      isReady: platesReady,
    },
    forme: {
      status: formeStatus as PrerequisiteBlockingInfo['forme']['status'],
      isReady: formeReady,
    },
  };
}

describe('PrerequisiteTooltip', () => {
  it('renders nothing when not visible', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'ready', true
    );

    const { container } = render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip when visible', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'ready', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    expect(screen.getByTestId('prerequisite-tooltip')).toBeInTheDocument();
  });

  it('shows warning icon for blocking items', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'ready', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    // Paper is blocking, should show warning
    expect(screen.getByText(/Papier/)).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('shows check icon for ready items', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'ready', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    // BAT and Plates are ready
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBeGreaterThanOrEqual(1);
  });

  it('shows French label for paper status', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'none', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    expect(screen.getByText(/À commander/)).toBeInTheDocument();
  });

  it('shows French label for BAT status', () => {
    const blockingInfo = createBlockingInfo(
      'in_stock', true,
      'waiting_files', false,
      'none', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    expect(screen.getByText(/Attente fichiers/)).toBeInTheDocument();
  });

  it('shows French label for plates status', () => {
    const blockingInfo = createBlockingInfo(
      'in_stock', true,
      'bat_approved', true,
      'to_make', false
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    expect(screen.getByText(/À faire/)).toBeInTheDocument();
  });

  it('hides items with "none" status when ready', () => {
    // Paper is blocking, but plates is 'none' (ready) - should be hidden
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'bat_approved', true,
      'none', true
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    // Plates should not be shown since it's 'none' and ready
    expect(screen.queryByText(/Plaques/)).not.toBeInTheDocument();
    // Paper should be shown (blocking)
    expect(screen.getByText(/Papier/)).toBeInTheDocument();
  });

  it('shows multiple blocking items', () => {
    const blockingInfo = createBlockingInfo(
      'to_order', false,
      'waiting_files', false,
      'to_make', false
    );

    render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    // All three should be shown
    expect(screen.getByText(/Papier/)).toBeInTheDocument();
    expect(screen.getByText(/BAT/)).toBeInTheDocument();
    expect(screen.getByText(/Plaques/)).toBeInTheDocument();

    // All three should have warning icon
    const warnings = screen.getAllByText('⚠');
    expect(warnings).toHaveLength(3);
  });

  it('renders nothing when all items are "none" and ready', () => {
    const blockingInfo = createBlockingInfo(
      'none', true,
      'none', true,
      'none', true
    );

    const { container } = render(
      <PrerequisiteTooltip blockingInfo={blockingInfo} isVisible={true} />
    );

    // No items to show, should render null
    expect(container.firstChild).toBeNull();
  });
});
