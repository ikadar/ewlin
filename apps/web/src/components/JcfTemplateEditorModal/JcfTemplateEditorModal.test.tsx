import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/testUtils';
import { JcfTemplateEditorModal } from './JcfTemplateEditorModal';
import type { JcfTemplate, JcfTemplateElement } from '@flux/types';
import { resetTemplates } from '../../mock/templateApi';

const createTestElement = (name: string): JcfTemplateElement => ({
  name,
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
});

const createTestTemplate = (overrides: Partial<JcfTemplate> = {}): JcfTemplate => ({
  id: 'tpl-test',
  name: 'Test Template',
  description: 'Test description',
  category: 'Brochure',
  clientName: 'Test Client',
  elements: [createTestElement('ELT1')],
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-20T14:30:00.000Z',
  ...overrides,
});

describe('JcfTemplateEditorModal', () => {
  const defaultProps = {
    isOpen: true,
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetTemplates();
  });

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      render(<JcfTemplateEditorModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('template-editor-backdrop')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      expect(screen.getByTestId('template-editor-backdrop')).toBeInTheDocument();
      expect(screen.getByTestId('template-editor-dialog')).toBeInTheDocument();
    });

    it('shows create mode title by default', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      expect(screen.getByTestId('template-editor-title')).toHaveTextContent(
        'Enregistrer comme template'
      );
    });

    it('shows edit mode title when template is provided', () => {
      render(
        <JcfTemplateEditorModal {...defaultProps} template={createTestTemplate()} />
      );

      expect(screen.getByTestId('template-editor-title')).toHaveTextContent(
        'Modifier le template'
      );
    });
  });

  describe('create mode', () => {
    it('initializes with empty form', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      expect(screen.getByTestId('template-field-name')).toHaveValue('');
      expect(screen.getByTestId('template-field-description')).toHaveValue('');
    });

    it('initializes with provided elements', () => {
      const elements = [createTestElement('COUV'), createTestElement('INT')];
      render(<JcfTemplateEditorModal {...defaultProps} initialElements={elements} />);

      // Check that elements table shows the elements
      expect(screen.getByText('COUV')).toBeInTheDocument();
      expect(screen.getByText('INT')).toBeInTheDocument();
    });

    it('initializes with provided client name', () => {
      render(
        <JcfTemplateEditorModal {...defaultProps} initialClientName="Client A" />
      );

      expect(screen.getByDisplayValue('Client A')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('loads template data into form', () => {
      const template = createTestTemplate({
        name: 'My Template',
        description: 'My Description',
        category: 'Feuillet',
        clientName: 'Client B',
      });

      render(<JcfTemplateEditorModal {...defaultProps} template={template} />);

      expect(screen.getByDisplayValue('My Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('My Description')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Feuillet')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Client B')).toBeInTheDocument();
    });

    it('loads template elements', () => {
      const template = createTestTemplate({
        elements: [createTestElement('ELEM1'), createTestElement('ELEM2')],
      });

      render(<JcfTemplateEditorModal {...defaultProps} template={template} />);

      expect(screen.getByText('ELEM1')).toBeInTheDocument();
      expect(screen.getByText('ELEM2')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when saving without name', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('template-editor-save'));

      expect(
        screen.getByText('Le nom du template est obligatoire')
      ).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows error when saving without elements', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      // Set a name
      fireEvent.change(screen.getByTestId('template-field-name'), {
        target: { value: 'Test Name' },
      });

      fireEvent.click(screen.getByTestId('template-editor-save'));

      expect(
        screen.getByText('Le template doit contenir au moins un élément')
      ).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('clears error on valid save', () => {
      const elements = [createTestElement('ELT1')];
      render(
        <JcfTemplateEditorModal {...defaultProps} initialElements={elements} />
      );

      // First, try to save without name to trigger error
      fireEvent.click(screen.getByTestId('template-editor-save'));
      expect(
        screen.getByText('Le nom du template est obligatoire')
      ).toBeInTheDocument();

      // Now add name and save again
      fireEvent.change(screen.getByTestId('template-field-name'), {
        target: { value: 'Valid Name' },
      });
      fireEvent.click(screen.getByTestId('template-editor-save'));

      // Error should be cleared and onSave should be called
      expect(
        screen.queryByText('Le nom du template est obligatoire')
      ).not.toBeInTheDocument();
      expect(defaultProps.onSave).toHaveBeenCalled();
    });
  });

  describe('save functionality', () => {
    it('calls onSave with correct data in create mode', () => {
      const elements = [createTestElement('ELT1')];
      render(
        <JcfTemplateEditorModal
          {...defaultProps}
          initialElements={elements}
          initialClientName="Client A"
        />
      );

      fireEvent.change(screen.getByTestId('template-field-name'), {
        target: { value: 'New Template' },
      });
      fireEvent.change(screen.getByTestId('template-field-description'), {
        target: { value: 'New Description' },
      });

      fireEvent.click(screen.getByTestId('template-editor-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Template',
          description: 'New Description',
          clientName: 'Client A',
          elements: expect.arrayContaining([
            expect.objectContaining({ name: 'ELT1' }),
          ]),
          id: undefined,
        })
      );
    });

    it('calls onSave with template id in edit mode', () => {
      const template = createTestTemplate({ id: 'tpl-123' });
      render(<JcfTemplateEditorModal {...defaultProps} template={template} />);

      fireEvent.click(screen.getByTestId('template-editor-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tpl-123',
        })
      );
    });

    it('trims whitespace from string fields', () => {
      const elements = [createTestElement('ELT1')];
      render(<JcfTemplateEditorModal {...defaultProps} initialElements={elements} />);

      fireEvent.change(screen.getByTestId('template-field-name'), {
        target: { value: '  Trimmed Name  ' },
      });

      fireEvent.click(screen.getByTestId('template-editor-save'));

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Name',
        })
      );
    });
  });

  describe('cancel functionality', () => {
    it('calls onCancel when cancel button is clicked', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('template-editor-cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when close button is clicked', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('template-editor-close'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when backdrop is clicked', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      const backdrop = screen.getByTestId('template-editor-backdrop');
      fireEvent.mouseDown(backdrop);
      fireEvent.mouseUp(backdrop);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('does not call onCancel when dialog is clicked', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      const dialog = screen.getByTestId('template-editor-dialog');
      fireEvent.click(dialog);

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('saves on Cmd+S', () => {
      const elements = [createTestElement('ELT1')];
      render(<JcfTemplateEditorModal {...defaultProps} initialElements={elements} />);

      fireEvent.change(screen.getByTestId('template-field-name'), {
        target: { value: 'Test' },
      });

      fireEvent.keyDown(document, { key: 's', metaKey: true });

      expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('closes on Escape', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('saving state', () => {
    it('disables buttons when isSaving is true', () => {
      render(<JcfTemplateEditorModal {...defaultProps} isSaving={true} />);

      expect(screen.getByTestId('template-editor-save')).toBeDisabled();
      expect(screen.getByTestId('template-editor-cancel')).toBeDisabled();
      expect(screen.getByTestId('template-editor-close')).toBeDisabled();
    });

    it('shows saving text in button', () => {
      render(<JcfTemplateEditorModal {...defaultProps} isSaving={true} />);

      expect(screen.getByTestId('template-editor-save')).toHaveTextContent(
        'Enregistrement...'
      );
    });

    it('does not close on backdrop click when saving', () => {
      render(<JcfTemplateEditorModal {...defaultProps} isSaving={true} />);

      const backdrop = screen.getByTestId('template-editor-backdrop');
      fireEvent.mouseDown(backdrop);
      fireEvent.mouseUp(backdrop);

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('footer elements', () => {
    it('renders keyboard hints', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      expect(screen.getByText('Tab')).toBeInTheDocument();
      expect(screen.getByText('⌘S')).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<JcfTemplateEditorModal {...defaultProps} />);

      expect(screen.getByTestId('template-editor-cancel')).toHaveTextContent('Annuler');
      expect(screen.getByTestId('template-editor-save')).toHaveTextContent(
        'Enregistrer'
      );
    });
  });
});
