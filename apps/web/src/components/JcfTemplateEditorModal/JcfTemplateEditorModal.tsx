/**
 * JcfTemplateEditorModal - Create and edit templates
 *
 * Two modes:
 * - Create: Initialize with elements from current job
 * - Edit: Load existing template for modification
 *
 * Features:
 * - Form tab with TemplateHeaderForm + ElementsTable
 * - JSON tab with CodeMirror editor (v0.4.35)
 * - Validation (name required, at least one element)
 * - Keyboard shortcuts (Cmd+S, Esc)
 * - Bidirectional sync between Form and JSON
 *
 * Architecture:
 * - JcfTemplateEditorModal: Handles visibility, renders content only when open
 * - TemplateEditorContent: Contains all state, gets remounted when modal opens
 *
 * @see v0.4.34 - JCF: Template CRUD & Apply
 * @see v0.4.35 - JCF: Link Propagation & Dual-Mode Editor
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, AlertTriangle, FileText, Code } from 'lucide-react';
import type { JcfTemplate, JcfTemplateElement } from '@flux/types';
import { JcfTemplateHeaderForm } from '../JcfTemplateHeaderForm';
import type { TemplateHeaderData } from '../JcfTemplateHeaderForm';
import { JcfElementsTable } from '../JcfElementsTable';
import type { JcfElement } from '../JcfElementsTable/types';
import { JcfJsonEditor } from './JcfJsonEditor';

/** Tab types for dual-mode editor (v0.4.35) */
type EditorTab = 'form' | 'json';

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

// ============================================================================
// Internal Content Component
// ============================================================================

