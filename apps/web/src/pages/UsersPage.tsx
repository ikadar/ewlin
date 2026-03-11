/**
 * UsersPage — CRUD page for admin user management
 *
 * Accessible at /settings/users.
 * Follows the same pattern as ClientsPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from '../store/api/adminUserApi';
import { useGetUserGroupsQuery } from '../store/api/adminUserGroupApi';
import type { AdminUserResponse } from '../store/api/adminUserApi';
import type { AdminUserGroupResponse } from '../store/api/adminUserGroupApi';

// ============================================================================
// User Form Modal
// ============================================================================

interface UserFormModalProps {
  initial?: AdminUserResponse | null;
  groups: AdminUserGroupResponse[];
  onSave: (data: {
    email: string;
    displayName: string;
    password: string;
    groupIds: string[];
    isActive: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function UserFormModal({ initial, groups, onSave, onCancel, isSaving }: UserFormModalProps) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    initial?.groups.map((g) => g.id) ?? [],
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
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
    await onSave({
      email: email.trim(),
      displayName: displayName.trim(),
      password,
      groupIds: selectedGroupIds,
      isActive,
    });
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const isValid = email.trim() && displayName.trim() && (initial || password.length >= 12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
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
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Jean Dupont"
            />
          </div>

          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="jean@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Mot de passe {!initial && <span className="text-red-400">*</span>}
              {initial && <span className="text-flux-text-muted text-xs ml-1">(laisser vide pour ne pas changer)</span>}
            </label>
            <input
              type="password"
              required={!initial}
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder={initial ? '••••••••••••' : 'Min. 12 caractères'}
            />
          </div>

          {groups.length > 0 && (
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Groupes</label>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-flux-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="rounded border-flux-border-light"
                    />
                    <span className="text-sm text-flux-text-primary">{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {initial && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-flux-border-light"
                />
                <span className="text-sm text-flux-text-primary">Actif</span>
              </label>
            </div>
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
              disabled={isSaving || !isValid}
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
// UsersPage
// ============================================================================

export function UsersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingUser, setEditingUser] = useState<AdminUserResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUserResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: users = [], isLoading, error } = useGetUsersQuery();
  const { data: groups = [] } = useGetUserGroupsQuery();
  const [createUser, { isLoading: isCreatingLoading }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdatingLoading }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  // Keyboard shortcuts
  useEffect(() => {
    if (editingUser || isCreating || deletingUser) return;

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
  }, [navigate, editingUser, isCreating, deletingUser]);

  // Client-side filtering
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.groups.some((g) => g.name.toLowerCase().includes(query)),
    );
  }, [users, searchQuery]);

  // Handlers
  const handleSaveCreate = async (data: {
    email: string;
    displayName: string;
    password: string;
    groupIds: string[];
  }) => {
    setSaveError(null);
    try {
      await createUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        groupIds: data.groupIds,
      }).unwrap();
      setIsCreating(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la création';
      setSaveError(msg);
    }
  };

  const handleSaveEdit = async (data: {
    email: string;
    displayName: string;
    password: string;
    groupIds: string[];
    isActive: boolean;
  }) => {
    if (!editingUser) return;
    setSaveError(null);
    try {
      await updateUser({
        id: editingUser.id,
        body: {
          email: data.email,
          displayName: data.displayName,
          password: data.password || undefined,
          groupIds: data.groupIds,
          isActive: data.isActive,
        },
      }).unwrap();
      setEditingUser(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la modification';
      setSaveError(msg);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleteError(null);
    try {
      await deleteUser(deletingUser.id).unwrap();
      setDeletingUser(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        'Erreur lors de la désactivation';
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Utilisateurs</h1>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsCreating(true); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouvel utilisateur
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des utilisateurs
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
                  aria-label="Rechercher un utilisateur"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredUsers.length} utilisateur
                {filteredUsers.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${users.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Groupes</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-left px-4 py-3 font-medium">Dernière connexion</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-flux-text-muted py-12">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium">
                        {user.displayName}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.groups.map((g) => (
                            <span
                              key={g.id}
                              className="px-1.5 py-0.5 text-xs rounded bg-blue-400/10 text-blue-400"
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            user.isActive
                              ? 'text-emerald-400 bg-emerald-400/10'
                              : 'text-red-400 bg-red-400/10'
                          }`}
                        >
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setSaveError(null); setEditingUser(user); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setDeletingUser(user); }}
                            className="p-1.5 text-flux-text-tertiary hover:text-red-400 transition-colors"
                            title="Désactiver"
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
        <UserFormModal
          initial={null}
          groups={groups}
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
      {editingUser && (
        <UserFormModal
          initial={editingUser}
          groups={groups}
          onSave={handleSaveEdit}
          onCancel={() => { setEditingUser(null); setSaveError(null); }}
          isSaving={isUpdatingLoading}
        />
      )}
      {editingUser && saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* Delete confirmation (soft delete = deactivate) */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Désactiver l'utilisateur</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Désactiver{' '}
              <span className="font-medium text-flux-text-primary">{deletingUser.displayName}</span> ?
              L'utilisateur ne pourra plus se connecter.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeletingUser(null); setDeleteError(null); }}
                className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
