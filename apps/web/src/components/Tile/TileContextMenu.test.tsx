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

describe('TileContextMenu — mode-gated rendering', () => {
  it('Préprod : shows planning items (Voir / Pin / Définir / Rappeler / Diviser / Fusionner)', () => {
    render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onDefinirDebut={vi.fn()}
        onRecall={vi.fn()}
        onSplit={vi.fn()}
        onFuse={vi.fn()}
        isSplit={true}
        onSaisirAvancement={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-toggle-pin')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-definir-debut')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-recall')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-split')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-fuse')).toBeInTheDocument();

    // Capture-only items hidden in préprod even when callbacks are provided
    expect(screen.queryByTestId('context-menu-saisir-avancement')).toBeNull();
    expect(screen.queryByTestId('context-menu-toggle-complete')).toBeNull();
  });

  it('Prod : shows capture items (Voir / Saisir / Marquer terminé)', () => {
    render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="prod"
        onDefinirDebut={vi.fn()}
        onRecall={vi.fn()}
        onSplit={vi.fn()}
        onFuse={vi.fn()}
        isSplit={true}
        onSaisirAvancement={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-saisir-avancement')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-toggle-complete')).toBeInTheDocument();

    // Planning items hidden in prod even when callbacks are provided
    expect(screen.queryByTestId('context-menu-toggle-pin')).toBeNull();
    expect(screen.queryByTestId('context-menu-definir-debut')).toBeNull();
    expect(screen.queryByTestId('context-menu-recall')).toBeNull();
    expect(screen.queryByTestId('context-menu-split')).toBeNull();
    expect(screen.queryByTestId('context-menu-fuse')).toBeNull();
  });

  it('Préprod : hides items whose callbacks are not provided', () => {
    render(<TileContextMenu {...baseProps} scenarioMode="preprod" />);
    // baseProps only has onTogglePin + onViewDetails
    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.getByTestId('context-menu-toggle-pin')).toBeInTheDocument();
    expect(screen.queryByTestId('context-menu-definir-debut')).toBeNull();
    expect(screen.queryByTestId('context-menu-recall')).toBeNull();
    expect(screen.queryByTestId('context-menu-split')).toBeNull();
  });

  it('Prod : hides items whose callbacks are not provided', () => {
    render(<TileContextMenu {...baseProps} scenarioMode="prod" />);
    expect(screen.getByTestId('context-menu-view-details')).toBeInTheDocument();
    expect(screen.queryByTestId('context-menu-saisir-avancement')).toBeNull();
    expect(screen.queryByTestId('context-menu-toggle-complete')).toBeNull();
  });

  it('Préprod : Diviser hidden when task is completed even with callback + mode', () => {
    render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="preprod"
        isCompleted={true}
        onSplit={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('context-menu-split')).toBeNull();
  });

  it('Préprod : Fusionner shown only when isSplit + onFuse', () => {
    const { rerender } = render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onFuse={vi.fn()}
        isSplit={false}
      />,
    );
    expect(screen.queryByTestId('context-menu-fuse')).toBeNull();

    rerender(
      <TileContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onFuse={vi.fn()}
        isSplit={true}
      />,
    );
    expect(screen.getByTestId('context-menu-fuse')).toBeInTheDocument();
  });

  it('fires onSaisirAvancement in prod and closes the menu', () => {
    const onSaisirAvancement = vi.fn();
    const onClose = vi.fn();
    render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="prod"
        onClose={onClose}
        onSaisirAvancement={onSaisirAvancement}
      />,
    );
    fireEvent.click(screen.getByTestId('context-menu-saisir-avancement'));
    expect(onSaisirAvancement).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onDefinirDebut in préprod and closes the menu', () => {
    const onDefinirDebut = vi.fn();
    const onClose = vi.fn();
    render(
      <TileContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onClose={onClose}
        onDefinirDebut={onDefinirDebut}
      />,
    );
    fireEvent.click(screen.getByTestId('context-menu-definir-debut'));
    expect(onDefinirDebut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
