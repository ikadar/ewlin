/**
 * StationsPage - CRUD page for stations
 *
 * Accessible at /stations.
 * Follows the same pattern as StationCategoriesPage.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetStationsQuery,
  useCreateStationMutation,
  useUpdateStationMutation,
  useDeleteStationMutation,
} from '../store/api/stationApi';
import { useGetStationCategoriesQuery } from '../store/api/stationCategoryApi';
import { useGetSnapshotQuery } from '../store';
import type { StationResponse, StationInput } from '../store/api/stationApi';
import {
  FluxSelect,
} from '../components/ScheduleEditor';

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = ['Available', 'InUse', 'Maintenance', 'OutOfService'] as const;

// ============================================================================
// Status Badge
// ============================================================================

const STATUS_STYLES: Record<string, string> = {
  Available:    'text-emerald-400 bg-emerald-400/10',
  InUse:        'text-blue-400 bg-blue-400/10',
  Maintenance:  'text-amber-400 bg-amber-400/10',
  OutOfService: 'text-red-400 bg-red-400/10',
};

const STATUS_LABELS: Record<string, string> = {
  Available:    'Disponible',
  InUse:        'En cours',
  Maintenance:  'Maintenance',
  OutOfService: 'Hors service',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'text-flux-text-secondary bg-flux-text-secondary/10'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ============================================================================
// Station Form Modal
// ============================================================================

interface StationFormModalProps {
  initial?: StationResponse | null;
  categories: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  onSave: (data: StationInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function StationFormModal({ initial, categories, groups, onSave, onCancel, isSaving }: StationFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState<string>(initial?.status ?? 'Available');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [groupId, setGroupId] = useState(initial?.groupId ?? groups[0]?.id ?? '');
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 1));
  const [displayOrder, setDisplayOrder] = useState(String(initial?.displayOrder ?? 0));

  // Operator-algorithm attributes
  const [attentionFull, setAttentionFull] = useState(String(initial?.attentionFull ?? 1));
  const [attentionRun, setAttentionRun] = useState(String(initial?.attentionRun ?? 1));
  const [maskedTimeEnabled, setMaskedTimeEnabled] = useState(initial?.maskedTimeEnabled ?? false);
  const [attentionMasked, setAttentionMasked] = useState(String(initial?.attentionMasked ?? 1));
  const [maskedProductivity, setMaskedProductivity] = useState(initial?.maskedProductivity != null ? String(initial.maskedProductivity) : '0.95');
  const [tickMinutes, setTickMinutes] = useState(String(initial?.tickMinutes ?? 15));
  const [peremptionHours, setPeremptionHours] = useState(String(initial?.peremptionThresholdMinutes != null ? initial.peremptionThresholdMinutes / 60 : 2));
  const [maxChunkHours, setMaxChunkHours] = useState(String(initial?.maxChunkMinutes != null ? initial.maxChunkMinutes / 60 : 7));
  const [maxOperators, setMaxOperators] = useState(String(initial?.maxOperators ?? 1));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const canSave = name.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    await onSave({
      name: name.trim(),
      status,
      categoryId,
      groupId,
      capacity: parseInt(capacity, 10) || 1,
      displayOrder: parseInt(displayOrder, 10) || 0,
      operatingSchedule: (initial?.operatingSchedule as Record<string, unknown>) ?? null,
      scheduleExceptions: (initial?.scheduleExceptions as unknown[]) ?? null,
      attentionFull: attentionFull.trim() ? parseFloat(attentionFull) : null,
      attentionRun: attentionRun.trim() ? parseFloat(attentionRun) : null,
      maskedTimeEnabled,
      attentionMasked: maskedTimeEnabled && attentionMasked.trim() ? parseFloat(attentionMasked) : null,
      maskedProductivity: maskedTimeEnabled && maskedProductivity.trim() ? parseFloat(maskedProductivity) : null,
      tickMinutes: tickMinutes.trim() ? parseInt(tickMinutes, 10) : null,
      peremptionThresholdMinutes: peremptionHours.trim() ? Math.round(parseFloat(peremptionHours) * 60) : null,
      maxChunkMinutes: maxChunkHours.trim() ? Math.round(parseFloat(maxChunkHours) * 60) : null,
      maxOperators: maxOperators.trim() ? parseInt(maxOperators, 10) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? 'Modifier la station' : 'Nouvelle station'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Row 1: Name */}
          <div>
            <label className="block text-sm text-flux-text-secondary mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
              placeholder="Ex : Komori G40"
            />
          </div>

          {/* Row 2: Status + Capacity + DisplayOrder */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Statut</label>
              <FluxSelect
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Capacité</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                onBlur={() => { const n = parseInt(capacity, 10); setCapacity(String(isNaN(n) || n < 1 ? 1 : n)); }}
                className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
              />
            </div>
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                onBlur={() => { const n = parseInt(displayOrder, 10); setDisplayOrder(String(isNaN(n) ? 0 : n)); }}
                className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
              />
            </div>
          </div>

          {/* Row 3: Category + Group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Catégorie</label>
              <FluxSelect
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Groupe</label>
              <FluxSelect
                value={groupId}
                onChange={setGroupId}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                className="w-full"
              />
            </div>
          </div>

          {/* Operator Algorithm Fields */}
          <div className="pt-2 border-t border-flux-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">Algorithme opérateur</p>

            {/* Attention calage + roulage (always visible) */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Attention calage</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={attentionFull}
                  onChange={(e) => setAttentionFull(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Attention roulage</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={attentionRun}
                  onChange={(e) => setAttentionRun(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
            </div>

            {/* Masked time switch */}
            <div className="flex items-center gap-2.5 mb-3">
              <button
                type="button"
                onClick={() => setMaskedTimeEnabled(!maskedTimeEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors ${maskedTimeEnabled ? 'bg-green-500' : 'bg-flux-elevated border border-flux-border-light'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${maskedTimeEnabled ? 'left-[18px] bg-white' : 'left-0.5 bg-flux-text-muted'}`} />
              </button>
              <span className="text-sm text-flux-text-secondary">Temps masqué possible</span>
            </div>

            {/* Masked time fields (only when switch enabled) */}
            {maskedTimeEnabled && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm text-flux-text-secondary mb-1">Attention temps masqué</label>
                  <input
                    type="number" step="0.1" min="0" max="2"
                    value={attentionMasked}
                    onChange={(e) => setAttentionMasked(e.target.value)}
                    className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-flux-text-secondary mb-1">Productivité masquée</label>
                  <input
                    type="number" step="0.05" min="0" max="1"
                    value={maskedProductivity}
                    onChange={(e) => setMaskedProductivity(e.target.value)}
                    className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                  />
                </div>
              </div>
            )}

            {/* Timing fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Pas de temps (min)</label>
                <input
                  type="number" min="1"
                  value={tickMinutes}
                  onChange={(e) => setTickMinutes(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Seuil péremption (h)</label>
                <input
                  type="number" step="0.5" min="0"
                  value={peremptionHours}
                  onChange={(e) => setPeremptionHours(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Durée max chunk (h)</label>
                <input
                  type="number" step="0.5" min="0"
                  value={maxChunkHours}
                  onChange={(e) => setMaxChunkHours(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
              <div>
                <label className="block text-sm text-flux-text-secondary mb-1">Max opérateurs</label>
                <input
                  type="number" step="1" min="1"
                  value={maxOperators}
                  onChange={(e) => setMaxOperators(e.target.value)}
                  className="w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover disabled:opacity-50 rounded transition-colors"
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
// StationsPage
// ============================================================================

export function StationsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingStation, setEditingStation] = useState<StationResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStation, setDeletingStation] = useState<StationResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: stations = [], isLoading, error } = useGetStationsQuery();
  const [createStation, { isLoading: isCreatingLoading }] = useCreateStationMutation();
  const [updateStation, { isLoading: isUpdatingLoading }] = useUpdateStationMutation();
  const [deleteStation] = useDeleteStationMutation();

  const { data: categories = [] } = useGetStationCategoriesQuery();
  const { data: snapshotData } = useGetSnapshotQuery();

  const groups = useMemo(
    () => (snapshotData?.groups ?? []).filter((g) => !g.isOutsourcedProviderGroup),
    [snapshotData]
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const groupById = useMemo(
    () => new Map((snapshotData?.groups ?? []).map((g) => [g.id, g.name])),
    [snapshotData]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (editingStation || isCreating || deletingStation) return;

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
  }, [navigate, editingStation, isCreating, deletingStation]);

  // Client-side filtering
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const query = searchQuery.toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.status.toLowerCase().includes(query) ||
        (categoryById.get(s.categoryId) ?? '').toLowerCase().includes(query) ||
        (groupById.get(s.groupId) ?? '').toLowerCase().includes(query)
    );
  }, [stations, searchQuery, categoryById, groupById]);

  // Handlers
  const handleSaveCreate = async (data: StationInput) => {
    await createStation(data).unwrap();
    setIsCreating(false);
  };

  const handleSaveEdit = async (data: StationInput) => {
    if (!editingStation) return;
    await updateStation({ id: editingStation.id, body: data }).unwrap();
    setEditingStation(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingStation) return;
    setDeleteError(null);
    try {
      await deleteStation(deletingStation.id).unwrap();
      setDeletingStation(null);
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
          <h1 className="text-xl font-semibold text-flux-text-primary">Stations</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouvelle station
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des stations
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
                  aria-label="Rechercher une station"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredStations.length} station
                {filteredStations.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${stations.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                    <th className="text-left px-4 py-3 font-medium">Groupe</th>
                    <th className="text-left px-4 py-3 font-medium">Cap.</th>
                    <th className="text-left px-4 py-3 font-medium">Ordre</th>
                    <th className="text-left px-4 py-3 font-medium">Créé le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredStations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-flux-text-muted py-12">
                        Aucune station trouvée
                      </td>
                    </tr>
                  )}
                  {filteredStations.map((station) => (
                    <tr
                      key={station.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium">{station.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={station.status} />
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {categoryById.get(station.categoryId) ?? (
                          <span className="text-flux-text-muted text-xs font-mono">{station.categoryId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {groupById.get(station.groupId) ?? (
                          <span className="text-flux-text-muted text-xs font-mono">{station.groupId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-flux-text-secondary">{station.capacity}</td>
                      <td className="px-4 py-3 text-flux-text-secondary">{station.displayOrder}</td>
                      <td className="px-4 py-3 text-flux-text-tertiary text-xs">
                        {new Date(station.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingStation(station)}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingStation(station);
                            }}
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
        <StationFormModal
          initial={null}
          categories={categories}
          groups={groups}
          onSave={handleSaveCreate}
          onCancel={() => setIsCreating(false)}
          isSaving={isCreatingLoading}
        />
      )}

      {/* Edit modal */}
      {editingStation && (
        <StationFormModal
          initial={editingStation}
          categories={categories}
          groups={groups}
          onSave={handleSaveEdit}
          onCancel={() => setEditingStation(null)}
          isSaving={isUpdatingLoading}
        />
      )}

      {/* Delete confirmation */}
      {deletingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer la station</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary">{deletingStation.name}</span> ?
              Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeletingStation(null);
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
