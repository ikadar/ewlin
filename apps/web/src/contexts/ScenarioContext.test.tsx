import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ScenarioProvider, useScenarioMode } from './ScenarioContext';

function Probe() {
  const { mode, setMode, isReadOnly } = useScenarioMode();
  return (
    <div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="readonly">{String(isReadOnly)}</div>
      <button onClick={() => setMode('prod')}>set-prod</button>
      <button onClick={() => setMode('preprod')}>set-preprod</button>
    </div>
  );
}

describe('ScenarioContext', () => {
  it('defaults to preprod when no env query param', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ScenarioProvider><Probe /></ScenarioProvider>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('preprod');
    expect(screen.getByTestId('readonly')).toHaveTextContent('false');
  });

  it('reads env=prod from URL', () => {
    render(
      <MemoryRouter initialEntries={['/?env=prod']}>
        <Routes>
          <Route path="/" element={<ScenarioProvider><Probe /></ScenarioProvider>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('prod');
    expect(screen.getByTestId('readonly')).toHaveTextContent('true');
  });

  it('setMode mutates URL via setMode("prod")', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ScenarioProvider><Probe /></ScenarioProvider>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('set-prod'));
    expect(screen.getByTestId('mode')).toHaveTextContent('prod');
    fireEvent.click(screen.getByText('set-preprod'));
    expect(screen.getByTestId('mode')).toHaveTextContent('preprod');
  });
});
