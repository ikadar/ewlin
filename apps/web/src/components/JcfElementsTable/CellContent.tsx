/**
 * CellContent - Renders the appropriate input/component for each cell type
 * Extracted from JcfElementsTable to reduce cognitive complexity
 */

import { useMemo } from 'react';
import { Calculator } from 'lucide-react';
import type { JcfFieldKey, JcfLinkableField } from './types';
import type { SessionLearning } from '../../hooks/useSessionLearning';
import type { LinkPropagationState } from '../../hooks/useLinkPropagation';
import { JcfSequenceAutocomplete } from '../JcfSequenceAutocomplete/JcfSequenceAutocomplete';
import type { PostePresetLike } from '../JcfSequenceAutocomplete/JcfSequenceAutocomplete';
import { WorkflowSequenceAutocomplete } from '../WorkflowSequenceAutocomplete/WorkflowSequenceAutocomplete';
import { JcfFormatAutocomplete } from '../JcfFormatAutocomplete/JcfFormatAutocomplete';
import { JcfImpressionAutocomplete } from '../JcfImpressionAutocomplete/JcfImpressionAutocomplete';
import { JcfSurfacageAutocomplete } from '../JcfSurfacageAutocomplete/JcfSurfacageAutocomplete';
import { JcfPapierAutocomplete } from '../JcfPapierAutocomplete/JcfPapierAutocomplete';
import { JcfImpositionAutocomplete } from '../JcfImpositionAutocomplete/JcfImpositionAutocomplete';
import { JcfPrecedencesAutocomplete } from '../JcfPrecedencesAutocomplete/JcfPrecedencesAutocomplete';
import { JcfQuantiteInput } from '../JcfQuantiteInput/JcfQuantiteInput';
import { JcfPaginationInput } from '../JcfPaginationInput/JcfPaginationInput';
import { JcfLinkToggle } from '../JcfLinkToggle/JcfLinkToggle';
import {
  SOUSTRAITANT_PRESETS,
  PRODUCT_FORMATS,
  IMPRESSION_PRESETS,
  SURFACAGE_PRESETS,
  PAPER_TYPES,
  FEUILLE_FORMATS,
  POSTE_CATEGORIES,
} from '../../mock/reference-data';
import { useGetFormatsQuery } from '../../store/api/formatApi';
import { useGetImpressionPresetsQuery } from '../../store/api/impressionPresetApi';
import { useGetSurfacagePresetsQuery } from '../../store/api/surfacagePresetApi';
import { useGetFeuilleFormatsQuery } from '../../store/api/feuilleFormatApi';
import { useGetProvidersQuery } from '../../store/api/providerApi';
import type { JcfMode } from './requiredFields';
import { createTabOutHandler, createArrowNavHandler } from './navigationUtils';

export interface CellContentProps {
  rowKey: JcfFieldKey;
  value: string;
  mode?: JcfMode;
  isEmpty: boolean;
  isTextarea: boolean;
  isNumeric: boolean;
  isQteFeuilles: boolean;
  isAutoMode: boolean;
  isLinked: boolean;
  canLinkThisCell: boolean;
  elementIndex: number;
  rowIndex: number;
  rowCount: number;
  elementCount: number;
  cellId: string;
  inputEmptyClass: string;
  inputFilledClass: string;
  inputLinkedClass: string;
  elementNames: string[];
  currentElementName: string;
  postePresets: ReadonlyArray<PostePresetLike>;
  sequenceWorkflow?: string[];
  sessionLearning: SessionLearning;
  linkPropagation: LinkPropagationState;
  focusCell: (elementIndex: number, rowIndex: number) => void;
  handleCellChange: (elementIndex: number, field: JcfFieldKey, value: string) => void;
  handleCellKeyDown: (e: React.KeyboardEvent, elementIndex: number, rowIndex: number) => void;
  handleTextareaAutoExpand: (e: React.ChangeEvent<HTMLTextAreaElement>, elementIndex: number, field: JcfFieldKey) => void;
  handleQteFeuillesChange: (elementIndex: number, value: string) => void;
  handleToggleAutoCalculated: (elementIndex: number) => void;
  markFieldTouched: (elementIndex: number, field: JcfFieldKey) => void;
}

