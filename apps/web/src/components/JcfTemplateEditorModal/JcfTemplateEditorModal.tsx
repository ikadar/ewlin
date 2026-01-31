/**
 * JcfTemplateEditorModal - Create and edit templates
 *
 * Two modes:
 * - Create: Initialize with elements from current job
 * - Edit: Load existing template for modification
 *
 * Features:
 * - Form tab with TemplateHeaderForm + ElementsTable
 * - Validation (name required, at least one element)
 * - Keyboard shortcuts (Cmd+S, Esc)
 *
 * @see v0.4.34 - JCF: Template CRUD & Apply
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { JcfTemplate, JcfTemplateElement } from '@flux/types';
import { JcfTemplateHeaderForm } from '../JcfTemplateHeaderForm';
import type { TemplateHeaderData } from '../JcfTemplateHeaderForm';
import { JcfElementsTable } from '../JcfElementsTable';
import type { JcfElement } from '../JcfElementsTable/types';

export interface TemplateEditorData {
  name: string;
  description?: string;
  category?: string;
  clientName?: string;
  elements: JcfTemplateElement[];
}

export interface JcfTemplateEditorModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Existing template to edit (edit mode) */
  template?: JcfTemplate;
  /** Elements from current job (create mode) */
  initialElements?: JcfTemplateElement[];
  /** Pre-fill client name (create mode) */
  initialClientName?: string;
  /** Called on save with template data */
  onSave: (data: TemplateEditorData & { id?: string }) => void;
  /** Called on cancel/close */
  onCancel: () => void;
  /** Disable interactions while saving */
  isSaving?: boolean;
}

/**
 * Convert JcfTemplateElement to JcfElement (form state).
 */
function templateElementToFormElement(el: JcfTemplateElement): JcfElement {
  return {
    name: el.name,
    precedences: el.precedences,
    quantite: el.quantite,
    format: el.format,
    pagination: el.pagination,
    papier: el.papier,
    imposition: el.imposition,
    impression: el.impression,
    surfacage: el.surfacage,
    autres: el.autres,
    qteFeuilles: el.qteFeuilles,
    commentaires: el.commentaires,
    sequence: el.sequence,
  };
}

/**
 * Convert JcfElement (form state) to JcfTemplateElement.
 */
function formElementToTemplateElement(el: JcfElement): JcfTemplateElement {
  return {
    name: el.name,
    precedences: el.precedences,
    quantite: el.quantite,
    format: el.format,
    pagination: el.pagination,
    papier: el.papier,
    imposition: el.imposition,
    impression: el.impression,
    surfacage: el.surfacage,
    autres: el.autres,
    qteFeuilles: el.qteFeuilles,
    commentaires: el.commentaires,
    sequence: el.sequence,
  };
}

/**
 * Create empty template data.
 */
function createEmptyTemplate(
  clientName?: string,
  elements?: JcfTemplateElement[]
): { header: TemplateHeaderData; elements: JcfElement[] } {
  return {
    header: {
      name: '',
      description: '',
      category: '',
      clientName: clientName || '',
    },
    elements: elements?.map(templateElementToFormElement) || [],
  };
}

/**
 * Extract editable data from template.
 */
function templateToEditorData(
  template: JcfTemplate
): { header: TemplateHeaderData; elements: JcfElement[] } {
  return {
    header: {
      name: template.name,
      description: template.description || '',
      category: template.category || '',
      clientName: template.clientName || '',
    },
    elements: template.elements.map(templateElementToFormElement),
  };
}

