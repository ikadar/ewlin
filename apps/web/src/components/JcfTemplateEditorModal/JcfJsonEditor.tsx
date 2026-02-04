/**
 * JcfJsonEditor - CodeMirror 6 JSON editor with contextual autocomplete
 *
 * Features:
 * - JSON syntax highlighting with dark theme
 * - JSON validation with error display
 * - Contextual autocomplete for element fields (v0.4.40)
 *
 * @see v0.4.35 - JCF: Link Propagation & Dual-Mode Editor
 * @see v0.4.40 - JSON Editor Contextual Autocomplete
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState, Compartment } from '@codemirror/state';
import {
  autocompletion,
  startCompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { detectFieldContext } from './fieldDetection';

// ============================================================================
// Types
// ============================================================================

/** Suggestions for autocomplete fields */
export interface JsonEditorSuggestions {
  /** Element names (COUV, INT, etc.) */
  name?: string[];
  /** Product formats (A4, A5, etc.) */
  format?: string[];
  /** Impression presets (Q/Q, Q/, etc.) */
  impression?: string[];
  /** Surfacage presets (mat/mat, etc.) */
  surfacage?: string[];
  /** Paper types (Couché mat, etc.) */
  papier?: string[];
  /** Workflow categories for sequence (Presse offset, etc.) */
  sequence?: string[];
}

export interface JcfJsonEditorProps {
  /** Current JSON value (as string) */
  value: string;
  /** Called when JSON is valid and changed */
  onChange: (value: string) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** CSS class for the container */
  className?: string;
  /** Test ID */
  'data-testid'?: string;
  /** Autocomplete suggestions (v0.4.40) */
  suggestions?: JsonEditorSuggestions;
}

// ============================================================================
// Completion Source (v0.4.40)
// ============================================================================

/**
 * Create CodeMirror completion source for JSON element fields.
 * Uses a ref to access dynamically loaded suggestions.
 */
function createCompletionSource(
  suggestionsRef: React.RefObject<JsonEditorSuggestions>
) {
  return function jsonFieldCompletionSource(
    context: CompletionContext
  ): CompletionResult | null {
    const doc = context.state.doc.toString();
    const pos = context.pos;
    const field = detectFieldContext(doc, pos);

    if (!field) return null;

    const suggestions = suggestionsRef.current?.[field] || [];
    if (suggestions.length === 0) return null;

    // Find the start of the current string value
    const before = doc.slice(0, pos);
    const lastQuote = before.lastIndexOf('"');
    const from = lastQuote + 1;
    const typed = doc.slice(from, pos).toLowerCase();

    // Filter suggestions based on what's typed
    const filtered = suggestions.filter((s) =>
      s.toLowerCase().includes(typed)
    );

    if (filtered.length === 0) return null;

    return {
      from,
      // Allow triggering even with no typed text (explicit activation)
      validFor: /^.*$/,
      options: filtered.map((label) => ({
        label,
        type: 'text',
        apply: label,
      })),
    };
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * CodeMirror 6 JSON editor with dark theme and contextual autocomplete.
 * Validates JSON and only calls onChange when valid.
 *
 * @see v0.4.35 - JCF: Link Propagation & Dual-Mode Editor
 * @see v0.4.40 - JSON Editor Contextual Autocomplete
 */
export function JcfJsonEditor({
  value,
  onChange,
  readOnly = false,
  placeholder: _placeholder = '[]',
  className = '',
  'data-testid': testId,
  suggestions = {},
}: JcfJsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const suggestionsRef = useRef<JsonEditorSuggestions>(suggestions);
  const [error, setError] = useState<string | null>(null);

  // Track if the last update was external (from parent) vs internal (from typing)
  const isExternalUpdate = useRef(false);

  // Keep suggestions ref in sync
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  /**
   * Validate JSON and update error state.
   */
  const validateJson = useCallback((jsonStr: string): boolean => {
    if (!jsonStr.trim()) {
      setError(null);
      return true;
    }
    try {
      JSON.parse(jsonStr);
      setError(null);
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'JSON invalide';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Handle editor content changes.
   */
  const handleUpdate = useCallback(
    (update: { docChanged: boolean; state: EditorState }) => {
      if (!update.docChanged) return;
      if (isExternalUpdate.current) {
        isExternalUpdate.current = false;
        return;
      }

      const newValue = update.state.doc.toString();
      if (validateJson(newValue)) {
        onChange(newValue);
      }
    },
    [onChange, validateJson]
  );

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        oneDark,
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        // v0.4.40: Contextual autocomplete
        autocompletion({
          override: [createCompletionSource(suggestionsRef)],
          activateOnTyping: true,
        }),
        // v0.4.40: Trigger autocomplete when cursor moves into autocompletable field
        EditorView.updateListener.of((update) => {
          if (update.selectionSet && !update.docChanged) {
            const pos = update.state.selection.main.head;
            const doc = update.state.doc.toString();
            const field = detectFieldContext(doc, pos);
            if (field) {
              // Delay to avoid interfering with other updates
              setTimeout(() => startCompletion(update.view), 50);
            }
          }
        }),
        EditorView.updateListener.of(handleUpdate),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': {
            padding: '8px 0',
          },
          '.cm-gutters': {
            backgroundColor: 'rgb(39, 39, 42)', // zinc-800
            borderRight: '1px solid rgb(63, 63, 70)', // zinc-700
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgb(63, 63, 70)', // zinc-700
          },
          '&.cm-focused': {
            outline: 'none',
          },
          // v0.4.40: Autocomplete dropdown styling
          '.cm-tooltip.cm-tooltip-autocomplete': {
            backgroundColor: 'rgb(39, 39, 42)', // zinc-800
            border: '1px solid rgb(63, 63, 70)', // zinc-700
            borderRadius: '4px',
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul': {
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            fontSize: '12px',
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
            padding: '4px 8px',
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: 'rgb(59, 130, 246)', // blue-500
            color: 'white',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorRef.current = view;

    // Initial validation
    validateJson(value);

    return () => {
      view.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update editor content when value changes externally
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.state.doc.toString();
    if (currentValue !== value) {
      isExternalUpdate.current = true;
      editor.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      validateJson(value);
    }
  }, [value, validateJson]);

  // Update read-only state
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    });
  }, [readOnly]);

  return (
    <div className={`flex flex-col ${className}`} data-testid={testId}>
      <div
        ref={containerRef}
        className={`
          flex-1 overflow-hidden rounded-[3px] border
          ${error ? 'border-red-500' : 'border-zinc-700'}
          bg-zinc-900
        `}
        data-testid={testId ? `${testId}-editor` : undefined}
      />
      {error && (
        <div
          className="mt-[5px] px-[7px] py-[3px] bg-red-900/30 text-red-400 text-sm rounded-[3px] font-mono"
          data-testid={testId ? `${testId}-error` : undefined}
        >
          {error}
        </div>
      )}
    </div>
  );
}
