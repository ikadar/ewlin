/**
 * SurfacagePresetsPage - CRUD page for surfacage presets
 *
 * Accessible at /surfacage-presets.
 * Follows the same pattern as ImpressionPresetsPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetSurfacagePresetsQuery,
  useCreateSurfacagePresetMutation,
  useUpdateSurfacagePresetMutation,
  useDeleteSurfacagePresetMutation,
} from '../store/api/surfacagePresetApi';
import type { SurfacagePresetResponse } from '../store/api/surfacagePresetApi';
import { toPrettySurfacage, isValidSurfacage } from '../components/JcfSurfacageAutocomplete/surfacageDsl';

// ============================================================================
// Surfacage Preset Form Modal
// ============================================================================

interface SurfacagePresetFormModalProps {
  initial?: SurfacagePresetResponse | null;
  presets: SurfacagePresetResponse[];
  onSave: (data: { value: string; description: string; label: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  saveError: string | null;
}

function SurfacagePresetFormModal({
  initial,
  presets,
  onSave,
  onCancel,
  isSaving,
  saveError,
}: SurfacagePresetFormModalProps) {
  const [value, setValue] = useState(initial?.value ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  // Track whether label was manually edited (to stop auto-fill)
  const [labelEdited, setLabelEdited] = useState(initial !== null && initial !== undefined);
  const [valueError, setValueError] = useState<string | null>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Suggestions: other preset values (excluding current if editing)
  const suggestions = useMemo(() => {
    const currentId = initial?.id;
    return presets.filter((p) => p.id !== currentId).map((p) => p.value);
  }, [presets, initial]);

  useEffect(() => {
    valueInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const handleValueChange = (v: string) => {
    setValue(v);
    if (valueError) setValueError(null);
    // Auto-fill label from static mapping if not manually edited
    if (!labelEdited) {
      const pretty = isValidSurfacage(v.trim()) ? toPrettySurfacage(v.trim()) : '';
      setLabel(pretty !== v.trim() ? pretty : '');
    }
  };

  const handleValueBlur = () => {
    if (!value.trim()) return;
    if (!value.includes('/')) {
      setValueError('Doit contenir /');
    } else {
      setValueError(null);
    }
  };

  const isValueValid = value.trim() === '' || value.includes('/');
  const canSave =
    value.trim() !== '' &&
    value.includes('/') &&
    description.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await onSave({ value: value.trim(), description: description.trim(), label: label.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier le preset' : 'Nouveau preset'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Value */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Valeur <span className="text-red-400">*</span>
            </label>
            <input
              ref={valueInputRef}
              type="text"
              required
              maxLength={30}
              value={value}
              list="surfacage-preset-suggestions"
              onChange={(e) => handleValueChange(e.target.value)}
              onBlur={handleValueBlur}
              className={`w-full px-3 py-2 bg-flux-base border rounded font-mono text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none transition-colors ${
                valueError || (!isValueValid && value.trim())
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-flux-border-light focus:border-flux-text-secondary'
              }`}
              placeholder="Ex: mat/mat, UV/, brillant/brillant"
            />
            <datalist id="surfacage-preset-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {(valueError || (!isValueValid && value.trim())) && (
              <p className="mt-1 text-xs text-red-400">
                {valueError ?? 'Doit contenir /'}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Libellé <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary transition-colors"
              placeholder="Ex: Pelli mat R/V"
            />
          </div>

          {/* JCF label */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Affichage JCF
              <span className="ml-1 text-flux-text-muted text-xs">(optionnel — vide = fallback statique)</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={label}
              onChange={(e) => { setLabel(e.target.value); setLabelEdited(true); }}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary transition-colors"
              placeholder="Ex: pelli mat recto/verso"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-400">{saveError}</p>
          )}

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
              disabled={isSaving || !canSave}
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
// SurfacagePresetsPage
// ============================================================================

export function SurfacagePresetsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingPreset, setEditingPreset] = useState<SurfacagePresetResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPreset, setDeletingPreset] = useState<SurfacagePresetResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: presets = [], isLoading, error } = useGetSurfacagePresetsQuery();
  const [createPreset, { isLoading: isCreatingLoading }] = useCreateSurfacagePresetMutation();
  const [updatePreset, { isLoading: isUpdatingLoading }] = useUpdateSurfacagePresetMutation();
  const [deletePreset] = useDeleteSurfacagePresetMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingPreset || isCreating || deletingPreset) return;

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
  }, [navigate, editingPreset, isCreating, deletingPreset]);

  // Client-side filtering
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return presets;
    const query = searchQuery.toLowerCase();
    return presets.filter(
      (p) =>
        p.value.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }, [presets, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: { value: string; description: string; label: string }) => {
    setSaveError(null);
    try {
      await createPreset(data).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: { value: string; description: string; label: string }) => {
    if (!editingPreset) return;
    setSaveError(null);
    try {
      await updatePreset({ id: editingPreset.id, body: data }).unwrap();
      setEditingPreset(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPreset) return;
    setDeleteError(null);
    try {
      await deletePreset(deletingPreset.id).unwrap();
      setDeletingPreset(null);
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Surfacages</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau preset
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des presets
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
                  aria-label="Rechercher un preset"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredPresets.length} preset
                {filteredPresets.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${presets.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-1.5 font-medium">Valeur</th>
                    <th className="text-left px-4 py-1.5 font-medium">Libellé</th>
                    <th className="text-left px-4 py-1.5 font-medium">Affichage JCF</th>
                    <th className="text-left px-4 py-1.5 font-medium">Créé le</th>
                    <th className="px-4 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPresets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-flux-text-muted py-12">
                        Aucun preset trouvé
                      </td>
                    </tr>
                  )}
                  {filteredPresets.map((preset) => {
                    const effectiveLabel = preset.label || toPrettySurfacage(preset.value);
                    const showLabel = effectiveLabel !== preset.value && effectiveLabel !== '';
                    return (
                      <tr
                        key={preset.id}
                        className="border-b border-flux-border group hover:bg-flux-hover transition-colors"
                      >
                        <td className="px-4 py-1.5 text-flux-text-primary font-medium font-mono">
                          {preset.value}
                        </td>
                        <td className="px-4 py-1.5 text-flux-text-secondary">
                          {preset.description}
                        </td>
                        <td className="px-4 py-1.5 text-flux-text-tertiary italic">
                          {showLabel ? effectiveLabel : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-flux-text-secondary">
                          {new Date(preset.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => { setSaveError(null); setEditingPreset(preset); }}
                              className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => { setDeleteError(null); setDeletingPreset(preset); }}
                              className="p-1.5 text-flux-text-tertiary hover:text-red-400 transition-colors"
                              title="Supprimer"
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
        <SurfacagePresetFormModal
          initial={null}
          presets={presets}
          onSave={handleSaveCreate}
          onCancel={() => { setIsCreating(false); setSaveError(null); }}
          isSaving={isCreatingLoading}
          saveError={saveError}
        />
      )}

      {/* Edit modal */}
      {editingPreset && (
        <SurfacagePresetFormModal
          initial={editingPreset}
          presets={presets}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingPreset(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
          saveError={saveError}
        />
      )}

      {/* Delete confirmation */}
      {deletingPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer le preset</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary font-mono">{deletingPreset.value}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingPreset(null); setDeleteError(null); }}
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
