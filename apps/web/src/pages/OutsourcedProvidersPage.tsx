/**
 * OutsourcedProvidersPage - CRUD page for outsourced providers
 *
 * Accessible at /settings/providers.
 * Follows the same pattern as ClientsPage + StationsPage (status badge).
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useGetProvidersQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
} from '../store/api/providerApi';
import type { ProviderResponse, ProviderInput } from '../store/api/providerApi';

// ============================================================================
// Status Badge
// ============================================================================

const STATUS_STYLES: Record<string, string> = {
  Active:   'text-emerald-400 bg-emerald-400/10',
  Inactive: 'text-zinc-400 bg-zinc-400/10',
};

const STATUS_LABELS: Record<string, string> = {
  Active:   'Actif',
  Inactive: 'Inactif',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'text-zinc-400 bg-zinc-400/10'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ============================================================================
// Provider Form Modal
// ============================================================================

/** Internal draft row — `_key` is React-only, never sent to the API */
interface ActionTypeDraft {
  _key: string;
  value: string;
}

interface ProviderFormModalProps {
  initial?: ProviderResponse | null;
  onSave: (data: ProviderInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function ProviderFormModal({ initial, onSave, onCancel, isSaving }: ProviderFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(initial?.status ?? 'Active');
  const [latestDepartureTime, setLatestDepartureTime] = useState(initial?.latestDepartureTime ?? '14:00');
  const [receptionTime, setReceptionTime] = useState(initial?.receptionTime ?? '09:00');
  const [transitDays, setTransitDays] = useState(initial?.transitDays ?? 1);
  const inputRef = useRef<HTMLInputElement>(null);

  const [actionTypes, setActionTypes] = useState<ActionTypeDraft[]>(
    (initial?.supportedActionTypes ?? []).map((v, i) => ({ _key: `existing-${i}`, value: v }))
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const handleAddActionType = () => {
    setActionTypes((prev) => [...prev, { _key: `new-${Date.now()}`, value: '' }]);
  };

  const handleRemoveActionType = (index: number) => {
    setActionTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleActionTypeChange = (index: number, value: string) => {
    setActionTypes((prev) =>
      prev.map((item, i) => (i === index ? { ...item, value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredTypes = actionTypes
      .map((item) => item.value.trim())
      .filter((v) => v.length > 0);

    await onSave({
      name: name.trim(),
      status,
      supportedActionTypes: filteredTypes,
      latestDepartureTime,
      receptionTime,
      transitDays,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
        <h2 className="text-zinc-100 font-medium mb-4">
          {initial ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
              placeholder="Ex : Transport Express"
            />
          </div>

          {/* Status + Transit days — 2-column grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                <option value="Active">Actif</option>
                <option value="Inactive">Inactif</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Jours de transit</label>
              <input
                type="number"
                min={1}
                value={transitDays}
                onChange={(e) => setTransitDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Departure + Reception times — 2-column grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Heure de départ</label>
              <input
                type="time"
                value={latestDepartureTime}
                onChange={(e) => setLatestDepartureTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Heure de réception</label>
              <input
                type="time"
                value={receptionTime}
                onChange={(e) => setReceptionTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Supported action types — dynamic list */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Types d&apos;actions</label>
            <div className="flex flex-col gap-2">
              {actionTypes.map((item, i) => (
                <div key={item._key} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => handleActionTypeChange(i, e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
                    placeholder="Type d'action"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveActionType(i)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddActionType}
              className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              + Ajouter un type d&apos;action
            </button>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
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
// OutsourcedProvidersPage
// ============================================================================

export function OutsourcedProvidersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingProvider, setEditingProvider] = useState<ProviderResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<ProviderResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: providers = [], isLoading, error } = useGetProvidersQuery();
  const [createProvider, { isLoading: isCreatingLoading }] = useCreateProviderMutation();
  const [updateProvider, { isLoading: isUpdatingLoading }] = useUpdateProviderMutation();
  const [deleteProvider] = useDeleteProviderMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingProvider || isCreating || deletingProvider) return;

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
  }, [navigate, editingProvider, isCreating, deletingProvider]);

  // Client-side filtering
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const query = searchQuery.toLowerCase();
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (STATUS_LABELS[p.status] ?? p.status).toLowerCase().includes(query) ||
        p.supportedActionTypes.join(', ').toLowerCase().includes(query)
    );
  }, [providers, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: ProviderInput) => {
    setSaveError(null);
    try {
      await createProvider(data).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: ProviderInput) => {
    if (!editingProvider) return;
    setSaveError(null);
    try {
      await updateProvider({ id: editingProvider.id, body: data }).unwrap();
      setEditingProvider(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProvider) return;
    setDeleteError(null);
    try {
      await deleteProvider(deletingProvider.id).unwrap();
      setDeletingProvider(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la suppression';
      setDeleteError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Retour (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <h1 className="text-xl font-semibold text-zinc-100">Sous-traitants</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau sous-traitant
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-zinc-500 mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des sous-traitants
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Search bar */}
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
                  aria-label="Rechercher un sous-traitant"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <span className="text-zinc-500 text-sm">
                {filteredProviders.length} sous-traitant
                {filteredProviders.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${providers.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-left px-4 py-3 font-medium">Types d&apos;actions</th>
                    <th className="text-left px-4 py-3 font-medium">Départ</th>
                    <th className="text-left px-4 py-3 font-medium">Réception</th>
                    <th className="text-left px-4 py-3 font-medium">Transit</th>
                    <th className="text-left px-4 py-3 font-medium">Créé le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-zinc-600 py-12">
                        Aucun sous-traitant trouvé
                      </td>
                    </tr>
                  )}
                  {filteredProviders.map((provider) => (
                    <tr
                      key={provider.id}
                      className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-100 font-medium">{provider.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={provider.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {provider.supportedActionTypes.length > 0
                          ? provider.supportedActionTypes.join(', ')
                          : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{provider.latestDepartureTime}</td>
                      <td className="px-4 py-3 text-zinc-400">{provider.receptionTime}</td>
                      <td className="px-4 py-3 text-zinc-400">{provider.transitDays} j</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(provider.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingProvider(provider); }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingProvider(provider); }}
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
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
        <ProviderFormModal
          initial={null}
          onSave={handleSaveCreate}
          onCancel={() => { setIsCreating(false); setSaveError(null); }}
          isSaving={isCreatingLoading}
        />
      )}
      {isCreating && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Edit modal */}
      {editingProvider && (
        <ProviderFormModal
          initial={editingProvider}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingProvider(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
        />
      )}
      {editingProvider && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Delete confirmation */}
      {deletingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-zinc-100 font-medium mb-2">Supprimer le sous-traitant</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Supprimer{' '}
              <span className="font-medium text-zinc-200">{deletingProvider.name}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingProvider(null); setDeleteError(null); }}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
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
