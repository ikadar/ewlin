/**
 * AcompteModal — standalone modal for splitting a job into delivery commitments
 * AND saisir l'avancement parent-level per task.
 *
 * V1 deviates from UX-AC-003 ("tab inside JcfModal") for shipping speed —
 * the modal stands alone and is opened from a button in the JCF modif flow.
 * The unified "JCF tab" integration is a follow-up refactor.
 *
 * See docs/releases/acomptes-kickoff.md, playground-parent-progress-saturation.html.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, CalendarClock, Package, Check, AlertTriangle, Split } from 'lucide-react';
import { JcfModal } from '../JcfModal';
import {
  useGetAcomptesQuery,
  useReplaceAcomptesMutation,
  useDeleteAcomptesMutation,
  useGetAcompteProgressDeclarationsQuery,
  useWriteAcompteProgressDeclarationMutation,
} from '../../store/api/acompteApi';
import type { JobDetailsResponse } from '../../store/api/scheduleApi';

interface SplitDraft {
  /** Stable local key. */
  key: string;
  quantityShare: number;
  /** ISO 8601 datetime-local format (e.g. "2026-06-15T17:00"). */
  deadline: string;
}

interface TaskDoneDraft {
  /** Stable cross-scenario logical task id. */
  logicalTaskId: string;
  /** Display label "G37 — Impression offset (couv 300g)". */
  label: string;
  /** Copies done declared by operator (parent-level). */
  copiesDone: number;
}

export interface AcompteModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDetailsResponse;
}

function isoToDatetimeLocal(iso: string): string {
  // Accepts both "2026-06-15T17:00:00+02:00" and "2026-06-15T17:00:00".
  // Returns "2026-06-15T17:00" for the datetime-local input.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextKey(): string {
  return 'sp-' + Math.random().toString(36).slice(2, 10);
}

