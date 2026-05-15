/**
 * StationHeader Component Tests
 * Tests for station header including REQ-18: Group capacity display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationHeader } from './StationHeader';
import type { Station } from '@flux/types';

// Test fixtures
const createStation = (id: string = 'sta-1'): Station => ({
  id,
  name: 'Test Station',
  status: 'Available',
  categoryId: 'cat-1',
  capacity: 1,
  operatingSchedule: {
    monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    saturday: { isOperating: false, slots: [] },
    sunday: { isOperating: false, slots: [] },
  },
  exceptions: [],
});

describe('StationHeader', () => {
  it('renders station name', () => {
    render(<StationHeader station={createStation()} />);

    expect(screen.getByText('Test Station')).toBeInTheDocument();
  });

  it('renders with data-testid', () => {
    render(<StationHeader station={createStation('sta-test')} />);

    expect(screen.getByTestId('station-header-sta-test')).toBeInTheDocument();
  });

});
