/**
 * TemplatesPage - List and browse JCF templates
 *
 * Matches the visual appearance of jcf/src/pages/Templates.tsx
 * with RTK Query for data fetching.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import type { JcfTemplate } from '@flux/types';
import { JcfTemplateList } from '../components/JcfTemplateList/JcfTemplateList';
import { JcfTemplateEditorModal } from '../components/JcfTemplateEditorModal';
import type { TemplateEditorData } from '../components/JcfTemplateEditorModal';
import { useGetTemplatesQuery, useUpdateTemplateMutation } from '../store/api/templateApi';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<JcfTemplate | null>(null);

  const { data, isLoading, error } = useGetTemplatesQuery();
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateTemplateMutation();

  const templates = data?.items ?? [];

  // Keyboard shortcuts
  useEffect(() => {
    // Don't handle page-level shortcuts when editor modal is open
    if (editingTemplate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: blur search or go back
      if (e.key === 'Escape') {
        if (e.target === searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current?.blur();
        } else if (!(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          navigate('/');
        }
        return;
      }

      // Ignore shortcuts if user is typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // "/" : Focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, editingTemplate]);

  // Client-side search filtering
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.clientName?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [templates, searchQuery]);

  // Edit handlers
  const handleEditClick = useCallback((template: JcfTemplate) => {
    setEditingTemplate(template);
  }, []);

  const handleEditorSave = useCallback(async (data: TemplateEditorData & { id?: string }) => {
    if (!data.id) return;
    try {
      await updateTemplate({
        id: data.id,
        body: {
          name: data.name,
          description: data.description,
          category: data.category,
          clientName: data.clientName,
          elements: data.elements,
        },
      }).unwrap();
      setEditingTemplate(null);
    } catch (err) {
      console.error('Failed to update template:', err);
    }
  }, [updateTemplate]);

  const handleEditorCancel = useCallback(() => {
    setEditingTemplate(null);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Retour aux jobs (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour aux jobs</span>
          </button>
          <h1 className="text-xl font-semibold text-zinc-100">Templates</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-zinc-500 mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des templates
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Search bar and counter */}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher... (/)"
                  aria-label="Rechercher dans les templates"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <span className="text-zinc-500 text-sm">
                {filteredTemplates.length} template
                {filteredTemplates.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${templates.length}`}
              </span>
            </div>

            <JcfTemplateList
              templates={filteredTemplates}
              onEditClick={handleEditClick}
            />
          </>
        )}
      </main>

      {/* Template editor modal (edit mode) */}
      <JcfTemplateEditorModal
        isOpen={editingTemplate !== null}
        template={editingTemplate ?? undefined}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
        isSaving={isUpdating}
      />
    </div>
  );
}
