/**
 * ClientsPage - CRUD page for clients
 *
 * Accessible at /clients.
 * Follows the same pattern as StationCategoriesPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} from '../store/api/clientApi';
import type { ClientResponse } from '../store/api/clientApi';

// ============================================================================
// Client Form Modal
// ============================================================================

interface ClientFormModalProps {
  initial?: ClientResponse | null;
  onSave: (data: { name: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function ClientFormModal({ initial, onSave, onCancel, isSaving }: ClientFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name: name.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }} tabIndex={-1}>
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier le client' : 'Nouveau client'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Imprimerie Martin"
            />
          </div>

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
// ClientsPage
// ============================================================================

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingClient, setEditingClient] = useState<ClientResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingClient, setDeletingClient] = useState<ClientResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: clients = [], isLoading, error } = useGetClientsQuery();
  const [createClient, { isLoading: isCreatingLoading }] = useCreateClientMutation();
  const [updateClient, { isLoading: isUpdatingLoading }] = useUpdateClientMutation();
  const [deleteClient] = useDeleteClientMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingClient || isCreating || deletingClient) return;

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
  }, [navigate, editingClient, isCreating, deletingClient]);

  // Client-side filtering
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(query));
  }, [clients, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: { name: string }) => {
    setSaveError(null);
    try {
      await createClient({ name: data.name }).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: { name: string }) => {
    if (!editingClient) return;
    setSaveError(null);
    try {
      await updateClient({ id: editingClient.id, body: { name: data.name } }).unwrap();
      setEditingClient(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClient) return;
    setDeleteError(null);
    try {
      await deleteClient(deletingClient.id).unwrap();
      setDeletingClient(null);
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Clients</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des clients
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
                  aria-label="Rechercher un client"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredClients.length} client
                {filteredClients.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${clients.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Créé le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-flux-text-muted py-12">
                        Aucun client trouvé
                      </td>
                    </tr>
                  )}
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium">{client.name}</td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingClient(client); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingClient(client); }}
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
        <ClientFormModal
          initial={null}
          onSave={handleSaveCreate}
          onCancel={() => { setIsCreating(false); setSaveError(null); }}
          isSaving={isCreatingLoading}
        />
      )}
      {isCreating && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Edit modal */}
      {editingClient && (
        <ClientFormModal
          initial={editingClient}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingClient(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
        />
      )}
      {editingClient && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Delete confirmation */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeletingClient(null)} onKeyDown={e => { if (e.key === 'Escape') setDeletingClient(null); }} tabIndex={-1}>
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer le client</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary">{deletingClient.name}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingClient(null); setDeleteError(null); }}
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
