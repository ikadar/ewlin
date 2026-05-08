/**
 * JobTestScenarioEditor — modal for creating / editing a JobTestScenario.
 *
 * A scenario is a named, ordered bundle of (recipe, count) entries. The
 * editor exposes a dynamic items list : each row is a recipe selector
 * (SearchableSelect) + a count input + a remove button. The live preview
 * shows the total jobs that will be created at execution time, plus a
 * per-recipe breakdown.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Layers, AlertTriangle, Play } from 'lucide-react';
import { SearchableSelect, type SearchableOption } from '../JobTestPickers/SearchableSelect';
import {
  useCreateScenarioMutation,
  useUpdateScenarioMutation,
  useExecuteScenarioMutation,
  type JobTestScenarioInput,
  type JobTestScenarioResponse,
  type JobTestRecipeResponse,
} from '../../store/api/jobTestApi';

const INPUT_CLASS =
  'w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-blue-500';

interface JobTestScenarioEditorProps {
  initial: JobTestScenarioResponse | null;
  recipes: JobTestRecipeResponse[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onExecuted?: (msg: string) => void;
}

interface DraftItem {
  recipeId: string;
  count: number;
}

export function JobTestScenarioEditor({
  initial,
  recipes,
  onClose,
  onSaved,
  onExecuted,
}: JobTestScenarioEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [items, setItems] = useState<DraftItem[]>(
    initial?.items.map((i) => ({ recipeId: i.recipeId, count: i.count })) ?? [],
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const [createScenario, { isLoading: isCreating }] = useCreateScenarioMutation();
  const [updateScenario, { isLoading: isUpdating }] = useUpdateScenarioMutation();
  const [executeScenario, { isLoading: isExecuting }] = useExecuteScenarioMutation();
  const isSaving = isCreating || isUpdating || isExecuting;

  const recipeOptions = useMemo<SearchableOption[]>(
    () =>
      recipes.map((r) => {
        const baseDesc = r.baseJobDescription ?? '— recette orpheline —';
        const qtyText = r.quantity != null ? String(r.quantity) : `${r.baseJobQuantity ?? '?'} (base)`;
        const dateText = r.deadlineRelativeWorkingDays != null ? `J+${r.deadlineRelativeWorkingDays}` : (r.workshopExitDate?.slice(0, 10) ?? '?');
        return {
          value: r.id,
          label: baseDesc,
          sublabel: `${r.id.slice(0, 8)} · qty ${qtyText} · ${dateText}`,
        };
      }),
    [recipes],
  );

  const totalJobs = items.reduce((acc, it) => acc + it.count, 0);
  const canSave = name.trim() !== '' && items.length > 0 && items.every((it) => it.recipeId !== '');

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

  const addItem = () => {
    if (recipes.length === 0) {
      setSaveError('Crée au moins une recette avant.');
      return;
    }
    setItems((prev) => [...prev, { recipeId: recipes[0].id, count: 1 }]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const buildBody = (): JobTestScenarioInput => ({
    name: name.trim(),
    description: description.trim() || null,
    items: items.map((it) => ({ recipeId: it.recipeId, count: Math.max(1, Math.min(99, it.count)) })),
  });

  const handleSubmit = async (e: React.FormEvent, runAfter: boolean) => {
    e.preventDefault();
    if (!canSave) return;
    setSaveError(null);
    const body = buildBody();
    try {
      let savedId: string;
      if (initial) {
        const saved = await updateScenario({ id: initial.id, body }).unwrap();
        savedId = saved.id;
      } else {
        const saved = await createScenario(body).unwrap();
        savedId = saved.id;
      }
      onSaved(initial ? 'Scénario mis à jour.' : 'Scénario créé.');
      if (runAfter) {
        const result = await executeScenario(savedId).unwrap();
        onExecuted?.(`Scénario exécuté · ${result.totalJobs} jobs créés.`);
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

  const breakdown = items.map((it) => {
    const r = recipes.find((rr) => rr.id === it.recipeId);
    return { count: it.count, label: r?.baseJobDescription ?? '— manquante —', orphan: !r || r.baseJobMissing };
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-flux-elevated border border-flux-border-light rounded-lg w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-flux-border bg-flux-hover/30">
          <div className="flex items-center gap-2 text-flux-text-primary font-medium">
            <Layers className="w-4 h-4" strokeWidth={2} />
            {initial ? 'Éditer le scénario' : 'Nouveau scénario'}
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

        <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_280px] gap-5 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">Nom *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="ex: Fin de mois — gros volume"
                  className={INPUT_CLASS}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-flux-text-tertiary mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="ex: Stress test — forte charge sur ImpA, BAT serrés"
                  className={`${INPUT_CLASS} resize-y min-h-[60px]`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-flux-text-tertiary">Recettes du scénario</label>
                  <span className="text-[11px] text-flux-text-tertiary">{items.length} ligne{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-flux-base border border-flux-border rounded p-2 flex flex-col gap-2">
                  {items.length === 0 ? (
                    <div className="px-2 py-3 text-flux-text-muted text-sm italic text-center">
                      Aucune recette. Ajoute-en une ci-dessous.
                    </div>
                  ) : (
                    items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_80px_auto] gap-2 items-center">
                        <SearchableSelect
                          options={recipeOptions}
                          value={it.recipeId}
                          onChange={(v) => updateItem(idx, { recipeId: v })}
                          placeholder="Choisir une recette"
                          searchable
                          ariaLabel={`Recette ligne ${idx + 1}`}
                        />
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={it.count}
                          onChange={(e) =>
                            updateItem(idx, {
                              count: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                            })
                          }
                          className={`${INPUT_CLASS} font-mono text-right`}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30"
                          aria-label="Retirer cette ligne"
                          title="Retirer"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={addItem}
                    className="self-start mt-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded border border-flux-border-light"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Ajouter une recette
                  </button>
                </div>
              </div>
            </div>

            <aside className="bg-flux-base border border-flux-border rounded p-3 text-xs text-flux-text-secondary self-start">
              <div className="text-[10px] uppercase tracking-wider text-flux-text-tertiary mb-2 font-semibold">
                Aperçu d'exécution
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2 mb-3 text-center">
                <div className="text-2xl font-bold font-mono text-purple-400">{totalJobs}</div>
                <div className="text-[10px] uppercase tracking-wider text-flux-text-tertiary">jobs par exécution</div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-flux-text-tertiary mb-1">Composition</div>
              {breakdown.length === 0 ? (
                <div className="text-flux-text-muted italic">— vide —</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {breakdown.map((b, i) => (
                    <div key={i} className={`flex justify-between gap-2 ${b.orphan ? 'text-amber-400' : ''}`}>
                      <span className="truncate">
                        <span className="font-mono text-blue-400 font-semibold">{b.count}×</span>{' '}
                        {b.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!canSave && (
                <div className="mt-3 flex items-start gap-1.5 text-amber-400 text-[11px]">
                  <AlertTriangle className="w-3 h-3 mt-0.5" strokeWidth={2.5} />
                  <span>
                    {!name.trim()
                      ? 'Nom requis. '
                      : items.length === 0
                        ? 'Au moins une recette requise.'
                        : 'Sélectionne une recette sur chaque ligne.'}
                  </span>
                </div>
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
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={!canSave || isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              <Play className="w-3.5 h-3.5" strokeWidth={2.5} /> Enregistrer & exécuter
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