interface TemplateEditorContentProps {
  template?: JcfTemplate;
  initialElements?: JcfTemplateElement[];
  initialClientName?: string;
  onSave: (data: TemplateEditorData & { id?: string }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

/**
 * Internal component containing all editor state.
 * Gets remounted when modal opens, ensuring fresh state.
 */
function TemplateEditorContent({
  template,
  initialElements,
  initialClientName,
  onSave,
  onCancel,
  isSaving,
}: TemplateEditorContentProps) {
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

  // Form state - initialized from initialData on mount
  const [header, setHeader] = useState<TemplateHeaderData>(initialData.header);
  const [elements, setElements] = useState<JcfElement[]>(initialData.elements);
  const [validationError, setValidationError] = useState<string | null>(null);

  // v0.4.35: Dual-mode editor tab state
  const [activeTab, setActiveTab] = useState<EditorTab>('form');
  const [jsonValue, setJsonValue] = useState<string>(() =>
    JSON.stringify(initialData.elements, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // v0.4.35: Handle tab switching with bidirectional sync
  const handleTabChange = useCallback(
    (tab: EditorTab) => {
      if (tab === activeTab) return;

      if (tab === 'json') {
        // Switching to JSON: serialize current form elements
        setJsonValue(JSON.stringify(elements, null, 2));
        setJsonError(null);
      } else if (tab === 'form') {
        // Switching to Form: parse JSON and update elements
        try {
          const parsed = JSON.parse(jsonValue);
          if (!Array.isArray(parsed)) {
            setJsonError('Le JSON doit être un tableau d\'éléments');
            return; // Don't switch tab if error
          }
          // Convert to JcfElement format
          const newElements: JcfElement[] = parsed.map((el: JcfTemplateElement) =>
            templateElementToFormElement(el)
          );
          setElements(newElements);
          setJsonError(null);
        } catch (e) {
          setJsonError(e instanceof Error ? e.message : 'JSON invalide');
          return; // Don't switch tab if error
        }
      }

      setActiveTab(tab);
    },
    [activeTab, elements, jsonValue]
  );

  // v0.4.35: Handle JSON editor changes
  const handleJsonChange = useCallback((value: string) => {
    setJsonValue(value);
    // Validate JSON structure
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setJsonError('Le JSON doit être un tableau d\'éléments');
      } else {
        setJsonError(null);
      }
    } catch {
      // Error will be shown by the JSON editor itself
    }
  }, []);

  // Stable close handler
  const stableOnCancel = useCallback(() => {
    if (!isSaving) {
      onCancel();
    }
  }, [onCancel, isSaving]);

  // Handle save
  const handleSave = useCallback(() => {
    // v0.4.35: Parse JSON if in JSON mode
    let finalElements = elements;
    if (activeTab === 'json') {
      try {
        const parsed = JSON.parse(jsonValue);
        if (!Array.isArray(parsed)) {
          setValidationError('Le JSON doit être un tableau d\'éléments');
          return;
        }
        finalElements = parsed.map((el: JcfTemplateElement) =>
          templateElementToFormElement(el)
        );
      } catch (e) {
        setValidationError(e instanceof Error ? e.message : 'JSON invalide');
        return;
      }
    }

    // Validate with final elements
    if (!header.name.trim()) {
      setValidationError('Le nom du template est obligatoire');
      return;
    }
    if (finalElements.length === 0) {
      setValidationError('Le template doit contenir au moins un élément');
      return;
    }
    for (let i = 0; i < finalElements.length; i++) {
      if (!finalElements[i].name.trim()) {
        setValidationError(`L'élément ${i + 1} doit avoir un nom`);
        return;
      }
    }

    setValidationError(null);

    const data: TemplateEditorData & { id?: string } = {
      name: header.name.trim(),
      description: header.description?.trim() || undefined,
      category: header.category?.trim() || undefined,
      clientName: header.clientName?.trim() || undefined,
      elements: finalElements.map(formElementToTemplateElement),
      id: template?.id,
    };

    onSave(data);
  }, [activeTab, jsonValue, header, elements, template?.id, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
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
  }, [isSaving, handleSave, stableOnCancel]);

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
      role="presentation"
      data-testid="template-editor-backdrop"
    >
      <div
        className="w-[70vw] max-w-[1400px] max-h-[90vh] bg-zinc-950 rounded-[7px] border border-zinc-800 flex flex-col overflow-hidden text-base leading-[1.4]"
        data-testid="template-editor-dialog"
      >
        {/* Header */}
        <header className="flex-shrink-0 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center justify-between px-[13px] py-[10px]">
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
          </div>

          {/* v0.4.35: Tab switcher */}
          <div className="flex px-[13px] gap-[3px]" data-testid="template-editor-tabs">
            <button
              onClick={() => handleTabChange('form')}
              disabled={isSaving}
              className={`flex items-center gap-[5px] px-[10px] py-[6px] text-sm rounded-t-[3px] transition-colors ${
                activeTab === 'form'
                  ? 'bg-zinc-950 text-zinc-100 border-t border-l border-r border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              data-testid="template-editor-tab-form"
            >
              <FileText size={14} />
              Form
            </button>
            <button
              onClick={() => handleTabChange('json')}
              disabled={isSaving}
              className={`flex items-center gap-[5px] px-[10px] py-[6px] text-sm rounded-t-[3px] transition-colors ${
                activeTab === 'json'
                  ? 'bg-zinc-950 text-zinc-100 border-t border-l border-r border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              } ${jsonError ? 'text-red-400' : ''}`}
              data-testid="template-editor-tab-json"
            >
              <Code size={14} />
              JSON
              {jsonError && <span className="text-red-400">!</span>}
            </button>
          </div>
        </header>

        {/* Content */}
        <main
          className="flex-1 overflow-y-auto px-[20px] py-[13px] space-y-[13px]"
          data-testid="template-editor-content"
        >
          {/* Template header form - always visible */}
          <JcfTemplateHeaderForm
            value={header}
            onChange={setHeader}
            disabled={isSaving}
          />

          {/* v0.4.35: Conditional content based on active tab */}
          {activeTab === 'form' ? (
            /* Elements table (Form mode) */
            <JcfElementsTable
              elements={elements}
              onElementsChange={setElements}
              mode="template"
              jobQuantity="1"
            />
          ) : (
            /* JSON editor (JSON mode) */
            <div className="flex-1 min-h-[300px]">
              <JcfJsonEditor
                value={jsonValue}
                onChange={handleJsonChange}
                readOnly={isSaving}
                className="h-full"
                data-testid="template-editor-json"
              />
            </div>
          )}
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

// ============================================================================
// Main Modal Component
// ============================================================================

/**
 * Template editor modal wrapper.
 * Handles visibility and renders content component only when open.
 * Content component gets remounted on each open, ensuring fresh state.
 */
export function JcfTemplateEditorModal({
  isOpen,
  template,
  initialElements,
  initialClientName,
  onSave,
  onCancel,
  isSaving,
}: JcfTemplateEditorModalProps) {
  // Only render content when modal is open
  // This ensures state is fresh on each open (component remounts)
  if (!isOpen) return null;

  return (
    <TemplateEditorContent
      template={template}
      initialElements={initialElements}
      initialClientName={initialClientName}
      onSave={onSave}
      onCancel={onCancel}
      isSaving={isSaving}
    />
  );
}
