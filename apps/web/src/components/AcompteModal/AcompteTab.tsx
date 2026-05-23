/**
 * AcompteTab — body of the « Acomptes » tab inside JcfModificationModal.
 *
 * Auto-Solde model :
 *   N = 1 : the row is « Livraison complète », quantity auto-set to job.quantity,
 *           deadline = job.workshopExitDate. Quantity is read-only.
 *   N ≥ 2 : the LAST row is the « Solde · Acompte N/N ». Its quantity is auto-
 *           computed as total − Σ(other acomptes) and is read-only. The other
 *           rows are normal editable « Acompte i/N ».
 *
 * Adding from N = 1 inserts a new acompte BEFORE the current row (which keeps
 * being the Solde). Removing the last editable row collapses back to N = 1.
 *
 * Per-card « Prêt : X / Y ex. » : bottleneck of each element's LAST task
 * cascade for this acompte. When ready === quantityShare, the card flips into
 * the « completed tile » aesthetic (emerald inset left bar + 9% emerald wash +
 * emerald-300 text) — same visual signature as a planning board tuile completed
 * (see apps/web/src/components/Tile/colorUtils.ts PALETTE.completed).
 *
 * Right column carries an element sub-tab strip in multi-element jobs ; only
 * the active element's tasks are shown. A small amber dot on the tab marks a
 * cross-machine cumul inversion within that element (e.g. massicot > impression).
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Package, Plus, Trash2 } from 'lucide-react';
import type { JobDetailsResponse } from '../../store/api/scheduleApi';
import {
  useGetAcomptesQuery,
  useReplaceAcomptesMutation,
  useDeleteAcomptesMutation,
} from '../../store/api/acompteApi';
import { useRecordProgressDirectMutation } from '../../store/api/saisieApi';
import { useGetStationsQuery } from '../../store/api/stationApi';
import { cascadeFifo, type AcompteForCascade } from './cascadeFifo';

export interface AcompteTabProps {
  job: JobDetailsResponse;
  /**
   * Callback fired whenever the local draft delivery count changes.
   * Drives the « Acomptes (N) » tab badge — N reflects what will be saved
   * (always ≥ 1, including the synthetic single delivery).
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
}

interface TaskDraft {
  /** Task entity UUID — used as the saisie write target. */
  taskId: string;
  /** Stable cross-scenario id — used to dedupe / look up wall-layer state. */
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
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('fr-FR');
}

/** Single source of truth for the verbose label of an acompte row (in card). */
function acompteLabel(idx: number, total: number): string {
  if (total === 1) return 'Livraison complète';
  if (idx === total - 1) return `Solde · Acompte ${idx + 1}/${total}`;
  return `Acompte ${idx + 1}/${total}`;
}

/** Compact label for tight cascade-segment headers. */
function acompteShortLabel(idx: number, total: number): string {
  if (total === 1) return 'Livraison';
  if (idx === total - 1) return `Solde ${idx + 1}/${total}`;
  return `${idx + 1}/${total}`;
}

/**
 * Returns a new array with the LAST delivery's qty auto-recomputed :
 *   - N = 1 ⇒ qty = total (the single row IS the solde, owns the full job)
 *   - N ≥ 2 ⇒ qty = total − Σ(others) (the Solde row absorbs the difference)
 */
function withAutoSolde(deliveries: DeliveryDraft[], total: number): DeliveryDraft[] {
  if (deliveries.length === 0) return deliveries;
  const lastIdx = deliveries.length - 1;
  if (lastIdx === 0) {
    return [{ ...deliveries[0], quantityShare: total }];
  }
  const sumOthers = deliveries.slice(0, -1).reduce((s, x) => s + x.quantityShare, 0);
  return deliveries.map((d, i) => (i === lastIdx ? { ...d, quantityShare: total - sumOthers } : d));
}

/**
 * For an acompte, compute the number of exemplaires effectively ready to ship,
 * given the cascade of each element's LAST task (the one that produces the
 * shippable output). For multi-element jobs, the acompte's ready count is the
 * MIN across all elements' last-task cascade allocations — bottleneck rules
 * (can't ship couv+intérieur sets if only couv is done).
 */
