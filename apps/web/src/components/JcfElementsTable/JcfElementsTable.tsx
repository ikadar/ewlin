import { useState, useCallback, useMemo } from 'react';
import { GitBranch, Minus, Plus } from 'lucide-react';
import { DEFAULT_ELEMENT, generateElementName } from './types';
import type { JcfElement, JcfFieldKey } from './types';
import { JcfFormatAutocomplete } from '../JcfFormatAutocomplete';
import { JcfImpressionAutocomplete } from '../JcfImpressionAutocomplete';
import { JcfSurfacageAutocomplete } from '../JcfSurfacageAutocomplete';
import { JcfQuantiteInput } from '../JcfQuantiteInput';
import { JcfPaginationInput } from '../JcfPaginationInput';
import { useSessionLearning } from '../../hooks/useSessionLearning';
import { PRODUCT_FORMATS, IMPRESSION_PRESETS, SURFACAGE_PRESETS } from '../../mock/reference-data';

// ── Row definitions ──

interface RowDef {
  key: JcfFieldKey;
  label: string;
  icon?: 'git-branch';
}

const baseRows: RowDef[] = [
  { key: 'precedences', label: 'Precedences', icon: 'git-branch' },
  { key: 'quantite', label: 'Quantité' },
  { key: 'pagination', label: 'Pagination' },
  { key: 'format', label: 'Format' },
  { key: 'papier', label: 'Papier' },
  { key: 'impression', label: 'Impression' },
  { key: 'surfacage', label: 'Surfacage' },
  { key: 'autres', label: 'Autres' },
  { key: 'imposition', label: 'Imposition' },
  { key: 'qteFeuilles', label: 'Qté feuilles' },
  { key: 'commentaires', label: 'Commentaires' },
];

const sequenceRow: RowDef = { key: 'sequence', label: 'Sequence' };

// ── Utilities ──

const numericFields: JcfFieldKey[] = ['quantite', 'pagination', 'qteFeuilles'];
const textareaFields: JcfFieldKey[] = ['commentaires', 'sequence'];

// ── Input class helpers ──
// 13px base: px-1.5→px-[5px], py-0.5→py-[2px], rounded→rounded-[3px]
const inputBaseClass =
  'w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 focus:outline-none rounded-[3px] px-[5px] py-[2px] font-mono placeholder:text-zinc-700';
const inputFilledClass = `${inputBaseClass} text-zinc-100`;
const inputEmptyClass = `${inputBaseClass} text-zinc-500`;

// ── Component ──

export interface JcfElementsTableProps {
  /** Current elements array */
  elements: JcfElement[];
  /** Callback when elements change */
  onElementsChange: (elements: JcfElement[]) => void;
}

