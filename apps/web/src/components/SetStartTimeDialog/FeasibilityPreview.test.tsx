import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeasibilityPreview } from './FeasibilityPreview';

describe('FeasibilityPreview', () => {
  it('renders the loading state when isLoading is true', () => {
    render(
      <FeasibilityPreview isLoading feasible={false} resolvedIso="2026-05-01T12:00:00" />,
    );
    expect(screen.getByTestId('feas-preview').dataset.feasState).toBe('loading');
    expect(screen.getByTestId('feas-preview').textContent).toContain('Vérification');
  });

  it('renders the feasible state with the resolved datetime', () => {
    render(<FeasibilityPreview feasible resolvedIso="2026-05-01T12:00:00" />);
    const preview = screen.getByTestId('feas-preview');
    expect(preview.dataset.feasState).toBe('feasible');
    expect(preview.textContent).toContain('Créneau disponible');
    expect(preview.textContent).toContain('vendredi 1 mai');
    expect(preview.textContent).toContain('12h');
  });

  it('renders the glided state with the resolved datetime', () => {
    render(<FeasibilityPreview feasible={false} resolvedIso="2026-05-04T08:00:00" />);
    const preview = screen.getByTestId('feas-preview');
    expect(preview.dataset.feasState).toBe('glided');
    expect(preview.textContent).toContain('Sera glissé');
    expect(preview.textContent).toContain('lundi 4 mai');
    expect(preview.textContent).toContain('8h');
  });

  it('formats hours without trailing 00 and minutes with padding', () => {
    render(<FeasibilityPreview feasible resolvedIso="2026-05-01T09:30:00" />);
    expect(screen.getByTestId('feas-preview').textContent).toContain('9h30');
  });

  it('omits :00 when minutes are zero', () => {
    render(<FeasibilityPreview feasible resolvedIso="2026-05-01T14:00:00" />);
    const text = screen.getByTestId('feas-preview').textContent ?? '';
    expect(text).toContain('14h');
    expect(text).not.toContain('14h00');
  });
});
