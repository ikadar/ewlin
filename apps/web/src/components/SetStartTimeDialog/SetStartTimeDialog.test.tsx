import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetStartTimeDialog } from './SetStartTimeDialog';

const mockPreview = vi.fn(() => ({}));
const mockPin = vi.fn(() => ({ unwrap: () => Promise.resolve({ taskId: 't1', scheduledStart: '2026-05-01T10:00:00', isPinned: true }) }));

vi.mock('../../store', () => ({
  useFeasibilityPreviewMutation: () => [mockPreview, { data: undefined, isLoading: false }],
  usePinAtTimeMutation: () => [mockPin, { isLoading: false }],
}));

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  taskId: 't-1',
  job: { reference: 'J-1247', client: 'ACME' },
  currentScheduledStart: '2026-05-01T09:30:00',
};

describe('SetStartTimeDialog', () => {
  beforeEach(() => {
    mockPreview.mockClear();
    mockPin.mockClear();
  });

  it('renders when isOpen is true', () => {
    render(<SetStartTimeDialog {...baseProps} />);
    expect(screen.getByTestId('set-start-time-dialog')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    render(<SetStartTimeDialog {...baseProps} isOpen={false} />);
    expect(screen.queryByTestId('set-start-time-dialog')).toBeNull();
  });

  it('shows the dialog title and tile context', () => {
    render(<SetStartTimeDialog {...baseProps} />);
    expect(screen.getByText('Définir heure de début')).toBeInTheDocument();
    expect(screen.getByText('J-1247 · ACME')).toBeInTheDocument();
  });

  it('renders the compact calendar and time stepper', () => {
    render(<SetStartTimeDialog {...baseProps} />);
    expect(screen.getByTestId('compact-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('pm-custom-input')).toBeInTheDocument();
  });

  it('renders the feasibility preview (defaults to feasible until first response)', () => {
    render(<SetStartTimeDialog {...baseProps} />);
    expect(screen.getByTestId('feas-preview')).toBeInTheDocument();
    // Defaulted to 'feasible' since no result yet
    expect(screen.getByTestId('feas-preview').dataset.feasState).toBe('feasible');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('sd-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('sd-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-start-time-dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog body', () => {
    const onClose = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Jour cible'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls pinAtTime with task + target ISO on confirm', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} onSaved={onSaved} />);
    fireEvent.click(screen.getByTestId('sd-confirm-btn'));
    await waitFor(() => {
      expect(mockPin).toHaveBeenCalledTimes(1);
    });
    const arg = mockPin.mock.calls[0][0];
    expect(arg.taskId).toBe('t-1');
    expect(typeof arg.targetDateTime).toBe('string');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SetStartTimeDialog {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
