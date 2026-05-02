import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLine } from './StatusLine';

describe('StatusLine', () => {
  it('shows the on-time state when current = planned', () => {
    render(<StatusLine currentTimeMin={720} plannedEndMin={720} />);
    const status = screen.getByTestId('pm-status');
    expect(status.dataset.pmStatus).toBe('ontime');
    expect(status.textContent).toContain('à l\'heure prévue');
  });

  it('shows the en-avance state when current < planned', () => {
    render(<StatusLine currentTimeMin={690} plannedEndMin={720} />);
    const status = screen.getByTestId('pm-status');
    expect(status.dataset.pmStatus).toBe('avance');
    expect(status.textContent).toContain('30 min en avance');
  });

  it('shows the en-retard state when current > planned', () => {
    render(<StatusLine currentTimeMin={750} plannedEndMin={720} />);
    const status = screen.getByTestId('pm-status');
    expect(status.dataset.pmStatus).toBe('retard');
    expect(status.textContent).toContain('30 min en retard');
  });

  it('treats sub-minute deltas as on-time (no flicker on boundary)', () => {
    render(<StatusLine currentTimeMin={720.4} plannedEndMin={720} />);
    expect(screen.getByTestId('pm-status').dataset.pmStatus).toBe('ontime');
  });
});
