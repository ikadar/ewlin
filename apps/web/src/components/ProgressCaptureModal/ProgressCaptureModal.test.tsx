import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressCaptureModal } from './ProgressCaptureModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  job: { reference: 'J-1247', client: 'ACME' },
  machineName: 'Heidelberg',
  slotStartMin: 570,    // 9h30
  slotEndMin: 720,      // 12h00
  cumulBeforeSlotPct: 30,
  slotVolumePct: 35,
  expectedAtNowPct: 13,
  nowMin: 645,          // 10h45
};

describe('ProgressCaptureModal', () => {
  it('renders when isOpen is true', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('progress-capture-modal')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    render(<ProgressCaptureModal {...baseProps} isOpen={false} />);
    expect(screen.queryByTestId('progress-capture-modal')).toBeNull();
  });

  it('shows job identity (without fragment number, per UX decision)', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByText('J-1247 · ACME')).toBeInTheDocument();
    expect(screen.getByText('Heidelberg')).toBeInTheDocument();
  });

  it('shows the slot range with formatted French times', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByText('9h30 → 12h00')).toBeInTheDocument();
  });

  it('renders the volume gauge with the slot context', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('volume-gauge')).toBeInTheDocument();
    expect(screen.getByTestId('volume-gauge-marker')).toBeInTheDocument();
    expect(screen.getByText('≈ 43% du job')).toBeInTheDocument();
  });

  it('renders all the input controls', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('pm-quick-ontime')).toBeInTheDocument();
    expect(screen.getByTestId('pm-quick-plus30')).toBeInTheDocument();
    expect(screen.getByTestId('pm-custom-input')).toBeInTheDocument();
    expect(screen.getByTestId('pm-status')).toBeInTheDocument();
  });

  it('starts on À l\'heure (initial pmTime = slotEndMin)', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    expect(screen.getByTestId('pm-quick-ontime').className).toMatch(/is-active/);
    expect(screen.getByTestId('pm-status').dataset.pmStatus).toBe('ontime');
  });

  it('updates the status line when a quick button is pressed', () => {
    render(<ProgressCaptureModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('pm-quick-plus30'));
    expect(screen.getByTestId('pm-status').dataset.pmStatus).toBe('retard');
    expect(screen.getByTestId('pm-status').textContent).toContain('30 min en retard');
  });

  it('calls onSave with the current pmTime when Enregistrer is clicked', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('pm-quick-plus30'));
    fireEvent.click(screen.getByTestId('pm-confirm-btn'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(750); // 12h00 + 30 min
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Annuler is clicked (without saving)', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pm-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
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

  it('does not close when clicking inside the dialog body', () => {
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Quand finirez-vous ?'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ProgressCaptureModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the buttons while saving (async onSave)', async () => {
    let resolveSave: (() => void) | null = null;
    const onSave = vi.fn(() => new Promise<void>((res) => { resolveSave = res; }));
    render(<ProgressCaptureModal {...baseProps} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('pm-confirm-btn'));
    expect((screen.getByTestId('pm-confirm-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('pm-cancel-btn') as HTMLButtonElement).disabled).toBe(true);

    resolveSave?.();
    await waitFor(() => {
      // After resolving, the modal closes via onClose (if parent handles).
      // In our test the parent is a vi.fn so the modal stays mounted with isOpen=true.
      // But the saving flag should now be false → buttons re-enabled.
      expect((screen.getByTestId('pm-confirm-btn') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('resets pmTime to slotEndMin when reopened (à l\'heure default for new session)', () => {
    const { rerender } = render(<ProgressCaptureModal {...baseProps} />);

    // Move to +30 min
    fireEvent.click(screen.getByTestId('pm-quick-plus30'));
    expect(screen.getByTestId('pm-status').dataset.pmStatus).toBe('retard');

    // Close + reopen
    rerender(<ProgressCaptureModal {...baseProps} isOpen={false} />);
    rerender(<ProgressCaptureModal {...baseProps} isOpen={true} />);

    expect(screen.getByTestId('pm-quick-ontime').className).toMatch(/is-active/);
    expect(screen.getByTestId('pm-status').dataset.pmStatus).toBe('ontime');
  });
});
