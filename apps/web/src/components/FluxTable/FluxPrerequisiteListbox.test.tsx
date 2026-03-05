import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxPrerequisiteListbox } from './FluxPrerequisiteListbox';
import { FluxTableContext } from './FluxTableContext';
import type { FluxTableContextValue } from './FluxTableContext';

/** Build a minimal FluxTableContextValue for testing. */
function makeCtx(overrides?: Partial<FluxTableContextValue>): FluxTableContextValue {
  return {
    openListboxId: null,
    setOpenListboxId: vi.fn(),
    onUpdatePrerequisite: vi.fn(),
    onToggleExpand: vi.fn(),
    onDeleteJob: vi.fn(),
    onEditJob: vi.fn(),
    expandedJobIds: new Set(),
    ...overrides,
  };
}

function renderListbox(
  props: {
    jobId?: string;
    elementId?: string;
    column?: Parameters<typeof FluxPrerequisiteListbox>[0]['column'];
    status?: Parameters<typeof FluxPrerequisiteListbox>[0]['status'];
  } = {},
  ctxOverrides?: Partial<FluxTableContextValue>,
) {
  const { jobId = 'j1', elementId = 'e1', column = 'bat', status = 'bat_approved' } = props;
  const ctx = makeCtx(ctxOverrides);

  render(
    <FluxTableContext.Provider value={ctx}>
      <FluxPrerequisiteListbox
        jobId={jobId}
        elementId={elementId}
        column={column}
        status={status}
      />
    </FluxTableContext.Provider>,
  );

  return ctx;
}

describe('FluxPrerequisiteListbox', () => {
  it('renders the trigger with the current status badge', () => {
    renderListbox({ status: 'bat_approved' });
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toBeInTheDocument();
    // badge label for bat_approved is 'BAT OK'
    expect(screen.getByText('BAT OK')).toBeInTheDocument();
  });

  it('does not show dropdown when closed', () => {
    renderListbox();
    expect(screen.queryByTestId('flux-prereq-dropdown')).not.toBeInTheDocument();
  });

  it('clicking trigger calls setOpenListboxId with the listbox ID', () => {
    const ctx = renderListbox({ jobId: 'j1', elementId: 'e1', column: 'bat' });
    fireEvent.click(screen.getByTestId('flux-prereq-listbox-trigger'));
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith('j1-e1-bat');
  });

  it('shows dropdown when openListboxId matches', () => {
    renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByTestId('flux-prereq-dropdown')).toBeInTheDocument();
  });

  it('renders all BAT options in the dropdown', () => {
    renderListbox(
      { column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByText('Pas de BAT')).toBeInTheDocument();
    expect(screen.getByText('Attente fichiers')).toBeInTheDocument();
    expect(screen.getByText('Fichiers reçus')).toBeInTheDocument();
    expect(screen.getByText('BAT envoyé')).toBeInTheDocument();
    // 'BAT OK' appears in both trigger badge and dropdown option
    const batOkElements = screen.getAllByText('BAT OK');
    expect(batOkElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all Papier options', () => {
    renderListbox(
      { column: 'papier', status: 'in_stock' },
      { openListboxId: 'j1-e1-papier' },
    );
    expect(screen.getByText('Pas de papier')).toBeInTheDocument();
    expect(screen.getByText('En stock')).toBeInTheDocument();
    expect(screen.getByText('À commander')).toBeInTheDocument();
    expect(screen.getByText('Commandé')).toBeInTheDocument();
    expect(screen.getByText('Livré')).toBeInTheDocument();
  });

  it('renders all Formes options', () => {
    renderListbox(
      { column: 'formes', status: 'none' },
      { openListboxId: 'j1-e1-formes' },
    );
    expect(screen.getByText('Pas de forme')).toBeInTheDocument();
    expect(screen.getByText('Sur stock')).toBeInTheDocument();
    // 'À commander' appears in both papier and formes; at least one instance
    expect(screen.getAllByText('À commander').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Commandée')).toBeInTheDocument();
    expect(screen.getByText('Livrée')).toBeInTheDocument();
  });

  it('renders all Plaques options', () => {
    renderListbox(
      { column: 'plaques', status: 'to_make' },
      { openListboxId: 'j1-e1-plaques' },
    );
    expect(screen.getByText('Pas de plaques')).toBeInTheDocument();
    // dropdown option label 'À faire' (with accent)
    expect(screen.getByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('Prêtes')).toBeInTheDocument();
  });

  it('clicking an option calls onUpdatePrerequisite with correct args', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    // Click the 'bat_sent' option (data-option="bat_sent")
    const options = screen.getAllByTestId('flux-prereq-option');
    const batSentOption = options.find(o => o.getAttribute('data-option') === 'bat_sent');
    expect(batSentOption).toBeDefined();
    fireEvent.click(batSentOption!);
    expect(ctx.onUpdatePrerequisite).toHaveBeenCalledWith('j1', 'e1', 'bat', 'bat_sent');
  });

  it('clicking an option calls setOpenListboxId(null) to close', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    fireEvent.click(options[0]!);
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });

  it('selected option has aria-selected=true', () => {
    renderListbox(
      { column: 'bat', status: 'files_received' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    const selectedOption = options.find(o => o.getAttribute('data-option') === 'files_received');
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
  });

  it('non-selected options have aria-selected=false', () => {
    renderListbox(
      { column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    const batSentOption = options.find(o => o.getAttribute('data-option') === 'bat_sent');
    expect(batSentOption).toHaveAttribute('aria-selected', 'false');
  });

  it('trigger has aria-haspopup=listbox', () => {
    renderListbox();
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('trigger has aria-expanded=false when closed', () => {
    renderListbox({ status: 'bat_approved' }, { openListboxId: null });
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('trigger has aria-expanded=true when open', () => {
    renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('dropdown has role=listbox', () => {
    renderListbox(
      { column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Escape key on open trigger calls setOpenListboxId(null)', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    const dropdown = screen.getByTestId('flux-prereq-dropdown');
    fireEvent.keyDown(dropdown, { key: 'Escape' });
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });

  it('clicking trigger when open calls setOpenListboxId(null)', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'bat_approved' },
      { openListboxId: 'j1-e1-bat' },
    );
    fireEvent.click(screen.getByTestId('flux-prereq-listbox-trigger'));
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });
});
