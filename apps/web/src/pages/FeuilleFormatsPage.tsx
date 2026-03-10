/**
 * FeuilleFormatsPage - CRUD page for feuille formats (imposition)
 *
 * Accessible at /feuille-formats.
 * Follows the same pattern as SurfacagePresetsPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useGetFeuilleFormatsQuery,
  useCreateFeuilleFormatMutation,
  useUpdateFeuilleFormatMutation,
  useDeleteFeuilleFormatMutation,
} from '../store/api/feuilleFormatApi';
import type { FeuilleFormatResponse } from '../store/api/feuilleFormatApi';

// ============================================================================
// Constants
// ============================================================================

const STANDARD_POSES = [1, 2, 4, 8, 16, 32, 64, 128];
const FORMAT_REGEX = /^[1-9]\d*x[1-9]\d*$/i;

// ============================================================================
// FeuilleFormat Form Modal
// ============================================================================

interface FeuilleFormatFormModalProps {
  initial?: FeuilleFormatResponse | null;
  formats: FeuilleFormatResponse[];
  onSave: (data: { format: string; poses: number[] }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  saveError: string | null;
}

function FeuilleFormatFormModal({
  initial,
  formats,
  onSave,
  onCancel,
  isSaving,
  saveError,
}: FeuilleFormatFormModalProps) {
  const [format, setFormat] = useState(initial?.format ?? '');
  const [poses, setPoses] = useState<number[]>(initial?.poses ? [...initial.poses].sort((a, b) => a - b) : []);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [customPoseInput, setCustomPoseInput] = useState('');
  const [customPoseError, setCustomPoseError] = useState<string | null>(null);
  const formatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    formatInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  // Suggestions: other format strings (excluding current if editing)
  const existingFormats = useMemo(() => {
    const currentId = initial?.id;
    return formats.filter((f) => f.id !== currentId).map((f) => f.format);
  }, [formats, initial]);

  const handleFormatChange = (v: string) => {
    setFormat(v);
    if (formatError) setFormatError(null);
  };

  const handleFormatBlur = () => {
    if (!format.trim()) return;
    if (!FORMAT_REGEX.test(format.trim())) {
      setFormatError('Format requis: LxH (ex. 50x70)');
    } else {
      setFormatError(null);
    }
  };

  const isFormatValid = format.trim() === '' || FORMAT_REGEX.test(format.trim());

  const toggleStandardPose = (pose: number) => {
    setPoses((prev) =>
      prev.includes(pose)
        ? prev.filter((p) => p !== pose).sort((a, b) => a - b)
        : [...prev, pose].sort((a, b) => a - b)
    );
  };

  const removePose = (pose: number) => {
    setPoses((prev) => prev.filter((p) => p !== pose));
  };

  const addCustomPose = () => {
    const val = parseInt(customPoseInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      setCustomPoseError('Entier positif requis');
      return;
    }
    if (poses.includes(val)) {
      setCustomPoseError('Valeur déjà présente');
      return;
    }
    setPoses((prev) => [...prev, val].sort((a, b) => a - b));
    setCustomPoseInput('');
    setCustomPoseError(null);
  };

  const handleCustomPoseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomPose();
    }
  };

  const canSave =
    format.trim() !== '' &&
    FORMAT_REGEX.test(format.trim()) &&
    poses.length > 0 &&
    !existingFormats.includes(format.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await onSave({ format: format.trim(), poses });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier le format' : 'Nouveau format'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Format */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Format <span className="text-red-400">*</span>
            </label>
            <input
              ref={formatInputRef}
              type="text"
              required
              maxLength={20}
              value={format}
              list="feuille-format-suggestions"
              onChange={(e) => handleFormatChange(e.target.value)}
              onBlur={handleFormatBlur}
              className={`w-full px-3 py-2 bg-flux-base border rounded font-mono text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none transition-colors ${
                formatError || (!isFormatValid && format.trim())
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-flux-border-light focus:border-flux-text-secondary'
              }`}
              placeholder="Ex: 50x70"
            />
            <datalist id="feuille-format-suggestions">
              {existingFormats.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            {(formatError || (!isFormatValid && format.trim())) && (
              <p className="mt-1 text-xs text-red-400">
                {formatError ?? 'Format requis: LxH (ex. 50x70)'}
              </p>
            )}
          </div>

          {/* Poses */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-2">
              Poses <span className="text-red-400">*</span>
            </label>

            {/* Standard poses toggle chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {STANDARD_POSES.map((pose) => {
                const active = poses.includes(pose);
                return (
                  <button
                    key={pose}
                    type="button"
                    onClick={() => toggleStandardPose(pose)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border border-blue-500'
                        : 'bg-flux-active text-flux-text-secondary border border-flux-border-light hover:border-flux-border-light hover:text-flux-text-secondary'
                    }`}
                  >
                    {pose}
                  </button>
                );
              })}
            </div>

            {/* Active poses (non-standard or to remove) */}
            {poses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-flux-base/50 rounded border border-flux-border-light">
                {poses.map((pose) => (
                  <span
                    key={pose}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-flux-active text-flux-text-primary rounded"
                  >
                    {pose}
                    <button
                      type="button"
                      onClick={() => removePose(pose)}
                      className="text-flux-text-tertiary hover:text-red-400 transition-colors"
                      title="Retirer"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {poses.length === 0 && (
              <p className="text-xs text-red-400 mb-2">Au moins une valeur de poses requise</p>
            )}

            {/* Custom pose input */}
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="number"
                  min={1}
                  value={customPoseInput}
                  onChange={(e) => { setCustomPoseInput(e.target.value); setCustomPoseError(null); }}
                  onKeyDown={handleCustomPoseKeyDown}
                  className={`w-full px-3 py-1.5 bg-flux-base border rounded text-sm font-mono text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none transition-colors ${
                    customPoseError ? 'border-red-500' : 'border-flux-border-light focus:border-flux-text-secondary'
                  }`}
                  placeholder="Valeur personnalisée"
                />
                {customPoseError && (
                  <p className="mt-0.5 text-xs text-red-400">{customPoseError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={addCustomPose}
                className="px-2.5 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
                title="Ajouter"
              >
                <Plus size={14} />
              </button>
            </div>
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
// FeuilleFormatsPage
// ============================================================================

export function FeuilleFormatsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingFormat, setEditingFormat] = useState<FeuilleFormatResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingFormat, setDeletingFormat] = useState<FeuilleFormatResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: formats = [], isLoading, error } = useGetFeuilleFormatsQuery();
  const [createFormat, { isLoading: isCreatingLoading }] = useCreateFeuilleFormatMutation();
  const [updateFormat, { isLoading: isUpdatingLoading }] = useUpdateFeuilleFormatMutation();
  const [deleteFormat] = useDeleteFeuilleFormatMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingFormat || isCreating || deletingFormat) return;

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
  }, [navigate, editingFormat, isCreating, deletingFormat]);

  // Client-side filtering
  const filteredFormats = useMemo(() => {
    if (!searchQuery.trim()) return formats;
    const query = searchQuery.toLowerCase();
    return formats.filter((f) => f.format.toLowerCase().includes(query));
  }, [formats, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: { format: string; poses: number[] }) => {
    setSaveError(null);
    try {
      await createFormat(data).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: { format: string; poses: number[] }) => {
    if (!editingFormat) return;
    setSaveError(null);
    try {
      await updateFormat({ id: editingFormat.id, body: data }).unwrap();
      setEditingFormat(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFormat) return;
    setDeleteError(null);
    try {
      await deleteFormat(deletingFormat.id).unwrap();
      setDeletingFormat(null);
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Formats feuille (Impositions)</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau format
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des formats
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
                  aria-label="Rechercher un format"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredFormats.length} format
                {filteredFormats.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${formats.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Format</th>
                    <th className="text-left px-4 py-3 font-medium">Poses</th>
                    <th className="text-left px-4 py-3 font-medium">Créé le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredFormats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-flux-text-muted py-12">
                        Aucun format trouvé
                      </td>
                    </tr>
                  )}
                  {filteredFormats.map((fmt) => (
                    <tr
                      key={fmt.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium font-mono">
                        {fmt.format}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary font-mono text-xs">
                        {[...fmt.poses].sort((a, b) => a - b).join(' · ')}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {new Date(fmt.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingFormat(fmt); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingFormat(fmt); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-red-400 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Create modal */}
      {isCreating && (
        <FeuilleFormatFormModal
          initial={null}
          formats={formats}
          onSave={handleSaveCreate}
          onCancel={() => { setIsCreating(false); setSaveError(null); }}
          isSaving={isCreatingLoading}
          saveError={saveError}
        />
      )}

      {/* Edit modal */}
      {editingFormat && (
        <FeuilleFormatFormModal
          initial={editingFormat}
          formats={formats}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingFormat(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
          saveError={saveError}
        />
      )}

      {/* Delete confirmation */}
      {deletingFormat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer le format</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary font-mono">{deletingFormat.format}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingFormat(null); setDeleteError(null); }}
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