function readyForAcompte(
  deliveryIdx: number,
  deliveries: DeliveryDraft[],
  elementGroups: ElementGroupDraft[],
): { ready: number; perElement: Array<{ name: string; ready: number }> } {
  if (elementGroups.length === 0) return { ready: 0, perElement: [] };
  const forCascade: AcompteForCascade[] = deliveries.map((d, i) => ({
    id: d.key,
    positionIndex: i + 1,
    quantityShare: d.quantityShare,
  }));
  const perElement = elementGroups.map((g) => {
    if (g.tasks.length === 0) return { name: g.elementName, ready: 0 };
    const lastTask = g.tasks[g.tasks.length - 1];
    const cascade = cascadeFifo(lastTask.copiesDone, forCascade);
    const row = cascade[deliveryIdx];
    return { name: g.elementName, ready: row?.copiesTaken ?? 0 };
  });
  const ready = perElement.reduce((m, x) => Math.min(m, x.ready), Infinity);
  return { ready: Number.isFinite(ready) ? ready : 0, perElement };
}

/** True when any task's copies > a prior task's copies on the same element. */
function elementHasCrossMachineWarning(g: ElementGroupDraft): boolean {
  return g.tasks.some((t, i) => i > 0 && t.copiesDone > g.tasks[i - 1].copiesDone);
}

