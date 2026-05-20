import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DebounceStatusBar } from './DebounceStatusBar';

describe('DebounceStatusBar', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<DebounceStatusBar state={{ kind: 'idle' }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders saving state', () => {
    const { getByTestId } = render(<DebounceStatusBar state={{ kind: 'pending-save' }} />);
    expect(getByTestId('mobile-debounce-bar').textContent).toContain('Enregistrement');
  });

  it('renders saved state', () => {
    const { getByTestId } = render(<DebounceStatusBar state={{ kind: 'saved' }} />);
    expect(getByTestId('mobile-debounce-bar').textContent).toContain('Enregistré');
  });

  it('renders replan countdown', () => {
    const { getByTestId } = render(
      <DebounceStatusBar state={{ kind: 'pending-replan', countdown: 42 }} />,
    );
    expect(getByTestId('mobile-debounce-bar').textContent).toContain('42s');
  });

  it('renders replanned state', () => {
    const { getByTestId } = render(<DebounceStatusBar state={{ kind: 'replanned' }} />);
    expect(getByTestId('mobile-debounce-bar').textContent).toContain('recalculé');
  });
});
