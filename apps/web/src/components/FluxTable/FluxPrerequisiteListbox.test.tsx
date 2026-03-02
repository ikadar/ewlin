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
  const { jobId = 'j1', elementId = 'e1', column = 'bat', status = 'OK' } = props;
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
    renderListbox({ status: 'OK' });
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
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
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByTestId('flux-prereq-dropdown')).toBeInTheDocument();
  });

  it('renders all BAT options in the dropdown', () => {
    renderListbox(
      { column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByText('n.a.')).toBeInTheDocument();
    expect(screen.getByText('Att.fich')).toBeInTheDocument();
    expect(screen.getByText('Recus')).toBeInTheDocument();
    expect(screen.getByText('Envoye')).toBeInTheDocument();
    // 'OK' appears in both badge and option
    const okElements = screen.getAllByText('OK');
    expect(okElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all Papier options', () => {
    renderListbox(
      { column: 'papier', status: 'Stock' },
      { openListboxId: 'j1-e1-papier' },
    );
    // 'Stock' appears in both trigger badge and dropdown option
    expect(screen.getAllByText('Stock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('A cder')).toBeInTheDocument();
    expect(screen.getByText('Cde')).toBeInTheDocument();
    expect(screen.getByText('Livre')).toBeInTheDocument();
  });

  it('renders all Formes options', () => {
    renderListbox(
      { column: 'formes', status: 'n.a.' },
      { openListboxId: 'j1-e1-formes' },
    );
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('A cder')).toBeInTheDocument();
    expect(screen.getByText('Cdee')).toBeInTheDocument();
    expect(screen.getByText('Livree')).toBeInTheDocument();
  });

  it('renders all Plaques options', () => {
    renderListbox(
      { column: 'plaques', status: 'A faire' },
      { openListboxId: 'j1-e1-plaques' },
    );
    // 'A faire' appears in both trigger badge and dropdown option — use getAllByText
    expect(screen.getAllByText('A faire').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pretes')).toBeInTheDocument();
  });

  it('clicking an option calls onUpdatePrerequisite with correct args', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    // Click the 'Envoye' option
    const options = screen.getAllByTestId('flux-prereq-option');
    const envoyeOption = options.find(o => o.getAttribute('data-option') === 'Envoye');
    expect(envoyeOption).toBeDefined();
    fireEvent.click(envoyeOption!);
    expect(ctx.onUpdatePrerequisite).toHaveBeenCalledWith('j1', 'e1', 'bat', 'Envoye');
  });

  it('clicking an option calls setOpenListboxId(null) to close', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    fireEvent.click(options[0]!);
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });

  it('selected option has aria-selected=true', () => {
    renderListbox(
      { column: 'bat', status: 'Recus' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    const recusOption = options.find(o => o.getAttribute('data-option') === 'Recus');
    expect(recusOption).toHaveAttribute('aria-selected', 'true');
  });

  it('non-selected options have aria-selected=false', () => {
    renderListbox(
      { column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    const options = screen.getAllByTestId('flux-prereq-option');
    const envoyeOption = options.find(o => o.getAttribute('data-option') === 'Envoye');
    expect(envoyeOption).toHaveAttribute('aria-selected', 'false');
  });

  it('trigger has aria-haspopup=listbox', () => {
    renderListbox();
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('trigger has aria-expanded=false when closed', () => {
    renderListbox({ status: 'OK' }, { openListboxId: null });
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('trigger has aria-expanded=true when open', () => {
    renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByTestId('flux-prereq-listbox-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('dropdown has role=listbox', () => {
    renderListbox(
      { column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Escape key on open trigger calls setOpenListboxId(null)', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    const dropdown = screen.getByTestId('flux-prereq-dropdown');
    fireEvent.keyDown(dropdown, { key: 'Escape' });
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });

  it('clicking trigger when open calls setOpenListboxId(null)', () => {
    const ctx = renderListbox(
      { jobId: 'j1', elementId: 'e1', column: 'bat', status: 'OK' },
      { openListboxId: 'j1-e1-bat' },
    );
    fireEvent.click(screen.getByTestId('flux-prereq-listbox-trigger'));
    expect(ctx.setOpenListboxId).toHaveBeenCalledWith(null);
  });
});
