/**
 * JobTestRecipeEditor — modal for creating / editing a {@link JobTestRecipe}.
 *
 * Mirrors the JCF UX :
 *   - Base job picker → SearchableSelect over the snapshot's jobs.
 *   - Quantity (override, blank = inherit base).
 *   - Départ atelier (datetime-local) OR Délai (J+) integer — at least one
 *     required, mirror of the JCF rule.
 *   - Date limite BAT (datetime-local).
 *   - Importance deadline → JcfPrioritySelect (Impératif/Important/Standard/Flexible).
 *
 * Live preview panel on the right shows the next generated job's
 * designation, quantity, scaled run minutes per step, and resolved dates.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, AlertTriangle, BookOpen } from 'lucide-react';
import { JcfPrioritySelect } from '../JcfJobHeader/JcfPrioritySelect';
import { SearchableSelect, type SearchableOption } from '../JobTestPickers/SearchableSelect';
import {
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  type JobTestRecipeInput,
  type JobTestRecipeResponse,
} from '../../store/api/jobTestApi';

interface BaseJobOption {
  id: string;
  reference: string;
  description: string;
  quantity: number | null;
}

interface JobTestRecipeEditorProps {
  initial: JobTestRecipeResponse | null;
  baseJobs: BaseJobOption[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const PRIORITY_LABELS = ['Vital', 'Impératif', 'Important', 'Standard', 'Flexible'];
const INPUT_CLASS =
  'w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-blue-500';

function isoToLocal(value: string | null): string {
  if (!value) return '';
  // Truncate seconds + tz for datetime-local input value.
  return value.slice(0, 16);
}

export function JobTestRecipeEditor({ initial, baseJobs, onClose, onSaved }: JobTestRecipeEditorProps) {
  const [baseJobId, setBaseJobId] = useState<string>(initial?.baseJobId ?? baseJobs[0]?.id ?? '');
  const [quantity, setQuantity] = useState<string>(initial?.quantity != null ? String(initial.quantity) : '');
  const [deadline, setDeadline] = useState<string>(isoToLocal(initial?.workshopExitDate ?? null));
  const [deadlineRel, setDeadlineRel] = useState<string>(
    initial?.deadlineRelativeWorkingDays != null ? String(initial.deadlineRelativeWorkingDays) : '',
  );
  const [batDeadline, setBatDeadline] = useState<string>(isoToLocal(initial?.batDeadline ?? null));
  const [priority, setPriority] = useState<number>(initial?.deadlinePriority ?? 2);
  const [saveError, setSaveError] = useState<string | null>(null);

  const deadlineRef = useRef<HTMLInputElement>(null);
  const deadlineRelRef = useRef<HTMLInputElement>(null);
  const batDeadlineRef = useRef<HTMLInputElement>(null);

  const [createRecipe, { isLoading: isCreating }] = useCreateRecipeMutation();
  const [updateRecipe, { isLoading: isUpdating }] = useUpdateRecipeMutation();
  const isSaving = isCreating || isUpdating;

  const baseJobOptions = useMemo<SearchableOption[]>(() => {
    const live: SearchableOption[] = baseJobs.map((j) => ({
      value: j.id,
      label: j.description,
      sublabel: `${j.reference} · qty ${j.quantity ?? '?'}`,
    }));
    // When editing a recipe whose base has been wiped (RAZ jobs), inject a
    // ghost option so the picker can keep the current selection visible —
    // the user can either keep it (snapshot-driven) or repoint to a live base.
    const initialBaseId = initial?.baseJobId;
    if (
      initial !== null &&
      initial.baseJobMissing &&
      initialBaseId !== undefined &&
      !live.some((opt) => opt.value === initialBaseId)
    ) {
      live.unshift({
        value: initialBaseId,
        label: `${initial.baseJobDescription ?? '(snapshot)'} (job supprimé)`,
        sublabel: `${initial.baseJobReference ?? '—'} · snapshot`,
      });
    }
    return live;
  }, [baseJobs, initial]);

  // Source of truth for the preview : prefer the live job from the picker
  // list, fall back to the snapshot summary on the recipe response so the
  // preview keeps working even after a RAZ (live base gone, snapshot still
  // there). Description / qty come from whichever side is available.
  const liveBase = baseJobs.find((j) => j.id === baseJobId) ?? null;
  const snapshotDescription = initial?.baseJobDescription ?? null;
  const snapshotQuantity = initial?.baseJobQuantity ?? null;
  const baseDescription = liveBase?.description ?? snapshotDescription;
  const baseQty = liveBase?.quantity ?? snapshotQuantity;
  const baseAvailable = liveBase !== null || snapshotDescription !== null;
  const baseLiveMissing =
    initial !== null && initial.baseJobMissing && baseJobId === initial.baseJobId;
  const newQty = quantity.trim() === '' ? baseQty ?? 1 : Number(quantity) || 0;
  const ratio = baseQty && baseQty > 0 ? newQty / baseQty : 1;

  const orRequiredSatisfied = deadline.trim() !== '' || deadlineRel.trim() !== '';
  const canSave = baseJobId !== '';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-portal-popover]')) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    // Read DOM values via refs as source of truth — datetime-local inputs can
    // diverge from React state (autofill, partial input, HMR transitions),
    // so we don't trust the state alone at submit time.
    // TODO: tackle the underlying state-sync issue (custom DateTimeInput that
    // properly bridges native input ↔ React state, or onBlur-stricter binding)
    // so this DOM-read workaround can disappear.
    const readInputOrState = (
      ref: React.RefObject<HTMLInputElement | null>,
      state: string,
    ): string => (ref.current?.value ?? state).trim();
    const deadlineDom = readInputOrState(deadlineRef, deadline);
    const deadlineRelDom = readInputOrState(deadlineRelRef, deadlineRel);
    const batDeadlineDom = readInputOrState(batDeadlineRef, batDeadline);

    if (deadlineDom === '' && deadlineRelDom === '') {
      setSaveError('Renseigne au moins une "Départ atelier" ou un "Délai (J+)".');
      return;
    }

    const body: JobTestRecipeInput = {
      baseJobId,
      quantity: quantity.trim() === '' ? null : Number(quantity),
      workshopExitDate: deadlineDom === '' ? null : deadlineDom,
      deadlineRelativeWorkingDays: deadlineRelDom === '' ? null : Number(deadlineRelDom),
      batDeadline: batDeadlineDom === '' ? null : batDeadlineDom,
      deadlinePriority: priority,
    };

    try {
      if (initial) {
        await updateRecipe({ id: initial.id, body }).unwrap();
        onSaved('Recette mise à jour.');
      } else {
        await createRecipe(body).unwrap();
        onSaved('Recette créée.');
      }
      onClose();
    } catch (err) {
      const msg =
        (err as { data?: { message?: string; details?: string[] } })?.data?.message ??
        (err as { data?: { details?: string[] } })?.data?.details?.join(', ') ??
        'Erreur lors de la sauvegarde.';
      setSaveError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-flux-elevated border border-flux-border-light rounded-lg w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-flux-border bg-flux-hover/30">
          <div className="flex items-center gap-2 text-flux-text-primary font-medium">
            <BookOpen className="w-4 h-4" strokeWidth={2} />
            {initial ? 'Éditer la recette' : 'Nouvelle recette'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-flux-text-tertiary hover:text-flux-text-primary hover:bg-flux-hover"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_280px] gap-5 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">Job de base *</label>
                <SearchableSelect
                  options={baseJobOptions}
                  value={baseJobId || null}
                  onChange={setBaseJobId}
                  placeholder="Choisir un job de base"
                  searchable
                  ariaLabel="Job de base"
                />
                <p className="mt-1 text-[11px] text-flux-text-muted">
                  Sa séquence et son calage sont clonés. Quantité gabarit&nbsp;:{' '}
                  <span className="font-mono">{baseQty ?? '—'}</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">Quantité (override)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={baseQty != null ? `${baseQty} (base)` : ''}
                  className={`${INPUT_CLASS} font-mono`}
                />
                <p className="mt-1 text-[11px] text-flux-text-muted">
                  Vide = quantité du base. La <b>roule</b> sera proportionnelle, le <b>calage</b> reste fixe.
                </p>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div>
                  <label className="block text-xs text-flux-text-tertiary mb-1">Départ atelier</label>
                  <input
                    ref={deadlineRef}
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value !== deadline) setDeadline(e.target.value);
                    }}
                    className={`${INPUT_CLASS} font-mono [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-flux-text-tertiary mb-1">Délai (J+)</label>
                  <input
                    ref={deadlineRelRef}
                    type="text"
                    inputMode="numeric"
                    value={deadlineRel}
                    onChange={(e) => setDeadlineRel(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="ex: 5"
                    className={`${INPUT_CLASS} font-mono text-right`}
                  />
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] ${orRequiredSatisfied ? 'text-emerald-400' : 'text-amber-400'}`}>
                {orRequiredSatisfied ? (
                  <>
                    <Check className="w-3 h-3" strokeWidth={2.5} /> Au moins un des deux est rempli
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" strokeWidth={2.5} /> Au moins un des deux requis
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">
                  Date limite BAT <span className="text-flux-text-muted font-normal">(optionnel)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={batDeadlineRef}
                    type="datetime-local"
                    value={batDeadline}
                    onChange={(e) => setBatDeadline(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value !== batDeadline) setBatDeadline(e.target.value);
                    }}
                    className={`${INPUT_CLASS} font-mono [color-scheme:dark]`}
                  />
                  {batDeadline !== '' && (
                    <button
                      type="button"
                      onClick={() => setBatDeadline('')}
                      className="px-2 py-1 text-[11px] text-flux-text-tertiary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded shrink-0"
                      aria-label="Effacer la date limite BAT"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-flux-text-muted">
                  Vide = pas d'échéance BAT contractuelle. Sinon, fait office de plancher d'ordo pour les tâches concernées.
                </p>
              </div>

              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">Importance deadline</label>
                <JcfPrioritySelect value={priority} onChange={setPriority} inputBaseClass={INPUT_CLASS} />
              </div>
            </div>

            <aside className="bg-flux-base border border-flux-border rounded p-3 text-xs text-flux-text-secondary self-start">
              <div className="text-[10px] uppercase tracking-wider text-flux-text-tertiary mb-2 font-semibold">
                Aperçu de la prochaine génération
              </div>
              {baseLiveMissing && (
                <div className="mb-2 px-2 py-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span>
                    Le job de base a été supprimé (RAZ jobs). La recette continue de fonctionner grâce au snapshot pris à sa création.
                  </span>
                </div>
              )}
              {!baseAvailable ? (
                <div className="text-flux-text-muted italic">Sélectionne un job de base pour voir l'aperçu.</div>
              ) : (
                <>
                  <div className="mb-2">
                    <div className="text-[10px] text-flux-text-tertiary">Désignation</div>
                    <div className="font-mono text-blue-400 font-semibold">{baseDescription} N</div>
                    <div className="text-[10px] text-flux-text-muted">N = compteur per-base (continu)</div>
                  </div>
                  <div className="border-t border-flux-border my-2" />
                  <div className="mb-2">
                    <div className="text-[10px] text-flux-text-tertiary">Quantité</div>
                    <div className="font-mono">
                      {newQty}{' '}
                      {Math.abs(ratio - 1) < 0.001 ? (
                        <span className="text-flux-text-muted">(×1.00)</span>
                      ) : (
                        <span className="text-blue-400 font-semibold">(×{ratio.toFixed(2)})</span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-[10px] text-flux-text-tertiary">Roule (proportionnée)</div>
                    <div className="text-flux-text-secondary text-[11px]">
                      Tous les <code>runMinutes</code> internes du job de base seront multipliés par {ratio.toFixed(2)}.
                      Le calage reste inchangé.
                    </div>
                  </div>
                  <div className="border-t border-flux-border my-2" />
                  <div>
                    <div className="text-[10px] text-flux-text-tertiary">Importance</div>
                    <div className="font-medium" style={{ color: PRIORITY_COLORS[priority] }}>
                      {PRIORITY_LABELS[priority]}
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>

          {saveError && (
            <div className="px-4 pb-3 text-xs text-red-400 bg-red-900/10 border-t border-red-500/30 py-2">
              {saveError}
            </div>
          )}

          <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-flux-border bg-flux-hover/30">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSave || isSaving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              {isSaving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'rgb(248 113 113)',
  1: 'rgb(251 146 60)',
  2: 'rgb(244 244 245)',
  3: 'rgb(96 165 250)',
};
