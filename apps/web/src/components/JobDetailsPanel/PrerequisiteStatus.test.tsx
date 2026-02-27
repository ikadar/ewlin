import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrerequisiteStatus } from './PrerequisiteStatus';

describe('PrerequisiteStatus', () => {
  it('renders nothing when all statuses are none and no handlers', () => {
    const { container } = render(
      <PrerequisiteStatus
        paperStatus="none"
        batStatus="none"
        plateStatus="none"
        formeStatus="none"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dropdowns when statuses are set', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
      />
    );
    expect(screen.getByTestId('prerequisite-status')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-paper-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-bat-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-plate-dropdown')).toBeInTheDocument();
  });

  it('shows assembly message when isAssembly is true', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
        isAssembly
      />
    );
    expect(screen.getByTestId('prerequisite-assembly')).toBeInTheDocument();
    expect(screen.getByText('(pas de prérequis)')).toBeInTheDocument();
  });

  it('hides plates dropdown when hasOffset is false', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
        hasOffset={false}
      />
    );
    expect(screen.getByTestId('prerequisite-paper-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-bat-dropdown')).toBeInTheDocument();
    expect(screen.queryByTestId('prerequisite-plate-dropdown')).not.toBeInTheDocument();
  });

  it('shows forme dropdown when hasDieCutting is true', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="in_stock"
        hasDieCutting={true}
      />
    );
    expect(screen.getByTestId('prerequisite-forme-dropdown')).toBeInTheDocument();
    expect(screen.getByTitle('Sur stock')).toBeInTheDocument();
  });

  it('hides forme dropdown when hasDieCutting is false', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="in_stock"
        hasDieCutting={false}
      />
    );
    expect(screen.queryByTestId('prerequisite-forme-dropdown')).not.toBeInTheDocument();
  });

  it('displays current status labels in pill tooltips', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
      />
    );
    expect(screen.getByTitle('En stock')).toBeInTheDocument();
    expect(screen.getByTitle('BAT OK')).toBeInTheDocument();
    expect(screen.getByTitle('Prêtes')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
      />
    );

    // Click paper dropdown
    fireEvent.click(screen.getByTestId('prerequisite-paper-dropdown'));
    expect(screen.getByTestId('prerequisite-paper-options')).toBeInTheDocument();

    // Should show all paper options
    expect(screen.getByText('À commander')).toBeInTheDocument();
    expect(screen.getByText('Commandé')).toBeInTheDocument();
    expect(screen.getByText('Livré')).toBeInTheDocument();
  });

  it('calls onChange when option is selected', () => {
    const onPaperChange = vi.fn();
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
        onPaperStatusChange={onPaperChange}
      />
    );

    // Open dropdown and select option
    fireEvent.click(screen.getByTestId('prerequisite-paper-dropdown'));
    fireEvent.click(screen.getByTestId('prerequisite-paper-option-to_order'));

    expect(onPaperChange).toHaveBeenCalledWith('to_order');
  });

  it('closes dropdown after selection', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
        onPaperStatusChange={() => {}}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('prerequisite-paper-dropdown'));
    expect(screen.getByTestId('prerequisite-paper-options')).toBeInTheDocument();

    // Select option
    fireEvent.click(screen.getByTestId('prerequisite-paper-option-ordered'));

    // Dropdown should close
    expect(screen.queryByTestId('prerequisite-paper-options')).not.toBeInTheDocument();
  });

  it('shows correct colors for blocking status', () => {
    render(
      <PrerequisiteStatus
        paperStatus="to_order"
        batStatus="waiting_files"
        plateStatus="to_make"
        formeStatus="none"
      />
    );

    expect(screen.getByText('Papier')).toHaveClass('text-red-500');
    expect(screen.getByText('BAT')).toHaveClass('text-red-500');
  });

  it('shows correct colors for ready status', () => {
    render(
      <PrerequisiteStatus
        paperStatus="in_stock"
        batStatus="bat_approved"
        plateStatus="ready"
        formeStatus="none"
      />
    );

    expect(screen.getByText('Papier')).toHaveClass('text-emerald-500');
    expect(screen.getByText('BAT')).toHaveClass('text-emerald-500');
    expect(screen.getByText('Plaques')).toHaveClass('text-emerald-500');
  });

  it('shows correct colors for pending status', () => {
    render(
      <PrerequisiteStatus
        paperStatus="ordered"
        batStatus="bat_sent"
        plateStatus="to_make"
        formeStatus="none"
      />
    );

    expect(screen.getByText('Papier')).toHaveClass('text-amber-500');
    expect(screen.getByText('BAT')).toHaveClass('text-amber-500');
    expect(screen.getByText('Plaques')).toHaveClass('text-amber-500');
  });
});