export function AcompteModal({ isOpen, onClose, job }: AcompteModalProps) {
  const { data: acomptesData } = useGetAcomptesQuery(job.id, { skip: !isOpen });
  const { data: declarationsData } = useGetAcompteProgressDeclarationsQuery(job.id, { skip: !isOpen });
  const [replaceAcomptes, { isLoading: isReplacing }] = useReplaceAcomptesMutation();
  const [deleteAcomptes, { isLoading: isDeleting }] = useDeleteAcomptesMutation();
  const [writeDeclaration, { isLoading: isWritingDecl }] = useWriteAcompteProgressDeclarationMutation();

  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [taskDones, setTaskDones] = useState<TaskDoneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalQuantity = job.quantity ?? 0;

  // Seed local state from server data when modal opens / data refreshes.
  useEffect(() => {
    if (!isOpen) return;
    if (acomptesData?.acomptes && acomptesData.acomptes.length > 0) {
      setSplits(acomptesData.acomptes.map(a => ({
        key: a.id,
        quantityShare: a.quantityShare,
        deadline: isoToDatetimeLocal(a.deadline),
      })));
    } else {
      // No acomptes yet → default to 2 even splits with the job's exit date.
      const half = Math.round(totalQuantity / 2);
      const defaultDeadline = job.workshopExitDate
        ? isoToDatetimeLocal(job.workshopExitDate)
        : new Date().toISOString().slice(0, 16);
      setSplits([
        { key: nextKey(), quantityShare: half, deadline: defaultDeadline },
        { key: nextKey(), quantityShare: totalQuantity - half, deadline: defaultDeadline },
      ]);
    }
  }, [isOpen, acomptesData, totalQuantity, job.workshopExitDate]);

  // Seed task progress drafts from job tasks (one row per task) and existing declarations.
  useEffect(() => {
    if (!isOpen) return;
    const elementNameById = new Map(job.elements.map(e => [e.id, e.name]));
    // Find the element each task belongs to via element.taskIds.
    const taskToElement = new Map<string, string>();
    for (const el of job.elements) for (const tid of el.taskIds) taskToElement.set(tid, el.id);

    const declByLogical = new Map(
      (declarationsData?.declarations ?? []).map(d => [d.logicalTaskId, d.declaredTotalCopiesDone]),
    );
    const drafts: TaskDoneDraft[] = job.tasks
      .filter(t => t.taskType === 'internal')
      .map(t => {
        const elementId = taskToElement.get(t.id);
        const elementName = elementId ? elementNameById.get(elementId) ?? '?' : '?';
        const label = `${t.stationId ? `Station ${t.stationId.slice(0, 8)}` : t.taskType} · ${elementName}`;
        return {
          logicalTaskId: t.logicalTaskId,
          label,
          copiesDone: declByLogical.get(t.logicalTaskId) ?? 0,
        };
      });
    setTaskDones(drafts);
  }, [isOpen, declarationsData, job.elements, job.tasks]);

  const splitsSum = useMemo(() => splits.reduce((s, x) => s + x.quantityShare, 0), [splits]);
  const splitsBalance = splitsSum === totalQuantity;

  function setSplitField(idx: number, field: keyof SplitDraft, value: string | number) {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function addSplit() {
    setSplits(prev => {
      const last = prev[prev.length - 1];
      return [...prev, { key: nextKey(), quantityShare: 0, deadline: last?.deadline ?? '' }];
    });
  }
  function removeSplit(idx: number) {
    setSplits(prev => prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx));
  }
  function setTaskDone(idx: number, copies: number) {
    setTaskDones(prev => prev.map((t, i) => i === idx ? { ...t, copiesDone: copies } : t));
  }

  async function handleSave() {
    setError(null);
    if (!splitsBalance) {
      setError(`Somme des acomptes (${splitsSum}) ≠ quantité totale (${totalQuantity}).`);
      return;
    }
    if (splits.length < 2) {
      setError('Au moins 2 acomptes requis.');
      return;
    }
    try {
      await replaceAcomptes({
        jobId: job.id,
        splits: splits.map(s => ({
          quantity_share: s.quantityShare,
          deadline: s.deadline,
        })),
      }).unwrap();
      // Write per-task declarations sequentially.
      for (const td of taskDones) {
        if (td.copiesDone > 0) {
          await writeDeclaration({
            jobId: job.id,
            logical_task_id: td.logicalTaskId,
            declared_total_copies_done: td.copiesDone,
          }).unwrap();
        }
      }
      onClose();
    } catch (e: unknown) {
      const msg = (e as { data?: { error?: string } } | undefined)?.data?.error
        ?? (e instanceof Error ? e.message : 'Erreur inconnue');
      setError(msg);
    }
  }

  async function handleUnsplit() {
    setError(null);
    if (!confirm('Supprimer tous les acomptes et restaurer la livraison unique ?')) return;
    try {
      await deleteAcomptes(job.id).unwrap();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { data?: { error?: string } } | undefined)?.data?.error
        ?? (e instanceof Error ? e.message : 'Erreur inconnue');
      setError(msg);
    }
  }

  const isSaving = isReplacing || isWritingDecl || isDeleting;
  const hasExistingAcomptes = (acomptesData?.acomptes.length ?? 0) > 0;

  return (
    <JcfModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Acomptes & avancement — ${job.reference} · ${job.client}`}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
      saveLabel={hasExistingAcomptes ? 'Mettre à jour' : 'Créer & enregistrer'}
    >
      <div className="space-y-5">
        {/* Total reference (read-only) */}
        <div className="flex items-baseline gap-3 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm">
          <span className="text-zinc-400">Quantité totale du job</span>
          <strong className="text-zinc-100 text-base font-semibold tabular-nums">
            {totalQuantity.toLocaleString('fr-FR')}
          </strong>
          <span className="text-zinc-500 text-xs">exemplaires (édité dans le JCF)</span>
        </div>

        {/* Acomptes editor */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
              <Split className="w-3.5 h-3.5" /> Acomptes ({splits.length})
            </h3>
            <button
              type="button"
              onClick={addSplit}
              className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          <div className="space-y-1.5">
            {splits.map((s, i) => (
              <div key={s.key} className="grid grid-cols-[40px_1fr_1fr_30px] gap-2 items-center text-xs">
                <span className="text-zinc-500 text-center">{i + 1}/{splits.length}</span>
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-zinc-500" />
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={s.quantityShare}
                    onChange={e => setSplitField(i, 'quantityShare', Number.parseInt(e.target.value, 10) || 0)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full text-right tabular-nums focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-zinc-500">ex.</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarClock className="w-3 h-3 text-zinc-500" />
                  <input
                    type="datetime-local"
                    value={s.deadline}
                    onChange={e => setSplitField(i, 'deadline', e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full text-zinc-200 [color-scheme:dark] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSplit(i)}
                  disabled={splits.length <= 2}
                  className="text-zinc-500 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label={`Supprimer l'acompte ${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className={`mt-2 text-xs flex items-center gap-1.5 ${splitsBalance ? 'text-emerald-400' : 'text-amber-300'}`}>
            {splitsBalance ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Somme : {splitsSum.toLocaleString('fr-FR')} / {totalQuantity.toLocaleString('fr-FR')} ex.
            {!splitsBalance && ' — à équilibrer'}
          </div>
        </section>

        {/* Per-task saisie */}
        {taskDones.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              Avancement — exemplaires produits par tâche
            </h3>
            <div className="space-y-1.5">
              {taskDones.map((t, i) => (
                <div key={t.logicalTaskId} className="grid grid-cols-[1fr_140px] gap-2 items-center text-xs">
                  <span className="text-zinc-300 truncate">{t.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={totalQuantity}
                      step={500}
                      value={t.copiesDone}
                      onChange={e => setTaskDone(i, Number.parseInt(e.target.value, 10) || 0)}
                      className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full text-right tabular-nums focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-zinc-500">/ {totalQuantity.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500 italic">
              Saisie au niveau du dossier. La cascade FIFO répartit sur les acomptes côté serveur ; les acomptes saturés à 100 % sont retirés du planning automatiquement.
            </p>
          </section>
        )}

        {/* Un-split */}
        {hasExistingAcomptes && (
          <section className="pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleUnsplit}
              disabled={isSaving}
              className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" /> Annuler le découpage (livraison unique)
            </button>
          </section>
        )}
      </div>
    </JcfModal>
  );
}