export function JcfTemplateEditorModal({
  isOpen,
  template,
  initialElements,
  initialClientName,
  onSave,
  onCancel,
  isSaving,
}: JcfTemplateEditorModalProps) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  // Determine mode
  const isEditMode = !!template;
  const title = isEditMode ? 'Modifier le template' : 'Enregistrer comme template';

  // Initialize state from template or initial data
  const initialData = useMemo(() => {
    if (isEditMode && template) {
      return templateToEditorData(template);
    }
    return createEmptyTemplate(initialClientName, initialElements);
  }, [isEditMode, template, initialClientName, initialElements]);

  // Form state
  const [header, setHeader] = useState<TemplateHeaderData>(initialData.header);
  const [elements, setElements] = useState<JcfElement[]>(initialData.elements);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setHeader(initialData.header);
      setElements(initialData.elements);
      setValidationError(null);
    }
  }, [isOpen, initialData]);

  // Stable close handler
  const stableOnCancel = useCallback(() => {
    if (!isSaving) {
      onCancel();
    }
  }, [onCancel, isSaving]);

  // Validate template data
  const validateTemplate = useCallback((): string | null => {
    if (!header.name.trim()) {
      return 'Le nom du template est obligatoire';
    }
    if (elements.length === 0) {
      return 'Le template doit contenir au moins un élément';
    }
    // Check that all elements have names
    for (let i = 0; i < elements.length; i++) {
      if (!elements[i].name.trim()) {
        return `L'élément ${i + 1} doit avoir un nom`;
      }
    }
    return null;
  }, [header.name, elements]);

  // Handle save
  const handleSave = useCallback(() => {
    const error = validateTemplate();
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);

    const data: TemplateEditorData & { id?: string } = {
      name: header.name.trim(),
      description: header.description?.trim() || undefined,
      category: header.category?.trim() || undefined,
      clientName: header.clientName?.trim() || undefined,
      elements: elements.map(formElementToTemplateElement),
      id: template?.id,
    };

    onSave(data);
  }, [validateTemplate, header, elements, template?.id, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving) {
          handleSave();
        }
        return;
      }

      if (e.key === 'Escape' && !e.defaultPrevented) {
        stableOnCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, handleSave, stableOnCancel]);

  if (!isOpen) return null;

  // Track where mousedown started for backdrop click
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target;
  };

  // Only close if both mousedown AND mouseup were on the backdrop
  const handleMouseUp = (e: React.MouseEvent) => {
    if (
      e.target === e.currentTarget &&
      mouseDownTargetRef.current === e.currentTarget &&
      !isSaving
    ) {
      onCancel();
    }
    mouseDownTargetRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-testid="template-editor-backdrop"
    >
      <div
        className="w-[70vw] max-w-[1400px] max-h-[90vh] bg-zinc-950 rounded-[7px] border border-zinc-800 flex flex-col overflow-hidden text-base leading-[1.4]"
        data-testid="template-editor-dialog"
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-[13px] py-[10px] bg-zinc-900 border-b border-zinc-800">
          <h2
            className="text-[15px] leading-[23px] font-medium text-zinc-100"
            data-testid="template-editor-title"
          >
            {title}
          </h2>
          <button
            onClick={stableOnCancel}
            disabled={isSaving}
            className="p-[3px] rounded-[3px] hover:bg-zinc-800 transition-colors disabled:opacity-50"
            aria-label="Fermer"
            data-testid="template-editor-close"
          >
            <X size={20} className="text-zinc-400 hover:text-zinc-100" />
          </button>
        </header>

        {/* Content */}
        <main
          className="flex-1 overflow-y-auto px-[20px] py-[13px] space-y-[13px]"
          data-testid="template-editor-content"
        >
          {/* Template header form */}
          <JcfTemplateHeaderForm
            value={header}
            onChange={setHeader}
            disabled={isSaving}
          />

          {/* Elements table */}
          <JcfElementsTable
            elements={elements}
            onElementsChange={setElements}
            mode="template"
            jobQuantity="1"
          />
        </main>

        {/* Footer */}
        <footer
          className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800"
          data-testid="template-editor-footer"
        >
          {/* Error display */}
          {validationError && (
            <div className="px-[13px] py-[8px] border-b border-zinc-800/50">
              <div className="flex items-center gap-[8px] px-[10px] py-[8px] bg-red-500/10 border border-red-500/30 rounded-[3px] text-red-400 text-sm">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            </div>
          )}

          {/* Keyboard hints row */}
          <div className="px-[13px] py-[5px] border-b border-zinc-800/50 flex items-center gap-[13px] text-sm text-zinc-500">
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">
                Tab
              </kbd>{' '}
              Suivant
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">
                ⌘S
              </kbd>{' '}
              Sauvegarder
            </span>
            <span className="flex items-center gap-[3px]">
              <kbd className="bg-zinc-800 px-[5px] py-[2px] rounded-[3px] text-zinc-400">
                Esc
              </kbd>{' '}
              Fermer
            </span>
          </div>

          {/* Action buttons row */}
          <div className="px-[13px] py-[8px] flex items-center justify-end gap-[10px]">
            <button
              onClick={stableOnCancel}
              disabled={isSaving}
              className="px-[13px] py-[7px] text-zinc-300 hover:bg-zinc-800 rounded-[3px] transition-colors disabled:opacity-50"
              data-testid="template-editor-cancel"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-[13px] py-[7px] bg-blue-600 hover:bg-blue-500 text-white rounded-[3px] font-medium transition-colors disabled:opacity-50"
              data-testid="template-editor-save"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
