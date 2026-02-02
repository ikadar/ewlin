import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState, Compartment } from '@codemirror/state';

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
}

/**
 * CodeMirror 6 JSON editor with dark theme.
 * Validates JSON and only calls onChange when valid.
 *
 * @see v0.4.35 - JCF: Link Propagation & Dual-Mode Editor
 */
export function JcfJsonEditor({
  value,
  onChange,
  readOnly = false,
  placeholder: _placeholder = '[]',
  className = '',
  'data-testid': testId,
}: JcfJsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const [error, setError] = useState<string | null>(null);

  // Track if the last update was external (from parent) vs internal (from typing)
  const isExternalUpdate = useRef(false);

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
