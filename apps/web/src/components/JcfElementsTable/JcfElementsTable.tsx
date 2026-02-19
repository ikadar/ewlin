import { useState, useCallback, useMemo, useEffect, type MutableRefObject } from 'react';
import { GitBranch, Minus, Plus } from 'lucide-react';
import { DEFAULT_ELEMENT, generateElementName } from './types';
import type { JcfElement, JcfFieldKey } from './types';
import { useLinkPropagation, isLinkableField } from '../../hooks/useLinkPropagation';
import { useSessionLearning } from '../../hooks/useSessionLearning';
import { JcfErrorTooltip } from '../JcfErrorTooltip';
import { CellContent } from './CellContent';
import type { PostePresetLike } from '../JcfSequenceAutocomplete/JcfSequenceAutocomplete';
import { validateAllElements, validateAllForSubmit, getCellError } from './validation';
import {
  getAllRequiredFields,
  hasRequiredIndicator,
  type JcfMode,
} from './requiredFields';
import { calculateQteFeuillesFromStrings } from './calculatedFields';
import {
  getTabNavigationTarget,
  getArrowNavigationTarget,
} from './navigationUtils';

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
// v0.4.35: Linked field styling
const inputLinkedClass = `${inputBaseClass} text-blue-400 cursor-pointer`;

// ── Component ──

export interface JcfElementsTableProps {
  /** Current elements array */
  elements: JcfElement[];
  /** Callback when elements change */
  onElementsChange: (elements: JcfElement[]) => void;
  /** Poste presets for sequence autocomplete (from snapshot or reference data) */
  postePresets?: ReadonlyArray<PostePresetLike>;
  /**
   * Per-element workflow-guided suggestion ordering for sequence autocomplete.
   * Outer array indexed by element, inner array is expected production step categories in order.
   * @see JcfSequenceAutocompleteProps.sequenceWorkflow
   */
  sequenceWorkflows?: string[][];
  /** Job quantity for qteFeuilles auto-calculation */
  jobQuantity?: string;
  /** Mode: 'job' shows required indicators, 'template' does not */
  mode?: JcfMode;
  /**
   * Ref to expose the save validation handler to parent.
   * Parent sets this ref, and we populate it with a function that returns true if valid.
   * @see v0.4.30 Submit Validation
   */
  onSaveAttemptRef?: MutableRefObject<(() => boolean) | null>;
  /**
   * Callback when save validation passes.
   * Called with the current elements array for the parent to proceed with API call.
   */
  onSave?: (elements: JcfElement[]) => void;
}

