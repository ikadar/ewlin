/**
 * Unit tests for STCell component.
 *
 * @see docs/releases/v0.5.23-st-column-frontend.md
 * @see docs/production-flow-dashboard-spec/upgrade-colonne-st-en.md §4–5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { STCell } from './STCell';
import type { FluxOutsourcingTask } from './fluxTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<FluxOutsourcingTask> = {}): FluxOutsourcingTask {
  return {
    taskId:       'task-001',
    actionType:   'Vernis UV sélectif',
    providerName: 'Faco 37',
    status:       'pending',
    ...overrides,
  };
}

// ── Empty array ──────────────────────────────────────────────────────────────

describe('STCell — empty tasks', () => {
  it('renders nothing when tasks array is empty', () => {
    const { container } = render(
      <STCell tasks={[]} onUpdateSTStatus={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── Rendering by status ──────────────────────────────────────────────────────

describe('STCell — status rendering', () => {
  it('renders pending state with correct label', () => {
    const task = makeTask({ status: 'pending' });
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    const toggle = screen.getByTestId('st-toggle-task-001');
    expect(toggle).toHaveAttribute('data-status', 'pending');
    expect(toggle).toHaveAttribute('aria-label', 'Faco 37 · Vernis UV sélectif: pending');
  });

  it('renders progress state with correct data-status', () => {
    const task = makeTask({ status: 'progress' });
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    const toggle = screen.getByTestId('st-toggle-task-001');
    expect(toggle).toHaveAttribute('data-status', 'progress');
  });

  it('renders done state with correct data-status', () => {
    const task = makeTask({ status: 'done' });
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    const toggle = screen.getByTestId('st-toggle-task-001');
    expect(toggle).toHaveAttribute('data-status', 'done');
  });

  it('shows "ProviderName · ActionType" label', () => {
    const task = makeTask({ providerName: 'SIPAP', actionType: 'Pelliculage mat' });
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    expect(screen.getByText('SIPAP · Pelliculage mat')).toBeInTheDocument();
  });
});

// ── Read-only status indicator (clickability removed) ───────────────────────

describe('STCell — read-only status indicator', () => {
  it('clicking the status indicator does not trigger onUpdateSTStatus', () => {
    const onUpdate = vi.fn();
    const task = makeTask({ status: 'pending' });
    render(<STCell tasks={[task]} onUpdateSTStatus={onUpdate} />);

    fireEvent.click(screen.getByTestId('st-toggle-task-001'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders a non-button element so accessibility tree treats it as static', () => {
    const task = makeTask({ status: 'progress' });
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    const indicator = screen.getByTestId('st-toggle-task-001');
    expect(indicator.tagName).toBe('SPAN');
  });
});

// ── Multiple tasks ───────────────────────────────────────────────────────────

describe('STCell — multiple tasks', () => {
  it('renders each task independently', () => {
    const tasks: FluxOutsourcingTask[] = [
      { taskId: 't1', actionType: 'Vernis UV', providerName: 'Faco 37', status: 'pending' },
      { taskId: 't2', actionType: 'Pelliculage mat', providerName: 'SIPAP', status: 'done' },
    ];
    render(<STCell tasks={tasks} onUpdateSTStatus={vi.fn()} />);

    expect(screen.getByTestId('st-toggle-t1')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('st-toggle-t2')).toHaveAttribute('data-status', 'done');
    expect(screen.getByText('Faco 37 · Vernis UV')).toBeInTheDocument();
    expect(screen.getByText('SIPAP · Pelliculage mat')).toBeInTheDocument();
  });

  it('clicks on multi-task cells remain no-ops', () => {
    const onUpdate = vi.fn();
    const tasks: FluxOutsourcingTask[] = [
      { taskId: 't1', actionType: 'Vernis UV', providerName: 'Faco 37', status: 'pending' },
      { taskId: 't2', actionType: 'Pelliculage mat', providerName: 'SIPAP', status: 'progress' },
    ];
    render(<STCell tasks={tasks} onUpdateSTStatus={onUpdate} />);

    fireEvent.click(screen.getByTestId('st-toggle-t1'));
    fireEvent.click(screen.getByTestId('st-toggle-t2'));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

// ── st-cell container ────────────────────────────────────────────────────────

describe('STCell — container', () => {
  it('renders with data-testid st-cell when tasks present', () => {
    const task = makeTask();
    render(<STCell tasks={[task]} onUpdateSTStatus={vi.fn()} />);

    expect(screen.getByTestId('st-cell')).toBeInTheDocument();
  });
});
