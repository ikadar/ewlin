/**
 * PaperLeadTimePage — admin UI for the global Paper Lead Time rule.
 *
 * Three parameters define a per-element supplier promise (cf. PaperGateService):
 *   - cutoffHour        — latest hour to commande for same-day processing
 *   - offsetWorkingDays — working-day offset between processing and delivery
 *   - arrivalHour       — guaranteed delivery hour on the delivery day
 *
 * Accessible at /settings/paper-lead-time. Triggers Snapshot invalidation so
 * the next compute applies the new rule.
 */

import { useEffect, useState } from 'react';
import { Truck, Check } from 'lucide-react';
import { useGetPaperLeadTimeQuery, useUpdatePaperLeadTimeMutation } from '../store';

const NUM_INPUT_CLASS =
  'w-16 px-2 py-1 text-right bg-flux-base border border-flux-border-light rounded ' +
  'text-base font-mono tabular-nums font-semibold text-flux-text-primary outline-none ' +
  'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ' +
  '[&::-webkit-outer-spin-button]:appearance-none';

interface Draft {
  cutoffHour: number;
  arrivalHour: number;
  offsetWorkingDays: number;
}

const DEFAULT_DRAFT: Draft = { cutoffHour: 11, arrivalHour: 10, offsetWorkingDays: 1 };

function inRange(value: number, lo: number, hi: number): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function validate(d: Draft): { ok: boolean; message: string | null } {
  if (!inRange(d.cutoffHour, 0, 23)) {
    return { ok: false, message: "L'heure limite de commande doit être entre 0 et 23." };
  }
  if (!inRange(d.arrivalHour, 0, 23)) {
    return { ok: false, message: "L'heure de livraison maximale doit être entre 0 et 23." };
  }
  if (!inRange(d.offsetWorkingDays, 0, 30)) {
    return { ok: false, message: 'Le délai de livraison doit être entre 0 et 30 jours ouvrés.' };
  }
  return { ok: true, message: null };
}