export function JcfElementsTable({
  elements,
  onElementsChange,
  postePresets = [],
  sequenceWorkflows,
  jobQuantity = '',
  mode = 'job',
  onSaveAttemptRef,
  onSave,
}: JcfElementsTableProps) {
  const [editingElementIndex, setEditingElementIndex] = useState<number | null>(
    null,
  );
  const [editingName, setEditingName] = useState('');

  // Level 3: Track if user has attempted to submit (triggers submit errors)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Auto-calculation state per element (true = auto, false = manual)
  const [autoCalculated, setAutoCalculated] = useState<Record<number, boolean>>(
    () => {
      const initial: Record<number, boolean> = {};
      elements.forEach((_, i) => {
        initial[i] = true;
      });
      return initial;
    },
  );

  // Track blurred fields for strict validation (sequence field)
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Mark a field as touched when user blurs it
  const markFieldTouched = useCallback(
    (elementIndex: number, field: string) => {
      const key = `${elementIndex}-${field}`;
      setTouchedFields((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    },
    [],
  );

  const sessionLearning = useSessionLearning();

  // v0.4.35: Link propagation between elements
  const linkPropagation = useLinkPropagation({
    elements,
    onElementsChange,
  });

  // Element names for precedences autocomplete
  const elementNames = useMemo(
    () => elements.map((el) => el.name),
    [elements],
  );

  const rows = useMemo(() => [...baseRows, sequenceRow], []);

  // Validation errors map
  // Level 1: Live errors (always shown)
  // Level 3: Submit errors (shown after hasAttemptedSubmit)
  const validationErrors = useMemo(
    () =>
      hasAttemptedSubmit
        ? validateAllForSubmit(elements, mode)
        : validateAllElements(elements, touchedFields, mode),
    [elements, touchedFields, hasAttemptedSubmit, mode],
  );

  // Required fields map (Level 2 indicators)
  const requiredFields = useMemo(
    () => getAllRequiredFields(elements, mode),
    [elements, mode],
  );

  // Fingerprint for qteFeuilles recalculation (quantite + imposition)
  const qtyImpositionFingerprint = useMemo(
    () => JSON.stringify(elements.map((e) => [e.quantite, e.imposition])),
    [elements],
  );

  // Auto-calculate qteFeuilles when inputs change
  useEffect(() => {
    const jobQty = parseInt(jobQuantity, 10) || 0;
    if (jobQty === 0) return; // No calculation without job quantity

    let changed = false;
    const updated = elements.map((el, index) => {
      // Skip if manual mode
      if (autoCalculated[index] === false) return el;

      const calculated = calculateQteFeuillesFromStrings(
        jobQuantity,
        el.quantite,
        el.imposition,
      );
      if (!calculated) return el;

      if (el.qteFeuilles !== calculated) {
        changed = true;
        return { ...el, qteFeuilles: calculated };
      }
      return el;
    });

    if (changed) {
      onElementsChange(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobQuantity, qtyImpositionFingerprint, autoCalculated]);

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
        // Rename element + cascade: update precedences referencing old name
        const updated = elements.map((el, i) => {
          const renamed = i === index ? { ...el, name: newName } : el;
          // Update precedences that reference the old name
          if (renamed.precedences) {
            const precs = renamed.precedences.split(',').map((p) => p.trim());
            const updatedPrecs = precs.map((p) =>
              p === oldName ? newName : p,
            );
            return { ...renamed, precedences: updatedPrecs.join(',') };
          }
          return renamed;
        });
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
        e.stopPropagation(); // Prevent modal from closing
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
      const removedName = elements[index].name;
      // Remove element + cascade: remove its name from all precedences
      const updated = elements
        .filter((_, i) => i !== index)
        .map((el) => {
          if (el.precedences) {
            const precs = el.precedences
              .split(',')
              .map((p) => p.trim())
              .filter((p) => p !== removedName && p !== '');
            return { ...el, precedences: precs.join(',') };
          }
          return el;
        });
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
      const isTextarea = textareaFields.includes(rows[rowIndex].key);

      // Alt+Arrow — circular wrap navigation
      if (e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const direction = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
        const target = getArrowNavigationTarget(direction, elementIndex, rowIndex, rowCount, elementCount);
        focusCell(target.elementIndex, target.rowIndex);
        return;
      }

      // Enter — move to next cell (text inputs only; textareas keep newline)
      if (e.key === 'Enter' && !isTextarea) {
        e.preventDefault();
        const target = getTabNavigationTarget('forward', elementIndex, rowIndex, rowCount, elementCount);
        if (target) {
          focusCell(target.elementIndex, target.rowIndex);
        }
        return;
      }

      // Escape — blur current cell
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent modal from closing
        (e.target as HTMLElement).blur();
        return;
      }

      // Tab / Shift+Tab — vertical navigation within column
      if (e.key !== 'Tab') return;

      const direction = e.shiftKey ? 'backward' : 'forward';
      const target = getTabNavigationTarget(direction, elementIndex, rowIndex, rowCount, elementCount);
      if (target) {
        e.preventDefault();
        focusCell(target.elementIndex, target.rowIndex);
      }
      // null = boundary, let native Tab/Shift+Tab exit
    },
    [rows, elements.length, focusCell],
  );

  // ── Cell change ──

  const handleCellChange = useCallback(
    (elementIndex: number, field: JcfFieldKey, value: string) => {
      // v0.4.35: Use link propagation for linkable fields
      if (isLinkableField(field)) {
        linkPropagation.updateFieldWithPropagation(elementIndex, field, value);
        return;
      }

      const updated = elements.map((el, i) =>
        i === elementIndex ? { ...el, [field]: value } : el,
      );
      onElementsChange(updated);
    },
    [elements, onElementsChange, linkPropagation],
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

  // ── qteFeuilles handlers ──

  // Manual qteFeuilles change - switches to manual mode
  const handleQteFeuillesChange = useCallback(
    (elementIndex: number, value: string) => {
      setAutoCalculated((prev) => ({ ...prev, [elementIndex]: false }));
      handleCellChange(elementIndex, 'qteFeuilles', value);
    },
    [handleCellChange],
  );

  // Toggle auto-calculation mode
  const handleToggleAutoCalculated = useCallback((elementIndex: number) => {
    setAutoCalculated((prev) => ({ ...prev, [elementIndex]: !prev[elementIndex] }));
  }, []);

  // ── Level 3: Submit Validation ──

  /**
   * Handle save attempt - validates and returns success status.
   * Sets hasAttemptedSubmit to trigger Level 3 error display.
   */
  const handleSaveAttempt = useCallback((): boolean => {
    setHasAttemptedSubmit(true);
    const submitErrors = validateAllForSubmit(elements, mode);

    if (submitErrors.size > 0) {
      // Validation failed - errors will be displayed
      return false;
    }

    // Validation passed - call onSave if provided
    if (onSave) {
      onSave(elements);
    }
    return true;
  }, [elements, mode, onSave]);

  // Expose handleSaveAttempt to parent via ref
  useEffect(() => {
    if (onSaveAttemptRef) {
      onSaveAttemptRef.current = handleSaveAttempt;
    }
  }, [onSaveAttemptRef, handleSaveAttempt]);

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
        <div className="px-[10px] py-[7px] text-sm text-zinc-500 font-medium border-r border-zinc-800 sticky left-0 bg-zinc-900 z-10" />

        {/* Element headers */}
        {elements.map((element, index) => (
          <div
            key={`header-${element.name}-${index}`}
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
                  autoComplete="off"
                  className="text-base text-zinc-100 font-medium bg-transparent border border-zinc-600 rounded-[3px] px-[3px] flex-1 min-w-0 focus:border-blue-500 focus:outline-none"
                  data-testid={`jcf-element-name-input-${index}`}
                />
              ) : (
                <button
                  type="button"
                  className="flex-1 cursor-pointer hover:bg-zinc-800/50 rounded-[3px] px-[3px] mx-[-3px] py-[2px] my-[-2px] transition-colors text-left"
                  onClick={() => handleStartEditing(index)}
                  data-testid={`jcf-element-name-${index}`}
                >
                  <span className="text-base text-zinc-400 font-medium hover:text-zinc-300 transition-colors">
                    {element.name}
                  </span>
                </button>
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
              className={`px-[10px] py-[5px] text-sm ${isPrecedencesRow ? 'text-zinc-600' : 'text-zinc-500'} border-r border-zinc-800 flex items-center gap-[3px] sticky left-0 ${isPrecedencesRow ? 'bg-zinc-900/80' : 'bg-zinc-950/90'} z-10`}
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
              const cellError = getCellError(
                validationErrors,
                elementIndex,
                row.key,
              );
              const hasError = !!cellError;
              const showRequiredIndicator = hasRequiredIndicator(
                requiredFields,
                validationErrors,
                elementIndex,
                row.key,
              );
              const isQteFeuilles = row.key === 'qteFeuilles';
              const isAutoMode = autoCalculated[elementIndex] !== false;

              // v0.4.35: Link propagation state
              const isLinkable = isLinkableField(row.key);
              const canLinkThisCell = isLinkable && linkPropagation.canLink(elementIndex);
              const isLinked = isLinkable && linkPropagation.isLinked(elementIndex, row.key as JcfLinkableField);

              return (
                <div
                  key={`${elementIndex}-${row.key}`}
                  className={`px-[5px] py-[3px] relative ${!isLastElement ? 'border-r border-zinc-800/50' : ''} ${hasError ? 'bg-red-900/20 transition-colors duration-500' : ''} ${isLinked ? 'bg-blue-900/30' : ''}`}
                  data-testid={`jcf-cell-${elementIndex}-${row.key}`}
                >
                  {/* Error tooltip */}
                  {cellError && (
                    <JcfErrorTooltip
                      message={cellError.message}
                      visible={hasError}
                      inputId={getCellId(elementIndex, rowIndex)}
                    />
                  )}
                  {/* Required indicator (Level 2) - amber dot */}
                  <span
                    className={`absolute top-0.5 right-1 w-[6px] h-[6px] rounded-full bg-amber-500 z-20 transition-opacity duration-300 ${showRequiredIndicator ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    title="Champ requis"
                    data-testid={`required-indicator-${elementIndex}-${row.key}`}
                  />
                  <CellContent
                    rowKey={row.key}
                    value={value}
                    mode={mode}
                    isEmpty={isEmpty}
                    isTextarea={isTextarea}
                    isNumeric={isNumeric}
                    isQteFeuilles={isQteFeuilles}
                    isAutoMode={isAutoMode}
                    isLinked={isLinked}
                    canLinkThisCell={canLinkThisCell}
                    elementIndex={elementIndex}
                    rowIndex={rowIndex}
                    rowCount={rows.length}
                    elementCount={elements.length}
                    cellId={getCellId(elementIndex, rowIndex)}
                    inputEmptyClass={inputEmptyClass}
                    inputFilledClass={inputFilledClass}
                    inputLinkedClass={inputLinkedClass}
                    elementNames={elementNames}
                    currentElementName={element.name}
                    postePresets={postePresets}
                    sequenceWorkflow={sequenceWorkflows?.[elementIndex]}
                    sessionLearning={sessionLearning}
                    linkPropagation={linkPropagation}
                    focusCell={focusCell}
                    handleCellChange={handleCellChange}
                    handleCellKeyDown={handleCellKeyDown}
                    handleTextareaAutoExpand={handleTextareaAutoExpand}
                    handleQteFeuillesChange={handleQteFeuillesChange}
                    handleToggleAutoCalculated={handleToggleAutoCalculated}
                    markFieldTouched={markFieldTouched}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
