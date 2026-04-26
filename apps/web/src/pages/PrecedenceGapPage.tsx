/**
 * PrecedenceGapPage — admin UI for the global Precedence Gap setting.
 *
 * Accessible at /settings/precedence-gap. A slider drives a value in
 * 0–12 ticks (= 0–60 min at the standard 5-min granularity), and the
 * change is pushed through PUT /api/v1/precedence-gap. Triggers Snapshot
 * invalidation so the next compute applies the new gap.
 */

import { useEffect, useState } from 'react';
import { Clock, Check } from 'lucide-react';
import { useGetPrecedenceGapQuery, useUpdatePrecedenceGapMutation } from '../store';

const MAX_GAP_TICKS = 12;
// The engine's standard tick granularity (matches the smallest station
// tickMinutes in the workshop — 5 min for the massicot, propagated to
// the whole grid). Used here only for display: ticks → minutes.
const TICK_MINUTES = 5;

export function PrecedenceGapPage() {
  const { data: config, isLoading } = useGetPrecedenceGapQuery();
  const [updatePrecedenceGap, { isLoading: isSaving }] = useUpdatePrecedenceGapMutation();

  const [draftGapTicks, setDraftGapTicks] = useState<number>(1);
  const [savedAck, setSavedAck] = useState(false);

  useEffect(() => {
    if (config?.gapTicks !== undefined) {
      setDraftGapTicks(config.gapTicks);
    }
  }, [config?.gapTicks]);

  const handleSave = async () => {
    try {
      await updatePrecedenceGap({ gapTicks: draftGapTicks }).unwrap();
      setSavedAck(true);
      setTimeout(() => setSavedAck(false), 1800);
    } catch (err) {
      console.error('Failed to update precedence gap', err);
    }
  };

  const dirty = config?.gapTicks !== undefined && draftGapTicks !== config.gapTicks;
  const draftMinutes = draftGapTicks * TICK_MINUTES;

  return (
    <div className="flex-1 overflow-auto bg-flux-base">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-flux-text-primary">
            Écart minimal de précédence
          </h1>
        </div>
        <p className="text-sm text-flux-text-tertiary mb-4 leading-relaxed">
          Nombre minimal de <em>ticks moteur</em> (5&nbsp;min chacun) imposé entre
          la <strong>fin</strong> d'une tâche prédécesseur et le <strong>début</strong>{' '}
          de la tâche suivante. Le moteur applique cet écart à chaque relation de
          précédence (tâches d'un même élément, éléments d'un même job, jobs liés)
          sauf entre <em>chunks d'une même tâche</em> qui restent contigus par
          conception.
        </p>

        {isLoading ? (
          <div className="text-sm text-flux-text-muted">Chargement…</div>
        ) : (
          <div className="bg-flux-surface border border-flux-border rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-4">
              <label htmlFor="precedence-gap-slider" className="text-sm text-flux-text-secondary">
                Écart minimal
              </label>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-lg text-amber-400 font-semibold">
                  {draftGapTicks} tick{draftGapTicks !== 1 ? 's' : ''}
                </span>
                <span className="font-mono text-sm text-flux-text-tertiary">
                  ({draftMinutes} min)
                </span>
              </div>
            </div>

            <input
              id="precedence-gap-slider"
              type="range"
              min={0}
              max={MAX_GAP_TICKS}
              step={1}
              value={draftGapTicks}
              onChange={(e) => setDraftGapTicks(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400"
            />

            <div className="flex justify-between text-xs text-flux-text-muted mt-2">
              <span>0 (off)</span>
              <span>1 (5 min)</span>
              <span>6 (30 min)</span>
              <span>{MAX_GAP_TICKS} ({MAX_GAP_TICKS * TICK_MINUTES} min)</span>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-flux-border">
              <div className="text-xs text-flux-text-tertiary">
                {config?.updatedAt && (
                  <>
                    Dernière mise à jour&nbsp;:{' '}
                    <span className="font-mono">
                      {new Date(config.updatedAt).toLocaleString('fr-FR')}
                    </span>
                  </>
                )}
              </div>

              <div className="flex gap-2 items-center">
                {savedAck && (
                  <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Enregistré
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || isSaving}
                  className="px-4 py-1.5 rounded-md text-sm font-medium bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Long-form explanation ===================================== */}
        <div className="mt-8 space-y-5 text-sm text-flux-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              À quoi ça sert&nbsp;?
            </h2>
            <p>
              Le moteur de planification raisonne en <em>ticks</em> demi-ouverts&nbsp;:
              une tâche qui occupe les ticks <code className="px-1 bg-flux-base rounded">[5, 10)</code>{' '}
              se termine techniquement <em>à</em> 10:00 sans inclure cet instant, et
              une tâche suivante peut <em>légalement</em> commencer au tick&nbsp;10.
              Sur le papier c'est cohérent — il n'y a pas de chevauchement de tick.
              Mais visuellement, et pour tout consommateur qui raisonne en
              intervalles fermés (l'UI, les rapports, l'œil humain), ça donne deux
              tuiles qui se touchent à <strong>10:00:00 pile</strong>, comme si un
              opérateur finissait sur la machine A et démarrait sur la machine B
              dans la même milliseconde.
            </p>
            <p className="mt-2">
              Cet écart minimal force au moins N ticks (donc N×5 minutes) entre la
              fin du prédécesseur et le début du successeur, ce qui élimine le cas
              «&nbsp;tuiles qui s'embrassent&nbsp;» et donne aux opérateurs un
              tampon physique pour transitionner.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Comment choisir la valeur&nbsp;?
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong>0 (off)</strong> — restaure le comportement historique. Les
                tuiles peuvent se toucher à l'instant pile. À utiliser uniquement
                pour des tests de régression ou pour reproduire un planning
                pré-correctif.
              </li>
              <li>
                <strong>1 tick (5 min)</strong> — valeur par défaut. Élimine le
                «&nbsp;kissing boundary&nbsp;» avec un coût minimal sur le makespan.
                Recommandé pour la production.
              </li>
              <li>
                <strong>2–4 ticks (10–20 min)</strong> — pour des ateliers où les
                opérateurs ont besoin de quelques minutes pour se déplacer
                physiquement entre stations distantes, ou pour absorber des
                imprévus de fin de tâche (essuyage, nettoyage rapide).
              </li>
              <li>
                <strong>5 ticks et plus</strong> — uniquement si chaque
                changement de poste implique une procédure significative
                (lavage approfondi, validation BAT&hellip;). Augmente
                proportionnellement le makespan global.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Limites importantes
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                S'applique <strong>uniformément</strong> à toutes les transitions de
                précédence, indépendamment de la station de départ et d'arrivée. Si
                certaines transitions sont rapides (deux machines à côté) et
                d'autres longues (changement d'étage), c'est la valeur la plus
                contraignante qui s'impose.
              </li>
              <li>
                <strong>N'affecte pas</strong> les chunks d'une même tâche
                (découpage interne du moteur)&nbsp;: ces transitions doivent rester
                contiguës et ne suivent pas ce paramètre.
              </li>
              <li>
                Augmenter cette valeur peut décaler des tuiles vers la droite et
                augmenter le nombre de jobs en retard. Vérifie l'impact sur le
                makespan après chaque modification significative.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Quand prend effet la modification&nbsp;?
            </h2>
            <p>
              Au prochain recompute (manuel via Ctrl+Alt+P ou automatique après une
              action console). Les plannings sauvegardés ne sont pas réécrits&nbsp;;
              seul le prochain calcul applique la nouvelle valeur.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
