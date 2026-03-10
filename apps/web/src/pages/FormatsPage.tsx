/**
 * FormatsPage - CRUD page for product formats
 *
 * Accessible at /formats.
 * Follows the same pattern as ClientsPage and StationCategoriesPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetFormatsQuery,
  useCreateFormatMutation,
  useUpdateFormatMutation,
  useDeleteFormatMutation,
} from '../store/api/formatApi';
import type { FormatResponse } from '../store/api/formatApi';
import { isValidFormat, normalizeFormat } from '../components/JcfFormatAutocomplete/formatDsl';

// ============================================================================
// Auto-fill helpers
// ============================================================================

/**
 * Try to resolve width/height from a DSL format name, given existing formats.
 * Returns null if the name cannot be resolved.
 */
function resolveAutofill(
  name: string,
  formats: FormatResponse[]
): { width: number; height: number } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Build case-insensitive lookup
  const lookup = new Map<string, { width: number; height: number }>();
  for (const f of formats) {
    lookup.set(f.name.toLowerCase(), { width: f.width, height: f.height });
  }

  // Direct lookup (A4, A4f, A4fi, etc. are all in the store)
  const direct = lookup.get(trimmed.toLowerCase());
  if (direct) return direct;

  // Custom dimensions: 210x297
  const customMatch = trimmed.match(/^(\d+)x(\d+)$/i);
  if (customMatch) {
    return { width: parseInt(customMatch[1], 10), height: parseInt(customMatch[2], 10) };
  }

  // Composite: A3/A6 → use first part
  if (trimmed.includes('/')) {
    const firstPart = trimmed.split('/')[0];
    return resolveAutofill(firstPart, formats);
  }

  // ISO with suffix not in store: strip f/fi and look up base
  const fiMatch = trimmed.match(/^(A\d+|[\d]+x[\d]+)fi$/i);
  if (fiMatch) {
    const base = fiMatch[1];
    const baseDim = lookup.get(base.toLowerCase());
    if (baseDim) return { width: baseDim.height, height: baseDim.width };
  }

  const fMatch = trimmed.match(/^(A\d+|[\d]+x[\d]+)f$/i);
  if (fMatch) {
    const base = fMatch[1];
    const baseDim = lookup.get(base.toLowerCase());
    if (baseDim) return baseDim;
  }

  return null;
}

// ============================================================================
// Format Form Modal
// ============================================================================

interface FormatFormModalProps {
  initial?: FormatResponse | null;
  formats: FormatResponse[];
  onSave: (data: { name: string; width: number; height: number }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  saveError: string | null;
}

function FormatFormModal({ initial, formats, onSave, onCancel, isSaving, saveError }: FormatFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [width, setWidth] = useState<string>(initial ? String(initial.width) : '');
  const [height, setHeight] = useState<string>(initial ? String(initial.height) : '');
  const [nameError, setNameError] = useState<string | null>(null);
  // Track whether width/height were auto-filled from the name
  const [widthAutoFilled, setWidthAutoFilled] = useState(false);
  const [heightAutoFilled, setHeightAutoFilled] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Suggestions: other format names (excluding current if editing)
  const suggestions = useMemo(() => {
    const currentId = initial?.id;
    return formats
      .filter((f) => f.id !== currentId)
      .map((f) => f.name);
  }, [formats, initial]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const handleNameChange = (value: string) => {
    setName(value);
    // Clear error while typing
    if (nameError) setNameError(null);
  };

  const handleNameBlur = () => {
    if (!name.trim()) return;

    // Validate
    if (!isValidFormat(name)) {
      setNameError('Format invalide (ex: A4, 210x297, A4f, A3/A6)');
      return;
    }
    setNameError(null);

    // Normalize
    const normalized = normalizeFormat(name);
    setName(normalized);

    // Auto-fill width/height if they are empty
    const autofill = resolveAutofill(normalized, formats);
    if (autofill) {
      if (!width.trim()) {
        setWidth(String(autofill.width));
        setWidthAutoFilled(true);
      }
      if (!height.trim()) {
        setHeight(String(autofill.height));
        setHeightAutoFilled(true);
      }
    }
  };

  const isNameValid = name.trim() === '' || isValidFormat(name);
  const canSave =
    name.trim() !== '' &&
    isValidFormat(name) &&
    width.trim() !== '' &&
    Number(width) > 0 &&
    height.trim() !== '' &&
    Number(height) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    await onSave({
      name: normalizeFormat(name.trim()),
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier le format' : 'Nouveau format'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              maxLength={50}
              value={name}
              list="format-suggestions"
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              className={`w-full px-3 py-2 bg-flux-base border rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none transition-colors ${
                nameError
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-flux-border-light focus:border-flux-text-secondary'
              }`}
              placeholder="Ex: A4, 210x297, A4f, A3/A6"
            />
            <datalist id="format-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {nameError && (
              <p className="mt-1 text-xs text-red-400">{nameError}</p>
            )}
            {!nameError && name.trim() && !isNameValid && (
              <p className="mt-1 text-xs text-red-400">
                Format invalide (ex: A4, 210x297, A4f, A3/A6)
              </p>
            )}
          </div>

          {/* Width */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Largeur (mm) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={width}
              onChange={(e) => { setWidth(e.target.value); setWidthAutoFilled(false); }}
              className={`w-full px-3 py-2 border rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary transition-colors ${
                widthAutoFilled
                  ? 'bg-flux-active/60 border-flux-border-light'
                  : 'bg-flux-base border-flux-border-light'
              }`}
              placeholder="Ex: 210"
            />
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Hauteur (mm) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={height}
              onChange={(e) => { setHeight(e.target.value); setHeightAutoFilled(false); }}
              className={`w-full px-3 py-2 border rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary transition-colors ${
                heightAutoFilled
                  ? 'bg-flux-active/60 border-flux-border-light'
                  : 'bg-flux-base border-flux-border-light'
              }`}
              placeholder="Ex: 297"
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
// FormatsPage
// ============================================================================

export function FormatsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingFormat, setEditingFormat] = useState<FormatResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingFormat, setDeletingFormat] = useState<FormatResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: formats = [], isLoading, error } = useGetFormatsQuery();
  const [createFormat, { isLoading: isCreatingLoading }] = useCreateFormatMutation();
  const [updateFormat, { isLoading: isUpdatingLoading }] = useUpdateFormatMutation();
  const [deleteFormat] = useDeleteFormatMutation();

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
    return formats.filter((f) => f.name.toLowerCase().includes(query));
  }, [formats, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: { name: string; width: number; height: number }) => {
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

  const handleSaveEdit = async (data: { name: string; width: number; height: number }) => {
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Formats</h1>
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
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Dimensions</th>
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
                  {filteredFormats.map((format) => (
                    <tr
                      key={format.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium font-mono">
                        {format.name}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {format.width}×{format.height} mm
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {new Date(format.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingFormat(format); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingFormat(format); }}
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
        <FormatFormModal
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
        <FormatFormModal
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
              <span className="font-medium text-flux-text-primary font-mono">{deletingFormat.name}</span> ?
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
