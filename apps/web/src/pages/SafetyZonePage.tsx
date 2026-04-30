/**
 * SafetyZonePage — admin UI for the global Safety Zone duration.
 *
 * Accessible at /settings/safety-zone. A slider drives a value in 0→8h,
 * and the change is pushed through PUT /api/v1/safety-zone. The snapshot
 * is invalidated so the Planning re-renders immediately with the new boundary.
 */

import { useEffect, useState } from 'react';
import { Snowflake, Check } from 'lucide-react';
import { useGetSafetyZoneQuery, useUpdateSafetyZoneMutation } from '../store';

const MAX_HOURS = 8;

export function SafetyZonePage() {
  const { data: config, isLoading } = useGetSafetyZoneQuery();
  const [updateSafetyZone, { isLoading: isSaving }] = useUpdateSafetyZoneMutation();

  const [draftHours, setDraftHours] = useState<number>(0);
  const [savedAck, setSavedAck] = useState(false);

  useEffect(() => {
    if (config?.hours !== undefined) {
      setDraftHours(config.hours);
    }
  }, [config?.hours]);

  const handleSave = async () => {
    try {
      await updateSafetyZone({ hours: draftHours }).unwrap();
      setSavedAck(true);
      setTimeout(() => setSavedAck(false), 1800);
    } catch (err) {
      console.error('Failed to update safety zone', err);
    }
  };

  const dirty = config?.hours !== undefined && draftHours !== config.hours;

  return (
    <div className="flex-1 overflow-auto bg-flux-base">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-2">
          <Snowflake className="w-5 h-5 text-sky-400" />
          <h1 className="text-lg font-semibold text-flux-text-primary">Safety Zone</h1>
        </div>
        <p className="text-sm text-flux-text-tertiary mb-8 leading-relaxed">
          Durée (en heures ouvrées depuis maintenant) pendant laquelle les
          cartes déjà planifiées sont figées dans le planning. Au prochain
          recompute, le moteur de scheduling ne pourra pas les déplacer — sauf
          si l'utilisateur active un override manuel (flocon éteint) sur une
          carte spécifique. Valeur à 0 = feature désactivée.
        </p>

        {isLoading ? (
          <div className="text-sm text-flux-text-muted">Chargement…</div>
        ) : (
          <div className="bg-flux-surface border border-flux-border rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-4">
              <label htmlFor="safety-zone-slider" className="text-sm text-flux-text-secondary">
                Durée de la zone
              </label>
              <span className="font-mono text-lg text-sky-400 font-semibold">
                {draftHours} h
              </span>
            </div>

            <input
              id="safety-zone-slider"
              type="range"
              min={0}
              max={MAX_HOURS}
              step={1}
              value={draftHours}
              onChange={(e) => setDraftHours(parseInt(e.target.value, 10))}
              className="w-full accent-sky-400"
            />

            <div className="flex justify-between text-xs text-flux-text-muted mt-2">
              <span>0 h (off)</span>
              <span>2 h</span>
              <span>4 h</span>
              <span>6 h</span>
              <span>{MAX_HOURS} h</span>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-flux-border">
              <div className="text-xs text-flux-text-tertiary">
                {config?.updatedAt && (
                  <>
                    Dernière mise à jour :{' '}
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
                  className="px-4 py-1.5 rounded-md text-sm font-medium bg-sky-500/15 border border-sky-500/40 text-sky-400 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-flux-text-muted leading-relaxed space-y-1">
          <p>
            <span className="text-flux-text-tertiary font-medium">Rappel.</span>{' '}
            La modification prend effet immédiatement. Au prochain recompute,
            les cartes qui sortent de la zone redeviennent mobiles.
          </p>
          <p>
            Valeur par défaut : 4 h. V1 : scope global (toutes stations). Les
            overrides par-tuile (flocon éteint) persistent indépendamment.
          </p>
        </div>
      </div>
    </div>
  );
}
