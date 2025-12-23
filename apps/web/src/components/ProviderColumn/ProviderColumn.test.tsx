/**
 * ProviderColumn Component Tests
 * Tests for REQ-19: Provider column display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderColumn } from './ProviderColumn';
import type { OutsourcedProvider } from '@flux/types';

// Test fixtures
const createProvider = (id: string = 'prov-1'): OutsourcedProvider => ({
  id,
  name: 'Clément',
  status: 'Active',
  supportedActionTypes: ['binding', 'laminating'],
  latestDepartureTime: '14:00',
  receptionTime: '09:00',
  groupId: 'grp-clement',
});

describe('ProviderColumn', () => {
  it('renders with data-testid', () => {
    render(<ProviderColumn provider={createProvider('prov-test')} />);

    expect(screen.getByTestId('provider-column-prov-test')).toBeInTheDocument();
  });

  it('has dotted left border', () => {
    render(<ProviderColumn provider={createProvider('prov-1')} />);

    const column = screen.getByTestId('provider-column-prov-1');
    expect(column).toHaveClass('border-dashed');
  });

  it('has darker background than station columns', () => {
    render(<ProviderColumn provider={createProvider('prov-1')} />);

    const column = screen.getByTestId('provider-column-prov-1');
    expect(column).toHaveClass('bg-zinc-900/50');
  });

  it('renders hour grid lines', () => {
    render(
      <ProviderColumn
        provider={createProvider()}
        hoursToDisplay={24}
      />
    );

    const gridLines = screen.getAllByTestId('hour-grid-line');
    // 24 hours + 1 for the ending line = 25 lines
    expect(gridLines.length).toBe(25);
  });

  it('renders children', () => {
    render(
      <ProviderColumn provider={createProvider()}>
        <div data-testid="child-element">Child</div>
      </ProviderColumn>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
  });

  describe('Collapsed state', () => {
    it('has narrower width when collapsed', () => {
      render(<ProviderColumn provider={createProvider('prov-1')} isCollapsed={true} />);

      const column = screen.getByTestId('provider-column-prov-1');
      expect(column).toHaveClass('w-30');
    });

    it('has full width when not collapsed', () => {
      render(<ProviderColumn provider={createProvider('prov-1')} isCollapsed={false} />);

      const column = screen.getByTestId('provider-column-prov-1');
      expect(column).toHaveClass('w-60');
    });
  });

  describe('Height calculation', () => {
    it('calculates height based on hours and pixels per hour', () => {
      render(
        <ProviderColumn
          provider={createProvider('prov-1')}
          hoursToDisplay={12}
          pixelsPerHour={60}
        />
      );

      const column = screen.getByTestId('provider-column-prov-1');
      expect(column).toHaveStyle({ height: '720px' }); // 12 * 60
    });

    it('uses default values when not specified', () => {
      render(<ProviderColumn provider={createProvider('prov-1')} />);

      const column = screen.getByTestId('provider-column-prov-1');
      // Default: 24 hours * 80 pixels = 1920px
      expect(column).toHaveStyle({ height: '1920px' });
    });
  });
});
