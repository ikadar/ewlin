/**
 * Capacity overrides settings page (Phase 8).
 *
 * Per-scenario, per-station, per-window operator-count delta. The chef
 * picks a scenario at the top (defaults to Préprod) and CRUDs overrides
 * underneath. V1 is intent-only — the engine pipeline doesn't honour
 * these rows yet, but the schema is locked so the chef can capture
 * planned capacity changes ahead of the engine integration.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Info, Edit2, X, Check } from 'lucide-react';
import {
  useListAllScenariosQuery,
  useGetCapacityOverridesQuery,
  useCreateCapacityOverrideMutation,
  useUpdateCapacityOverrideMutation,
  useDeleteCapacityOverrideMutation,
  useGetStationsQuery,
} from '../store';
import type { CapacityOverride } from '../store/api/capacityOverrideApi';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

interface OverrideFormState {
  stationId: string;
  startsAt: string;
  endsAt: string;
  operatorCountDelta: number;
  note: string;
}

function emptyForm(stationId = ''): OverrideFormState {
  const now = new Date();
  const inAMonth = new Date();
  inAMonth.setMonth(inAMonth.getMonth() + 1);
  return {
    stationId,
    startsAt: now.toISOString().slice(0, 16),
    endsAt: inAMonth.toISOString().slice(0, 16),
    operatorCountDelta: 1,
    note: '',
  };
}

export function CapacityOverridesPage() {
  const { data: scenarioList } = useListAllScenariosQuery();
  const { data: stationData } = useGetStationsQuery();
  const stations = useMemo(() => stationData ?? [], [stationData]);

  const preprod = scenarioList?.scenarios.find((s) => s.type === 'preprod');
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  useEffect(() => {
    if (scenarioId === null && preprod) {
      setScenarioId(preprod.id);
    }
  }, [preprod, scenarioId]);

  const { data: overrides, isLoading } = useGetCapacityOverridesQuery(scenarioId ?? '', {
    skip: !scenarioId,
  });

  const [createOverride, createState] = useCreateCapacityOverrideMutation();
  const [updateOverride, updateState] = useUpdateCapacityOverrideMutation();
  const [deleteOverride] = useDeleteCapacityOverrideMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<OverrideFormState>(() => emptyForm());

  const handleAdd = async () => {
    if (!scenarioId || !form.stationId) return;
    try {
      await createOverride({
        scenarioId,
        stationId: form.stationId,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        operatorCountDelta: form.operatorCountDelta,
        note: form.note.trim() || null,
      }).unwrap();
      setShowAdd(false);
      setForm(emptyForm());
    } catch {
      // Error message exposed via createState.error
    }
  };

  const handleStartEdit = (override: CapacityOverride) => {
    setEditingId(override.id);
    setForm({
      stationId: override.stationId,
      startsAt: override.startsAt.slice(0, 16),
      endsAt: override.endsAt.slice(0, 16),
      operatorCountDelta: override.operatorCountDelta,
      note: override.note ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!scenarioId || !editingId) return;
    try {
      await updateOverride({
        scenarioId,
        id: editingId,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        operatorCountDelta: form.operatorCountDelta,
        note: form.note.trim() || null,
      }).unwrap();
      setEditingId(null);
    } catch {
      // Error in updateState.error
    }
  };

  const handleDelete = async (id: string) => {
    if (!scenarioId) return;
    const ok = window.confirm('Supprimer cet override de capacité ?');
    if (!ok) return;
    await deleteOverride({ scenarioId, id });
  };

  return (
    <div className="flex flex-col gap-3 p-5 overflow-y-auto">
      <header>
        <h2 className="text-sm font-medium text-zinc-100">Capacités scénarisées</h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Décalages prévus de capacité par station, scopés à un scénario. Bornés sur une fenêtre temporelle.
        </p>
      </header>

      <div className="flex items-center gap-2 p-2 bg-amber-950/20 border border-amber-900/40 rounded-md text-[11px] text-amber-300">
        <Info size={12} className="shrink-0" />
        <div>
          V1 stocke l'intention uniquement — le moteur d'ordonnancement ne
          consomme pas encore ces overrides. Les overrides seront pris en
          compte dans une phase ultérieure sans migration de données.
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Scénario</label>
        <select
          value={scenarioId ?? ''}
          onChange={(e) => setScenarioId(e.target.value || null)}
          className="px-2 py-1 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
          data-testid="capacity-override-scenario-picker"
        >
          {scenarioList?.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.type}
              {s.name ? ` — ${s.name}` : ''}
              {s.type === 'archive' && s.promotedAt ? ` (${formatDate(s.promotedAt)})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setForm(emptyForm(stations[0]?.id ?? ''));
          }}
          disabled={!scenarioId}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
        >
          <Plus size={13} />
          Ajouter
        </button>
      </div>

      {showAdd && (
        <div className="rounded-md border border-violet-900/40 bg-violet-950/10 p-3">
          <div className="text-[10px] text-violet-300 uppercase tracking-wider mb-2">Nouvel override</div>
          <OverrideForm
            stations={stations.map((s) => ({ id: s.id, name: s.name ?? s.id }))}
            form={form}
            onChange={setForm}
          />
          {createState.error && (
            <div className="mt-2 text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Échec de l'enregistrement.
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-2.5 py-1 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!form.stationId || form.operatorCountDelta === 0 || createState.isLoading}
              className="px-2.5 py-1 rounded text-[11px] bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        {isLoading && <div className="p-4 text-xs text-zinc-500">Chargement…</div>}
        {!isLoading && overrides && overrides.overrides.length === 0 && (
          <div className="p-6 text-center text-xs text-zinc-500">
            Aucun override pour ce scénario.
          </div>
        )}
        {overrides && overrides.overrides.length > 0 && (
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/60 border-b border-zinc-800">
              <tr className="text-[10px] text-zinc-500 uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-medium">Station</th>
                <th className="px-3 py-2 text-left font-medium">Du</th>
                <th className="px-3 py-2 text-left font-medium">Au</th>
                <th className="px-3 py-2 text-left font-medium">Δ opérateurs</th>
                <th className="px-3 py-2 text-left font-medium">Note</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {overrides.overrides.map((override) =>
                editingId === override.id ? (
                  <tr key={override.id} className="bg-violet-950/10">
                    <td colSpan={6} className="p-3">
                      <OverrideForm
                        stations={stations.map((s) => ({ id: s.id, name: s.name ?? s.id }))}
                        form={form}
                        onChange={setForm}
                      />
                      {updateState.error && (
                        <div className="mt-2 text-[11px] text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          Échec de la mise à jour.
                        </div>
                      )}
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded text-[10px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
                        >
                          <X size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={form.operatorCountDelta === 0 || updateState.isLoading}
                          className="px-2 py-1 rounded text-[10px] bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={override.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-zinc-200">{override.stationName}</td>
                    <td className="px-3 py-2 text-zinc-400">{formatDate(override.startsAt)}</td>
                    <td className="px-3 py-2 text-zinc-400">{formatDate(override.endsAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          override.operatorCountDelta > 0
                            ? 'bg-emerald-600/15 border border-emerald-600/30 text-emerald-300'
                            : 'bg-rose-600/15 border border-rose-600/30 text-rose-300'
                        }`}
                      >
                        {override.operatorCountDelta > 0 ? '+' : ''}
                        {override.operatorCountDelta}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{override.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(override)}
                        className="inline-flex items-center px-1.5 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        aria-label="Éditer"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(override.id)}
                        className="inline-flex items-center ml-1 px-1.5 py-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OverrideForm({
  stations,
  form,
  onChange,
}: {
  stations: Array<{ id: string; name: string }>;
  form: OverrideFormState;
  onChange: (next: OverrideFormState) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Station</span>
        <select
          value={form.stationId}
          onChange={(e) => onChange({ ...form, stationId: e.target.value })}
          className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
        >
          <option value="">Sélectionner…</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Δ opérateurs</span>
        <input
          type="number"
          step={1}
          value={form.operatorCountDelta}
          onChange={(e) => onChange({ ...form, operatorCountDelta: Number.parseInt(e.target.value, 10) || 0 })}
          className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Du</span>
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => onChange({ ...form, startsAt: e.target.value })}
          className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
        />
      </label>
      <label className="block">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Au</span>
        <input
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => onChange({ ...form, endsAt: e.target.value })}
          className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
        />
      </label>
      <label className="block col-span-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Note</span>
        <input
          type="text"
          value={form.note}
          maxLength={255}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
          placeholder="Ex. Vacances été 2026 (offset −1 op)"
          className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
        />
      </label>
    </div>
  );
}
