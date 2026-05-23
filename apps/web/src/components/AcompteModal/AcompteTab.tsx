/**
 * AcompteTab — body of the « Acomptes » tab inside JcfModificationModal.
 *
 * Single-model UX (« livraisons ») :
 *   - N = 1 : the dossier ships as one delivery. Row is read-only — quantity
 *           equals job.quantity and deadline equals job.workshopExitDate.
 *           Saving with N = 1 against a server that already had acomptes
 *           calls deleteAcomptes (un-split). Against a virgin server it's
 *           a no-op.
 *   - N ≥ 2 : real acomptes. All rows editable (quantity + deadline +
 *           remove). Saving calls replaceAcomptes + writeDeclaration per
 *           task with copies > 0.
 *   - Removing the 2nd-to-last row collapses back to N = 1 (synthetic
 *           single delivery) and discards the partial draft state.
 *
 * Layout (two-column once content is rich enough — same shape regardless of N) :
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  Total job : 100 000 ex.                  (édité dans Dossier)  │
 *   ├──────────────────────────┬──────────────────────────────────────┤
 *   │  Livraisons   [+ Ajouter]│  Avancement — exemplaires produits   │
 *   │                          │  par tâche                            │
 *   │  ┌──────────────────────┐│  ┌─ Carte 350g ────────────────────┐ │
 *   │  │ Livraison unique     ││  │ G37 — Cumul: 80k/100k            │ │
 *   │  │ 100 000 ex.   (lecture)│  │ [80 000] ex. ▓▓▓▓░░ 80%          │ │
 *   │  │ Deadline du dossier  ││  │ Cascade : (synth, 100% du job)   │ │
 *   │  └──────────────────────┘│  └─────────────────────────────────┘ │
 *   └──────────────────────────┴──────────────────────────────────────┘
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Package, Plus, Trash2 } from 'lucide-react';
import type { JobDetailsResponse } from '../../store/api/scheduleApi';
import {
  useGetAcomptesQuery,
  useReplaceAcomptesMutation,
  useDeleteAcomptesMutation,
  useGetAcompteProgressDeclarationsQuery,
  useWriteAcompteProgressDeclarationMutation,
} from '../../store/api/acompteApi';
import { useGetStationsQuery } from '../../store/api/stationApi';
import { cascadeFifo, type AcompteForCascade } from './cascadeFifo';

export interface AcompteTabProps {
  job: JobDetailsResponse;
  /**
   * Callback fired whenever the local draft delivery count changes.
   * Drives the « Livraisons (N) » tab badge — N reflects what will be saved,
   * including the synthetic single-delivery (so N is always ≥ 1).
   */
  onDraftCountChange?: (deliveryCount: number) => void;
}

export interface AcompteTabHandle {
  /** Persist deliveries + declarations. Throws on validation or API failure. */
  save: () => Promise<void>;
}

interface DeliveryDraft {
  key: string;
  quantityShare: number;
  /** datetime-local format "YYYY-MM-DDTHH:MM". */
  deadline: string;
  /** True if this row is the synthetic "single delivery" fallback (read-only). */
  synthetic: boolean;
}

interface TaskDraft {
  logicalTaskId: string;
  taskLabel: string;
  sequenceOrder: number;
  copiesDone: number;
}

