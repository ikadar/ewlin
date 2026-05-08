/**
 * JobsDeTestPage — settings page for orchestrating test fixtures.
 *
 * Two layers :
 *   - Recettes : parameterised clone descriptors of an existing job.
 *   - Scénarios : ordered bundles of (recipe, count) entries.
 *
 * Quick actions in the header :
 *   - "Générer 1 de chaque recette" : one job per recipe in one click.
 *   - "RAZ jobs" : empties all job-related rows (with confirmation).
 *
 * Per-base global counter for direct generation, per-execution scoped
 * counter for scenario runs (see backend service for details).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Pencil, Copy, Play, Zap, Layers, BookOpen,
  AlertTriangle, X, CheckCircle2, Info,
} from 'lucide-react';
import {
  useGetRecipesQuery,
  useGetScenariosQuery,
  useDeleteRecipeMutation,
  useDeleteScenarioMutation,
  useGenerateRecipeMutation,
  useExecuteScenarioMutation,
  useDuplicateScenarioMutation,
  useGenerateOneOfEachMutation,
  useWipeMutation,
  type JobTestRecipeResponse,
  type JobTestScenarioResponse,
  type JobTestWipeResponse,
} from '../store/api/jobTestApi';
import { useGetSnapshotQuery, useAppDispatch, scheduleApi } from '../store';
import { prodSnapshotApi } from '../store/api/prodSnapshotApi';
import { fluxApi } from '../store/api/fluxApi';
import { JobTestRecipeEditor } from '../components/JobTestRecipeEditor/JobTestRecipeEditor';
import { JobTestScenarioEditor } from '../components/JobTestScenarioEditor/JobTestScenarioEditor';

const PRIORITY_LABELS = ['Impératif', 'Important', 'Standard', 'Flexible'];
const PRIORITY_COLORS = ['text-red-400 border-red-400/40', 'text-orange-400 border-orange-400/40', 'text-zinc-100 border-flux-border-light', 'text-blue-400 border-blue-400/40'];

interface ToastState {
  msg: string;
  kind: 'ok' | 'warn' | 'err';
  details?: string[];
}

function fmtQty(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function JobsDeTestPage() {
  const { data: recipes = [], isLoading: recipesLoading } = useGetRecipesQuery();
  const { data: scenarios = [], isLoading: scenariosLoading } = useGetScenariosQuery();
  const { data: snapshot } = useGetSnapshotQuery();

  const [deleteRecipe] = useDeleteRecipeMutation();
  const [deleteScenario] = useDeleteScenarioMutation();
  const [generateRecipe, { isLoading: genRecipeLoading }] = useGenerateRecipeMutation();
  const [executeScenario, { isLoading: execScenarioLoading }] = useExecuteScenarioMutation();
  const [duplicateScenario] = useDuplicateScenarioMutation();
  const [generateOneOfEach, { isLoading: genEachLoading }] = useGenerateOneOfEachMutation();
  const [wipe, { isLoading: wipeLoading }] = useWipeMutation();
  const dispatch = useAppDispatch();

  /**
   * Reality-driven mutations (wipe, generate, execute) bypass the normal
   * Mercure-driven invalidation paths : TRUNCATE doesn't fire ORM events,
   * and the freshly created jobs sit behind three separate RTK Query
   * caches (Préprod Snapshot, Prod ProdSnapshot, Flux dashboard FluxJobs).
   * After any such mutation, we invalidate all three explicitly — see
   * memory `feedback_dual_snapshot_invalidation`.
   */
  const invalidatePlanningCaches = () => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
    dispatch(prodSnapshotApi.util.invalidateTags(['ProdSnapshot']));
    dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
  };

  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<JobTestRecipeResponse | null>(null);
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [editingScenario, setEditingScenario] = useState<JobTestScenarioResponse | null>(null);
  const [showRaz, setShowRaz] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'recipe'; id: string; label: string }
    | { kind: 'scenario'; id: string; label: string }
    | null
  >(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const baseJobs = useMemo(() => {
    const jobs = ((snapshot as unknown as { jobs?: Array<{ id: string; reference: string; description: string; quantity?: number | null }> })?.jobs) ?? [];
    return jobs.map((j) => ({
      id: j.id,
      reference: j.reference,
      description: j.description,
      quantity: j.quantity ?? null,
    }));
  }, [snapshot]);

  const showToast = (kind: ToastState['kind'], msg: string, details?: string[]) => {
    setToast({ msg, kind, details });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleGenerateRecipe = async (id: string) => {
    try {
      const res = await generateRecipe(id).unwrap();
      invalidatePlanningCaches();
      showToast('ok', `${res.totalJobs} job créé : ${res.createdJobs[0]?.description ?? ''}`);
    } catch (err) {
      showToast('err', errorMessage(err, 'Erreur de génération.'));
    }
  };

  const handleExecuteScenario = async (id: string, name: string) => {
    try {
      const res = await executeScenario(id).unwrap();
      invalidatePlanningCaches();
      showToast('ok', `Scénario « ${name} » exécuté · ${res.totalJobs} jobs créés.`);
    } catch (err) {
      showToast('err', errorMessage(err, "Erreur d'exécution."));
    }
  };

  const handleDuplicateScenario = async (id: string) => {
    try {
      await duplicateScenario(id).unwrap();
      showToast('ok', 'Scénario dupliqué.');
    } catch (err) {
      showToast('err', errorMessage(err, 'Erreur de duplication.'));
    }
  };

  const handleGenerateEach = async () => {
    try {
      const res = await generateOneOfEach().unwrap();
      invalidatePlanningCaches();
      showToast('ok', `${res.totalJobs} jobs créés depuis ${recipes.length} recette${recipes.length > 1 ? 's' : ''}.`);
    } catch (err) {
      showToast('err', errorMessage(err, 'Erreur de génération.'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === 'recipe') {
        await deleteRecipe(confirmDelete.id).unwrap();
        showToast('ok', 'Recette supprimée.');
      } else {
        await deleteScenario(confirmDelete.id).unwrap();
        showToast('ok', 'Scénario supprimé.');
      }
      setConfirmDelete(null);
    } catch (err) {
      showToast('warn', errorMessage(err, 'Suppression refusée.'));
      setConfirmDelete(null);
    }
  };

  const handleConfirmWipe = async () => {
    try {
      const res: JobTestWipeResponse = await wipe().unwrap();
      invalidatePlanningCaches();
      setShowRaz(false);
      showToast('ok', `Base vidée · ${res.totalRowsWiped} lignes supprimées sur ${Object.keys(res.countsBefore).length} tables.`);
    } catch (err) {
      showToast('err', errorMessage(err, 'Erreur de RAZ.'));
    }
  };

  return (
    <div className="min-h-full bg-flux-base flex flex-col">
      <header className="border-b border-flux-border px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-flux-text-primary">Jobs de test</h1>
          <p className="text-xs text-flux-text-tertiary mt-1 max-w-xl">
            Recettes (clones paramétrés d'un job de base) et scénarios (ensembles de recettes)
            pour mettre la base dans un état déterministe en deux clics.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateEach}
            disabled={genEachLoading || recipes.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            title="Génère un job pour chaque recette"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
            {genEachLoading ? '…' : '1 de chaque recette'}
          </button>
          <button
            type="button"
            onClick={() => setShowRaz(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded"
            title="Vide les données liées aux jobs"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
            RAZ jobs
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2.5 text-xs text-amber-300 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
          <span>
            Page accessible en prod pour itérer rapidement sur des scénarios de test. Sera retirée
            quand tous les tests seront passés.
          </span>
        </div>

        {/* SCENARIOS SECTION */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-flux-text-primary text-sm font-semibold uppercase tracking-wider">
              <Layers className="w-4 h-4 text-purple-400" strokeWidth={2} />
              Scénarios
              <span className="text-flux-text-tertiary text-[11px] normal-case font-normal tracking-normal">
                ({scenarios.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCreatingScenario(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nouveau scénario
            </button>
          </div>
          <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-flux-hover/30">
                <tr className="text-flux-text-tertiary text-[11px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 font-medium">Nom</th>
                  <th className="text-left px-3 py-2.5 font-medium">Recettes</th>
                  <th className="text-center px-3 py-2.5 font-medium">Jobs / exéc.</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {scenariosLoading && (
                  <tr><td colSpan={4} className="text-center py-6 text-flux-text-muted">Chargement…</td></tr>
                )}
                {!scenariosLoading && scenarios.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-flux-text-muted italic">Aucun scénario. Crée-en un pour orchestrer un ensemble de recettes en un clic.</td></tr>
                )}
                {scenarios.map((s) => (
                  <tr key={s.id} className="border-t border-flux-border hover:bg-flux-hover/30">
                    <td className="px-3 py-2 align-middle">
                      <div className="text-flux-text-primary font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-[11px] text-flux-text-tertiary mt-0.5 max-w-md truncate">{s.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {s.items.length === 0 && <span className="text-flux-text-muted text-xs">— vide —</span>}
                        {s.items.map((it) => {
                          const orphan = it.recipe.baseJobMissing;
                          return (
                            <span
                              key={it.recipeId}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                                orphan
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                  : 'bg-blue-500/10 border-blue-500/30 text-flux-text-secondary'
                              }`}
                            >
                              <span className="font-mono text-blue-400 font-semibold">{it.count}×</span>
                              <span className="truncate max-w-[200px]">{it.recipe.baseJobDescription ?? '— manquant —'}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center align-middle">
                      <span className="font-mono text-flux-text-primary font-semibold">{s.totalJobs}</span>
                    </td>
                    <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                      <button
                        onClick={() => handleExecuteScenario(s.id, s.name)}
                        disabled={execScenarioLoading || s.items.length === 0}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-50 rounded mr-1"
                        title="Exécuter"
                      >
                        <Play className="w-3 h-3" strokeWidth={2.5} /> Exécuter
                      </button>
                      <button
                        onClick={() => setEditingScenario(s)}
                        className="p-1 text-flux-text-tertiary hover:text-flux-text-primary"
                        title="Éditer"
                      >
                        <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => handleDuplicateScenario(s.id)}
                        className="p-1 text-flux-text-tertiary hover:text-flux-text-primary"
                        title="Dupliquer"
                      >
                        <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ kind: 'scenario', id: s.id, label: s.name })}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* RECIPES SECTION */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-flux-text-primary text-sm font-semibold uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-blue-400" strokeWidth={2} />
              Recettes
              <span className="text-flux-text-tertiary text-[11px] normal-case font-normal tracking-normal">
                ({recipes.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCreatingRecipe(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nouvelle recette
            </button>
          </div>
          <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-flux-hover/30">
                <tr className="text-flux-text-tertiary text-[11px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 font-medium">Job de base</th>
                  <th className="text-right px-3 py-2.5 font-medium">Quantité</th>
                  <th className="text-left px-3 py-2.5 font-medium">Délai départ</th>
                  <th className="text-left px-3 py-2.5 font-medium">BAT</th>
                  <th className="text-left px-3 py-2.5 font-medium">Importance</th>
                  <th className="text-center px-3 py-2.5 font-medium">Roule</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {recipesLoading && (
                  <tr><td colSpan={7} className="text-center py-6 text-flux-text-muted">Chargement…</td></tr>
                )}
                {!recipesLoading && recipes.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-flux-text-muted italic">Aucune recette. Crée-en une pour générer des jobs de test en un clic.</td></tr>
                )}
                {recipes.map((r) => {
                  const baseQty = r.baseJobQuantity ?? 1;
                  const newQty = r.quantity ?? baseQty;
                  const ratio = baseQty > 0 ? newQty / baseQty : 1;
                  return (
                    <tr key={r.id} className="border-t border-flux-border hover:bg-flux-hover/30">
                      <td className="px-3 py-2 align-middle">
                        <div className="text-flux-text-primary font-medium">{r.baseJobDescription ?? <span className="text-amber-400">— job de base manquant —</span>}</div>
                        <div className="text-[11px] text-flux-text-tertiary font-mono mt-0.5">
                          {r.baseJobReference ?? r.baseJobId.slice(0, 8)} · {r.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        {r.quantity != null ? (
                          <span className="font-mono">{fmtQty(r.quantity)}</span>
                        ) : (
                          <span className="font-mono text-flux-text-muted">{fmtQty(r.baseJobQuantity)} <span className="text-[10px]">(base)</span></span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {r.workshopExitDate ? (
                          <span className="font-mono text-xs">{r.workshopExitDate.replace('T', ' ').slice(0, 16)}</span>
                        ) : r.deadlineRelativeWorkingDays != null ? (
                          <span className="font-mono">J+{r.deadlineRelativeWorkingDays}</span>
                        ) : (
                          <span className="text-flux-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {r.batDeadline ? (
                          <span className="font-mono text-xs">{r.batDeadline.replace('T', ' ').slice(0, 16)}</span>
                        ) : (
                          <span className="text-flux-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${PRIORITY_COLORS[r.deadlinePriority] ?? PRIORITY_COLORS[2]}`}>
                          {PRIORITY_LABELS[r.deadlinePriority] ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono border ${
                          Math.abs(ratio - 1) < 0.001 ? 'border-flux-border-light text-flux-text-tertiary' : 'border-blue-500/40 text-blue-400 font-semibold'
                        }`}>
                          ×{ratio.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                        <button
                          onClick={() => handleGenerateRecipe(r.id)}
                          disabled={genRecipeLoading || r.baseJobMissing}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-50 rounded mr-1"
                          title={r.baseJobMissing ? 'Job de base manquant' : 'Générer'}
                        >
                          <Play className="w-3 h-3" strokeWidth={2.5} /> Générer
                        </button>
                        <button
                          onClick={() => setEditingRecipe(r)}
                          className="p-1 text-flux-text-tertiary hover:text-flux-text-primary"
                          title="Éditer"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ kind: 'recipe', id: r.id, label: r.baseJobDescription ?? r.id })}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Recipe editor */}
      {creatingRecipe && (
        <JobTestRecipeEditor
          initial={null}
          baseJobs={baseJobs}
          onClose={() => setCreatingRecipe(false)}
          onSaved={(msg) => showToast('ok', msg)}
        />
      )}
      {editingRecipe && (
        <JobTestRecipeEditor
          initial={editingRecipe}
          baseJobs={baseJobs}
          onClose={() => setEditingRecipe(null)}
          onSaved={(msg) => showToast('ok', msg)}
        />
      )}

      {/* Scenario editor */}
      {creatingScenario && (
        <JobTestScenarioEditor
          initial={null}
          recipes={recipes}
          onClose={() => setCreatingScenario(false)}
          onSaved={(msg) => showToast('ok', msg)}
          onExecuted={(msg) => showToast('ok', msg)}
        />
      )}
      {editingScenario && (
        <JobTestScenarioEditor
          initial={editingScenario}
          recipes={recipes}
          onClose={() => setEditingScenario(null)}
          onSaved={(msg) => showToast('ok', msg)}
          onExecuted={(msg) => showToast('ok', msg)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(null)}>
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-flux-text-primary font-medium mb-2">
              <Trash2 className="w-4 h-4 text-red-400" strokeWidth={2} />
              Supprimer {confirmDelete.kind === 'recipe' ? 'la recette' : 'le scénario'} ?
            </div>
            <p className="text-sm text-flux-text-secondary mb-4">
              <span className="font-medium text-flux-text-primary">{confirmDelete.label}</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAZ modal */}
      {showRaz && (
        <RazModal
          onCancel={() => setShowRaz(false)}
          onConfirm={handleConfirmWipe}
          isWiping={wipeLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[200] px-3.5 py-2.5 rounded-md shadow-2xl text-sm flex items-start gap-2 max-w-md ${
            toast.kind === 'ok'
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
              : toast.kind === 'warn'
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                : 'bg-red-500/15 border border-red-500/40 text-red-300'
          }`}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
          )}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-auto p-0.5 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

interface RazModalProps {
  onCancel: () => void;
  onConfirm: () => void;
  isWiping: boolean;
}

function RazModal({ onCancel, onConfirm, isWiping }: RazModalProps) {
  const wipedTables = [
    'Jobs (et commentaires)',
    'Éléments + element_walls',
    'Tâches + assignations + completions',
    'Saisies (productivity_ratio, last_saisie_at, recordedProgressPct…)',
    'Setup completions (calages historiques)',
    'Modifications JCF',
    'Notes & audits logistiques',
    'Overrides safety zone',
    'console_audit_log',
  ];
  const keptTables = [
    'Stations, opérateurs, catégories, groupes',
    'Clients, référents, transporteurs',
    'Formats, presets, délais papier/forme',
    'Schedules (version+1 pour invalider caches)',
    'Scénarios (forks technique)',
    'JCF templates',
    'Recettes & scénarios de test',
    'Users, settings, configs',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg w-full max-w-xl mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-flux-border bg-flux-hover/30">
          <div className="flex items-center gap-2 text-flux-text-primary font-medium">
            <Trash2 className="w-4 h-4 text-red-400" strokeWidth={2} />
            Vider les données de test
          </div>
          <button onClick={onCancel} className="p-1 rounded text-flux-text-tertiary hover:text-flux-text-primary hover:bg-flux-hover" aria-label="Fermer">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        <div className="p-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded p-2.5 text-xs text-red-300 flex items-start gap-2 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
            <span>
              <b className="text-red-200">Action irréversible.</b> Tous les jobs et leur historique
              (avancements, calages, BAT, modifications…) seront supprimés. Recettes et scénarios
              sont préservés.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1.5 flex items-center gap-1">
                <X className="w-3 h-3" strokeWidth={2.5} /> Sera supprimé
              </div>
              <ul className="space-y-1 text-flux-text-secondary">
                {wipedTables.map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} /> Sera préservé
              </div>
              <ul className="space-y-1 text-flux-text-secondary">
                {keptTables.map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-flux-border bg-flux-hover/30">
          <button
            onClick={onCancel}
            disabled={isWiping}
            className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isWiping}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            {isWiping ? 'Suppression…' : 'Vider la base'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string; details?: string[] } };
  return e?.data?.message ?? e?.data?.details?.join(', ') ?? fallback;
}
