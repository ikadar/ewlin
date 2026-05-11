import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressCaptureModal } from './ProgressCaptureModal';

const inProgressNow = new Date('2026-05-11T10:30:00+02:00');

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  job: { reference: 'J-1247', client: 'ACME' },
  machineName: 'Heidelberg',
  operatorName: 'Marc D.',
  scheduledStart: '2026-05-11T09:30:00+02:00',
  scheduledEnd: '2026-05-11T12:00:00+02:00',
  now: inProgressNow,
  setupMinutes: 10,
};

describe('ProgressCaptureModal', () => {
  // ── Rendering ──────────────────────────────

  it('renders when isOpen is true', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('progress-capture-modal')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    render(<ProgressCaptureModal {...baseProps} isOpen={false} />);
    expect(screen.queryByTestId('progress-capture-modal')).toBeNull();
  });

  // ── Identity & Triptych ────────────────────

  it('shows job identity centered', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByText('J-1247 · ACME')).toBeInTheDocument();
  });

  it('shows operator and machine in triptych', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByText('Marc D.')).toBeInTheDocument();
    expect(screen.getByText('Heidelberg')).toBeInTheDocument();
  });

  it('shows time slot in triptych', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    const triptych = screen.getByTestId('pm-triptych');
    expect(triptych.textContent).toContain('9h30');
    expect(triptych.textContent).toContain('12h00');
  });

  // ── Variant: in-progress ───────────────────

  it('shows progress band for in-progress task', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('pm-progress-band')).toBeInTheDocument();
  });

  it('shows stepper with "Je finirai à :" label', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    const stepper = screen.getByTestId('pm-stepper');
    expect(stepper.textContent).toContain('Je finirai');
  });

  it('starts on planned end time (stepper shows slot end)', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('pm-stepper-value').textContent).toBe('12h00');
    expect(screen.getByTestId('pm-stepper-status').textContent).toContain("l'heure");
  });

  it('shows blocked button for in-progress variant', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('pm-blocked-btn')).toBeInTheDocument();
  });

  // ── Stepper interaction ────────────────────

  it('increments stepper by +15 on first click', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('pm-stepper-plus'));
    expect(screen.getByTestId('pm-stepper-value').textContent).toBe('12h15');
    expect(screen.getByTestId('pm-stepper-status').textContent).toContain('retard');
  });

  it('decrements stepper below planned end for early finish', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('pm-stepper-minus'));
    expect(screen.getByTestId('pm-stepper-value').textContent).toBe('11h45');
    expect(screen.getByTestId('pm-stepper-status').textContent).toContain('avance');
  });

  // ── Save / Close ───────────────────────────

  it('calls onSave with the planned end when Enregistrer is clicked at default', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pm-confirm-btn'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(720); // 12h00
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Annuler is clicked', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pm-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pm-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('progress-capture-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Blocked mode ───────────────────────────

  it('switches to blocked mode when button is clicked', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('pm-blocked-btn'));
    expect(screen.getByTestId('pm-blocked-mode')).toBeInTheDocument();
    expect(screen.queryByTestId('pm-stepper')).toBeNull();
  });

  it('returns to normal mode from blocked mode', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('pm-blocked-btn'));
    fireEvent.click(screen.getByTestId('pm-blocked-back'));
    expect(screen.getByTestId('pm-stepper')).toBeInTheDocument();
    expect(screen.queryByTestId('pm-blocked-mode')).toBeNull();
  });

  // ── Variant: done-past-end ─────────────────

  it('shows "J\'ai termine" label for done task', () => {
    const doneNow = new Date('2026-05-11T14:00:00+02:00');
    render(<ProgressCaptureModal {...baseProps} now={doneNow} />);
    const stepper = screen.getByTestId('pm-stepper');
    expect(stepper.textContent).toContain("J'ai termin");
  });

  it('does not show blocked button for done variant', () => {
    const doneNow = new Date('2026-05-11T14:00:00+02:00');
    render(<ProgressCaptureModal {...baseProps} now={doneNow} />);
    expect(screen.queryByTestId('pm-blocked-btn')).toBeNull();
  });

  // ── Variant: future-blocked ────────────────

  it('shows predecessor card for future task', () => {
    const futureNow = new Date('2026-05-11T08:00:00+02:00');
    render(
      <ProgressCaptureModal
        {...baseProps}
        now={futureNow}
        predecessorInfo={{ jobReference: 'J-1247', client: 'ACME', stationName: 'SM102', timeRange: '7h00 - 8h30' }}
      />,
    );
    expect(screen.getByTestId('pm-future-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('pm-stepper')).toBeNull();
    expect(screen.queryByTestId('pm-progress-band')).toBeNull();
  });

  it('shows "Fermer" instead of "Annuler" for future variant', () => {
    const futureNow = new Date('2026-05-11T08:00:00+02:00');
    render(<ProgressCaptureModal {...baseProps} now={futureNow} />);
    expect(screen.getByTestId('pm-cancel-btn').textContent).toBe('Fermer');
    expect(screen.queryByTestId('pm-confirm-btn')).toBeNull();
  });
});
