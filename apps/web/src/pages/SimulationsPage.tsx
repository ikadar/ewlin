/**
 * Simulations page — Phase 6 forks browser.
 *
 * V1 simulations are read-only Preprod snapshots with a TTL. The chef
 * forks them via the "Forker préprod" button (one click → name modal),
 * inspects the snapshot in the table (TTL countdown + KPI from
 * `payload.jobs.length`), or deletes them when no longer needed. The
 * reaper command auto-deletes once the TTL elapses.
 *
 * Mutation (sandboxed JCF in a sim) is deferred — the schema fields
 * are in place (lastTouchedAt, parentScenarioId), the surface stays
 * narrow.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Plus, Trash2, Clock, AlertTriangle } from 'lucide-react';
import {
  useGetSimulationsQuery,
  useForkSimulationMutation,
  useDeleteSimulationMutation,
} from '../store';
import type { SimulationSummary } from '../store/api/simulationApi';
import { ForkSimulationDialog } from '../components/SimulationBrowser/ForkSimulationDialog';

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function describeTtl(iso: string | null): { label: string; expired: boolean } {
  if (!iso) return { label: 'Pas de TTL', expired: false };
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining <= 0) return { label: 'Expirée', expired: true };
  const hours = Math.floor(remaining / 3_600_000);
  if (hours < 1) {
    const minutes = Math.floor(remaining / 60_000);
    return { label: `${minutes} min`, expired: false };
  }
  if (hours < 24) return { label: `${hours} h`, expired: false };
  const days = Math.floor(hours / 24);
  return { label: `${days} j`, expired: false };
}

function SimRow({
  sim,
  onDelete,
}: {
  sim: SimulationSummary;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const ttl = describeTtl(sim.ttlExpiresAt);
  return (
    <tr className="hover:bg-zinc-900/40" data-testid={`simulation-row-${sim.id}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-violet-300 shrink-0" />
          <button
            type="button"
            onClick={() => navigate(`/simulations/${sim.id}`)}
            className="text-zinc-100 hover:text-violet-300 text-left"
          >
            {sim.name ?? '(sans nom)'}
          </button>
          {sim.mutationCount > 0 && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-600/20 border border-violet-600/40 text-violet-300"
              title={`${sim.mutationCount} mutations en attente`}
            >
              Δ {sim.mutationCount}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-zinc-400">{formatStamp(sim.createdAt)}</td>
      <td className="px-4 py-2.5 text-zinc-400">{formatStamp(sim.lastTouchedAt)}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            ttl.expired
              ? 'bg-rose-600/15 border border-rose-600/30 text-rose-300'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
          }`}
        >
          {ttl.expired ? <AlertTriangle size={10} /> : <Clock size={10} />}
          {ttl.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          type="button"
          onClick={() => onDelete(sim.id)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-zinc-900 hover:bg-rose-950/50 hover:text-rose-300 border border-zinc-800 text-zinc-400"
          aria-label={`Supprimer ${sim.name ?? 'simulation'}`}
        >
          <Trash2 size={11} />
          Supprimer
        </button>
      </td>
    </tr>
  );
}

export function SimulationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetSimulationsQuery();
  const [forkOpen, setForkOpen] = useState(false);
  const [forkSimulation] = useForkSimulationMutation();
  const [deleteSimulation] = useDeleteSimulationMutation();

  const handleFork = useCallback(
    async (name: string) => {
      try {
        await forkSimulation({ name }).unwrap();
        setForkOpen(false);
      } catch {
        // RTK error already exposed; the dialog displays it
      }
    },
    [forkSimulation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const sim = data?.simulations.find((s) => s.id === id);
      if (!sim) return;
      const ok = window.confirm(`Supprimer la simulation "${sim.name ?? id}" ?`);
      if (!ok) return;
      await deleteSimulation(id);
    },
    [data?.simulations, deleteSimulation],
  );

  return (
    <div className="flex flex-col h-full bg-flux-bg text-flux-text-primary">
      <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <FlaskConical size={16} className="text-violet-300" />
          <div>
            <div className="text-sm font-medium">Simulations</div>
            <div className="text-[11px] text-zinc-500">
              Forks figés de la préprod pour ADV / what-if. Auto-supprimées au TTL.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForkOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-violet-600 hover:bg-violet-500 text-white"
          data-testid="simulation-fork-trigger"
        >
          <Plus size={13} />
          Forker préprod
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-6 text-xs text-zinc-500">Chargement…</div>}
        {error && (
          <div className="p-6 text-xs text-rose-300">
            Impossible de charger les simulations.
          </div>
        )}
        {data && data.simulations.length === 0 && (
          <div className="p-12 text-center text-xs text-zinc-500">
            <FlaskConical size={20} className="mx-auto mb-2 text-zinc-600" />
            <div className="font-medium text-zinc-400 mb-1">Aucune simulation</div>
            <div>Forke la préprod pour tester un scénario sans impacter le plan vivant.</div>
          </div>
        )}
        {data && data.simulations.length > 0 && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
              <tr className="text-[10px] text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2 text-left font-medium">Nom</th>
                <th className="px-4 py-2 text-left font-medium">Forkée le</th>
                <th className="px-4 py-2 text-left font-medium">Dernière vue</th>
                <th className="px-4 py-2 text-left font-medium">Expire dans</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {data.simulations.map((sim) => (
                <SimRow key={sim.id} sim={sim} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ForkSimulationDialog
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        onConfirm={handleFork}
      />
    </div>
  );
}