export function PaperLeadTimePage() {
  const { data: config, isLoading } = useGetPaperLeadTimeQuery();
  const [updatePaperLeadTime, { isLoading: isSaving }] = useUpdatePaperLeadTimeMutation();

  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [savedAck, setSavedAck] = useState(false);

  useEffect(() => {
    if (config) {
      setDraft({
        cutoffHour: config.cutoffHour,
        arrivalHour: config.arrivalHour,
        offsetWorkingDays: config.offsetWorkingDays,
      });
    }
  }, [config]);

  const validation = validate(draft);
  const dirty = config !== undefined && (
    draft.cutoffHour !== config.cutoffHour
    || draft.arrivalHour !== config.arrivalHour
    || draft.offsetWorkingDays !== config.offsetWorkingDays
  );

  const handleSave = async () => {
    if (!validation.ok) return;
    try {
      await updatePaperLeadTime(draft).unwrap();
      setSavedAck(true);
      setTimeout(() => setSavedAck(false), 1800);
    } catch (err) {
      console.error('Failed to update paper lead time', err);
    }
  };

  const handleField = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) }));
  };

  const offsetLabel = draft.offsetWorkingDays === 0 ? 'le jour même' : `J+${draft.offsetWorkingDays} ouvré`;
  const cutoffStr = draft.cutoffHour.toString().padStart(2, '0');
  const arrivalStr = draft.arrivalHour.toString().padStart(2, '0');

  return (
    <div className="flex-1 overflow-auto bg-flux-base">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-flux-text-primary">
            Délai d'approvisionnement papier
          </h1>
        </div>
        <p className="text-sm text-flux-text-tertiary mb-8 leading-relaxed">
          Règle utilisée par le moteur pour gater les éléments dont le papier
          n'est pas encore disponible (statuts <em>à commander</em> ou
          <em> commandé</em>). Le démarrage est repoussé à la première date à
          laquelle le fournisseur garantit la livraison du papier, en heures
          ouvrées.
        </p>

        {isLoading ? (
          <div className="text-sm text-flux-text-muted">Chargement…</div>
        ) : (
          <div className="bg-flux-surface border border-flux-border rounded-lg p-6">
            <div className="flex items-baseline justify-between py-3">
              <label htmlFor="paper-cutoff" className="text-sm text-flux-text-secondary">
                Heure limite de commande J
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  id="paper-cutoff"
                  className={NUM_INPUT_CLASS}
                  type="number"
                  min={0}
                  max={23}
                  value={draft.cutoffHour}
                  onChange={handleField('cutoffHour')}
                />
                <span className="font-mono text-sm text-flux-text-tertiary">h</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between py-3 border-t border-flux-border">
              <label htmlFor="paper-offset" className="text-sm text-flux-text-secondary">
                Délai de livraison
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  id="paper-offset"
                  className={NUM_INPUT_CLASS}
                  type="number"
                  min={0}
                  max={30}
                  value={draft.offsetWorkingDays}
                  onChange={handleField('offsetWorkingDays')}
                />
                <span className="font-mono text-sm text-flux-text-tertiary">jour&nbsp;ouvré</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between py-3 border-t border-flux-border">
              <label htmlFor="paper-arrival" className="text-sm text-flux-text-secondary">
                Heure de livraison maximale
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  id="paper-arrival"
                  className={NUM_INPUT_CLASS}
                  type="number"
                  min={0}
                  max={23}
                  value={draft.arrivalHour}
                  onChange={handleField('arrivalHour')}
                />
                <span className="font-mono text-sm text-flux-text-tertiary">h</span>
              </div>
            </div>

            {!validation.ok && validation.message && (
              <div className="mt-3 text-xs text-red-400">{validation.message}</div>
            )}

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
                  disabled={!dirty || !validation.ok || isSaving}
                  className="px-4 py-1.5 rounded-md text-sm font-medium bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-5 text-sm text-flux-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Comment se lit la règle&nbsp;?
            </h2>
            <p>
              Si la commande est passée avant{' '}
              <strong className="text-flux-text-primary">{cutoffStr}h00</strong> le
              jour&nbsp;J, le papier est livré{' '}
              <strong className="text-flux-text-primary">{offsetLabel}</strong> au
              plus tard à{' '}
              <strong className="text-flux-text-primary">{arrivalStr}h00</strong>.
            </p>
            <p className="mt-2 text-flux-text-tertiary">
              Si la commande arrive <em>après</em> l'heure limite, elle est
              considérée comme passée le jour ouvré suivant&nbsp;: la livraison
              se cale alors automatiquement sur ce nouveau jour de référence,
              sans paramètre supplémentaire.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              À quoi ça sert&nbsp;?
            </h2>
            <p>
              Le moteur de planification ne peut pas démarrer un élément tant
              que son papier n'est pas physiquement présent. Cette règle traduit
              la promesse du fournisseur en une <strong>date plancher</strong> par
              élément&nbsp;: la référence prise en compte est la date de commande
              si le statut est <em>commandé</em>, ou maintenant si le statut est{' '}
              <em>à commander</em>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Comment choisir les valeurs&nbsp;?
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong>Heure limite de commande J</strong>&nbsp;— l'horaire au-delà
                duquel le fournisseur traite la commande le lendemain seulement.
                Demande au commercial fournisseur (souvent 11h ou 12h).
              </li>
              <li>
                <strong>Délai de livraison</strong>&nbsp;— combien de jours ouvrés
                après le jour de traitement le papier arrive. <em>1</em> = J+1
                ouvré (le lendemain). Augmente si le fournisseur est lointain ou
                que le papier est spécifique.
              </li>
              <li>
                <strong>Heure de livraison maximale</strong>&nbsp;— l'heure tardive
                à laquelle on est sûr d'avoir le papier le jour de livraison.
                Sert de plancher horaire — le moteur n'engage pas l'élément avant
                cet instant ce jour-là.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Quand prend effet la modification&nbsp;?
            </h2>
            <p>
              Au prochain recompute (manuel via Ctrl+Alt+P ou automatique après
              une action console). Les plannings sauvegardés ne sont pas
              réécrits&nbsp;; seul le prochain calcul applique la nouvelle règle.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