/** Render sequence autocomplete cell */
function SequenceCell(props: CellContentProps) {
  const { cellId, value, inputFilledClass, elementIndex, rowIndex, rowCount, elementCount } = props;
  const { postePresets, sequenceWorkflow, sessionLearning, focusCell, handleCellChange, markFieldTouched } = props;

  const { data: providers } = useGetProvidersQuery();

  const dynamicSoustraitantPresets = useMemo(() => {
    if (!providers) return SOUSTRAITANT_PRESETS;
    return providers
      .filter(p => p.status === 'Active')
      .map(p => ({ name: p.name }));
  }, [providers]);

  return (
    <JcfSequenceAutocomplete
      id={cellId}
      value={value}
      onChange={(v) => handleCellChange(elementIndex, 'sequence', v)}
      postePresets={postePresets}
      sessionPostes={sessionLearning.postes}
      onLearnPoste={(poste: PostePresetLike) => sessionLearning.learnPoste(poste as import('@flux/types').PostePreset)}
      soustraitantPresets={dynamicSoustraitantPresets}
      sessionSoustraitants={sessionLearning.soustraitants}
      onLearnSoustraitant={sessionLearning.learnSoustraitant}
      sequenceWorkflow={sequenceWorkflow}
      inputClassName={`${inputFilledClass} resize-none min-h-[28px] overflow-hidden text-base`}
      onTabOut={createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onArrowNav={createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onBlur={() => markFieldTouched(elementIndex, 'sequence')}
    />
  );
}

/** Render workflow sequence autocomplete cell (template mode — categories instead of machine names) */
function WorkflowSequenceCell(props: CellContentProps) {
  const { cellId, value, inputFilledClass, elementIndex, rowIndex, rowCount, elementCount } = props;
  const { postePresets, focusCell, handleCellChange, markFieldTouched } = props;

  // Derive unique category names from postePresets (snapshot-based, single source of truth)
  const categories = useMemo(() => {
    const seen = new Set<string>();
    return postePresets
      .map(p => p.category)
      .filter(c => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      });
  }, [postePresets]);

  return (
    <WorkflowSequenceAutocomplete
      id={cellId}
      value={value}
      onChange={(v) => handleCellChange(elementIndex, 'sequence', v)}
      categories={categories.length > 0 ? categories : POSTE_CATEGORIES}
      inputClassName={`${inputFilledClass} resize-none min-h-[28px] overflow-hidden text-base`}
      onTabOut={createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onArrowNav={createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onBlur={() => markFieldTouched(elementIndex, 'sequence')}
    />
  );
}

/** Render textarea cell */
function TextareaCell(props: CellContentProps) {
  const { cellId, value, isEmpty, inputEmptyClass, inputFilledClass, elementIndex, rowIndex, rowKey } = props;
  const { handleTextareaAutoExpand, handleCellKeyDown } = props;

  return (
    <textarea
      id={cellId}
      value={value}
      onChange={(e) => handleTextareaAutoExpand(e, elementIndex, rowKey)}
      onKeyDown={(e) => handleCellKeyDown(e, elementIndex, rowIndex)}
      className={`${isEmpty ? inputEmptyClass : inputFilledClass} resize-none min-h-[28px] overflow-hidden text-base`}
      rows={1}
      data-testid={`jcf-input-${elementIndex}-${rowKey}`}
    />
  );
}

/** Render linkable field cell (format, impression, surfacage, papier, imposition) */
function LinkableFieldCell(props: CellContentProps) {
  const { rowKey, cellId, value, isLinked, canLinkThisCell, inputFilledClass, inputLinkedClass } = props;
  const { elementIndex, rowIndex, rowCount, elementCount, sessionLearning, linkPropagation, focusCell, handleCellChange } = props;

  const { data: managedFormats } = useGetFormatsQuery();
  const formats = managedFormats ?? PRODUCT_FORMATS;

  const { data: managedImpressionPresets } = useGetImpressionPresetsQuery();
  const impressionPresets = managedImpressionPresets ?? IMPRESSION_PRESETS;

  const { data: managedSurfacagePresets } = useGetSurfacagePresetsQuery();
  const surfacagePresets = managedSurfacagePresets ?? SURFACAGE_PRESETS;

  const { data: managedFeuilleFormats } = useGetFeuilleFormatsQuery();
  const feuilleFormats = managedFeuilleFormats ?? FEUILLE_FORMATS;

  const toggleLink = () => linkPropagation.toggleLink(elementIndex, rowKey as JcfLinkableField);
  const tabOutHandler = createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount);
  const arrowNavHandler = createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount);

  const renderAutocomplete = () => {
    switch (rowKey) {
      case 'format':
        return (
          <JcfFormatAutocomplete
            id={cellId}
            value={value}
            onChange={(v) => handleCellChange(elementIndex, 'format', v)}
            formats={formats}
            sessionPresets={sessionLearning.productFormats}
            onLearnPreset={sessionLearning.learnProductFormat}
            inputClassName={`${inputFilledClass} text-base`}
            onTabOut={tabOutHandler}
            onArrowNav={arrowNavHandler}
          />
        );
      case 'impression':
        return (
          <JcfImpressionAutocomplete
            id={cellId}
            value={value}
            onChange={(v) => handleCellChange(elementIndex, 'impression', v)}
            presets={impressionPresets}
            sessionPresets={sessionLearning.impressions}
            onLearnPreset={sessionLearning.learnImpression}
            inputClassName={`${inputFilledClass} text-base`}
            onTabOut={tabOutHandler}
            onArrowNav={arrowNavHandler}
          />
        );
      case 'surfacage':
        return (
          <JcfSurfacageAutocomplete
            id={cellId}
            value={value}
            onChange={(v) => handleCellChange(elementIndex, 'surfacage', v)}
            presets={surfacagePresets}
            sessionPresets={sessionLearning.surfacages}
            onLearnPreset={sessionLearning.learnSurfacage}
            inputClassName={`${inputFilledClass} text-base`}
            onTabOut={tabOutHandler}
            onArrowNav={arrowNavHandler}
          />
        );
      case 'papier':
        return (
          <JcfPapierAutocomplete
            id={cellId}
            value={value}
            onChange={(v) => handleCellChange(elementIndex, 'papier', v)}
            paperTypes={PAPER_TYPES}
            sessionPaperTypes={sessionLearning.papiers}
            onLearnPaperType={sessionLearning.learnPapier}
            inputClassName={`${inputFilledClass} text-base`}
            onTabOut={tabOutHandler}
            onArrowNav={arrowNavHandler}
          />
        );
      case 'imposition':
        return (
          <JcfImpositionAutocomplete
            id={cellId}
            value={value}
            onChange={(v) => handleCellChange(elementIndex, 'imposition', v)}
            feuilleFormats={feuilleFormats}
            sessionFormats={sessionLearning.feuilleFormats}
            onLearnFormat={sessionLearning.learnFeuilleFormat}
            inputClassName={`${inputFilledClass} text-base`}
            onTabOut={tabOutHandler}
            onArrowNav={arrowNavHandler}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {canLinkThisCell && (
        <JcfLinkToggle
          isLinked={isLinked}
          onToggle={toggleLink}
          data-testid={`link-toggle-${elementIndex}-${rowKey}`}
        />
      )}
      {isLinked ? (
        <input
          id={cellId}
          type="text"
          value={value}
          readOnly
          onClick={toggleLink}
          className={`${inputLinkedClass} text-base flex-1 cursor-pointer`}
          title="Cliquer pour délier"
          data-testid={`jcf-input-${elementIndex}-${rowKey}`}
        />
      ) : (
        <div className="flex-1">{renderAutocomplete()}</div>
      )}
    </div>
  );
}

/** Render quantite input cell */
function QuantiteCell(props: CellContentProps) {
  const { cellId, value, inputFilledClass, elementIndex, rowIndex, rowCount, elementCount, focusCell, handleCellChange } = props;

  return (
    <JcfQuantiteInput
      id={cellId}
      value={value}
      onChange={(v) => handleCellChange(elementIndex, 'quantite', v)}
      inputClassName={`${inputFilledClass} text-base`}
      onTabOut={createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onArrowNav={createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
    />
  );
}

/** Render pagination input cell */
function PaginationCell(props: CellContentProps) {
  const { cellId, value, inputFilledClass, elementIndex, rowIndex, rowCount, elementCount, focusCell, handleCellChange } = props;

  return (
    <JcfPaginationInput
      id={cellId}
      value={value}
      onChange={(v) => handleCellChange(elementIndex, 'pagination', v)}
      inputClassName={`${inputFilledClass} text-base`}
      onTabOut={createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onArrowNav={createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
    />
  );
}

/** Render precedences autocomplete cell */
function PrecedencesCell(props: CellContentProps) {
  const { cellId, value, inputFilledClass, elementIndex, rowIndex, rowCount, elementCount } = props;
  const { elementNames, currentElementName, focusCell, handleCellChange } = props;

  return (
    <JcfPrecedencesAutocomplete
      id={cellId}
      value={value}
      onChange={(v) => handleCellChange(elementIndex, 'precedences', v)}
      elementNames={elementNames}
      currentElementName={currentElementName}
      inputClassName={`${inputFilledClass} text-base`}
      onTabOut={createTabOutHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
      onArrowNav={createArrowNavHandler(focusCell, elementIndex, rowIndex, rowCount, elementCount)}
    />
  );
}

/** Render qteFeuilles cell with auto-calculate toggle */
function QteFeuillesCell(props: CellContentProps) {
  const { cellId, value, isEmpty, isAutoMode, inputEmptyClass, inputFilledClass, elementIndex, rowIndex, rowKey } = props;
  const { handleQteFeuillesChange, handleToggleAutoCalculated, handleCellKeyDown } = props;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleToggleAutoCalculated(elementIndex)}
        className={`flex-shrink-0 p-0.5 rounded transition-colors ${
          isAutoMode
            ? 'text-emerald-500 hover:bg-emerald-900/30'
            : 'text-zinc-600 hover:bg-zinc-800'
        }`}
        title={
          isAutoMode
            ? 'Calcul auto actif - cliquer pour désactiver'
            : 'Calcul auto désactivé - cliquer pour réactiver'
        }
        data-testid={`auto-toggle-${elementIndex}`}
      >
        <Calculator className="w-2.5 h-2.5" />
      </button>
      <input
        id={cellId}
        type="text"
        value={value}
        onChange={(e) => handleQteFeuillesChange(elementIndex, e.target.value)}
        onKeyDown={(e) => handleCellKeyDown(e, elementIndex, rowIndex)}
        className={`${isEmpty ? inputEmptyClass : inputFilledClass} text-right ${isAutoMode ? 'text-emerald-500' : 'text-zinc-100'} text-base flex-1`}
        autoComplete="off"
        data-testid={`jcf-input-${elementIndex}-${rowKey}`}
      />
    </div>
  );
}

/** Render default text input cell */
function DefaultCell(props: CellContentProps) {
  const { cellId, value, isEmpty, isNumeric, inputEmptyClass, inputFilledClass, elementIndex, rowIndex, rowKey } = props;
  const { handleCellChange, handleCellKeyDown } = props;

  return (
    <input
      id={cellId}
      type="text"
      value={value}
      onChange={(e) => handleCellChange(elementIndex, rowKey, e.target.value)}
      onKeyDown={(e) => handleCellKeyDown(e, elementIndex, rowIndex)}
      className={`${isEmpty ? inputEmptyClass : inputFilledClass}${isNumeric ? ' text-right' : ''} text-base`}
      autoComplete="off"
      data-testid={`jcf-input-${elementIndex}-${rowKey}`}
    />
  );
}

const LINKABLE_FIELDS = ['format', 'impression', 'surfacage', 'papier', 'imposition'];

/**
 * CellContent - Main component that renders the appropriate cell type
 */
export function CellContent(props: CellContentProps) {
  const { rowKey, mode, isTextarea, isQteFeuilles } = props;

  // Sequence field — template mode uses category autocomplete, job mode uses machine DSL
  if (rowKey === 'sequence') {
    if (mode === 'template') {
      return <WorkflowSequenceCell {...props} />;
    }
    return <SequenceCell {...props} />;
  }

  // Textarea fields
  if (isTextarea) {
    return <TextareaCell {...props} />;
  }

  // Linkable fields (format, impression, surfacage, papier, imposition)
  if (LINKABLE_FIELDS.includes(rowKey)) {
    return <LinkableFieldCell {...props} />;
  }

  // Quantite field
  if (rowKey === 'quantite') {
    return <QuantiteCell {...props} />;
  }

  // Pagination field
  if (rowKey === 'pagination') {
    return <PaginationCell {...props} />;
  }

  // Precedences field
  if (rowKey === 'precedences') {
    return <PrecedencesCell {...props} />;
  }

  // QteFeuilles field with auto-calculate
  if (isQteFeuilles) {
    return <QteFeuillesCell {...props} />;
  }

  // Default text input
  return <DefaultCell {...props} />;
}
