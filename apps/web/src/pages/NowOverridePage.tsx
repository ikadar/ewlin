/**
 * NowOverridePage — admin UI for the global virtual-clock override.
 *
 * Test-environment feature. When enabled, every PHP service that
 * injects `ClockService` and the Rust scheduling engine treat
 * `wallNow + offsetSeconds` as "now". The offset is captured once
 * (`virtualNow - wallNow`) and the virtual clock advances at wall
 * speed — no tick infrastructure required.
 *
 * Three actions:
 *   - Set : PUT { virtualNow, enabled = true }, captures the offset
 *           against the wall clock at submit time.
 *   - Disable : PUT { virtualNow = current setVirtualNow, enabled = false }
 *           keeps the value for audit but reverts the system to the
 *           wall clock.
 *   - Align : PUT { virtualNow = wall now, enabled = false }, zero
 *           offset, override off — explicit "back to reality" button.
 */

import { useEffect, useMemo, useState } from 'react';
import { Clock, Check, AlertTriangle } from 'lucide-react';
import { useGetNowOverrideQuery, useUpdateNowOverrideMutation } from '../store';

const DT_INPUT_CLASS =
  'px-2 py-1 bg-flux-base border border-flux-border-light rounded ' +
  'text-base font-mono tabular-nums text-flux-text-primary outline-none ' +
  'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors';

function toLocalInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): Date {
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" in *local*
  // wall-time. new Date() parses that as local — perfect.
  return new Date(s);
}

function formatOffset(seconds: number): string {
  if (seconds === 0) return 'aligné sur le wall clock';
  const sign = seconds > 0 ? '+' : '−';
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
  return `${sign}${parts.join(' ')}`;
}

