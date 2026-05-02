import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TileContextMenu } from './TileContextMenu';

const baseProps = {
  x: 100,
  y: 100,
  isCompleted: false,
  isPinned: false,
  onTogglePin: vi.fn(),
  onViewDetails: vi.fn(),
  onClose: vi.fn(),
};

describe('TileContextMenu (V2 — optional items)', () => {
  it('renders only the items whose callbacks are provided', () => {
    render(<TileContextMenu {...baseProps} />);

    // Always-present items
    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-toggle-pin')).toBeInTheDocument();

    // Optional items absent without callbacks
    expect(screen.queryByTestId('context-menu-toggle-complete')).toBeNull();
    expect(screen.queryByTestId('context-menu-recall')).toBeNull();
    expect(screen.queryByTestId('context-menu-saisir-avancement')).toBeNull();
    expect(screen.queryByTestId('context-menu-definir-debut')).toBeNull();
  });

  it('renders the legacy toggle-complete + recall when those callbacks are passed', () => {
    render(
      <TileContextMenu
        {...baseProps}
        onToggleComplete={vi.fn()}
        onRecall={vi.fn()}
      />,
    );
    expect(screen.getByTestId('context-menu-toggle-complete')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-recall')).toBeInTheDocument();
  });

  it('renders Saisir l\'avancement when onSaisirAvancement is provided', () => {
    const onSaisirAvancement = vi.fn();
    render(
      <TileContextMenu {...baseProps} onSaisirAvancement={onSaisirAvancement} />,
    );
    const item = screen.getByTestId('context-menu-saisir-avancement');
    expect(item).toBeInTheDocument();
    expect(item.textContent).toContain('Saisir l\'avancement');
  });

  it('renders Définir heure de début… when onDefinirDebut is provided', () => {
    const onDefinirDebut = vi.fn();
    render(
      <TileContextMenu {...baseProps} onDefinirDebut={onDefinirDebut} />,
    );
    const item = screen.getByTestId('context-menu-definir-debut');
    expect(item).toBeInTheDocument();
    expect(item.textContent).toContain('Définir heure de début');
  });

  it('fires onSaisirAvancement on click and closes the menu', () => {
    const onSaisirAvancement = vi.fn();
    const onClose = vi.fn();
    render(
      <TileContextMenu
        {...baseProps}
        onClose={onClose}
        onSaisirAvancement={onSaisirAvancement}
      />,
    );
    fireEvent.click(screen.getByTestId('context-menu-saisir-avancement'));
    expect(onSaisirAvancement).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onDefinirDebut on click and closes the menu', () => {
    const onDefinirDebut = vi.fn();
    const onClose = vi.fn();
    render(
      <TileContextMenu
        {...baseProps}
        onClose={onClose}
        onDefinirDebut={onDefinirDebut}
      />,
    );
    fireEvent.click(screen.getByTestId('context-menu-definir-debut'));
    expect(onDefinirDebut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('matches the V2 prod menu shape (Voir / Saisir / Pin / Définir, no legacy items)', () => {
    render(
      <TileContextMenu
        {...baseProps}
        onSaisirAvancement={vi.fn()}
        onDefinirDebut={vi.fn()}
      />,
    );
    // Present
    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-saisir-avancement')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-toggle-pin')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-definir-debut')).toBeInTheDocument();
    // Absent
    expect(screen.queryByTestId('context-menu-toggle-complete')).toBeNull();
    expect(screen.queryByTestId('context-menu-recall')).toBeNull();
    expect(screen.queryByTestId('context-menu-split')).toBeNull();
    expect(screen.queryByTestId('context-menu-fuse')).toBeNull();
  });
});
