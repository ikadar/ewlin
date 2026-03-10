/**
 * StationCategoriesPage - CRUD page for station categories
 *
 * Accessible at /station-categories.
 * Follows the same pattern as TemplatesPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useGetStationCategoriesQuery,
  useCreateStationCategoryMutation,
  useUpdateStationCategoryMutation,
  useDeleteStationCategoryMutation,
} from '../store/api/stationCategoryApi';
import { useGetSnapshotQuery } from '../store';
import type { StationCategoryResponse, SimilarityCriterionInput } from '../store/api/stationCategoryApi';

// ============================================================================
// Category Form Modal
// ============================================================================

interface CategoryFormData {
  name: string;
  description: string;
  abbreviation: string;
  similarityCriteria: SimilarityCriterionInput[];
}

interface CategoryFormModalProps {
  initial?: StationCategoryResponse | null;
  onSave: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

/** Internal form row — `_key` is React-only, never sent to the API */
interface CriterionDraft extends SimilarityCriterionInput {
  _key: string;
}

function CategoryFormModal({ initial, onSave, onCancel, isSaving }: CategoryFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [abbreviation, setAbbreviation] = useState(initial?.abbreviation ?? '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);
  const [criteria, setCriteria] = useState<CriterionDraft[]>(
    (initial?.similarityCriteria ?? []).map((c, i) => ({ ...c, _key: `existing-${i}` }))
  );
  const [criteriaError, setCriteriaError] = useState<string | null>(null);

  const handleAddCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      { _key: `new-${Date.now()}`, name: '', fieldPath: '' },
    ]);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
    setCriteriaError(null);
  };

  const handleCriterionChange = (
    index: number,
    field: 'name' | 'fieldPath',
    value: string
  ) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
    setCriteriaError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Drop completely empty rows silently, validate partially filled ones
    const nonEmpty = criteria.filter(
      (c) => c.name.trim() || c.fieldPath.trim()
    );
    const hasIncomplete = nonEmpty.some(
      (c) => !c.name.trim() || !c.fieldPath.trim()
    );
    if (hasIncomplete) {
      setCriteriaError('Chaque critère doit avoir un nom et un fieldPath.');
      return;
    }

    // Strip _key before sending to API
    const payload = nonEmpty.map(({ _key: _, ...rest }) => rest);
    await onSave({ name, description, abbreviation, similarityCriteria: payload });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Presses Offset"
            />
          </div>

          {/* Abbreviation */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Abréviation <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required={!initial}
              maxLength={20}
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Off."
            />
            <p className="mt-1 text-xs text-flux-text-tertiary">Max 20 caractères</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary resize-none"
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Similarity criteria */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-2">Critères de similarité</label>
            {criteria.length > 0 && (
              <div className="flex gap-2 items-center mb-1 px-0">
                <span className="flex-1 text-xs text-flux-text-tertiary">Nom</span>
                <span className="w-28 text-xs text-flux-text-tertiary">fieldPath</span>
                <span className="w-5" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {criteria.map((crit, i) => (
                <div key={crit._key} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={crit.name}
                    onChange={(e) => handleCriterionChange(i, 'name', e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-flux-base border border-flux-border-light rounded text-sm text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                    placeholder="Nom"
                  />
                  <input
                    type="text"
                    value={crit.fieldPath}
                    onChange={(e) => handleCriterionChange(i, 'fieldPath', e.target.value)}
                    className="w-28 px-2 py-1.5 bg-flux-base border border-flux-border-light rounded text-sm text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary font-mono"
                    placeholder="fieldPath"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(i)}
                    className="p-1 text-flux-text-tertiary hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddCriterion}
              className="mt-2 text-xs text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            >
              + Ajouter un critère
            </button>
            {criteriaError && (
              <p className="mt-1 text-xs text-red-400">{criteriaError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// StationCategoriesPage
// ============================================================================

export function StationCategoriesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingCategory, setEditingCategory] = useState<StationCategoryResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<StationCategoryResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: categories = [], isLoading, error } = useGetStationCategoriesQuery();
  const [createCategory, { isLoading: isCreatingLoading }] = useCreateStationCategoryMutation();
  const [updateCategory, { isLoading: isUpdatingLoading }] = useUpdateStationCategoryMutation();
  const [deleteCategory] = useDeleteStationCategoryMutation();
  const { data: snapshotData } = useGetSnapshotQuery();

  // Count stations per category
  const stationCountByCategory = useMemo(() => {
    if (!snapshotData) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const station of snapshotData.stations) {
      map.set(station.categoryId, (map.get(station.categoryId) ?? 0) + 1);
    }
    return map;
  }, [snapshotData]);

  // Keyboard shortcuts
  useEffect(() => {
    if (editingCategory || isCreating || deletingCategory) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, editingCategory, isCreating, deletingCategory]);

  // Client-side filtering
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: CategoryFormData) => {
    await createCategory({
      name: data.name,
      description: data.description || undefined,
      abbreviation: data.abbreviation || undefined,
      similarityCriteria: data.similarityCriteria,
    }).unwrap();
    setIsCreating(false);
  };

  const handleSaveEdit = async (data: CategoryFormData) => {
    if (!editingCategory) return;
    await updateCategory({
      id: editingCategory.id,
      body: {
        name: data.name,
        description: data.description || undefined,
        abbreviation: data.abbreviation,
        similarityCriteria: data.similarityCriteria,
      },
    }).unwrap();
    setEditingCategory(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    setDeleteError(null);
    try {
      await deleteCategory(deletingCategory.id).unwrap();
      setDeletingCategory(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la suppression';
      setDeleteError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      {/* Header */}
      <header className="border-b border-flux-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            title="Retour (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <h1 className="text-xl font-semibold text-flux-text-primary">Catégories de stations</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouvelle catégorie
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des catégories
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Search bar */}
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
                  aria-label="Rechercher une catégorie"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredCategories.length} catégorie
                {filteredCategories.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${categories.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Critères</th>
                    <th className="text-left px-4 py-3 font-medium">Stations</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-flux-text-muted py-12">
                        Aucune catégorie trouvée
                      </td>
                    </tr>
                  )}
                  {filteredCategories.map((cat) => {
                    const stationCount = stationCountByCategory.get(cat.id) ?? 0;
                    return (
                      <tr
                        key={cat.id}
                        className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                      >
                        <td className="px-4 py-3 text-flux-text-primary font-medium">{cat.name}</td>
                        <td className="px-4 py-3 text-flux-text-secondary">
                          {cat.description ?? <span className="text-flux-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-flux-text-secondary">
                          {cat.similarityCriteria.length > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-flux-text-secondary">{cat.similarityCriteria.length}</span>
                              <span className="text-flux-text-muted">
                                {cat.similarityCriteria.length === 1 ? 'critère' : 'critères'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-flux-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-flux-text-secondary">
                          {stationCount > 0 ? (
                            <span className="text-flux-text-secondary">{stationCount}</span>
                          ) : (
                            <span className="text-flux-text-muted">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setEditingCategory(cat)}
                              className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingCategory(cat);
                              }}
                              disabled={stationCount > 0}
                              className="p-1.5 text-flux-text-tertiary hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={
                                stationCount > 0
                                  ? 'Catégorie utilisée par des stations'
                                  : 'Supprimer'
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Create modal */}
      {isCreating && (
        <CategoryFormModal
          initial={null}
          onSave={handleSaveCreate}
          onCancel={() => setIsCreating(false)}
          isSaving={isCreatingLoading}
        />
      )}

      {/* Edit modal */}
      {editingCategory && (
        <CategoryFormModal
          initial={editingCategory}
          onSave={handleSaveEdit}
          onCancel={() => setEditingCategory(null)}
          isSaving={isUpdatingLoading}
        />
      )}

      {/* Delete confirmation */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer la catégorie</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary">{deletingCategory.name}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeletingCategory(null);
                  setDeleteError(null);
                }}
                className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
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