export function NowOverridePage() {
  const { data: config, isLoading } = useGetNowOverrideQuery();
  const [updateOverride, { isLoading: isSaving }] = useUpdateNowOverrideMutation();

  const [draftValue, setDraftValue] = useState<string>(() => toLocalInput(new Date()));
  const [savedAck, setSavedAck] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (config?.setVirtualNow) {
      setDraftValue(toLocalInput(new Date(config.setVirtualNow)));
    }
  }, [config?.setVirtualNow]);

  // Live tick of the displayed effectiveNow (1 s) — gives the user a
  // visible "the clock is ticking" feedback so they don't think it's
  // frozen.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const liveEffectiveNow = useMemo(() => {
    void tick; // re-compute every second
    if (!config) return new Date();
    if (!config.enabled) return new Date();
    const captured = new Date(config.effectiveNow).getTime();
    const wallCaptured = new Date(config.wallNow).getTime();
    return new Date(captured + (Date.now() - wallCaptured));
  }, [config, tick]);

  const submit = async (virtualNow: Date, enabled: boolean) => {
    setErrorMsg(null);
    try {
      await updateOverride({ virtualNow: virtualNow.toISOString(), enabled }).unwrap();
      setSavedAck(true);
      setTimeout(() => setSavedAck(false), 1800);
    } catch (err) {
      setErrorMsg(
        (err as { data?: { message?: string } })?.data?.message
          ?? 'Failed to update now-override',
      );
    }
  };

  const handleEnable = () => {
    const d = fromLocalInput(draftValue);
    if (isNaN(d.getTime())) {
      setErrorMsg('Date invalide.');
      return;
    }
    void submit(d, true);
  };

  const handleDisable = () => {
    if (!config) return;
    void submit(new Date(config.setVirtualNow), false);
  };

  const handleAlignToWall = () => {
    void submit(new Date(), false);
  };

  return (
    <div className="flex-1 overflow-auto bg-flux-base">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-flux-text-primary">
            Override de l'horloge (now)
          </h1>
        </div>
        <p className="text-sm text-flux-text-tertiary mb-8 leading-relaxed">
          Force le système (backend PHP, moteur Rust, frontend) à percevoir
          un autre instant comme «&nbsp;maintenant&nbsp;». Une fois posé,
          le temps avance normalement à partir de la valeur choisie&nbsp;:
          c'est un décalage signé, pas un gel. Réservé aux environnements
          de test.
        </p>

        {isLoading ? (
          <div className="text-sm text-flux-text-muted">Chargement…</div>
        ) : (
          <div className="bg-flux-surface border border-flux-border rounded-lg p-6">
            {config?.enabled && (
              <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  Override <strong>actif</strong>&nbsp;: décalage{' '}
                  <span className="font-mono">{formatOffset(config.offsetSeconds)}</span>.
                  Toutes les pages, le moteur et les calculs (retard,
                  «&nbsp;en cours&nbsp;», deadline) utilisent ce temps virtuel.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <div className="text-flux-text-tertiary mb-1">Now du système (virtuel)</div>
                <div className="font-mono text-base text-flux-text-primary tabular-nums">
                  {liveEffectiveNow.toLocaleString('fr-FR')}
                </div>
              </div>
              <div>
                <div className="text-flux-text-tertiary mb-1">Wall clock (réel)</div>
                <div className="font-mono text-base text-flux-text-secondary tabular-nums">
                  {new Date().toLocaleString('fr-FR')}
                </div>
              </div>
            </div>

            <div className="border-t border-flux-border pt-4">
              <label htmlFor="virtual-now" className="block text-sm text-flux-text-secondary mb-2">
                Régler le now virtuel
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="virtual-now"
                  type="datetime-local"
                  className={DT_INPUT_CLASS}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Enregistrement…' : 'Activer / Mettre à jour'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-flux-border">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAlignToWall}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-flux-base border border-flux-border-light text-flux-text-secondary hover:bg-flux-surface hover:text-flux-text-primary disabled:opacity-40 transition-colors"
                  title="Pose virtualNow = wall now et désactive l'override"
                >
                  Aligner sur maintenant
                </button>
                {config?.enabled && (
                  <button
                    type="button"
                    onClick={handleDisable}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-flux-base border border-flux-border-light text-flux-text-secondary hover:bg-flux-surface hover:text-flux-text-primary disabled:opacity-40 transition-colors"
                  >
                    Désactiver l'override
                  </button>
                )}
              </div>
              {savedAck && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Enregistré
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="mt-3 text-xs text-red-400">{errorMsg}</div>
            )}

            <div className="mt-4 pt-3 border-t border-flux-border text-xs text-flux-text-tertiary">
              {config?.updatedAt && (
                <>
                  Dernière mise à jour&nbsp;:{' '}
                  <span className="font-mono">
                    {new Date(config.updatedAt).toLocaleString('fr-FR')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-5 text-sm text-flux-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              À quoi ça sert&nbsp;?
            </h2>
            <p>
              Permet de relancer indéfiniment le même scénario de test sans
              avoir à régénérer les jobs à cause du temps qui passe. Tu
              poses le now souhaité, le système avance à partir de cette
              référence&nbsp;; les calculs de retard, de gates papier/forme,
              de safety zone, de péremption et d'avancement utilisent ce
              temps virtuel. Le wall clock reste accessible pour comparaison.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Comment ça se propage&nbsp;?
            </h2>
            <ul className="space-y-1 list-disc pl-5">
              <li>
                Le backend PHP injecte un{' '}
                <code className="text-flux-text-primary">ClockService</code>{' '}
                qui ajoute l'offset à <code>new \DateTimeImmutable()</code>
                pour les services scheduling-critical (SnapshotBuilder,
                SafetyZone, paper/forme gates).
              </li>
              <li>
                Le moteur Rust reçoit le now virtuel via le champ{' '}
                <code className="text-flux-text-primary">referenceTime</code>{' '}
                du payload <code>/compute*</code>. Toute l'arithmétique
                de ticks part de cette référence.
              </li>
              <li>
                Le frontend lit le live <code>effectiveNow</code> de l'API
                et fournit un <code>useNow()</code> à tous les composants
                qui dépendent du temps qui passe.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-flux-text-primary mb-2">
              Limites
            </h2>
            <ul className="space-y-1 list-disc pl-5">
              <li>
                Les <em>logs serveur</em> et l'instrumentation (timeouts,
                tracing) gardent le wall clock — c'est volontaire pour la
                forensique.
              </li>
              <li>
                Les timestamps déjà écrits (<em>updatedAt</em>,{' '}
                <em>createdAt</em>) en base ne sont pas réécrits&nbsp;:
                cette feature ne corrige pas rétroactivement les écarts
                préexistants.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
