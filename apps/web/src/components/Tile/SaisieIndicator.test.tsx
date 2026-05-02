/**
 * Tests for SaisieIndicator — the V2 progress-capture indicator on tiles.
 *
 *   - mock useScenarioMode to drive prod / preprod gating
 *   - assert visibility via testid
 *   - assert state transitions via data-saisie-state attribute
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SaisieIndicator } from './SaisieIndicator';
import type { SaisieState } from './SaisieIndicator';

let currentMode: 'preprod' | 'prod' = 'preprod';
const setMode = vi.fn();
vi.mock('../../contexts/ScenarioContext', () => ({
  useScenarioMode: () => ({ mode: currentMode, setMode, isReadOnly: currentMode === 'prod' }),
}));

function renderIndicator(props: { state: SaisieState; onClick: () => void }) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<SaisieIndicator {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SaisieIndicator', () => {
  beforeEach(() => {
    setMode.mockClear();
  });

  it('renders nothing in préprod (icon hidden entirely)', () => {
    currentMode = 'preprod';
    renderIndicator({ state: 'inactive', onClick: () => {} });
    expect(screen.queryByTestId('tile-saisie-indicator')).toBeNull();
  });

  it('renders in prod mode', () => {
    currentMode = 'prod';
    renderIndicator({ state: 'inactive', onClick: () => {} });
    expect(screen.getByTestId('tile-saisie-indicator')).toBeInTheDocument();
  });

  it('exposes the current state via data-saisie-state', () => {
    currentMode = 'prod';
    const { rerender } = renderIndicator({ state: 'inactive', onClick: () => {} });
    expect(screen.getByTestId('tile-saisie-indicator').getAttribute('data-saisie-state')).toBe('inactive');

    const noop = () => {};
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SaisieIndicator state="hourly" onClick={noop} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tile-saisie-indicator').getAttribute('data-saisie-state')).toBe('hourly');

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SaisieIndicator state="tile-end" onClick={noop} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tile-saisie-indicator').getAttribute('data-saisie-state')).toBe('tile-end');
  });

  it('applies the pulse animation only on tile-end state', () => {
    currentMode = 'prod';
    const noop = () => {};
    const { rerender } = renderIndicator({ state: 'inactive', onClick: noop });
    expect(screen.getByTestId('tile-saisie-indicator').className).not.toMatch(/animate-saisie-pulse/);

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SaisieIndicator state="tile-end" onClick={noop} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tile-saisie-indicator').className).toMatch(/animate-saisie-pulse/);
  });

  it('fires onClick when the operator clicks the indicator', () => {
    currentMode = 'prod';
    const onClick = vi.fn();
    renderIndicator({ state: 'inactive', onClick });
    fireEvent.click(screen.getByTestId('tile-saisie-indicator'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops click propagation so the underlying tile is not selected', () => {
    currentMode = 'prod';
    const onClick = vi.fn();
    const onTileClick = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <div onClick={onTileClick} data-testid="parent-tile">
                <SaisieIndicator state="hourly" onClick={onClick} />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tile-saisie-indicator'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).not.toHaveBeenCalled();
  });
});
