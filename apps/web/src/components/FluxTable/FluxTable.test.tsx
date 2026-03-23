import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxTable } from './FluxTable';
import type { FluxJob } from './fluxTypes';
import type { StationCategoryResponse } from '@/store/api/stationCategoryApi';

const dummyCategories: StationCategoryResponse[] = [
  { id: 'cat-offset',    name: 'Offset',    abbreviation: 'Off.',  displayOrder: 0, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-cutting',   name: 'Massicot',  abbreviation: 'Mass.', displayOrder: 1, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-pelliculeuse', name: 'Pelliculeuse', abbreviation: 'Pell.', displayOrder: 2, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-typo',      name: 'Typo',      abbreviation: 'Typo',  displayOrder: 3, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-folding',   name: 'Plieuse',   abbreviation: 'Pli.',  displayOrder: 4, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-booklet',   name: 'Enc.-Piqueuse', abbreviation: 'Enc.', displayOrder: 5, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-saddle-stitch', name: 'Ass.-Piqueuse', abbreviation: 'Ass.', displayOrder: 6, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-assembly',  name: 'Assembleuse', abbreviation: 'Assem.', displayOrder: 7, similarityCriteria: [], createdAt: '', updatedAt: '' },
  { id: 'cat-packaging', name: 'Conditionnement', abbreviation: 'Cond.', displayOrder: 8, similarityCriteria: [], createdAt: '', updatedAt: '' },
];

const singleJob: FluxJob = {
  id: '00042',
  client: 'Ducros',
  designation: 'Brochure A4 16p',
  sortie: '28/02',
  elements: [
    {
      id: 'e1',
      label: 'Main',
      bat: 'bat_approved',
      papier: 'in_stock',
      formes: 'none',
      plaques: 'ready',
      stations: {
        'cat-offset': { state: 'done' },
        'cat-cutting': { state: 'done' },
      },
      outsourcing: [],
    },
  ],
  transporteur: 'Chronopost',
  parti: { shipped: true, date: '25/02' },
};

const multiJob: FluxJob = {
  id: '00078',
  client: 'Müller AG',
  designation: 'Étiquettes adhesives 500ex',
  sortie: '05/03',
  elements: [
    {
      id: 'e1', label: 'Ronde', bat: 'bat_approved', papier: 'in_stock', formes: 'in_stock', plaques: 'ready',
      stations: { 'cat-offset': { state: 'late', progress: 60 } },
      outsourcing: [],
    },
    {
      id: 'e2', label: 'Carree', bat: 'bat_sent', papier: 'ordered', formes: 'none', plaques: 'to_make',
      stations: { 'cat-offset': { state: 'in-progress', progress: 40 } },
      outsourcing: [],
    },
    {
      id: 'e3', label: 'Ovale', bat: 'waiting_files', papier: 'to_order', formes: 'to_order', plaques: 'to_make',
      stations: { 'cat-offset': { state: 'planned' } },
      outsourcing: [],
    },
  ],
  transporteur: null,
  parti: { shipped: false, date: null },
};

describe('FluxTable', () => {
  it('renders the table', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByTestId('flux-table')).toBeInTheDocument();
  });

  it('renders all job rows', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob, multiJob]} />);
    const rows = screen.getAllByTestId('flux-table-row');
    expect(rows).toHaveLength(2);
  });

  it('renders rows in the order provided (sorting is done by FluxPage)', () => {
    const job2: FluxJob = { ...singleJob, id: '00010', client: 'AAAA' };
    // FluxTable is a presentational component — it renders jobs in the order given
    render(<FluxTable categories={dummyCategories} jobs={[job2, singleJob]} />);
    const rows = screen.getAllByTestId('flux-table-row');
    expect(rows[0]).toHaveAttribute('data-job-id', '00010');
    expect(rows[1]).toHaveAttribute('data-job-id', '00042');
  });

  it('renders job ID in monospace', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByText('00042')).toBeInTheDocument();
  });

  it('renders client name', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByText('Ducros')).toBeInTheDocument();
  });

  it('renders designation', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByText('Brochure A4 16p')).toBeInTheDocument();
  });

  it('renders transporteur', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByText('Chronopost')).toBeInTheDocument();
  });

  it('renders em dash when no transporteur', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders shipped icon and date for shipped jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByText('25/02')).toBeInTheDocument();
  });

  it('shows expand toggle for multi-element jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    expect(screen.getByTestId('flux-expand-toggle')).toBeInTheDocument();
  });

  it('does not show expand toggle for single-element jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.queryByTestId('flux-expand-toggle')).not.toBeInTheDocument();
  });

  it('shows element count in designation for multi-element jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('does not show element count for single-element jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.queryByText('(1)')).not.toBeInTheDocument();
  });

  it('shows delete and edit action buttons', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.getByTitle('Supprimer')).toBeInTheDocument();
    expect(screen.getByTitle('Éditer')).toBeInTheDocument();
  });

  it('renders worst-value prerequisites for multi-element job', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    // BAT worst: waiting_files → badge "Att.fich", Papier worst: to_order → badge "A cder"
    const badges = screen.getAllByTestId('flux-prereq-badge');
    const texts = badges.map(b => b.textContent);
    expect(texts.some(t => t?.includes('Att.fich'))).toBe(true);
    expect(texts.some(t => t?.includes('A cder'))).toBe(true);
  });

  it('renders +N count on badges for multi-element job (collapsed)', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    const plusCounts = screen.getAllByTestId('flux-prereq-plus-count');
    // 4 prerequisite columns, each with +2 for 3-element job
    expect(plusCounts.length).toBeGreaterThan(0);
    expect(plusCounts[0]).toHaveTextContent('+2');
  });

  it('renders empty table with no jobs', () => {
    render(<FluxTable categories={dummyCategories} jobs={[]} />);
    expect(screen.getByTestId('flux-table')).toBeInTheDocument();
    expect(screen.queryByTestId('flux-table-row')).not.toBeInTheDocument();
  });

  it('renders listbox trigger for single-element job prerequisite cells', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    const triggers = screen.getAllByTestId('flux-prereq-listbox-trigger');
    // 4 prerequisite columns for single-element job
    expect(triggers).toHaveLength(4);
  });

  it('does not render listbox triggers for collapsed multi-element prerequisite cells', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    // Multi-element collapsed: no listbox triggers (read-only badges)
    expect(screen.queryByTestId('flux-prereq-listbox-trigger')).not.toBeInTheDocument();
  });

  // ── Expand / Collapse ───────────────────────────────────────────────────

  it('clicking expand toggle calls onToggleExpand with job id', () => {
    const onToggleExpand = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} onToggleExpand={onToggleExpand} />);
    fireEvent.click(screen.getByTestId('flux-expand-toggle'));
    expect(onToggleExpand).toHaveBeenCalledWith('00078');
  });

  it('does not show sub-rows when job is not in expandedJobIds', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} expandedJobIds={new Set()} />);
    expect(screen.queryByTestId('flux-sub-row')).not.toBeInTheDocument();
  });

  it('shows sub-rows when job is in expandedJobIds', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} expandedJobIds={new Set(['00078'])} />);
    const subRows = screen.getAllByTestId('flux-sub-row');
    expect(subRows).toHaveLength(3); // 3 elements
  });

  it('sub-row shows element label with arrow prefix', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} expandedJobIds={new Set(['00078'])} />);
    expect(screen.getByText(/Ronde/)).toBeInTheDocument();
    expect(screen.getByText(/Carree/)).toBeInTheDocument();
    expect(screen.getByText(/Ovale/)).toBeInTheDocument();
  });

  it('sub-rows have listbox triggers for prerequisite columns', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} expandedJobIds={new Set(['00078'])} />);
    // 3 sub-rows × 4 columns = 12 listbox triggers
    const triggers = screen.getAllByTestId('flux-prereq-listbox-trigger');
    expect(triggers).toHaveLength(12);
  });

  it('parent row has no +N count when expanded', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} expandedJobIds={new Set(['00078'])} />);
    // When expanded, plusCount is undefined so no +N badges on parent
    expect(screen.queryByTestId('flux-prereq-plus-count')).not.toBeInTheDocument();
  });

  // ── Action callbacks ─────────────────────────────────────────────────────

  it('clicking delete button calls onDeleteJob with job id', () => {
    const onDeleteJob = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByTestId('flux-action-delete'));
    expect(onDeleteJob).toHaveBeenCalledWith('00042');
  });

  it('clicking edit button calls onEditJob with job id', () => {
    const onEditJob = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onEditJob={onEditJob} />);
    fireEvent.click(screen.getByTestId('flux-action-edit'));
    expect(onEditJob).toHaveBeenCalledWith('00042');
  });

  // ── Sort header clicks (v0.5.21) ─────────────────────────────────────────

  it('clicking ID header calls onSortChange with "id"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Identifiant'));
    expect(onSortChange).toHaveBeenCalledWith('id');
  });

  it('clicking Client header calls onSortChange with "client"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Client'));
    expect(onSortChange).toHaveBeenCalledWith('client');
  });

  it('clicking Désignation header calls onSortChange with "designation"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Désignation'));
    expect(onSortChange).toHaveBeenCalledWith('designation');
  });

  it('clicking Sortie header calls onSortChange with "sortie"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Date de sortie atelier'));
    expect(onSortChange).toHaveBeenCalledWith('sortie');
  });

  it('clicking BAT header calls onSortChange with "bat"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Bon à tirer'));
    expect(onSortChange).toHaveBeenCalledWith('bat');
  });

  it('clicking Transporteur header calls onSortChange with "transporteur"', () => {
    const onSortChange = vi.fn();
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTitle('Transporteur'));
    expect(onSortChange).toHaveBeenCalledWith('transporteur');
  });

  it('active sort column shows up-arrow chevron when ascending', () => {
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[singleJob]}
        sortColumn="id"
        sortDirection="asc"
      />,
    );
    // The ID header should have an up chevron (active ascending)
    const idHeader = screen.getByTitle('Identifiant');
    // The active column chevron has no opacity-0 class (it's always visible)
    const chevron = idHeader.querySelector('svg');
    expect(chevron).not.toBeNull();
    expect(chevron?.classList.contains('opacity-0')).toBe(false);
  });

  it('inactive sortable column chevron has opacity-0 class (hidden until hover)', () => {
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[singleJob]}
        sortColumn="id"
        sortDirection="asc"
      />,
    );
    // Client header (inactive) should have opacity-0 chevron
    const clientHeader = screen.getByTitle('Client');
    const chevron = clientHeader.querySelector('svg');
    expect(chevron?.classList.contains('opacity-0')).toBe(true);
  });

  // ── Job status dot ──────────────────────────────────────────────────────

  it('shows late status dot for job with a late station', () => {
    render(<FluxTable categories={dummyCategories} jobs={[multiJob]} />);
    const dot = screen.getByTestId('flux-job-status-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('data-status', 'late');
    expect(dot).toHaveAttribute('aria-label', 'En retard');
  });

  it('does not show status dot for job with no late stations', () => {
    render(<FluxTable categories={dummyCategories} jobs={[singleJob]} />);
    expect(screen.queryByTestId('flux-job-status-dot')).not.toBeInTheDocument();
  });

  it('shows conflict status dot when job internalId is in conflictJobIds', () => {
    const conflictJob: FluxJob = {
      ...singleJob,
      id: '00099',
      internalId: 'uuid-conflict-job',
    };
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[conflictJob]}
        conflictJobIds={new Set(['uuid-conflict-job'])}
      />,
    );
    const dot = screen.getByTestId('flux-job-status-dot');
    expect(dot).toHaveAttribute('data-status', 'conflict');
    expect(dot).toHaveAttribute('aria-label', 'Conflit');
  });

  it('late status takes priority over conflict', () => {
    const lateConflictJob: FluxJob = {
      ...multiJob,
      internalId: 'uuid-late-conflict',
    };
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[lateConflictJob]}
        conflictJobIds={new Set(['uuid-late-conflict'])}
      />,
    );
    const dot = screen.getByTestId('flux-job-status-dot');
    expect(dot).toHaveAttribute('data-status', 'late');
  });

  it('shows late status dot when job is in lateJobIds (snapshot-level late)', () => {
    const snapshotLateJob: FluxJob = {
      ...singleJob,
      id: '00055',
      internalId: 'uuid-snapshot-late',
    };
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[snapshotLateJob]}
        lateJobIds={new Set(['uuid-snapshot-late'])}
      />,
    );
    const dot = screen.getByTestId('flux-job-status-dot');
    expect(dot).toHaveAttribute('data-status', 'late');
    expect(dot).toHaveAttribute('aria-label', 'En retard');
  });

  it('snapshot-level late takes priority over conflict', () => {
    const bothJob: FluxJob = {
      ...singleJob,
      id: '00066',
      internalId: 'uuid-both',
    };
    render(
      <FluxTable
        categories={dummyCategories}
        jobs={[bothJob]}
        lateJobIds={new Set(['uuid-both'])}
        conflictJobIds={new Set(['uuid-both'])}
      />,
    );
    const dot = screen.getByTestId('flux-job-status-dot');
    expect(dot).toHaveAttribute('data-status', 'late');
  });
});
