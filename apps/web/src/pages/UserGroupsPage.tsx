/**
 * UserGroupsPage — CRUD page for admin user group management
 *
 * Accessible at /settings/user-groups.
 * Follows the same pattern as ClientsPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetUserGroupsQuery,
  useCreateUserGroupMutation,
  useUpdateUserGroupMutation,
  useDeleteUserGroupMutation,
} from '../store/api/adminUserGroupApi';
import type { AdminUserGroupResponse } from '../store/api/adminUserGroupApi';

// ============================================================================
// Permission list (matches backend Permission enum)
// ============================================================================

const ALL_PERMISSIONS = [
  { value: 'scheduling.view', label: 'Planning — Consultation' },
  { value: 'scheduling.assign', label: 'Planning — Assignation' },
  { value: 'jobs.create', label: 'Jobs — Création' },
  { value: 'jobs.edit', label: 'Jobs — Modification' },
  { value: 'reporting.edit', label: 'Rapports' },
  { value: 'settings.view', label: 'Paramètres — Consultation' },
  { value: 'settings.edit', label: 'Paramètres — Modification' },
  { value: 'admin.users', label: 'Administration utilisateurs' },
];

// ============================================================================
// UserGroup Form Modal
// ============================================================================

interface UserGroupFormModalProps {
  initial?: AdminUserGroupResponse | null;
  onSave: (data: { name: string; permissions: string[] }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function UserGroupFormModal({ initial, onSave, onCancel, isSaving }: UserGroupFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    initial?.permissions ?? [],
  );
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
    await onSave({ name: name.trim(), permissions: selectedPermissions });
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier le groupe' : 'Nouveau groupe'}
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
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Administrateurs"
            />
          </div>

          <div>
            <label className="block text-sm text-flux-text-secondary mb-2">Permissions</label>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-flux-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    className="rounded border-flux-border-light"
                  />
                  <span className="text-sm text-flux-text-primary">{perm.label}</span>
                </label>
              ))}
            </div>
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
// Permission label lookup
// ============================================================================

const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => [p.value, p.label]),
);

// ============================================================================
// UserGroupsPage
// ============================================================================

export function UserGroupsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingGroup, setEditingGroup] = useState<AdminUserGroupResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<AdminUserGroupResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: groups = [], isLoading, error } = useGetUserGroupsQuery();
  const [createGroup, { isLoading: isCreatingLoading }] = useCreateUserGroupMutation();
  const [updateGroup, { isLoading: isUpdatingLoading }] = useUpdateUserGroupMutation();
  const [deleteGroup] = useDeleteUserGroupMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingGroup || isCreating || deletingGroup) return;

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
  }, [navigate, editingGroup, isCreating, deletingGroup]);

  // Client-side filtering
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: { name: string; permissions: string[] }) => {
    setSaveError(null);
    try {
      await createGroup({ name: data.name, permissions: data.permissions }).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: { name: string; permissions: string[] }) => {
    if (!editingGroup) return;
    setSaveError(null);
    try {
      await updateGroup({
        id: editingGroup.id,
        body: { name: data.name, permissions: data.permissions },
      }).unwrap();
      setEditingGroup(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGroup) return;
    setDeleteError(null);
    try {
      await deleteGroup(deletingGroup.id).unwrap();
      setDeletingGroup(null);
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Groupes d'utilisateurs</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau groupe
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des groupes
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
                  aria-label="Rechercher un groupe"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredGroups.length} groupe
                {filteredGroups.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${groups.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Permissions</th>
                    <th className="text-left px-4 py-3 font-medium">Membres</th>
                    <th className="text-left px-4 py-3 font-medium">Créé le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-flux-text-muted py-12">
                        Aucun groupe trouvé
                      </td>
                    </tr>
                  )}
                  {filteredGroups.map((group) => (
                    <tr
                      key={group.id}
                      className="border-b border-flux-border group/row hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium">
                        {group.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {group.permissions.map((perm) => (
                            <span
                              key={perm}
                              className="px-1.5 py-0.5 text-xs rounded bg-violet-400/10 text-violet-400"
                            >
                              {PERMISSION_LABELS[perm] ?? perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">{group.userCount}</td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {new Date(group.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingGroup(group); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingGroup(group); }}
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
        <UserGroupFormModal
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
      {editingGroup && (
        <UserGroupFormModal
          initial={editingGroup}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingGroup(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
        />
      )}
      {editingGroup && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Delete confirmation (hard delete) */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer le groupe</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary">{deletingGroup.name}</span> ?
              Cette action est irréversible.
              {deletingGroup.userCount > 0 && (
                <span className="block mt-1 text-amber-400">
                  Ce groupe contient {deletingGroup.userCount} membre
                  {deletingGroup.userCount > 1 ? 's' : ''}.
                </span>
              )}
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingGroup(null); setDeleteError(null); }}
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
