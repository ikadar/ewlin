/**
 * TemplatesPage - List and browse JCF templates
 *
 * Matches the visual appearance of jcf/src/pages/Templates.tsx
 * with RTK Query for data fetching.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus } from 'lucide-react';
import type { JcfTemplate } from '@flux/types';
import { JcfTemplateList } from '../components/JcfTemplateList/JcfTemplateList';
import { JcfTemplateEditorModal } from '../components/JcfTemplateEditorModal';
import type { TemplateEditorData } from '../components/JcfTemplateEditorModal';
import { useGetTemplatesQuery, useCreateTemplateMutation, useUpdateTemplateMutation, useDeleteTemplateMutation } from '../store/api/templateApi';
import { useGetSnapshotQuery } from '../store';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Template editor state
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JcfTemplate | null>(null);
  // Delete confirmation state
  const [deletingTemplate, setDeletingTemplate] = useState<JcfTemplate | null>(null);

  const { data, isLoading, error } = useGetTemplatesQuery();
  const [createTemplate, { isLoading: isCreatingTemplate }] = useCreateTemplateMutation();
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateTemplateMutation();
  const [deleteTemplate] = useDeleteTemplateMutation();
  const { data: snapshotData } = useGetSnapshotQuery();

  const templates = useMemo(() => data?.items ?? [], [data]);

  // Derive poste presets from snapshot (for template sequence autocomplete)
  const snapshotPostes = useMemo(() => {
    if (!snapshotData) return [];
    const catNameMap = new Map(snapshotData.categories.map(c => [c.id, c.name]));
    return snapshotData.stations.map(s => ({
      name: s.name.replace(/\s+/g, ''),
      category: catNameMap.get(s.categoryId) ?? '',
    }));
  }, [snapshotData]);

  // Keyboard shortcuts
  useEffect(() => {
    // Don't handle page-level shortcuts when editor modal is open
    if (editingTemplate || isCreating) return;

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
  }, [navigate, editingTemplate, isCreating]);

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

  // Create handler
  const handleCreateSave = useCallback(async (data: TemplateEditorData) => {
    try {
      const elementsWithWorkflow = data.elements.map(el => ({
        ...el,
        sequenceWorkflow: el.sequence.split('\n').map(s => s.trim()).filter(Boolean),
      }));
      await createTemplate({
        name: data.name,
        description: data.description,
        category: data.category,
        clientName: data.clientName,
        elements: elementsWithWorkflow,
      }).unwrap();
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  }, [createTemplate]);

  // Edit handlers
  const handleEditClick = useCallback((template: JcfTemplate) => {
    setEditingTemplate(template);
  }, []);

  const handleEditorSave = useCallback(async (data: TemplateEditorData & { id?: string }) => {
    if (!data.id) return;
    try {
      // Derive sequenceWorkflow from each element's sequence (abstract category names)
      const elementsWithWorkflow = data.elements.map(el => ({
        ...el,
        sequenceWorkflow: el.sequence.split('\n').map(s => s.trim()).filter(Boolean),
      }));
      await updateTemplate({
        id: data.id,
        body: {
          name: data.name,
          description: data.description,
          category: data.category,
          clientName: data.clientName,
          elements: elementsWithWorkflow,
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

  // Delete handlers
  const handleDeleteClick = useCallback((template: JcfTemplate) => {
    setDeletingTemplate(template);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTemplate) return;
    try {
      await deleteTemplate(deletingTemplate.id).unwrap();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
    setDeletingTemplate(null);
  }, [deletingTemplate, deleteTemplate]);

  const handleDeleteCancel = useCallback(() => {
    setDeletingTemplate(null);
  }, []);

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      {/* Header */}
      <header className="border-b border-flux-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            title="Retour aux jobs (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour aux jobs</span>
          </button>
          <h1 className="text-xl font-semibold text-flux-text-primary">Templates</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau template
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher... (/)"
                  aria-label="Rechercher dans les templates"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredTemplates.length} template
                {filteredTemplates.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${templates.length}`}
              </span>
            </div>

            <JcfTemplateList
              templates={filteredTemplates}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
            />
          </>
        )}
      </main>

      {/* Template editor modal (create mode) */}
      <JcfTemplateEditorModal
        isOpen={isCreating}
        initialElements={[{
          name: 'ELT', precedences: '', quantite: '1', format: '', pagination: '',
          papier: '', imposition: '', impression: '', surfacage: '', autres: '',
          qteFeuilles: '', commentaires: '', sequence: '',
        }]}
        onSave={handleCreateSave}
        onCancel={() => setIsCreating(false)}
        isSaving={isCreatingTemplate}
        postePresets={snapshotPostes}
      />

      {/* Template editor modal (edit mode) */}
      <JcfTemplateEditorModal
        isOpen={editingTemplate !== null}
        template={editingTemplate ?? undefined}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
        isSaving={isUpdating}
        postePresets={snapshotPostes}
      />

      {/* Delete confirmation dialog */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer le template</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer <span className="font-medium text-flux-text-primary">{deletingTemplate.name}</span> ?
              Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
                data-testid="template-delete-confirm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
