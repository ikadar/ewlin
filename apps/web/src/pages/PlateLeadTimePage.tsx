/**
 * PlateLeadTimePage — admin UI for the global Plate Lead Time rule.
 *
 * Simpler than paper/forme: a single offsetHours field (0-72).
 * Accessible at /settings/plate-lead-time. Triggers Snapshot invalidation
 * so the next compute applies the new floor.
 */

import { useEffect, useState } from 'react';
import { Layers, Check } from 'lucide-react';
import { useGetPlateLeadTimeQuery, useUpdatePlateLeadTimeMutation } from '../store';

const NUM_INPUT_CLASS =
  'w-16 px-2 py-1 text-right bg-flux-base border border-flux-border-light rounded ' +
  'text-base font-mono tabular-nums font-semibold text-flux-text-primary outline-none ' +
  'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ' +
  '[&::-webkit-outer-spin-button]:appearance-none';

function inRange(value: number, lo: number, hi: number): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

export function PlateLeadTimePage() {
  const { data: config, isLoading } = useGetPlateLeadTimeQuery();
  const [updatePlateLeadTime, { isLoading: isSaving }] = useUpdatePlateLeadTimeMutation();

  const [offsetHours, setOffsetHours] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setOffsetHours(config.offsetHours);
    }
  }, [config]);

  const isValid = inRange(offsetHours, 0, 72);
  const isDirty = config ? offsetHours !== config.offsetHours : false;

  const handleSave = async () => {
    if (!isValid || !isDirty || isSaving) return;
    await updatePlateLeadTime({ offsetHours });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-flux-text-tertiary">
        Chargement...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <Layers size={22} className="text-flux-text-tertiary" />
          <h1 className="text-lg font-semibold text-flux-text-primary">
            Délai plaques (CTP/CTF)
          </h1>
        </div>

        <div className="bg-flux-surface border border-flux-border rounded-lg p-5 mb-4">
          <p className="text-sm text-flux-text-secondary mb-4">
            Quand un élément a le statut plaques = &laquo;&thinsp;A faire&thinsp;&raquo;,
            l&apos;algo ne le schedule pas avant <strong>maintenant + N heures</strong>.
            Cela laisse le temps de produire les plaques avant le démarrage du job.
          </p>

          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm text-flux-text-secondary w-48">
              Offset (heures)
            </label>
            <input
              type="number"
              min={0}
              max={72}
              value={offsetHours}
              onChange={(e) => setOffsetHours(parseInt(e.target.value, 10) || 0)}
              className={NUM_INPUT_CLASS}
            />
            <span className="text-xs text-flux-text-tertiary">0–72</span>
          </div>

          {!isValid && (
            <p className="text-xs text-red-400 mt-2">
              La valeur doit être entre 0 et 72.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!isDirty || !isValid || isSaving}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              isDirty && isValid && !isSaving
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                : 'bg-flux-surface border border-flux-border text-flux-text-tertiary cursor-not-allowed'
            }`}
          >
            Enregistrer
          </button>

          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <Check size={14} />
              Enregistré
            </span>
          )}

          {config?.updatedAt && (
            <span className="text-xs text-flux-text-tertiary ml-auto">
              Modifié le{' '}
              {new Date(config.updatedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
