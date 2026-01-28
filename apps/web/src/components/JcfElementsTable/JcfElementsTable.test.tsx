import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfElementsTable } from './JcfElementsTable';
import { generateElementName, DEFAULT_ELEMENT } from './types';
import type { JcfElement } from './types';

const defaultProps = {
  elements: [{ ...DEFAULT_ELEMENT }],
  onElementsChange: vi.fn(),
};

function renderTable(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, onElementsChange: vi.fn(), ...overrides };
  const result = render(<JcfElementsTable {...props} />);
  return { ...result, onElementsChange: props.onElementsChange };
}

describe('JcfElementsTable', () => {
  describe('rendering', () => {
    it('renders the table container', () => {
      renderTable();
      expect(screen.getByTestId('jcf-elements-table')).toBeInTheDocument();
    });

    it('renders the header row', () => {
      renderTable();
      expect(screen.getByTestId('jcf-elements-header')).toBeInTheDocument();
    });

    it('displays default element name "ELT"', () => {
      renderTable();
      expect(screen.getByTestId('jcf-element-name-0')).toHaveTextContent(
        'ELT',
      );
    });

    it('renders all 12 field row labels', () => {
      renderTable();
      const labels = [
        'Precedences',
        'Quantité',
        'Pagination',
        'Format',
        'Papier',
        'Impression',
        'Surfacage',
        'Autres',
        'Imposition',
        'Qté feuilles',
        'Commentaires',
        'Sequence',
      ];
      labels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('renders all 12 field rows', () => {
      renderTable();
      const fieldKeys = [
        'precedences',
        'quantite',
        'pagination',
        'format',
        'papier',
        'impression',
        'surfacage',
        'autres',
        'imposition',
        'qteFeuilles',
        'commentaires',
        'sequence',
      ];
      fieldKeys.forEach((key) => {
        expect(screen.getByTestId(`jcf-row-${key}`)).toBeInTheDocument();
      });
    });

    it('renders default quantite value as "1"', () => {
      renderTable();
      const cell = screen.getByTestId('jcf-cell-0-quantite');
      const input = cell.querySelector('input') as HTMLInputElement;
      expect(input).toHaveValue('1');
    });

    it('renders commentaires as textarea', () => {
      renderTable();
      const el = screen.getByTestId('jcf-input-0-commentaires');
      expect(el.tagName).toBe('TEXTAREA');
    });

    it('renders sequence as textarea', () => {
      renderTable();
      const el = screen.getByTestId('jcf-input-0-sequence');
      expect(el.tagName).toBe('TEXTAREA');
    });

    it('renders standard fields as input', () => {
      renderTable();
      const el = screen.getByTestId('jcf-input-0-autres');
      expect(el.tagName).toBe('INPUT');
    });

    it('renders multiple elements as columns', () => {
      const elements: JcfElement[] = [
        { ...DEFAULT_ELEMENT, name: 'ELEM1' },
        { ...DEFAULT_ELEMENT, name: 'ELEM2' },
      ];
      renderTable({ elements });
      expect(screen.getByTestId('jcf-element-name-0')).toHaveTextContent(
        'ELEM1',
      );
      expect(screen.getByTestId('jcf-element-name-1')).toHaveTextContent(
        'ELEM2',
      );
    });
  });

  describe('input changes', () => {
    it('calls onElementsChange when field value changes', () => {
      const { onElementsChange } = renderTable();
      const input = screen.getByTestId('jcf-input-0-autres');
      fireEvent.change(input, { target: { value: 'Test value' } });
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ autres: 'Test value' }),
      ]);
    });

    it('calls onElementsChange for textarea fields', () => {
      const { onElementsChange } = renderTable();
      const textarea = screen.getByTestId('jcf-input-0-commentaires');
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ commentaires: 'Test comment' }),
      ]);
    });
  });

  describe('add element', () => {
    it('adds a new element after the clicked position', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-add-0'));
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'ELT' }),
        expect.objectContaining({ name: 'ELEM2' }),
      ]);
    });

    it('inserts element at correct position with multiple elements', () => {
      const elements: JcfElement[] = [
        { ...DEFAULT_ELEMENT, name: 'ELEM1' },
        { ...DEFAULT_ELEMENT, name: 'ELEM2' },
      ];
      const { onElementsChange } = renderTable({ elements });
      fireEvent.click(screen.getByTestId('jcf-element-add-0'));
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'ELEM1' }),
        expect.objectContaining({ name: 'ELEM3' }),
        expect.objectContaining({ name: 'ELEM2' }),
      ]);
    });
  });

  describe('remove element', () => {
    it('removes the element at the clicked position', () => {
      const elements: JcfElement[] = [
        { ...DEFAULT_ELEMENT, name: 'ELEM1' },
        { ...DEFAULT_ELEMENT, name: 'ELEM2' },
      ];
      const { onElementsChange } = renderTable({ elements });
      fireEvent.click(screen.getByTestId('jcf-element-remove-0'));
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'ELEM2' }),
      ]);
    });

    it('does not remove when only 1 element', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-remove-0'));
      expect(onElementsChange).not.toHaveBeenCalled();
    });

    it('remove button is disabled when only 1 element', () => {
      renderTable();
      const removeBtn = screen.getByTestId('jcf-element-remove-0');
      expect(removeBtn).toBeDisabled();
    });

    it('remove button is enabled when multiple elements', () => {
      const elements: JcfElement[] = [
        { ...DEFAULT_ELEMENT, name: 'ELEM1' },
        { ...DEFAULT_ELEMENT, name: 'ELEM2' },
      ];
      renderTable({ elements });
      const removeBtn = screen.getByTestId('jcf-element-remove-0');
      expect(removeBtn).not.toBeDisabled();
    });
  });

  describe('element name editing', () => {
    it('enters edit mode on click', () => {
      renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      expect(
        screen.getByTestId('jcf-element-name-input-0'),
      ).toBeInTheDocument();
    });

    it('shows current name in edit input', () => {
      renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      expect(input).toHaveValue('ELT');
    });

    it('saves name on Enter', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      fireEvent.change(input, { target: { value: 'COUV' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'COUV' }),
      ]);
    });

    it('saves name on blur', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      fireEvent.change(input, { target: { value: 'INT' } });
      fireEvent.blur(input);
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'INT' }),
      ]);
    });

    it('cancels edit on Escape', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      fireEvent.change(input, { target: { value: 'COUV' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      // Should exit edit mode without calling onElementsChange
      expect(onElementsChange).not.toHaveBeenCalled();
      // Name display should be back
      expect(screen.getByTestId('jcf-element-name-0')).toHaveTextContent(
        'ELT',
      );
    });

    it('cancels edit when name is empty', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onElementsChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('jcf-element-name-0')).toHaveTextContent(
        'ELT',
      );
    });

    it('does not call onElementsChange if name unchanged', () => {
      const { onElementsChange } = renderTable();
      fireEvent.click(screen.getByTestId('jcf-element-name-0'));
      const input = screen.getByTestId('jcf-element-name-input-0');
      // Don't change the value, just press Enter
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onElementsChange).not.toHaveBeenCalled();
    });
  });

  describe('git-branch icon', () => {
    it('renders git-branch icon in precedences row', () => {
      renderTable();
      const row = screen.getByTestId('jcf-row-precedences');
      const svg = row.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('cell navigation', () => {
    // Row indices: 0=precedences, 1=quantite, 2=pagination, 3=format,
    // 4=papier, 5=impression, 6=surfacage, 7=autres, 8=imposition,
    // 9=qteFeuilles, 10=commentaires, 11=sequence
    const LAST_ROW = 11;

    const twoElements: JcfElement[] = [
      { ...DEFAULT_ELEMENT, name: 'ELEM1' },
      { ...DEFAULT_ELEMENT, name: 'ELEM2' },
    ];

    function getCellById(elementIndex: number, rowIndex: number) {
      return document.getElementById(
        `cell-${elementIndex}-${rowIndex}`,
      ) as HTMLElement;
    }

    it('cells have IDs in the format cell-{elementIndex}-{rowIndex}', () => {
      renderTable();
      expect(getCellById(0, 0)).toBeInTheDocument();
      expect(getCellById(0, LAST_ROW)).toBeInTheDocument();
    });

    it('Tab moves focus to next row in same column', () => {
      renderTable();
      const cell = getCellById(0, 0);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Tab' });
      expect(document.activeElement).toBe(getCellById(0, 1));
    });

    it('Tab at last row moves to next column first row', () => {
      renderTable({ elements: twoElements });
      const cell = getCellById(0, LAST_ROW);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Tab' });
      expect(document.activeElement).toBe(getCellById(1, 0));
    });

    it('Tab at last cell of table does not prevent default (native exit)', () => {
      renderTable();
      const cell = getCellById(0, LAST_ROW);
      cell.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const prevented = !cell.dispatchEvent(event);
      // Last cell of only column → should NOT be prevented (native Tab exits)
      expect(prevented).toBe(false);
    });

    it('Shift+Tab moves focus to previous row', () => {
      renderTable();
      const cell = getCellById(0, 3);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(getCellById(0, 2));
    });

    it('Shift+Tab at first row moves to previous column last row', () => {
      renderTable({ elements: twoElements });
      const cell = getCellById(1, 0);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(getCellById(0, LAST_ROW));
    });

    it('Shift+Tab at first cell of table does not prevent default (native exit)', () => {
      renderTable();
      const cell = getCellById(0, 0);
      cell.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const prevented = !cell.dispatchEvent(event);
      expect(prevented).toBe(false);
    });

    it('Alt+ArrowDown wraps from last row to first row', () => {
      renderTable();
      const cell = getCellById(0, LAST_ROW);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'ArrowDown', altKey: true });
      expect(document.activeElement).toBe(getCellById(0, 0));
    });

    it('Alt+ArrowUp wraps from first row to last row', () => {
      renderTable();
      const cell = getCellById(0, 0);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'ArrowUp', altKey: true });
      expect(document.activeElement).toBe(getCellById(0, LAST_ROW));
    });

    it('Alt+ArrowRight wraps from last column to first column', () => {
      renderTable({ elements: twoElements });
      const cell = getCellById(1, 3);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'ArrowRight', altKey: true });
      expect(document.activeElement).toBe(getCellById(0, 3));
    });

    it('Alt+ArrowLeft wraps from first column to last column', () => {
      renderTable({ elements: twoElements });
      const cell = getCellById(0, 3);
      cell.focus();
      fireEvent.keyDown(cell, { key: 'ArrowLeft', altKey: true });
      expect(document.activeElement).toBe(getCellById(1, 3));
    });

    it('Enter in text input moves to next cell', () => {
      renderTable();
      const cell = getCellById(0, 7); // autres (plain text input)
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Enter' });
      expect(document.activeElement).toBe(getCellById(0, 8));
    });

    it('Enter in textarea does NOT move to next cell', () => {
      renderTable();
      const cell = getCellById(0, 10); // commentaires (textarea, rowIndex=10)
      cell.focus();
      fireEvent.keyDown(cell, { key: 'Enter' });
      // Should stay on same cell (Enter inserts newline in textarea)
      expect(document.activeElement).toBe(cell);
    });

    it('Escape blurs the active cell', () => {
      renderTable();
      const cell = getCellById(0, 7); // autres (plain text input)
      cell.focus();
      expect(document.activeElement).toBe(cell);
      fireEvent.keyDown(cell, { key: 'Escape' });
      expect(document.activeElement).not.toBe(cell);
    });
  });
});

describe('generateElementName', () => {
  it('returns ELEM2 for single default element', () => {
    const elements: JcfElement[] = [{ ...DEFAULT_ELEMENT }];
    expect(generateElementName(elements)).toBe('ELEM2');
  });

  it('returns ELEM3 for two elements', () => {
    const elements: JcfElement[] = [
      { ...DEFAULT_ELEMENT, name: 'ELEM1' },
      { ...DEFAULT_ELEMENT, name: 'ELEM2' },
    ];
    expect(generateElementName(elements)).toBe('ELEM3');
  });

  it('handles gaps in numbering', () => {
    const elements: JcfElement[] = [
      { ...DEFAULT_ELEMENT, name: 'ELEM1' },
      { ...DEFAULT_ELEMENT, name: 'ELEM5' },
    ];
    expect(generateElementName(elements)).toBe('ELEM6');
  });

  it('handles non-ELEM names', () => {
    const elements: JcfElement[] = [
      { ...DEFAULT_ELEMENT, name: 'COUV' },
      { ...DEFAULT_ELEMENT, name: 'INT' },
    ];
    // No ELEM-matching names, so maxNum = max(0, elements.length=2) = 2 → ELEM3
    expect(generateElementName(elements)).toBe('ELEM3');
  });
});
