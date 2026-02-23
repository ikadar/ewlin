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

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = ['Available', 'InUse', 'Maintenance', 'OutOfService'] as const;

const DEFAULT_OPERATING_SCHEDULE = {
  monday:    { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  tuesday:   { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  wednesday: { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  thursday:  { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  friday:    { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  saturday:  { isOperating: false, slots: [] },
  sunday:    { isOperating: false, slots: [] },
};

const DEFAULT_SCHEDULE_JSON = JSON.stringify(DEFAULT_OPERATING_SCHEDULE, null, 2);

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'text-zinc-400 bg-zinc-400/10'}`}>
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
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? 0);
  const [scheduleJson, setScheduleJson] = useState(
    initial?.operatingSchedule != null
      ? JSON.stringify(initial.operatingSchedule, null, 2)
      : DEFAULT_SCHEDULE_JSON
  );
  const [exceptionsJson, setExceptionsJson] = useState(
    initial?.scheduleExceptions != null
      ? JSON.stringify(initial.scheduleExceptions, null, 2)
      : '[]'
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [exceptionsError, setExceptionsError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const validateScheduleJson = (value: string): boolean => {
    if (value.trim() === '') {
      setScheduleError(null);
      return true;
    }
    try {
      JSON.parse(value);
      setScheduleError(null);
      return true;
    } catch {
      setScheduleError('JSON invalide');
      return false;
    }
  };

  const validateExceptionsJson = (value: string): boolean => {
    if (value.trim() === '') {
      setExceptionsError(null);
      return true;
    }
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setExceptionsError('Doit être un tableau JSON');
        return false;
      }
      setExceptionsError(null);
      return true;
    } catch {
      setExceptionsError('JSON invalide');
      return false;
    }
  };

  const canSave =
    name.trim() !== '' &&
    scheduleError === null &&
    exceptionsError === null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const scheduleValid = validateScheduleJson(scheduleJson);
    const exceptionsValid = validateExceptionsJson(exceptionsJson);
    if (!scheduleValid || !exceptionsValid) return;

    const operatingSchedule = scheduleJson.trim()
      ? (JSON.parse(scheduleJson) as Record<string, unknown>)
      : null;
    const scheduleExceptions = exceptionsJson.trim()
      ? (JSON.parse(exceptionsJson) as unknown[])
      : null;

    await onSave({
      name: name.trim(),
      status,
      categoryId,
      groupId,
      capacity,
      displayOrder,
      operatingSchedule,
      scheduleExceptions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-zinc-100 font-medium mb-4">
          {initial ? 'Modifier la station' : 'Nouvelle station'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Row 1: Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
              placeholder="Ex : Komori G40"
            />
          </div>

          {/* Row 2: Status + Capacity + DisplayOrder */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Capacité</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Row 3: Category + Group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Catégorie</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Groupe</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Operating Schedule JSON */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Planning d'exploitation (JSON)</label>
            <textarea
              rows={10}
              value={scheduleJson}
              onChange={(e) => {
                setScheduleJson(e.target.value);
                setScheduleError(null);
              }}
              onBlur={() => validateScheduleJson(scheduleJson)}
              className={`w-full px-3 py-2 bg-zinc-900 border rounded text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono text-xs resize-y ${scheduleError ? 'border-red-500 focus:border-red-400' : 'border-zinc-600 focus:border-zinc-400'}`}
              placeholder="{}"
              spellCheck={false}
            />
            {scheduleError && (
              <p className="mt-1 text-xs text-red-400">{scheduleError}</p>
            )}
          </div>

          {/* Row 5: Exceptions JSON */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Exceptions (JSON)</label>
            <textarea
              rows={5}
              value={exceptionsJson}
              onChange={(e) => {
                setExceptionsJson(e.target.value);
                setExceptionsError(null);
              }}
              onBlur={() => validateExceptionsJson(exceptionsJson)}
              className={`w-full px-3 py-2 bg-zinc-900 border rounded text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono text-xs resize-y ${exceptionsError ? 'border-red-500 focus:border-red-400' : 'border-zinc-600 focus:border-zinc-400'}`}
              placeholder="[]"
              spellCheck={false}
            />
            {exceptionsError && (
              <p className="mt-1 text-xs text-red-400">{exceptionsError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !canSave}
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
          <h1 className="text-xl font-semibold text-zinc-100">Stations</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouvelle station
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-zinc-500 mt-20">Chargement...</div>
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher... (/)"
                  aria-label="Rechercher une station"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <span className="text-zinc-500 text-sm">
                {filteredStations.length} station
                {filteredStations.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${stations.length}`}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
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
                      <td colSpan={8} className="text-center text-zinc-600 py-12">
                        Aucune station trouvée
                      </td>
                    </tr>
                  )}
                  {filteredStations.map((station) => (
                    <tr
                      key={station.id}
                      className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-100 font-medium">{station.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={station.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {categoryById.get(station.categoryId) ?? (
                          <span className="text-zinc-600 text-xs font-mono">{station.categoryId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {groupById.get(station.groupId) ?? (
                          <span className="text-zinc-600 text-xs font-mono">{station.groupId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{station.capacity}</td>
                      <td className="px-4 py-3 text-zinc-400">{station.displayOrder}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {new Date(station.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingStation(station)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingStation(station);
                            }}
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
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-zinc-100 font-medium mb-2">Supprimer la station</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Supprimer{' '}
              <span className="font-medium text-zinc-200">{deletingStation.name}</span> ?
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