interface ElementGroupDraft {
  elementId: string;
  elementName: string;
  tasks: TaskDraft[];
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextKey(): string {
  return 'dl-' + Math.random().toString(36).slice(2, 10);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

/** Build the single synthetic delivery row from the job. */
function buildSingleDelivery(totalQuantity: number, workshopExitDate: string | null): DeliveryDraft {
  return {
    key: 'single',
    quantityShare: totalQuantity,
    deadline: workshopExitDate ? isoToDatetimeLocal(workshopExitDate) : '',
    synthetic: true,
  };
}

export const AcompteTab = forwardRef<AcompteTabHandle, AcompteTabProps>(function AcompteTab(
  { job, onDraftCountChange },
  ref,
) {
  const totalQuantity = job.quantity ?? 0;

  const { data: acomptesData } = useGetAcomptesQuery(job.id);
  const { data: declarationsData } = useGetAcompteProgressDeclarationsQuery(job.id);
  const { data: stations = [] } = useGetStationsQuery();
  const [replaceAcomptes] = useReplaceAcomptesMutation();
  const [deleteAcomptes] = useDeleteAcomptesMutation();
  const [writeDeclaration] = useWriteAcompteProgressDeclarationMutation();

  // Station id → name lookup so task labels show "G37" / "P137" etc. instead
  // of opaque UUID prefixes.
  const stationNameById = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations],
  );

  const [deliveries, setDeliveries] = useState<DeliveryDraft[]>([]);
  const [elementGroups, setElementGroups] = useState<ElementGroupDraft[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  /* ── Initialize deliveries : server > 0 → load real acomptes, else synthetic single. ── */
  useEffect(() => {
    if (acomptesData?.acomptes && acomptesData.acomptes.length > 0) {
      setDeliveries(acomptesData.acomptes.map((a) => ({
        key: a.id,
        quantityShare: a.quantityShare,
        deadline: isoToDatetimeLocal(a.deadline),
        synthetic: false,
      })));
    } else {
      setDeliveries([buildSingleDelivery(totalQuantity, job.workshopExitDate)]);
    }
  }, [acomptesData, totalQuantity, job.workshopExitDate]);

  /* ── Build element groups + tasks (with declarations seeded) ─ */
  useEffect(() => {
    const declByLogical = new Map(
      (declarationsData?.declarations ?? []).map((d) => [d.logicalTaskId, d.declaredTotalCopiesDone]),
    );

    const groups: ElementGroupDraft[] = [];
    const tasksById = new Map(job.tasks.map((t) => [t.id, t]));

    for (const el of job.elements) {
      const tasks: TaskDraft[] = [];
      for (const tid of el.taskIds) {
        const t = tasksById.get(tid);
        if (!t || t.taskType !== 'internal') continue;
        const stationLabel = t.stationId ? (stationNameById.get(t.stationId) ?? 'Tâche') : 'Tâche';
        tasks.push({
          logicalTaskId: t.logicalTaskId,
          taskLabel: stationLabel,
          sequenceOrder: t.sequenceOrder,
          copiesDone: declByLogical.get(t.logicalTaskId) ?? 0,
        });
      }
      tasks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      if (tasks.length > 0) {
        groups.push({ elementId: el.id, elementName: el.name, tasks });
      }
    }
    setElementGroups(groups);
  }, [declarationsData, job.elements, job.tasks, stationNameById]);

  /* ── Notify parent of draft delivery count (always ≥ 1). ── */
  useEffect(() => {
    if (!onDraftCountChange) return;
    onDraftCountChange(deliveries.length);
  }, [deliveries.length, onDraftCountChange]);

  /* ── Derived ──────────────────────────────────────── */
  const deliveriesSum = useMemo(() => deliveries.reduce((s, x) => s + x.quantityShare, 0), [deliveries]);
  const deliveriesBalance = deliveriesSum === totalQuantity;
  const isSingleDelivery = deliveries.length === 1;
  const acomptesForCascade: AcompteForCascade[] = useMemo(
    () => deliveries.map((s, i) => ({ id: s.key, positionIndex: i + 1, quantityShare: s.quantityShare })),
    [deliveries],
  );

  /* ── Delivery mutators ───────────────────────────── */
  function setDeliveryQty(idx: number, qty: number) {
    setDeliveries((prev) => prev.map((s, i) => (i === idx ? { ...s, quantityShare: qty } : s)));
  }
  function setDeliveryDeadline(idx: number, deadline: string) {
    setDeliveries((prev) => prev.map((s, i) => (i === idx ? { ...s, deadline } : s)));
  }

  /** Add a delivery. From N=1 (synthetic) → seed 2 real 50/50 splits.
   *  From N≥2 → append a 0-share row with deadline = last + 7 days. */
  function addDelivery() {
    setDeliveries((prev) => {
      if (prev.length === 1) {
        // Transition synthetic → 2 real acomptes 50/50.
        const half = Math.round(totalQuantity / 2);
        const defaultDeadline = job.workshopExitDate ? isoToDatetimeLocal(job.workshopExitDate) : '';
        return [
          { key: nextKey(), quantityShare: half, deadline: defaultDeadline, synthetic: false },
          { key: nextKey(), quantityShare: totalQuantity - half, deadline: defaultDeadline, synthetic: false },
        ];
      }
      // N≥2 → append.
      const last = prev[prev.length - 1];
      let nextDeadline = last?.deadline ?? '';
      if (last?.deadline) {
        const d = new Date(last.deadline);
        if (!Number.isNaN(d.getTime())) {
          d.setDate(d.getDate() + 7);
          nextDeadline = isoToDatetimeLocal(d.toISOString());
        }
      }
      return [...prev, { key: nextKey(), quantityShare: 0, deadline: nextDeadline, synthetic: false }];
    });
  }

  /** Remove a delivery. N=2 → collapse to N=1 (synthetic single).
   *  N≥3 → just remove. N=1 (synthetic) → disabled. */
  function removeDelivery(idx: number) {
    setDeliveries((prev) => {
      if (prev.length <= 1) return prev;
      if (prev.length === 2) {
        // Collapse to single synthetic delivery — discards partial split state.
        return [buildSingleDelivery(totalQuantity, job.workshopExitDate)];
      }
      return prev.filter((_, i) => i !== idx);
    });
  }

  /* ── Task done mutator ───────────────────────────── */
  function setTaskCopiesDone(groupIdx: number, taskIdx: number, copies: number) {
    setElementGroups((prev) =>
      prev.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              tasks: g.tasks.map((t, ti) => (ti === taskIdx ? { ...t, copiesDone: copies } : t)),
            }
          : g,
      ),
    );
  }

