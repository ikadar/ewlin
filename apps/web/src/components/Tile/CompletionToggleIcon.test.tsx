import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CompletionToggleIcon } from './CompletionToggleIcon';

// Mock the scenario context and the mutation hook so we can assert the
// dual-write call semantics without going through Redux/RTK Query.
const mockToggleProdCompletion = vi.fn(() => ({
  unwrap: () => Promise.resolve({ taskId: 't1', isCompleted: true, completedAt: '2026-04-29T14:32:00+02:00' }),
}));

vi.mock('../../store', () => ({
  useToggleProdCompletionMutation: () => [mockToggleProdCompletion, { isLoading: false }],
}));

const setMode = vi.fn();
let currentMode: 'preprod' | 'prod' = 'preprod';
vi.mock('../../contexts/ScenarioContext', () => ({
  useScenarioMode: () => ({ mode: currentMode, setMode, isReadOnly: currentMode === 'prod' }),
}));

function renderIcon(props: { taskId: string; isCompleted: boolean }) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CompletionToggleIcon {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompletionToggleIcon', () => {
  beforeEach(() => {
    mockToggleProdCompletion.mockClear();
    setMode.mockClear();
  });

  it('is non-interactive in préprod (pointer-events:none)', () => {
    currentMode = 'preprod';
    renderIcon({ taskId: 't1', isCompleted: false });
    const toggle = screen.getByTestId('tile-completion-toggle');
    expect(toggle.className).toMatch(/pointer-events-none/);
    expect(toggle.getAttribute('data-mode')).toBe('preprod');
  });

  it('is interactive in prod (cursor pointer + clickable)', () => {
    currentMode = 'prod';
    renderIcon({ taskId: 't1', isCompleted: false });
    const toggle = screen.getByTestId('tile-completion-toggle');
    expect(toggle.className).toMatch(/cursor-pointer/);
    expect(toggle.className).toMatch(/pointer-events-auto/);
    expect(toggle.getAttribute('data-mode')).toBe('prod');
  });

  it('does NOT call the mutation on click in préprod', () => {
    currentMode = 'preprod';
    renderIcon({ taskId: 't1', isCompleted: false });
    fireEvent.click(screen.getByTestId('tile-completion-toggle'));
    expect(mockToggleProdCompletion).not.toHaveBeenCalled();
  });

  it('calls the mutation with the taskId on click in prod', () => {
    currentMode = 'prod';
    renderIcon({ taskId: 't1', isCompleted: false });
    fireEvent.click(screen.getByTestId('tile-completion-toggle'));
    expect(mockToggleProdCompletion).toHaveBeenCalledTimes(1);
    expect(mockToggleProdCompletion).toHaveBeenCalledWith('t1');
  });

  it('reflects the completion state via data-completed', () => {
    currentMode = 'preprod';
    const { rerender } = renderIcon({ taskId: 't1', isCompleted: false });
    expect(screen.getByTestId('tile-completion-toggle').getAttribute('data-completed')).toBe('false');

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<CompletionToggleIcon taskId="t1" isCompleted={true} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tile-completion-toggle').getAttribute('data-completed')).toBe('true');
  });
});
