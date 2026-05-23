import { describe, it, expect } from 'vitest';
import {
  derivePaperKey,
  deriveColumnFromStatus,
  groupElementsByPaper,
  leftmostColumn,
  columnToApiStatus,
} from './paperKanban';
import type { PaperGroupElement, PaperGroup, KanbanColumnDef } from './paperKanban';

const PAPER_COLS: KanbanColumnDef[] = [
  { id: 'to_order', label: 'A commander', dotColor: '#ef4444', apiStatus: 'to_order' },
  { id: 'ordered', label: 'Commandé', dotColor: '#f59e0b', apiStatus: 'ordered' },
  { id: 'available', label: 'Disponible', dotColor: '#22c55e', apiStatus: 'delivered' },
];

describe('derivePaperKey', () => {
  it('parses full spec (papier DSL + imposition)', () => {
    const result = derivePaperKey(
      { papier: 'Couché mat:135', imposition: '50x70(8)' },
    );
    expect(result.key).toBe('Couché mat|135g|50×70');
    expect(result.label).toBe('Couché mat 135g 50×70');
  });

  it('parses papier DSL without imposition', () => {
    const result = derivePaperKey({ papier: 'Offset:80' });
    expect(result.key).toBe('Offset|80g');
    expect(result.label).toBe('Offset 80g');
  });

  it('parses papier type without grammage', () => {
    const result = derivePaperKey({ papier: 'Offset' });
    expect(result.key).toBe('Offset');
    expect(result.label).toBe('Offset');
  });

  it('falls back to job-level fields when spec.papier is absent', () => {
    const result = derivePaperKey({}, 'Couché brillant', '65x92', 350);
    expect(result.key).toBe('Couché brillant|350g|65x92');
    expect(result.label).toBe('Couché brillant 350g 65x92');
  });

  it('falls back to job-level imposition when spec has none', () => {
    const result = derivePaperKey(
      { papier: 'Offset:80' },
      undefined, '65x90',
    );
    expect(result.key).toBe('Offset|80g|65x90');
    expect(result.label).toBe('Offset 80g 65x90');
  });

  it('returns unspecified when no paper info at all', () => {
    const result = derivePaperKey(undefined);
    expect(result.key).toBe('__unspecified__');
    expect(result.label).toBe('Non spécifié');
  });

  it('returns unspecified for empty spec', () => {
    const result = derivePaperKey({});
    expect(result.key).toBe('__unspecified__');
    expect(result.label).toBe('Non spécifié');
  });
});

describe('deriveColumnFromStatus', () => {
  it('maps to_order', () => expect(deriveColumnFromStatus('to_order', PAPER_COLS)).toBe('to_order'));
  it('maps ordered', () => expect(deriveColumnFromStatus('ordered', PAPER_COLS)).toBe('ordered'));
  it('maps delivered to available', () => expect(deriveColumnFromStatus('delivered', PAPER_COLS)).toBe('available'));
  it('falls back to last column for unknown', () => expect(deriveColumnFromStatus('none', PAPER_COLS)).toBe('available'));
});

describe('groupElementsByPaper', () => {
  it('groups elements sharing the same paper key', () => {
    const elements: PaperGroupElement[] = [
      { elementId: 'a', paperStatus: 'to_order', paperKey: 'Offset|80g', paperLabel: 'Offset 80g', sheetQty: 1000 },
      { elementId: 'b', paperStatus: 'to_order', paperKey: 'Offset|80g', paperLabel: 'Offset 80g', sheetQty: 1000 },
      { elementId: 'c', paperStatus: 'to_order', paperKey: 'Couché|350g', paperLabel: 'Couché 350g', sheetQty: 500 },
    ];
    const groups = groupElementsByPaper(elements, PAPER_COLS);
    expect(groups).toHaveLength(2);

    const offset = groups.find((g) => g.paperKey === 'Offset|80g')!;
    expect(offset.elements).toHaveLength(2);
    expect(offset.totalSheets).toBe(2000);

    const couche = groups.find((g) => g.paperKey === 'Couché|350g')!;
    expect(couche.elements).toHaveLength(1);
    expect(couche.totalSheets).toBe(500);
  });

  it('returns empty array for empty input', () => {
    expect(groupElementsByPaper([], PAPER_COLS)).toEqual([]);
  });
});

describe('leftmostColumn', () => {
  function makeGroup(col: string): PaperGroup {
    return { paperKey: 'x', paperLabel: 'x', elements: [], totalSheets: 0, column: col };
  }

  it('returns to_order when any group is there', () => {
    expect(leftmostColumn([makeGroup('available'), makeGroup('to_order')], PAPER_COLS)).toBe('to_order');
  });

  it('returns ordered when no to_order', () => {
    expect(leftmostColumn([makeGroup('available'), makeGroup('ordered')], PAPER_COLS)).toBe('ordered');
  });

  it('returns available when all available', () => {
    expect(leftmostColumn([makeGroup('available')], PAPER_COLS)).toBe('available');
  });

  it('returns last column for empty groups', () => {
    expect(leftmostColumn([], PAPER_COLS)).toBe('available');
  });
});

describe('columnToApiStatus', () => {
  it('maps to_order', () => expect(columnToApiStatus('to_order', PAPER_COLS)).toBe('to_order'));
  it('maps ordered', () => expect(columnToApiStatus('ordered', PAPER_COLS)).toBe('ordered'));
  it('maps available to delivered', () => expect(columnToApiStatus('available', PAPER_COLS)).toBe('delivered'));
});
