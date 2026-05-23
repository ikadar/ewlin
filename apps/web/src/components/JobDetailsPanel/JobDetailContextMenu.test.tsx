import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobDetailContextMenu } from './JobDetailContextMenu';

const baseProps = {
  x: 100,
  y: 100,
  isCompleted: false,
  isPinned: false,
  onTogglePin: vi.fn(),
  onToggleComplete: vi.fn(),
  onRecall: vi.fn(),
  onClose: vi.fn(),
};

describe('JobDetailContextMenu — mode-gated rendering', () => {
  it('Préprod : shows planning items (Pin / Définir / Rappeler / Diviser / Fusionner)', () => {
    render(
      <JobDetailContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onSaisirAvancement={vi.fn()}
        onDefinirDebut={vi.fn()}
        onSplit={vi.fn()}
        onFuse={vi.fn()}
        isSplit={true}
      />,
    );

    expect(screen.getByTestId('job-detail-context-toggle-pin')).toBeInTheDocument();
    expect(screen.getByTestId('job-detail-context-definir-debut')).toBeInTheDocument();
    expect(screen.getByTestId('job-detail-context-recall')).toBeInTheDocument();
    expect(screen.getByTestId('job-detail-context-split')).toBeInTheDocument();
    expect(screen.getByTestId('job-detail-context-fuse')).toBeInTheDocument();

    expect(screen.queryByTestId('job-detail-context-saisir-avancement')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-toggle-complete')).toBeNull();
  });

  it('Prod : shows capture items (Saisir / Marquer terminée)', () => {
    render(
      <JobDetailContextMenu
        {...baseProps}
        scenarioMode="prod"
        onSaisirAvancement={vi.fn()}
        onDefinirDebut={vi.fn()}
        onSplit={vi.fn()}
        onFuse={vi.fn()}
        isSplit={true}
      />,
    );

    expect(screen.getByTestId('job-detail-context-saisir-avancement')).toBeInTheDocument();
    expect(screen.getByTestId('job-detail-context-toggle-complete')).toBeInTheDocument();

    expect(screen.queryByTestId('job-detail-context-toggle-pin')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-definir-debut')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-recall')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-split')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-fuse')).toBeNull();
  });

  it('isUnassigned : hides recall/completion/pin even with mode + callbacks', () => {
    render(
      <JobDetailContextMenu
        {...baseProps}
        scenarioMode="preprod"
        isUnassigned={true}
        onSaisirAvancement={vi.fn()}
        onDefinirDebut={vi.fn()}
        onSplit={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('job-detail-context-toggle-pin')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-recall')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-toggle-complete')).toBeNull();
    expect(screen.queryByTestId('job-detail-context-definir-debut')).toBeNull();
    // Diviser stays available for unassigned tasks (planning operation on the task itself)
    expect(screen.getByTestId('job-detail-context-split')).toBeInTheDocument();
  });

  it('Saisir fires its callback and closes', () => {
    const onSaisirAvancement = vi.fn();
    const onClose = vi.fn();
    render(
      <JobDetailContextMenu
        {...baseProps}
        scenarioMode="prod"
        onClose={onClose}
        onSaisirAvancement={onSaisirAvancement}
      />,
    );
    fireEvent.click(screen.getByTestId('job-detail-context-saisir-avancement'));
    expect(onSaisirAvancement).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Définir fires its callback and closes', () => {
    const onDefinirDebut = vi.fn();
    const onClose = vi.fn();
    render(
      <JobDetailContextMenu
        {...baseProps}
        scenarioMode="preprod"
        onClose={onClose}
        onDefinirDebut={onDefinirDebut}
      />,
    );
    fireEvent.click(screen.getByTestId('job-detail-context-definir-debut'));
    expect(onDefinirDebut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
