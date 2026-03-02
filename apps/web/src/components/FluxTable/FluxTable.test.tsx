import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluxTable } from './FluxTable';
import type { FluxJob } from './fluxTypes';

const singleJob: FluxJob = {
  id: '00042',
  client: 'Ducros',
  designation: 'Brochure A4 16p',
  sortie: '28/02',
  elements: [
    {
      id: 'e1',
      label: 'Main',
      bat: 'OK',
      papier: 'Stock',
      formes: 'n.a.',
      plaques: 'Pretes',
      stations: {
        'cat-offset': { state: 'done' },
        'cat-cutting': { state: 'done' },
      },
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
      id: 'e1', label: 'Ronde', bat: 'OK', papier: 'Stock', formes: 'Stock', plaques: 'Pretes',
      stations: { 'cat-offset': { state: 'late', progress: 60 } },
    },
    {
      id: 'e2', label: 'Carree', bat: 'Envoye', papier: 'Cde', formes: 'n.a.', plaques: 'A faire',
      stations: { 'cat-offset': { state: 'in-progress', progress: 40 } },
    },
    {
      id: 'e3', label: 'Ovale', bat: 'Att.fich', papier: 'A cder', formes: 'A cder', plaques: 'A faire',
      stations: { 'cat-offset': { state: 'planned' } },
    },
  ],
  transporteur: null,
  parti: { shipped: false, date: null },
};

describe('FluxTable', () => {
  it('renders the table', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByTestId('flux-table')).toBeInTheDocument();
  });

  it('renders all job rows', () => {
    render(<FluxTable jobs={[singleJob, multiJob]} />);
    const rows = screen.getAllByTestId('flux-table-row');
    expect(rows).toHaveLength(2);
  });

  it('sorts rows by ID ascending', () => {
    const job2: FluxJob = { ...singleJob, id: '00010', client: 'AAAA' };
    render(<FluxTable jobs={[singleJob, job2]} />);
    const rows = screen.getAllByTestId('flux-table-row');
    expect(rows[0]).toHaveAttribute('data-job-id', '00010');
    expect(rows[1]).toHaveAttribute('data-job-id', '00042');
  });

  it('renders job ID in monospace', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByText('00042')).toBeInTheDocument();
  });

  it('renders client name', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByText('Ducros')).toBeInTheDocument();
  });

  it('renders designation', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByText('Brochure A4 16p')).toBeInTheDocument();
  });

  it('renders transporteur', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByText('Chronopost')).toBeInTheDocument();
  });

  it('renders em dash when no transporteur', () => {
    render(<FluxTable jobs={[multiJob]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders shipped icon and date for shipped jobs', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByText('25/02')).toBeInTheDocument();
  });

  it('shows expand toggle for multi-element jobs', () => {
    render(<FluxTable jobs={[multiJob]} />);
    expect(screen.getByTestId('flux-expand-toggle')).toBeInTheDocument();
  });

  it('does not show expand toggle for single-element jobs', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.queryByTestId('flux-expand-toggle')).not.toBeInTheDocument();
  });

  it('shows element count in designation for multi-element jobs', () => {
    render(<FluxTable jobs={[multiJob]} />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('does not show element count for single-element jobs', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.queryByText('(1)')).not.toBeInTheDocument();
  });

  it('shows delete and edit action buttons', () => {
    render(<FluxTable jobs={[singleJob]} />);
    expect(screen.getByTitle('Supprimer')).toBeInTheDocument();
    expect(screen.getByTitle('Éditer')).toBeInTheDocument();
  });

  it('renders worst-value prerequisites for multi-element job', () => {
    render(<FluxTable jobs={[multiJob]} />);
    // BAT worst: Att.fich (red), Papier worst: A cder (red)
    const badges = screen.getAllByTestId('flux-prereq-badge');
    const texts = badges.map(b => b.textContent);
    expect(texts.some(t => t?.includes('Att.fich'))).toBe(true);
    expect(texts.some(t => t?.includes('A cder'))).toBe(true);
  });

  it('renders +N count on badges for multi-element job', () => {
    render(<FluxTable jobs={[multiJob]} />);
    const plusCounts = screen.getAllByTestId('flux-prereq-plus-count');
    // 4 prerequisite columns, each with +2 for 3-element job
    expect(plusCounts.length).toBeGreaterThan(0);
    expect(plusCounts[0]).toHaveTextContent('+2');
  });

  it('renders empty table with no jobs', () => {
    render(<FluxTable jobs={[]} />);
    expect(screen.getByTestId('flux-table')).toBeInTheDocument();
    expect(screen.queryByTestId('flux-table-row')).not.toBeInTheDocument();
  });
});