export function JcfElementsTable({
  elements,
  onElementsChange,
}: JcfElementsTableProps) {
  const [editingElementIndex, setEditingElementIndex] = useState<number | null>(
    null,
  );
  const [editingName, setEditingName] = useState('');

  const sessionLearning = useSessionLearning();

  const rows = useMemo(() => [...baseRows, sequenceRow], []);

  // Grid style: 100px label column + 288px per element
  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `100px repeat(${elements.length}, 288px)`,
    }),
    [elements.length],
  );

  const canDelete = elements.length > 1;

  // ── Element name editing ──

  const handleStartEditing = useCallback(
    (index: number) => {
      setEditingElementIndex(index);
      setEditingName(elements[index].name);
    },
    [elements],
  );

  const handleSaveName = useCallback(
    (index: number) => {
      if (editingName.trim() === '') {
        setEditingElementIndex(null);
        return;
      }

      const newName = editingName.trim();
      const oldName = elements[index].name;

      if (oldName !== newName) {
        const updated = elements.map((el, i) =>
          i === index ? { ...el, name: newName } : el,
        );
        onElementsChange(updated);
      }

      setEditingElementIndex(null);
    },
    [editingName, elements, onElementsChange],
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveName(index);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingElementIndex(null);
      }
    },
    [handleSaveName],
  );

  // ── Add / Remove elements ──

  const handleAddElement = useCallback(
    (afterIndex: number) => {
      const newElement: JcfElement = {
        ...DEFAULT_ELEMENT,
        name: generateElementName(elements),
      };
      const updated = [
        ...elements.slice(0, afterIndex + 1),
        newElement,
        ...elements.slice(afterIndex + 1),
      ];
      onElementsChange(updated);
    },
    [elements, onElementsChange],
  );

  const handleRemoveElement = useCallback(
    (index: number) => {
      if (elements.length <= 1) return;
      const updated = elements.filter((_, i) => i !== index);
      onElementsChange(updated);
    },
    [elements, onElementsChange],
  );

  // ── Cell navigation ──

  const getCellId = useCallback(
    (elementIndex: number, rowIndex: number) =>
      `cell-${elementIndex}-${rowIndex}`,
    [],
  );

  const focusCell = useCallback(
    (elementIndex: number, rowIndex: number) => {
      const id = getCellId(elementIndex, rowIndex);
      const el = document.getElementById(id) as HTMLElement | null;
      el?.focus();
    },
    [getCellId],
  );

  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      elementIndex: number,
      rowIndex: number,
    ) => {
      const rowCount = rows.length;
      const elementCount = elements.length;
      const lastRowIndex = rowCount - 1;
      const lastElementIndex = elementCount - 1;
      const isTextarea = textareaFields.includes(rows[rowIndex].key);

      // Alt+Arrow — circular wrap navigation
      if (e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        switch (e.key) {
          case 'ArrowDown':
            focusCell(elementIndex, (rowIndex + 1) % rowCount);
            break;
          case 'ArrowUp':
            focusCell(elementIndex, (rowIndex - 1 + rowCount) % rowCount);
            break;
          case 'ArrowRight':
            focusCell((elementIndex + 1) % elementCount, rowIndex);
            break;
          case 'ArrowLeft':
            focusCell(
              (elementIndex - 1 + elementCount) % elementCount,
              rowIndex,
            );
            break;
        }
        return;
      }

      // Enter — move to next cell (text inputs only; textareas keep newline)
      if (e.key === 'Enter' && !isTextarea) {
        e.preventDefault();
        if (rowIndex < lastRowIndex) {
          focusCell(elementIndex, rowIndex + 1);
        } else if (elementIndex < lastElementIndex) {
          focusCell(elementIndex + 1, 0);
        }
        // At last cell: do nothing (Enter doesn't exit table)
        return;
      }

      // Escape — blur current cell
      if (e.key === 'Escape') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
        return;
      }

      // Tab / Shift+Tab — vertical navigation within column
      if (e.key !== 'Tab') return;

      if (!e.shiftKey) {
        // Tab — move down
        if (rowIndex < lastRowIndex) {
          e.preventDefault();
          focusCell(elementIndex, rowIndex + 1);
        } else if (elementIndex < lastElementIndex) {
          // Last row → next column, first row
          e.preventDefault();
          focusCell(elementIndex + 1, 0);
        }
        // Last cell of table → let native Tab exit
      } else {
        // Shift+Tab — move up
        if (rowIndex > 0) {
          e.preventDefault();
          focusCell(elementIndex, rowIndex - 1);
        } else if (elementIndex > 0) {
          // First row → previous column, last row
          e.preventDefault();
          focusCell(elementIndex - 1, lastRowIndex);
        }
        // First cell of table → let native Shift+Tab exit
      }
    },
    [rows, elements.length, focusCell],
  );

  // ── Cell change ──

  const handleCellChange = useCallback(
    (elementIndex: number, field: JcfFieldKey, value: string) => {
      const updated = elements.map((el, i) =>
        i === elementIndex ? { ...el, [field]: value } : el,
      );
      onElementsChange(updated);
    },
    [elements, onElementsChange],
  );

  // ── Textarea auto-expand ──

  const handleTextareaAutoExpand = useCallback(
    (
      e: React.ChangeEvent<HTMLTextAreaElement>,
      elementIndex: number,
      field: JcfFieldKey,
    ) => {
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      handleCellChange(elementIndex, field, e.target.value);
    },
    [handleCellChange],
  );

  // ── Render ──

  return (
    <div
      className="bg-zinc-900/30 rounded-[3px] border border-zinc-800 overflow-x-auto w-fit max-w-full"
      data-testid="jcf-elements-table"
    >
      {/* Table Header */}
      <div
        className="grid bg-zinc-900 border-b border-zinc-800 rounded-t-[3px] min-w-max"
        style={gridStyle}
        data-testid="jcf-elements-header"
      >
        {/* Empty label cell */}
        <div className="px-[10px] py-[7px] text-[11px] text-zinc-500 font-medium border-r border-zinc-800 sticky left-0 bg-zinc-900 z-10" />

        {/* Element headers */}
        {elements.map((element, index) => (
          <div
            key={`header-${index}`}
            className={`px-[10px] py-[7px] ${index < elements.length - 1 ? 'border-r border-zinc-800' : ''}`}
          >
            <div className="flex items-center justify-between gap-[7px]">
              {editingElementIndex === index ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => handleNameKeyDown(e, index)}
                  onBlur={() => handleSaveName(index)}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  className="text-[11px] text-zinc-100 font-medium bg-transparent border border-zinc-600 rounded-[3px] px-[3px] flex-1 min-w-0 focus:border-blue-500 focus:outline-none"
                  data-testid={`jcf-element-name-input-${index}`}
                />
              ) : (
                <div
                  className="flex-1 cursor-pointer hover:bg-zinc-800/50 rounded-[3px] px-[3px] mx-[-3px] py-[2px] my-[-2px] transition-colors"
                  onClick={() => handleStartEditing(index)}
                  data-testid={`jcf-element-name-${index}`}
                >
                  <span className="text-[11px] text-zinc-400 font-medium hover:text-zinc-300 transition-colors">
                    {element.name}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-[3px]">
                <button
                  type="button"
                  className={`transition-colors ${
                    canDelete
                      ? 'text-zinc-600 hover:text-red-400'
                      : 'text-zinc-600 opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!canDelete}
                  onClick={() => handleRemoveElement(index)}
                  aria-label="Supprimer cet élément"
                  data-testid={`jcf-element-remove-${index}`}
                >
                  <Minus className="w-[11px] h-[11px]" />
                </button>
                <button
                  type="button"
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                  onClick={() => handleAddElement(index)}
                  aria-label="Ajouter un élément"
                  data-testid={`jcf-element-add-${index}`}
                >
                  <Plus className="w-[11px] h-[11px]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Rows */}
      {rows.map((row, rowIndex) => {
        const isLastRow = rowIndex === rows.length - 1;
        const isPrecedencesRow = row.key === 'precedences';

        return (
          <div
            key={row.key}
            className={`grid ${!isLastRow ? 'border-b border-zinc-800/50' : ''} ${isPrecedencesRow ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/30'} min-w-max`}
            style={gridStyle}
            data-testid={`jcf-row-${row.key}`}
          >
            {/* Label cell (sticky) */}
            <div
              className={`px-[10px] py-[5px] text-[11px] ${isPrecedencesRow ? 'text-zinc-600' : 'text-zinc-500'} border-r border-zinc-800 flex items-center gap-[3px] sticky left-0 ${isPrecedencesRow ? 'bg-zinc-900/80' : 'bg-zinc-950/90'} z-10`}
            >
              {row.icon === 'git-branch' && (
                <GitBranch className="w-[10px] h-[10px]" />
              )}
              {row.label}
            </div>

            {/* Data cells */}
            {elements.map((element, elementIndex) => {
              const value = element[row.key];
              const isEmpty = value === '' || value === '-';
              const isLastElement = elementIndex === elements.length - 1;
              const isNumeric = numericFields.includes(row.key);
              const isTextarea = textareaFields.includes(row.key);

              return (
                <div
                  key={`${elementIndex}-${row.key}`}
                  className={`px-[5px] py-[3px] ${!isLastElement ? 'border-r border-zinc-800/50' : ''}`}
                  data-testid={`jcf-cell-${elementIndex}-${row.key}`}
                >
                  {isTextarea ? (
                    <textarea
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(e) =>
                        handleTextareaAutoExpand(e, elementIndex, row.key)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, elementIndex, rowIndex)
                      }
                      className={`${isEmpty ? inputEmptyClass : inputFilledClass} resize-none min-h-[28px] overflow-hidden text-[11px]`}
                      rows={1}
                      data-testid={`jcf-input-${elementIndex}-${row.key}`}
                    />
                  ) : row.key === 'format' ? (
                    <JcfFormatAutocomplete
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(v) =>
                        handleCellChange(elementIndex, 'format', v)
                      }
                      formats={PRODUCT_FORMATS}
                      sessionPresets={sessionLearning.productFormats}
                      onLearnPreset={sessionLearning.learnProductFormat}
                      inputClassName={`${inputFilledClass} text-[11px]`}
                      onTabOut={(_e, direction) => {
                        const lastRow = rows.length - 1;
                        const lastEl = elements.length - 1;
                        if (direction === 'forward') {
                          if (rowIndex < lastRow)
                            focusCell(elementIndex, rowIndex + 1);
                          else if (elementIndex < lastEl)
                            focusCell(elementIndex + 1, 0);
                        } else {
                          if (rowIndex > 0)
                            focusCell(elementIndex, rowIndex - 1);
                          else if (elementIndex > 0)
                            focusCell(elementIndex - 1, lastRow);
                        }
                      }}
                      onArrowNav={(_e, direction) => {
                        const rc = rows.length;
                        const ec = elements.length;
                        switch (direction) {
                          case 'down':
                            focusCell(
                              elementIndex,
                              (rowIndex + 1) % rc,
                            );
                            break;
                          case 'up':
                            focusCell(
                              elementIndex,
                              (rowIndex - 1 + rc) % rc,
                            );
                            break;
                          case 'right':
                            focusCell(
                              (elementIndex + 1) % ec,
                              rowIndex,
                            );
                            break;
                          case 'left':
                            focusCell(
                              (elementIndex - 1 + ec) % ec,
                              rowIndex,
                            );
                            break;
                        }
                      }}
                    />
                  ) : row.key === 'impression' ? (
                    <JcfImpressionAutocomplete
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(v) =>
                        handleCellChange(elementIndex, 'impression', v)
                      }
                      presets={IMPRESSION_PRESETS}
                      sessionPresets={sessionLearning.impressions}
                      onLearnPreset={sessionLearning.learnImpression}
                      inputClassName={`${inputFilledClass} text-[11px]`}
                      onTabOut={(_e, direction) => {
                        const lastRow = rows.length - 1;
                        const lastEl = elements.length - 1;
                        if (direction === 'forward') {
                          if (rowIndex < lastRow)
                            focusCell(elementIndex, rowIndex + 1);
                          else if (elementIndex < lastEl)
                            focusCell(elementIndex + 1, 0);
                        } else {
                          if (rowIndex > 0)
                            focusCell(elementIndex, rowIndex - 1);
                          else if (elementIndex > 0)
                            focusCell(elementIndex - 1, lastRow);
                        }
                      }}
                      onArrowNav={(_e, direction) => {
                        const rc = rows.length;
                        const ec = elements.length;
                        switch (direction) {
                          case 'down':
                            focusCell(
                              elementIndex,
                              (rowIndex + 1) % rc,
                            );
                            break;
                          case 'up':
                            focusCell(
                              elementIndex,
                              (rowIndex - 1 + rc) % rc,
                            );
                            break;
                          case 'right':
                            focusCell(
                              (elementIndex + 1) % ec,
                              rowIndex,
                            );
                            break;
                          case 'left':
                            focusCell(
                              (elementIndex - 1 + ec) % ec,
                              rowIndex,
                            );
                            break;
                        }
                      }}
                    />
                  ) : row.key === 'surfacage' ? (
                    <JcfSurfacageAutocomplete
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(v) =>
                        handleCellChange(elementIndex, 'surfacage', v)
                      }
                      presets={SURFACAGE_PRESETS}
                      sessionPresets={sessionLearning.surfacages}
                      onLearnPreset={sessionLearning.learnSurfacage}
                      inputClassName={`${inputFilledClass} text-[11px]`}
                      onTabOut={(_e, direction) => {
                        const lastRow = rows.length - 1;
                        const lastEl = elements.length - 1;
                        if (direction === 'forward') {
                          if (rowIndex < lastRow)
                            focusCell(elementIndex, rowIndex + 1);
                          else if (elementIndex < lastEl)
                            focusCell(elementIndex + 1, 0);
                        } else {
                          if (rowIndex > 0)
                            focusCell(elementIndex, rowIndex - 1);
                          else if (elementIndex > 0)
                            focusCell(elementIndex - 1, lastRow);
                        }
                      }}
                      onArrowNav={(_e, direction) => {
                        const rc = rows.length;
                        const ec = elements.length;
                        switch (direction) {
                          case 'down':
                            focusCell(
                              elementIndex,
                              (rowIndex + 1) % rc,
                            );
                            break;
                          case 'up':
                            focusCell(
                              elementIndex,
                              (rowIndex - 1 + rc) % rc,
                            );
                            break;
                          case 'right':
                            focusCell(
                              (elementIndex + 1) % ec,
                              rowIndex,
                            );
                            break;
                          case 'left':
                            focusCell(
                              (elementIndex - 1 + ec) % ec,
                              rowIndex,
                            );
                            break;
                        }
                      }}
                    />
                  ) : row.key === 'quantite' ? (
                    <JcfQuantiteInput
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(v) =>
                        handleCellChange(elementIndex, 'quantite', v)
                      }
                      inputClassName={`${inputFilledClass} text-[11px]`}
                      onTabOut={(_e, direction) => {
                        const lastRow = rows.length - 1;
                        const lastEl = elements.length - 1;
                        if (direction === 'forward') {
                          if (rowIndex < lastRow)
                            focusCell(elementIndex, rowIndex + 1);
                          else if (elementIndex < lastEl)
                            focusCell(elementIndex + 1, 0);
                        } else {
                          if (rowIndex > 0)
                            focusCell(elementIndex, rowIndex - 1);
                          else if (elementIndex > 0)
                            focusCell(elementIndex - 1, lastRow);
                        }
                      }}
                      onArrowNav={(_e, direction) => {
                        const rc = rows.length;
                        const ec = elements.length;
                        switch (direction) {
                          case 'down':
                            focusCell(
                              elementIndex,
                              (rowIndex + 1) % rc,
                            );
                            break;
                          case 'up':
                            focusCell(
                              elementIndex,
                              (rowIndex - 1 + rc) % rc,
                            );
                            break;
                          case 'right':
                            focusCell(
                              (elementIndex + 1) % ec,
                              rowIndex,
                            );
                            break;
                          case 'left':
                            focusCell(
                              (elementIndex - 1 + ec) % ec,
                              rowIndex,
                            );
                            break;
                        }
                      }}
                    />
                  ) : row.key === 'pagination' ? (
                    <JcfPaginationInput
                      id={getCellId(elementIndex, rowIndex)}
                      value={value}
                      onChange={(v) =>
                        handleCellChange(elementIndex, 'pagination', v)
                      }
                      inputClassName={`${inputFilledClass} text-[11px]`}
                      onTabOut={(_e, direction) => {
                        const lastRow = rows.length - 1;
                        const lastEl = elements.length - 1;
                        if (direction === 'forward') {
                          if (rowIndex < lastRow)
                            focusCell(elementIndex, rowIndex + 1);
                          else if (elementIndex < lastEl)
                            focusCell(elementIndex + 1, 0);
                        } else {
                          if (rowIndex > 0)
                            focusCell(elementIndex, rowIndex - 1);
                          else if (elementIndex > 0)
                            focusCell(elementIndex - 1, lastRow);
                        }
                      }}
                      onArrowNav={(_e, direction) => {
                        const rc = rows.length;
                        const ec = elements.length;
                        switch (direction) {
                          case 'down':
                            focusCell(
                              elementIndex,
                              (rowIndex + 1) % rc,
                            );
                            break;
                          case 'up':
                            focusCell(
                              elementIndex,
                              (rowIndex - 1 + rc) % rc,
                            );
                            break;
                          case 'right':
                            focusCell(
                              (elementIndex + 1) % ec,
                              rowIndex,
                            );
                            break;
                          case 'left':
                            focusCell(
                              (elementIndex - 1 + ec) % ec,
                              rowIndex,
                            );
                            break;
                        }
                      }}
                    />
                  ) : (
                    <input
                      id={getCellId(elementIndex, rowIndex)}
                      type="text"
                      value={value}
                      onChange={(e) =>
                        handleCellChange(elementIndex, row.key, e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, elementIndex, rowIndex)
                      }
                      className={`${isEmpty ? inputEmptyClass : inputFilledClass}${isNumeric ? ' text-right' : ''} text-[11px]`}
                      data-testid={`jcf-input-${elementIndex}-${row.key}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
