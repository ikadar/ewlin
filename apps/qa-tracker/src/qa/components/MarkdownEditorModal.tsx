/**
 * Markdown Editor Modal
 *
 * Full-screen modal with CodeMirror editor for editing QA test markdown files.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Save } from 'lucide-react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { cn } from '@/utils/cn';

interface MarkdownEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: string;
  file: string;
}

export function MarkdownEditorModal({
  isOpen,
  onClose,
  folder,
  file,
}: MarkdownEditorModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load content
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    fetch(`/qa-api/raw/${folder}/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
        setOriginalContent(data.content);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [isOpen, folder, file]);

  // Handle editor content changes
  const handleUpdate = useCallback(
    (update: { docChanged: boolean; state: EditorState }) => {
      if (!update.docChanged) return;
      setContent(update.state.doc.toString());
    },
    []
  );

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!containerRef.current || isLoading || error) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of(handleUpdate),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            fontSize: '14px',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            height: '100%',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '16px 0',
          },
          '.cm-gutters': {
            backgroundColor: 'rgb(39, 39, 42)',
            borderRight: '1px solid rgb(63, 63, 70)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgb(63, 63, 70)',
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

    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, [isLoading, error, handleUpdate, content]);

  // Save content
  const handleSave = async () => {
    const currentContent = editorRef.current?.state.doc.toString() || content;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/qa-api/raw/${folder}/${file}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      if (!res.ok) throw new Error('Failed to save file');

      setOriginalContent(currentContent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Check for unsaved changes
  const hasChanges = content !== originalContent;

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, handleSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-zinc-100">
            {folder}/{file}
          </h2>
          {hasChanges && (
            <span className="px-2 py-0.5 text-base bg-amber-600 text-white rounded">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded text-base font-medium transition-colors',
              hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-400">
            {error}
          </div>
        )}
        {!isLoading && !error && (
          <div ref={containerRef} className="h-full" />
        )}
      </div>
    </div>
  );
}