export const AcompteTab = forwardRef<AcompteTabHandle, AcompteTabProps>(function AcompteTab(
  { job, onDraftCountChange },
  ref,
) {
  const totalQuantity = job.quantity ?? 0;

  const { data: acomptesData } = useGetAcomptesQuery(job.id);
  const { data: stations = [] } = useGetStationsQuery();
  const [replaceAcomptes] = useReplaceAcomptesMutation();
  const [deleteAcomptes] = useDeleteAcomptesMutation();
  const [recordProgressDirect] = useRecordProgressDirectMutation();

  const stationNameById = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations],
  );

  const [deliveries, setDeliveries] = useState<DeliveryDraft[]>([]);
  const [elementGroups, setElementGroups] = useState<ElementGroupDraft[]>([]);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  // Track which logical_task_ids had a non-null declaration loaded from the
  // server. Required to handle the "user resets a previously-saved progress
  // back to 0" case : without it, flushDeclarations would skip writing 0
  // (current copies > 0 is the only trigger), leaving the stale value alive
  // in DB and the engine still reading the job as in-progress.
  const [previouslyDeclaredTaskIds, setPreviouslyDeclaredTaskIds] = useState<ReadonlySet<string>>(new Set());

  /* ── Initialize deliveries from server (or synth single if virgin). ── */
  useEffect(() => {
    if (acomptesData?.acomptes && acomptesData.acomptes.length > 0) {
      const loaded: DeliveryDraft[] = acomptesData.acomptes.map((a) => ({
        key: a.id,
        quantityShare: a.quantityShare,
        deadline: isoToDatetimeLocal(a.deadline),
      }));
      setDeliveries(withAutoSolde(loaded, totalQuantity));
    } else {
      setDeliveries([
        {
          key: 'single',
          quantityShare: totalQuantity,
          deadline: job.workshopExitDate ? isoToDatetimeLocal(job.workshopExitDate) : '',
        },
      ]);
    }
  }, [acomptesData, totalQuantity, job.workshopExitDate]);

  /* ── Build element groups + tasks (single source: Task.recordedProgressPct) ─
   * The Acomptes tab now writes progress through the canonical wall-layer
   * channel (POST /scenarios/prod/record-progress/{taskId}) — same channel as
   * clic-droit « saisir l'avancement », IA palette and the silent-push from
   * ClockService. Task.recordedProgressPct is the single source of truth.
   *
   * Previously the form maintained its own per-job AcompteProgressDeclaration
   * table : two write paths, two read paths, no shared semantics — the
   * « avancement invisible » bug on job 202601.0162 / 754 PAP1 was the proof.
   * That table is now dead-code on read (engine reads recordedProgressPct
   * from the task payload directly, see AcompteSnapshotFanOutService). */
  useEffect(() => {
    // Tasks that already carry non-zero recordedProgressPct must trigger a
    // 0-write on save when the user resets the slider — otherwise the
    // reset is silently a no-op (the slider drops to 0 but the wall
    // still shows the old value).
    const priorIds = new Set<string>();
    for (const t of job.tasks) {
      if ((t.recordedProgressPct ?? 0) > 0) {
        priorIds.add(t.logicalTaskId);
      }
    }
    setPreviouslyDeclaredTaskIds(priorIds);

    const groups: ElementGroupDraft[] = [];
    const tasksById = new Map(job.tasks.map((t) => [t.id, t]));
    for (const el of job.elements) {
      const tasks: TaskDraft[] = [];
      for (const tid of el.taskIds) {
        const t = tasksById.get(tid);
        if (!t || t.taskType !== 'internal') continue;
        const stationLabel = t.stationId ? (stationNameById.get(t.stationId) ?? 'Tâche') : 'Tâche';
        const copiesDone = totalQuantity > 0 && (t.recordedProgressPct ?? 0) > 0
          ? Math.round(((t.recordedProgressPct ?? 0) / 100) * totalQuantity)
          : 0;
        tasks.push({
          taskId: t.id,
          logicalTaskId: t.logicalTaskId,
          taskLabel: stationLabel,
          sequenceOrder: t.sequenceOrder,
          copiesDone,
        });
      }
      tasks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      if (tasks.length > 0) {
        groups.push({ elementId: el.id, elementName: el.name, tasks });
      }
    }
    setElementGroups(groups);
    // Reset active element if it no longer exists in the new groups.
    setActiveElementId((prev) => {
      if (groups.length === 0) return null;
      if (prev && groups.some((g) => g.elementId === prev)) return prev;
      return groups[0].elementId;
    });
  }, [job.elements, job.tasks, stationNameById, totalQuantity]);

  /* ── Notify parent of draft delivery count (always ≥ 1). ──────────── */
  useEffect(() => {
    if (!onDraftCountChange) return;
    onDraftCountChange(deliveries.length);
  }, [deliveries.length, onDraftCountChange]);

  /* ── Derived ──────────────────────────────────────────────────────── */
  const isSingleDelivery = deliveries.length === 1;
  const soldeIsNegative = deliveries.length >= 2 && deliveries[deliveries.length - 1].quantityShare < 0;
  const activeElement = elementGroups.find((g) => g.elementId === activeElementId) ?? elementGroups[0];
  const activeGroupIdx = elementGroups.findIndex((g) => g.elementId === activeElement?.elementId);

  /* ── Mutators ─────────────────────────────────────────────────────── */
  function setDeliveryQty(idx: number, qty: number) {
    setDeliveries((prev) => {
      const next = prev.map((d, i) => (i === idx ? { ...d, quantityShare: qty } : d));
      return withAutoSolde(next, totalQuantity);
    });
  }

  function setDeliveryDeadline(idx: number, deadline: string) {
    setDeliveries((prev) => prev.map((d, i) => (i === idx ? { ...d, deadline } : d)));
  }

  /** Insert a new acompte BEFORE the current Solde (which stays last and is
   *  recomputed to absorb the difference). */
  function addDelivery() {
    setDeliveries((prev) => {
      const solde = prev[prev.length - 1];
      let nextDeadline = '';
      if (solde?.deadline) {
        const d = new Date(solde.deadline);
        if (!Number.isNaN(d.getTime())) {
          d.setDate(d.getDate() - 7);
          nextDeadline = isoToDatetimeLocal(d.toISOString());
        }
      } else if (job.workshopExitDate) {
        nextDeadline = isoToDatetimeLocal(job.workshopExitDate);
      }
      const newAcompte: DeliveryDraft = { key: nextKey(), quantityShare: 0, deadline: nextDeadline };
      const inserted = [...prev.slice(0, -1), newAcompte, solde ?? newAcompte];
      return withAutoSolde(inserted, totalQuantity);
    });
  }

  function removeDelivery(idx: number) {
    setDeliveries((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev.filter((_, i) => i !== idx);
      return withAutoSolde(removed, totalQuantity);
    });
  }

  function setTaskCopiesDone(groupIdx: number, taskIdx: number, copies: number) {
    setElementGroups((prev) =>
      prev.map((g, gi) =>
        gi === groupIdx
          ? { ...g, tasks: g.tasks.map((t, ti) => (ti === taskIdx ? { ...t, copiesDone: copies } : t)) }
          : g,
      ),
    );
  }

  /* ── Imperative save ──────────────────────────────────────────────── */
  useImperativeHandle(
    ref,
    () => ({
      async save() {
        const serverHadAcomptes = (acomptesData?.acomptes.length ?? 0) > 0;
        if (isSingleDelivery) {
          if (serverHadAcomptes) {
            await deleteAcomptes(job.id).unwrap();
          }
          await flushDeclarations();
          return;
        }
        if (soldeIsNegative) {
          throw new Error(
            `Sur-allocation : les acomptes saisis dépassent la quantité totale (${fmt(totalQuantity)} ex.).`,
          );
        }
        for (const d of deliveries) {
          if (d.deadline === '') {
            throw new Error('Chaque acompte doit avoir une date+heure de livraison.');
          }
        }
        await replaceAcomptes({
          jobId: job.id,
          splits: deliveries.map((s) => ({ quantity_share: s.quantityShare, deadline: s.deadline })),
        }).unwrap();
        await flushDeclarations();
      },
    }),
    [
      isSingleDelivery,
      soldeIsNegative,
      deliveries,
      totalQuantity,
      elementGroups,
      job.id,
      acomptesData,
      replaceAcomptes,
      deleteAcomptes,
      recordProgressDirect,
    ],
  );

  async function flushDeclarations() {
    // Write progress through the canonical wall-layer channel
    // (POST /scenarios/prod/record-progress/{taskId}). Same endpoint
    // as clic-droit / IA palette — one source of truth.
    //
    // Write when EITHER (a) copies > 0, OR (b) the task had non-zero
    // recordedProgressPct on load — in case (b) we must upsert to 0 so
    // the user can undo a prior saisie. Without that guard a slider
    // drag back to 0 would silently no-op (the wall keeps the prior pct).
    for (const g of elementGroups) {
      for (const t of g.tasks) {
        const hadPrior = previouslyDeclaredTaskIds.has(t.logicalTaskId);
        if (t.copiesDone > 0 || hadPrior) {
          const pct = totalQuantity > 0 ? (t.copiesDone / totalQuantity) * 100 : 0;
          await recordProgressDirect({
            taskId: t.taskId,
            progressPct: Math.max(0, Math.min(100, pct)),
          }).unwrap();
        }
      }
    }
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* ── Left column: Acomptes ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] uppercase tracking-[0.06em] text-zinc-500 font-semibold flex items-center gap-1.5">
              <Package className="w-3 h-3" /> Acomptes
            </h3>
            <button
              type="button"
              onClick={addDelivery}
              className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 px-2 py-1 hover:bg-zinc-800 transition-colors"
              data-testid="acompte-tab-add"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {deliveries.map((d, i) => {
              const label = acompteLabel(i, deliveries.length);
              const isLast = i === deliveries.length - 1;
              const qtyReadonly = isLast; // N = 1 single AND Solde are both auto.
              const removable = !isLast;
              const { ready, perElement } = readyForAcompte(i, deliveries, elementGroups);
              const cap = d.quantityShare;
              const isFull = cap > 0 && ready >= cap;
              const isZero = cap > 0 && ready === 0;
              const showDetail =
                perElement.length > 1 && perElement.some((x, k) => k > 0 && x.ready !== perElement[0].ready);
              return (
                <div
                  key={d.key}
                  data-acompte-card={d.key}
                  className={`relative px-3.5 py-3 border border-zinc-800 bg-zinc-900 transition-colors ${
                    isFull ? 'bg-[rgba(34,197,94,0.09)] shadow-[inset_4px_0_0_#22c55e]' : ''
                  }`}
                >
                  {removable && (
                    <button
                      type="button"
                      onClick={() => removeDelivery(i)}
                      className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-red-400"
                      aria-label={`Supprimer ${label}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <div
                    className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${
                      isFull ? 'text-[#86efac]' : 'text-zinc-500'
                    }`}
                  >
                    {label}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Package className="w-3 h-3 text-zinc-500 shrink-0" />
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={d.quantityShare}
                      onChange={(e) => setDeliveryQty(i, Number.parseInt(e.target.value, 10) || 0)}
                      readOnly={qtyReadonly}
                      tabIndex={qtyReadonly ? -1 : undefined}
                      title={qtyReadonly ? 'Calculé automatiquement' : ''}
                      className={`w-full border px-2 py-1 text-[13px] font-semibold text-right tabular-nums focus:outline-none focus:border-indigo-500 ${
                        qtyReadonly
                          ? 'bg-zinc-950/60 border-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                      }`}
                    />
                    <span className="text-[11px] text-zinc-500 shrink-0">ex.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3 text-zinc-500 shrink-0" />
                    <input
                      type="datetime-local"
                      value={d.deadline}
                      onChange={(e) => setDeliveryDeadline(i, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-1.5 py-1 text-[11px] text-zinc-300 [color-scheme:dark] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  {isLast && deliveries.length >= 2 && (
                    <div className="mt-2 text-[10px] text-zinc-600 italic">
                      = {fmt(totalQuantity)} − Σ(autres acomptes)
                    </div>
                  )}
                  {isLast && deliveries.length === 1 && (
                    <div className="mt-2 text-[10px] text-zinc-600 italic">Quantité totale du job</div>
                  )}
                  {cap > 0 && (
                    <div
                      className={`mt-2.5 text-[11px] tabular-nums ${
                        isFull ? 'text-[#86efac]' : isZero ? 'text-zinc-600' : 'text-zinc-500'
                      }`}
                    >
                      Prêt :{' '}
                      <strong
                        className={`font-semibold ${
                          isFull ? 'text-[#86efac]' : isZero ? 'text-zinc-600' : 'text-zinc-300'
                        }`}
                      >
                        {fmt(ready)}
                      </strong>{' '}
                      / {fmt(cap)} ex.
                      {showDetail && (
                        <div className="mt-1 text-[10px] text-zinc-600">
                          {perElement.map((x) => `${x.name} : ${fmt(x.ready)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {soldeIsNegative ? (
            <div className="mt-3 px-3 py-2 bg-amber-500/[0.08] border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Sur-allocation : la somme des acomptes saisis dépasse la quantité totale du job.</span>
            </div>
          ) : (
            !isSingleDelivery && (
              <div className="mt-3 px-3 py-2 bg-zinc-900/40 border border-zinc-800 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Somme = {fmt(totalQuantity)} ex. — Solde absorbe l'écart automatiquement.
                </span>
              </div>
            )
          )}
        </section>

        {/* ── Right column: Avancement ──────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] uppercase tracking-[0.06em] text-zinc-500 font-semibold flex items-center gap-1.5">
              <Package className="w-3 h-3" /> Avancement — exemplaires produits par tâche
            </h3>
          </div>

          {elementGroups.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500 italic">Aucune tâche interne sur ce dossier.</div>
          )}

          {elementGroups.length > 0 && (
            <>
              {/* Element sub-tabs strip (always visible — single tab for mono) */}
              <div className="flex border-b border-zinc-800 mb-4">
                {elementGroups.map((g) => {
                  const isActive = g.elementId === activeElement?.elementId;
                  const hasWarn = elementHasCrossMachineWarning(g);
                  return (
                    <button
                      key={g.elementId}
                      type="button"
                      onClick={() => setActiveElementId(g.elementId)}
                      className={`px-3 py-1.5 text-[12px] font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                        isActive
                          ? 'border-indigo-500 text-zinc-100'
                          : 'border-transparent text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {g.elementName}
                      <span className="text-[10px] text-zinc-500">({g.tasks.length})</span>
                      {hasWarn && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"
                          title="Incohérence d'avancement détectée"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {activeElement && (
                <div className="px-3.5 py-3 border border-zinc-800 bg-white/[0.012]">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-[13px] font-semibold text-zinc-100">{activeElement.elementName}</span>
                    <span className="ml-auto text-[10px] text-zinc-500">
                      {activeElement.tasks.length} tâche{activeElement.tasks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {activeElement.tasks.map((task, taskIdx) => {
                      const pct = totalQuantity > 0 ? (task.copiesDone / totalQuantity) * 100 : 0;
                      const cascade = cascadeFifo(
                        task.copiesDone,
                        deliveries.map((d, i) => ({
                          id: d.key,
                          positionIndex: i + 1,
                          quantityShare: d.quantityShare,
                        })),
                      );
                      const upstream = taskIdx > 0 ? activeElement.tasks[taskIdx - 1] : null;
                      const warning =
                        upstream && task.copiesDone > upstream.copiesDone
                          ? `Cumul (${fmt(task.copiesDone)}) supérieur à ${upstream.taskLabel} (${fmt(upstream.copiesDone)}) sur le même élément — physiquement improbable.`
                          : null;
                      return (
                        <div key={task.logicalTaskId} className="py-1">
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-[13px] font-semibold text-zinc-300">{task.taskLabel}</span>
                            <span className="text-[11px] text-zinc-500 tabular-nums">
                              Cumul :{' '}
                              <strong className="text-zinc-200">{fmt(task.copiesDone)}</strong> / {fmt(totalQuantity)}{' '}
                              ex.
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="number"
                              min={0}
                              max={totalQuantity}
                              step={1}
                              value={task.copiesDone}
                              onChange={(e) =>
                                setTaskCopiesDone(activeGroupIdx, taskIdx, Number.parseInt(e.target.value, 10) || 0)
                              }
                              className="w-[110px] bg-zinc-900 border border-zinc-800 px-2 py-1 text-[13px] text-zinc-100 text-right tabular-nums focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-[11px] text-zinc-500">ex.</span>
                            <div className="flex-1 relative h-[22px] flex items-center">
                              <div className="absolute inset-x-0 h-[6px] bg-zinc-800 overflow-hidden pointer-events-none">
                                <div
                                  className="h-full bg-indigo-500 transition-[width]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {/* step=1 (not 500) — when the job quantity isn't
                                  a multiple of the slider step, HTML5 normalises
                                  values that aren't on a step boundary by clamping
                                  to the nearest reachable step. A 3 800 ex. job
                                  with step=500 caps the slider at 3 500 (= 92 %)
                                  even when state holds 3 800 — the thumb is stuck
                                  mid-track and a fresh drag can't reach the max.
                                  step=1 makes every integer reachable ; the drag
                                  feel stays smooth (mouse pixel resolution is the
                                  real granularity, not the step). */}
                              <input
                                type="range"
                                min={0}
                                max={totalQuantity}
                                step={1}
                                value={task.copiesDone}
                                onChange={(e) =>
                                  setTaskCopiesDone(activeGroupIdx, taskIdx, Number.parseInt(e.target.value, 10) || 0)
                                }
                                className="acompte-progress-slider relative z-10 w-full appearance-none bg-transparent cursor-grab active:cursor-grabbing focus:outline-none"
                                aria-label={`Exemplaires produits — ${task.taskLabel}`}
                              />
                            </div>
                            <span className="text-[13px] text-zinc-300 tabular-nums w-[40px] text-right">
                              {Math.round(pct)} %
                            </span>
                          </div>
                          {/* Cascade segments */}
                          {/* Cascade segments use the canonical tile-completed palette
                              (rgb 34,197,94 == #22c55e, text #86efac) so they read as
                              the same « validated » signal as the .full acompte card +
                              the planning-board tuile completed. Previously these used
                              Tailwind emerald-500 (#10b981) which drifted just enough
                              to look like a separate green from the rest. */}
                          <div className="flex gap-1 h-[44px] mt-2">
                            {cascade.map((c, ci) => (
                              <div
                                key={c.acompteId}
                                className={`relative border px-2 py-1.5 min-w-[80px] flex flex-col justify-between overflow-hidden ${
                                  c.saturated ? 'border-[rgba(34,197,94,0.45)]' : 'border-zinc-800'
                                } bg-zinc-800/40`}
                                style={{ flexGrow: Math.max(1, c.capacity), flexBasis: 0 }}
                              >
                                <div
                                  className={`absolute left-0 top-0 bottom-0 transition-[width] ${
                                    c.saturated
                                      ? 'bg-[rgba(34,197,94,0.55)]'
                                      : c.empty
                                        ? 'bg-transparent'
                                        : 'bg-[rgba(34,197,94,0.30)]'
                                  }`}
                                  style={{ width: `${c.progressPct}%` }}
                                />
                                <div className="relative z-10 flex items-center justify-between text-[10px] tabular-nums leading-tight">
                                  <span
                                    className={`font-semibold text-[11px] flex items-center gap-1 ${
                                      c.empty ? 'text-zinc-500' : 'text-zinc-100'
                                    }`}
                                  >
                                    {acompteShortLabel(ci, cascade.length)}
                                    {c.saturated && <Check className="w-2.5 h-2.5 text-[#86efac]" />}
                                  </span>
                                  <span className={c.saturated ? 'text-[#86efac]' : 'text-zinc-500'}>
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
                            ))}
                          </div>
                          {warning && (
                            <div className="mt-2 px-2.5 py-1.5 bg-amber-500/[0.08] border border-amber-500/25 text-[11px] text-amber-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {warning}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
});
