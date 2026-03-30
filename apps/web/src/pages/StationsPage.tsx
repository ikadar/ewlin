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
  OperatingScheduleEditor,
  ExceptionsEditor,
  FluxSelect,
} from '../components/ScheduleEditor';
import type { OperatingSchedule, ScheduleExceptionInput, DaySchedule } from '../components/ScheduleEditor';
import { generateId } from '../utils/generateId';

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
  // Visual mode state
  const [scheduleData, setScheduleData] = useState<OperatingSchedule>(
    (initial?.operatingSchedule as unknown as OperatingSchedule) ?? DEFAULT_OPERATING_SCHEDULE
  );
  const [exceptionsData, setExceptionsData] = useState<ScheduleExceptionInput[]>(() => {
    if (!initial?.scheduleExceptions?.length) return [];
    return initial.scheduleExceptions.map((e) => ({
      id: generateId(),
      date: (e as { date: string }).date ?? '',
      reason: ((e as { reason: string | null }).reason ?? ''),
      schedule: ((e as { type: string }).type === 'MODIFIED' && (e as { schedule: DaySchedule | null }).schedule)
        ? (e as { schedule: DaySchedule }).schedule
        : { isOperating: false, slots: [] },
    }));
  });

  // Mode toggles (visual vs JSON)
  const [scheduleJsonMode, setScheduleJsonMode] = useState(false);
  const [exceptionsJsonMode, setExceptionsJsonMode] = useState(false);

  // JSON fallback state
  const [scheduleJson, setScheduleJson] = useState('');
  const [exceptionsJson, setExceptionsJson] = useState('');
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
    (!scheduleJsonMode || scheduleError === null) &&
    (!exceptionsJsonMode || exceptionsError === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    let operatingSchedule: Record<string, unknown> | null;
    let scheduleExceptions: unknown[] | null;

    if (scheduleJsonMode) {
      const valid = validateScheduleJson(scheduleJson);
      if (!valid) return;
      operatingSchedule = scheduleJson.trim() ? (JSON.parse(scheduleJson) as Record<string, unknown>) : null;
    } else {
      operatingSchedule = scheduleData as unknown as Record<string, unknown>;
    }

    if (exceptionsJsonMode) {
      const valid = validateExceptionsJson(exceptionsJson);
      if (!valid) return;
      scheduleExceptions = exceptionsJson.trim() ? (JSON.parse(exceptionsJson) as unknown[]) : null;
    } else {
      scheduleExceptions = exceptionsData.length > 0
        ? exceptionsData.map((exc) => ({
            date: exc.date,
            type: exc.schedule.isOperating ? 'MODIFIED' : 'CLOSED',
            reason: exc.reason || null,
            schedule: exc.schedule.isOperating ? exc.schedule : null,
          }))
        : null;
    }

    await onSave({
      name: name.trim(),
      status,
      categoryId,
      groupId,
      capacity: parseInt(capacity, 10) || 1,
      displayOrder: parseInt(displayOrder, 10) || 0,
      operatingSchedule,
      scheduleExceptions,
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

          {/* Row 4: Operating Schedule */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-flux-text-secondary">Planning d'exploitation</label>
              <div className="inline-flex rounded-md overflow-hidden border border-flux-border-light">
                <button
                  type="button"
                  onClick={() => {
                    if (scheduleJsonMode) {
                      // Switching to visual: try to parse current JSON
                      try {
                        const parsed = JSON.parse(scheduleJson);
                        setScheduleData(parsed as OperatingSchedule);
                        setScheduleJsonMode(false);
                        setScheduleError(null);
                      } catch {
                        setScheduleError('JSON invalide — impossible de basculer en mode visuel');
                      }
                    }
                  }}
                  className={`px-3 py-0.5 text-xs transition-colors ${!scheduleJsonMode ? 'bg-blue-600 text-white' : 'bg-flux-base text-flux-text-tertiary hover:text-flux-text-secondary'}`}
                >
                  Visuel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!scheduleJsonMode) {
                      setScheduleJson(JSON.stringify(scheduleData, null, 2));
                      setScheduleJsonMode(true);
                      setScheduleError(null);
                    }
                  }}
                  className={`px-3 py-0.5 text-xs transition-colors ${scheduleJsonMode ? 'bg-blue-600 text-white' : 'bg-flux-base text-flux-text-tertiary hover:text-flux-text-secondary'}`}
                >
                  JSON
                </button>
              </div>
            </div>
            {scheduleJsonMode ? (
              <>
                <textarea
                  rows={10}
                  value={scheduleJson}
                  onChange={(e) => {
                    setScheduleJson(e.target.value);
                    setScheduleError(null);
                  }}
                  onBlur={() => validateScheduleJson(scheduleJson)}
                  className={`w-full px-3 py-2 bg-flux-base border rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none font-mono text-xs resize-y ${scheduleError ? 'border-red-500 focus:border-red-400' : 'border-flux-border-light focus:border-flux-text-secondary'}`}
                  placeholder="{}"
                  spellCheck={false}
                />
                {scheduleError && (
                  <p className="mt-1 text-xs text-red-400">{scheduleError}</p>
                )}
              </>
            ) : (
              <OperatingScheduleEditor value={scheduleData} onChange={setScheduleData} />
            )}
          </div>

          {/* Row 5: Exceptions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-flux-text-secondary">Exceptions de planning</label>
              <div className="inline-flex rounded-md overflow-hidden border border-flux-border-light">
                <button
                  type="button"
                  onClick={() => {
                    if (exceptionsJsonMode) {
                      try {
                        const parsed = JSON.parse(exceptionsJson);
                        if (!Array.isArray(parsed)) throw new Error();
                        setExceptionsData(
                          parsed.map((e: Record<string, unknown>) => ({
                            id: generateId(),
                            date: (e.date as string) ?? '',
                            reason: (e.reason as string) ?? '',
                            schedule: (e.type === 'MODIFIED' && e.schedule)
                              ? (e.schedule as DaySchedule)
                              : { isOperating: false, slots: [] },
                          }))
                        );
                        setExceptionsJsonMode(false);
                        setExceptionsError(null);
                      } catch {
                        setExceptionsError('JSON invalide — impossible de basculer en mode visuel');
                      }
                    }
                  }}
                  className={`px-3 py-0.5 text-xs transition-colors ${!exceptionsJsonMode ? 'bg-blue-600 text-white' : 'bg-flux-base text-flux-text-tertiary hover:text-flux-text-secondary'}`}
                >
                  Visuel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!exceptionsJsonMode) {
                      const apiFormat = exceptionsData.map((exc) => ({
                        date: exc.date,
                        type: exc.schedule.isOperating ? 'MODIFIED' : 'CLOSED',
                        reason: exc.reason || null,
                        schedule: exc.schedule.isOperating ? exc.schedule : null,
                      }));
                      setExceptionsJson(JSON.stringify(apiFormat, null, 2));
                      setExceptionsJsonMode(true);
                      setExceptionsError(null);
                    }
                  }}
                  className={`px-3 py-0.5 text-xs transition-colors ${exceptionsJsonMode ? 'bg-blue-600 text-white' : 'bg-flux-base text-flux-text-tertiary hover:text-flux-text-secondary'}`}
                >
                  JSON
                </button>
              </div>
            </div>
            {exceptionsJsonMode ? (
              <>
                <textarea
                  rows={5}
                  value={exceptionsJson}
                  onChange={(e) => {
                    setExceptionsJson(e.target.value);
                    setExceptionsError(null);
                  }}
                  onBlur={() => validateExceptionsJson(exceptionsJson)}
                  className={`w-full px-3 py-2 bg-flux-base border rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none font-mono text-xs resize-y ${exceptionsError ? 'border-red-500 focus:border-red-400' : 'border-flux-border-light focus:border-flux-text-secondary'}`}
                  placeholder="[]"
                  spellCheck={false}
                />
                {exceptionsError && (
                  <p className="mt-1 text-xs text-red-400">{exceptionsError}</p>
                )}
              </>
            ) : (
              <ExceptionsEditor value={exceptionsData} onChange={setExceptionsData} />
            )}
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
