import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VolumeGauge } from './VolumeGauge';

describe('VolumeGauge', () => {
  it('positions the slot zone at cumulBeforeSlotPct with width slotVolumePct', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={13} />);
    const zone = screen.getByTestId('volume-gauge-slot-zone');
    expect(zone.style.left).toBe('30%');
    expect(zone.style.width).toBe('35%');
  });

  it('fills the slot zone proportionally to expectedAtNowPct / slotVolumePct', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={13} />);
    const fill = screen.getByTestId('volume-gauge-slot-fill');
    // 13 / 35 ≈ 37.142857% → React stringifies to that exact value
    expect(parseFloat(fill.style.width)).toBeCloseTo((13 / 35) * 100, 2);
  });

  it('places the marker at cumulBeforeSlotPct + expectedAtNowPct', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={13} />);
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('43%');
  });

  it('renders the cumulative-job label rounded to the nearest integer', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={13.4} />);
    // 30 + 13.4 = 43.4 → rounded to 43
    expect(screen.getByText('≈ 43% du job')).toBeInTheDocument();
  });

  it('shows the slot info line with start and end positions', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={13} />);
    expect(screen.getByText(/35%/)).toBeInTheDocument();
    expect(screen.getByText(/de 30% à 65%/)).toBeInTheDocument();
  });

  it('shows zero fill when expectedAtNowPct is 0 (still in calage)', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={0} />);
    const fill = screen.getByTestId('volume-gauge-slot-fill');
    expect(fill.style.width).toBe('0%');
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('30%');
  });

  it('shows full fill when expectedAtNowPct equals slotVolumePct (slot complete)', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={35} />);
    const fill = screen.getByTestId('volume-gauge-slot-fill');
    expect(fill.style.width).toBe('100%');
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('65%');
  });

  it('clamps expectedAtNowPct above slotVolumePct (defensive)', () => {
    render(<VolumeGauge cumulBeforeSlotPct={30} slotVolumePct={35} expectedAtNowPct={50} />);
    const fill = screen.getByTestId('volume-gauge-slot-fill');
    // Clamped to slot, so fill = 100% of slot
    expect(fill.style.width).toBe('100%');
    const marker = screen.getByTestId('volume-gauge-marker');
    // Cumul caps at slotEnd = 30 + 35 = 65
    expect(marker.style.left).toBe('65%');
  });

  it('clamps negative inputs to 0', () => {
    render(<VolumeGauge cumulBeforeSlotPct={-5} slotVolumePct={35} expectedAtNowPct={-3} />);
    const zone = screen.getByTestId('volume-gauge-slot-zone');
    expect(zone.style.left).toBe('0%');
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('0%');
  });

  it('handles a slot that occupies the start of the job (cumulBeforeSlotPct = 0)', () => {
    render(<VolumeGauge cumulBeforeSlotPct={0} slotVolumePct={50} expectedAtNowPct={20} />);
    const zone = screen.getByTestId('volume-gauge-slot-zone');
    expect(zone.style.left).toBe('0%');
    expect(zone.style.width).toBe('50%');
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('20%');
  });

  it('handles a slot at the very end of the job (cumulBeforeSlotPct + slotVolumePct = 100)', () => {
    render(<VolumeGauge cumulBeforeSlotPct={70} slotVolumePct={30} expectedAtNowPct={15} />);
    const zone = screen.getByTestId('volume-gauge-slot-zone');
    expect(zone.style.left).toBe('70%');
    expect(zone.style.width).toBe('30%');
    const marker = screen.getByTestId('volume-gauge-marker');
    expect(marker.style.left).toBe('85%');
  });
});
