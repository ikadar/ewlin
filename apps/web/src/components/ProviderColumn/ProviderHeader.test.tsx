/**
 * ProviderHeader Component Tests
 * Tests for REQ-19: Provider column header display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderHeader } from './ProviderHeader';
import type { OutsourcedProvider } from '@flux/types';

// Test fixtures
const createProvider = (id: string = 'prov-1', name: string = 'Clément'): OutsourcedProvider => ({
  id,
  name,
  status: 'Active',
  supportedActionTypes: ['binding', 'laminating'],
  latestDepartureTime: '14:00',
  receptionTime: '09:00',
  groupId: 'grp-clement',
});

describe('ProviderHeader', () => {
  it('renders provider name', () => {
    render(<ProviderHeader provider={createProvider('prov-1', 'Clément')} />);

    expect(screen.getByText('Clément')).toBeInTheDocument();
  });

  it('renders with data-testid', () => {
    render(<ProviderHeader provider={createProvider('prov-test')} />);

    expect(screen.getByTestId('provider-header-prov-test')).toBeInTheDocument();
  });

  it('renders Building2 icon', () => {
    render(<ProviderHeader provider={createProvider()} />);

    expect(screen.getByTestId('provider-icon')).toBeInTheDocument();
  });

  it('renders Outsourced label', () => {
    render(<ProviderHeader provider={createProvider()} />);

    expect(screen.getByText('Outsourced')).toBeInTheDocument();
  });

  it('has dotted left border', () => {
    render(<ProviderHeader provider={createProvider('prov-1')} />);

    const header = screen.getByTestId('provider-header-prov-1');
    expect(header).toHaveClass('border-dashed');
  });

  describe('Collapsed state', () => {
    it('hides Outsourced label when collapsed', () => {
      render(<ProviderHeader provider={createProvider()} isCollapsed={true} />);

      expect(screen.queryByText('Outsourced')).not.toBeInTheDocument();
    });

    it('still shows provider name when collapsed', () => {
      render(<ProviderHeader provider={createProvider('prov-1', 'Clément')} isCollapsed={true} />);

      expect(screen.getByText('Clément')).toBeInTheDocument();
    });

    it('has narrower width when collapsed', () => {
      render(<ProviderHeader provider={createProvider('prov-1')} isCollapsed={true} />);

      const header = screen.getByTestId('provider-header-prov-1');
      expect(header).toHaveClass('w-30');
    });

    it('has full width when not collapsed', () => {
      render(<ProviderHeader provider={createProvider('prov-1')} isCollapsed={false} />);

      const header = screen.getByTestId('provider-header-prov-1');
      expect(header).toHaveClass('w-60');
    });
  });
});
