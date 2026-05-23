import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VolumeGauge } from './VolumeGauge';

describe('VolumeGauge', () => {
  it('renders the track spanning the full task (left=0%, width=100%)', () => {
    render(<VolumeGauge taskProgressPct={37} />);
    const zone = screen.getByTestId('volume-gauge-slot-zone');
    expect(zone.style.left).toBe('0%');
    expect(zone.style.width).toBe('100%');
  });

  it('fills the bar to taskProgressPct', () => {
    render(<VolumeGauge taskProgressPct={37} />);
    const fill = screen.getByTestId('volume-gauge-slot-fill');
    expect(fill.style.width).toBe('37%');
  });

  it('places the marker at taskProgressPct', () => {
    render(<VolumeGauge taskProgressPct={37} />);
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('37%');
  });

  it('shows the « fin de la tâche » endpoint label', () => {
    render(<VolumeGauge taskProgressPct={50} />);
    expect(screen.getByText(/fin de la tâche/)).toBeInTheDocument();
  });

  it('shows zero fill at 0% (still in calage)', () => {
    render(<VolumeGauge taskProgressPct={0} />);
    expect(screen.getByTestId('volume-gauge-slot-fill').style.width).toBe('0%');
    expect(screen.getByTestId('volume-gauge-marker').style.left).toBe('0%');
  });

  it('shows full fill at 100% (task complete)', () => {
    render(<VolumeGauge taskProgressPct={100} />);
    expect(screen.getByTestId('volume-gauge-slot-fill').style.width).toBe('100%');
    expect(screen.getByTestId('volume-gauge-marker').style.left).toBe('100%');
  });

  it('clamps values above 100', () => {
    render(<VolumeGauge taskProgressPct={150} />);
    expect(screen.getByTestId('volume-gauge-slot-fill').style.width).toBe('100%');
    expect(screen.getByTestId('volume-gauge-marker').style.left).toBe('100%');
  });

  it('clamps negative values to 0', () => {
    render(<VolumeGauge taskProgressPct={-5} />);
    expect(screen.getByTestId('volume-gauge-slot-fill').style.width).toBe('0%');
    expect(screen.getByTestId('volume-gauge-marker').style.left).toBe('0%');
  });
});