  /* ── Imperative save (called by parent on global "Enregistrer") ─ */
  useImperativeHandle(ref, () => ({
    async save() {
      setLocalError(null);
      const serverHadAcomptes = (acomptesData?.acomptes.length ?? 0) > 0;

      if (isSingleDelivery) {
        // No acomptes desired. If server had them, un-split.
        if (serverHadAcomptes) {
          await deleteAcomptes(job.id).unwrap();
        }
        // Even with no acomptes, declarations may still apply (operator may
        // have declared progress at job level even without splitting).
        await flushDeclarations();
        return;
      }

      if (deliveries.length < 2) {
        throw new Error('Au moins 2 livraisons sont requises pour activer le découpage.');
      }
      if (!deliveriesBalance) {
        throw new Error(`Somme des livraisons (${fmt(deliveriesSum)}) ≠ quantité totale (${fmt(totalQuantity)}).`);
      }
      for (const d of deliveries) {
        if (d.deadline === '') {
          throw new Error('Chaque livraison doit avoir une date+heure de livraison.');
        }
      }
      await replaceAcomptes({
        jobId: job.id,
        splits: deliveries.map((s) => ({ quantity_share: s.quantityShare, deadline: s.deadline })),
      }).unwrap();
      await flushDeclarations();
    },
  }), [
    isSingleDelivery,
    deliveries,
    deliveriesBalance,
    deliveriesSum,
    totalQuantity,
    elementGroups,
    job.id,
    acomptesData,
    replaceAcomptes,
    deleteAcomptes,
    writeDeclaration,
  ]);

