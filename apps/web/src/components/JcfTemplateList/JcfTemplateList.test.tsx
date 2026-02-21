import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfTemplateList } from './JcfTemplateList';
import type { JcfTemplate } from '@flux/types';

const createTemplate = (overrides: Partial<JcfTemplate> = {}): JcfTemplate => ({
  id: 'tpl-1',
  name: 'Test Template',
  description: 'A test template',
  category: 'Brochure',
  clientName: undefined,
  elements: [
    {
      name: 'ELT1',
      precedences: '',
      quantite: '1',
      format: 'A4',
      pagination: '4',
      papier: '',
      imposition: '',
      impression: '',
      surfacage: '',
      autres: '',
      qteFeuilles: '',
      commentaires: '',
      sequence: '',
    },
  ],
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-20T14:30:00.000Z',
  ...overrides,
});

describe('JcfTemplateList', () => {
  describe('empty state', () => {
    it('shows empty state message when no templates', () => {
      render(<JcfTemplateList templates={[]} />);

      expect(screen.getByTestId('template-list-empty')).toBeInTheDocument();
      expect(screen.getByText('Aucun template trouvé')).toBeInTheDocument();
      expect(
        screen.getByText(/Pour créer un template, utilisez/)
      ).toBeInTheDocument();
    });

    it('does not render table when empty', () => {
      render(<JcfTemplateList templates={[]} />);

      expect(screen.queryByTestId('template-list-table')).not.toBeInTheDocument();
    });
  });

  describe('table rendering', () => {
    it('renders table with templates', () => {
      const templates = [createTemplate()];
      render(<JcfTemplateList templates={templates} />);

      expect(screen.getByTestId('template-list-table')).toBeInTheDocument();
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    it('renders all column headers', () => {
      const templates = [createTemplate()];
      render(<JcfTemplateList templates={templates} />);

      expect(screen.getByText('Nom')).toBeInTheDocument();
      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Catégorie')).toBeInTheDocument();
      expect(screen.getByText('Éléments')).toBeInTheDocument();
      expect(screen.getByText('Modifié')).toBeInTheDocument();
    });

    it('renders template data correctly', () => {
      const templates = [
        createTemplate({
          id: 'tpl-1',
          name: 'Brochure A4',
          category: 'Brochure',
          clientName: 'Client A',
          elements: [
            {
              name: 'ELT1',
              precedences: '',
              quantite: '1',
              format: '',
              pagination: '',
              papier: '',
              imposition: '',
              impression: '',
              surfacage: '',
              autres: '',
              qteFeuilles: '',
              commentaires: '',
              sequence: '',
            },
            {
              name: 'ELT2',
              precedences: '',
              quantite: '1',
              format: '',
              pagination: '',
              papier: '',
              imposition: '',
              impression: '',
              surfacage: '',
              autres: '',
              qteFeuilles: '',
              commentaires: '',
              sequence: '',
            },
          ],
        }),
      ];
      render(<JcfTemplateList templates={templates} />);

      expect(screen.getByText('Brochure A4')).toBeInTheDocument();
      expect(screen.getByText('Client A')).toBeInTheDocument();
      expect(screen.getByText('Brochure')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // elements count
    });

    it('shows "Universel" for templates without client', () => {
      const templates = [createTemplate({ clientName: undefined })];
      render(<JcfTemplateList templates={templates} />);

      expect(screen.getByText('Universel')).toBeInTheDocument();
    });

    it('shows dash for templates without category', () => {
      const templates = [createTemplate({ category: undefined })];
      render(<JcfTemplateList templates={templates} />);

      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    const templates = [
      createTemplate({
        id: 'tpl-1',
        name: 'Zebra Template',
        updatedAt: '2025-01-10T10:00:00.000Z',
      }),
      createTemplate({
        id: 'tpl-2',
        name: 'Alpha Template',
        updatedAt: '2025-01-20T10:00:00.000Z',
      }),
      createTemplate({
        id: 'tpl-3',
        name: 'Beta Template',
        updatedAt: '2025-01-15T10:00:00.000Z',
      }),
    ];

    it('sorts by updatedAt descending by default', () => {
      render(<JcfTemplateList templates={templates} />);

      const rows = screen.getAllByTestId(/^template-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'template-row-tpl-2'); // Most recent
      expect(rows[1]).toHaveAttribute('data-testid', 'template-row-tpl-3');
      expect(rows[2]).toHaveAttribute('data-testid', 'template-row-tpl-1'); // Oldest
    });

    it('sorts by name ascending when clicked', () => {
      render(<JcfTemplateList templates={templates} />);

      fireEvent.click(screen.getByText('Nom'));

      const rows = screen.getAllByTestId(/^template-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'template-row-tpl-2'); // Alpha
      expect(rows[1]).toHaveAttribute('data-testid', 'template-row-tpl-3'); // Beta
      expect(rows[2]).toHaveAttribute('data-testid', 'template-row-tpl-1'); // Zebra
    });

    it('toggles sort direction when clicking same column', () => {
      render(<JcfTemplateList templates={templates} />);

      // Click name to sort ascending
      fireEvent.click(screen.getByText('Nom'));
      // Click again to sort descending
      fireEvent.click(screen.getByText('Nom'));

      const rows = screen.getAllByTestId(/^template-row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'template-row-tpl-1'); // Zebra
      expect(rows[2]).toHaveAttribute('data-testid', 'template-row-tpl-2'); // Alpha
    });

    it('shows sort indicator icon', () => {
      render(<JcfTemplateList templates={templates} />);

      // Default: updatedAt column should show descending indicator
      const updatedAtHeader = screen.getByText('Modifié').closest('th');
      expect(updatedAtHeader?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('calls onDeleteClick when delete button is clicked', () => {
      const onDeleteClick = vi.fn();
      const template = createTemplate({ id: 'tpl-test' });
      render(<JcfTemplateList templates={[template]} onDeleteClick={onDeleteClick} />);

      fireEvent.click(screen.getByTestId('template-delete-tpl-test'));

      expect(onDeleteClick).toHaveBeenCalledWith(template);
    });

    it('calls onEditClick when edit button is clicked', () => {
      const onEditClick = vi.fn();
      const template = createTemplate({ id: 'tpl-test' });
      render(<JcfTemplateList templates={[template]} onEditClick={onEditClick} />);

      fireEvent.click(screen.getByTestId('template-edit-tpl-test'));

      expect(onEditClick).toHaveBeenCalledWith(template);
    });

    it('calls onUseClick when use button is clicked', () => {
      const onUseClick = vi.fn();
      const template = createTemplate({ id: 'tpl-test' });
      render(<JcfTemplateList templates={[template]} onUseClick={onUseClick} />);

      fireEvent.click(screen.getByTestId('template-use-tpl-test'));

      expect(onUseClick).toHaveBeenCalledWith(template);
    });

    it('renders action buttons with correct aria labels', () => {
      const template = createTemplate({ id: 'tpl-test' });
      render(
        <JcfTemplateList
          templates={[template]}
          onDeleteClick={vi.fn()}
          onEditClick={vi.fn()}
          onUseClick={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Supprimer le template')).toBeInTheDocument();
      expect(screen.getByLabelText('Modifier les propriétés')).toBeInTheDocument();
      expect(screen.getByLabelText('Utiliser ce template')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has table caption for screen readers', () => {
      render(<JcfTemplateList templates={[createTemplate()]} />);

      expect(screen.getByText('Liste des templates')).toBeInTheDocument();
    });

    it('has aria-sort attributes on sortable columns', () => {
      render(<JcfTemplateList templates={[createTemplate()]} />);

      const updatedAtHeader = screen.getByText('Modifié').closest('th');
      expect(updatedAtHeader).toHaveAttribute('aria-sort', 'descending');
    });
  });
});