  async function flushDeclarations() {
    for (const g of elementGroups) {
      for (const t of g.tasks) {
        if (t.copiesDone > 0) {
          await writeDeclaration({
            jobId: job.id,
            logical_task_id: t.logicalTaskId,
            declared_total_copies_done: t.copiesDone,
          }).unwrap();
        }
      }
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      {localError && (
        <div className="px-3 py-2 bg-red-950/40 border border-red-900/50 text-red-300 text-xs rounded">
          {localError}
        </div>
      )}

      <TotalRef totalQuantity={totalQuantity} />

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* ── Left: livraisons column ─────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-[0.06em] text-zinc-500 font-semibold">
              Livraisons
            </h3>
            <button
              type="button"
              onClick={addDelivery}
              className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
              data-testid="acompte-tab-add"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          {deliveries.map((d, i) => (
            <div
              key={d.key}
              className={`relative p-3 border rounded transition-colors ${
                d.synthetic
                  ? 'bg-zinc-900/60 border-zinc-800 border-dashed'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              {!d.synthetic && (
                <button
                  type="button"
                  onClick={() => removeDelivery(i)}
                  className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-red-400 rounded"
                  aria-label={`Supprimer livraison ${i + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
                {d.synthetic
                  ? 'Livraison unique'
                  : `Acompte ${i + 1}/${deliveries.length}`}
              </div>
              {d.synthetic ? (
                <>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Package className="w-3 h-3 text-zinc-500 shrink-0" />
                    <div className="text-[13px] font-semibold text-zinc-300 tabular-nums">
                      {fmt(d.quantityShare)} <span className="text-[11px] text-zinc-500 font-normal">ex.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3 text-zinc-500 shrink-0" />
                    <div className="text-[11px] text-zinc-400">
                      {d.deadline
                        ? d.deadline.replace('T', ' à ')
                        : <em className="text-zinc-600">deadline non définie</em>}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-600 italic">
                    Le tout en une seule livraison. Clique « Ajouter » pour découper.
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package className="w-3 h-3 text-zinc-500 shrink-0" />
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={d.quantityShare}
                      onChange={(e) => setDeliveryQty(i, Number.parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[13px] font-semibold text-zinc-100 text-right tabular-nums focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[11px] text-zinc-500 shrink-0">ex.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3 text-zinc-500 shrink-0" />
                    <input
                      type="datetime-local"
                      value={d.deadline}
                      onChange={(e) => setDeliveryDeadline(i, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-300 [color-scheme:dark] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
          {!isSingleDelivery && (
            <div
              className={`mt-1 text-xs flex items-center gap-1.5 ${
                deliveriesBalance ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {deliveriesBalance ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span className="tabular-nums">{fmt(deliveriesSum)} / {fmt(totalQuantity)} ex.</span>
              {!deliveriesBalance && <span className="text-[10px]">à équilibrer</span>}
            </div>
          )}
        </section>

        {/* ── Right: avancement column ────────────── */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-[0.06em] text-zinc-500 font-semibold flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5" />
            Avancement — exemplaires produits par tâche
          </h3>
          {elementGroups.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500 italic">
              Aucune tâche interne sur ce dossier.
            </div>
          )}
          {elementGroups.map((group, groupIdx) => (
            <div
              key={group.elementId}
              className="px-3.5 py-3 border border-zinc-800 border-l-[3px] border-l-indigo-500 bg-white/[0.012]"
            >
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[13px] font-semibold text-zinc-100">{group.elementName}</span>
                <span className="ml-auto text-[10px] text-zinc-500">
                  {group.tasks.length} tâche{group.tasks.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3.5">
                {group.tasks.map((task, taskIdx) => {
                  const pct = totalQuantity > 0 ? (task.copiesDone / totalQuantity) * 100 : 0;
                  const cascade = cascadeFifo(task.copiesDone, acomptesForCascade);
                  const upstream = taskIdx > 0 ? group.tasks[taskIdx - 1] : null;
                  const warning =
                    upstream && task.copiesDone > upstream.copiesDone
                      ? `Cumul (${fmt(task.copiesDone)}) supérieur à ${upstream.taskLabel} (${fmt(upstream.copiesDone)}) sur le même élément — physiquement improbable.`
                      : null;
                  return (
                    <div key={task.logicalTaskId}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-[12px] font-semibold text-zinc-300">{task.taskLabel}</span>
                        <span className="text-[11px] text-zinc-500 tabular-nums">
                          Cumul : <strong className="text-zinc-300">{fmt(task.copiesDone)}</strong> /{' '}
                          {fmt(totalQuantity)} ex.
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <input
                          type="number"
                          min={0}
                          max={totalQuantity}
                          step={500}
                          value={task.copiesDone}
                          onChange={(e) =>
                            setTaskCopiesDone(groupIdx, taskIdx, Number.parseInt(e.target.value, 10) || 0)
                          }
                          className="w-[110px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[13px] text-zinc-100 text-right tabular-nums focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[11px] text-zinc-500">ex.</span>
                        {/* Draggable slider — same shape as the operator
                             proficiency editor : grab cursor, indigo track fill,
                             white round thumb. Native <input type="range"> for
                             reliable keyboard + drag support. */}
                        <div className="flex-1 relative h-[18px] flex items-center group">
                          <div className="absolute inset-x-0 h-[5px] bg-zinc-800 rounded overflow-hidden pointer-events-none">
                            <div
                              className="h-full bg-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={totalQuantity}
                            step={500}
                            value={task.copiesDone}
                            onChange={(e) =>
                              setTaskCopiesDone(
                                groupIdx,
                                taskIdx,
                                Number.parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="acompte-progress-slider relative z-10 w-full appearance-none bg-transparent cursor-grab active:cursor-grabbing focus:outline-none"
                            aria-label={`Exemplaires produits — ${task.taskLabel}`}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-300 tabular-nums w-[34px] text-right">
                          {Math.round(pct)} %
                        </span>
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">
                        {isSingleDelivery ? 'Avancement global (livraison unique)' : 'Cascade vers les acomptes'}
                      </div>
                      <div className="flex gap-1 h-[38px]">
                        {cascade.map((c) => {
                          const segClasses = c.saturated ? 'border-emerald-500/45' : '';
                          const fillBg = c.saturated
                            ? 'bg-emerald-500/55'
                            : c.empty
                              ? 'bg-transparent'
                              : 'bg-emerald-500/30';
                          return (
                            <div
                              key={c.acompteId}
                              className={`relative border border-zinc-800 ${segClasses} bg-zinc-800/40 px-2 py-1 rounded min-w-[64px] flex flex-col justify-between overflow-hidden`}
                              style={{ flexGrow: c.capacity, flexBasis: 0 }}
                            >
                              <div
                                className={`absolute left-0 top-0 bottom-0 ${fillBg} transition-[width] duration-75`}
                                style={{ width: `${c.progressPct}%` }}
                              />
                              <div className="relative z-10 flex items-center justify-between text-[10px] text-zinc-300 tabular-nums leading-tight">
                                <span
                                  className={`font-semibold text-[11px] flex items-center gap-1 ${
                                    c.empty ? 'text-zinc-500' : 'text-zinc-100'
                                  }`}
                                >
                                  {isSingleDelivery ? 'Livraison' : `${c.position}/${cascade.length}`}
                                  {c.saturated && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                                </span>
                                <span
                                  className={`text-[9px] ${
                                    c.saturated ? 'text-emerald-400' : 'text-zinc-500'
                                  }`}
                                >
                                  {Math.round(c.progressPct)}%
                                </span>
                              </div>
                              <div
                                className={`relative z-10 text-[10px] tabular-nums leading-tight ${
                                  c.empty ? 'text-zinc-600' : 'text-zinc-400'
                                }`}
                              >
                                {fmt(c.copiesTaken)} / {fmt(c.capacity)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {warning && (
                        <div className="mt-2 px-2.5 py-1.5 bg-amber-500/[0.08] border border-amber-500/25 rounded text-[11px] text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {warning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-zinc-500 italic">
            Saisie au niveau du dossier.
            {!isSingleDelivery && ' La cascade FIFO répartit sur les acomptes en commençant par le 1 ; les acomptes saturés à 100 % sont retirés du planning automatiquement côté serveur.'}
          </p>
        </section>
      </div>
    </div>
  );
});

function TotalRef({ totalQuantity }: { totalQuantity: number }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded">
      <span className="text-xs text-zinc-400">Total job</span>
      <strong className="text-base font-semibold text-zinc-100 tabular-nums">
        {fmt(totalQuantity)}
      </strong>
      <span className="text-xs text-zinc-500">exemplaires</span>
      <span className="ml-auto text-[10px] text-zinc-600 italic">édité dans l'onglet Dossier</span>
    </div>
  );
}
