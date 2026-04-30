/**
 * Sim mutation editor — list current mutations + a small form to
 * append a new one. Each mutation kind shows its required value field;
 * `cancel_job` only takes a job; the date/priority kinds add an extra
 * input. Removal is one-click X.
 *
 * The job picker reads from the sim's frozen `payload.jobs` so the
 * chef sees the snapshot's job set, not a fresh preprod query (which
 * would miss the point: mutations target the sim's worldview).
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Ban, Calendar, Flag } from 'lucide-react';
import {
  useAppendMutationMutation,
  useRemoveMutationMutation,
} from '../../store';
import type { SimulationMutation, SimulationMutationKind } from '../../store/api/simulationApi';

interface JobOption {
  id: string;
  reference: string;
  description: string;
}

interface MutationEditorProps {
  simulationId: string;
  mutations: SimulationMutation[];
  jobs: JobOption[];
}

const KIND_LABEL: Record<SimulationMutationKind, string> = {
  cancel_job: 'Annuler le job',
  change_workshop_exit_date: 'Changer la deadline',
  change_deadline_priority: 'Changer la priorité',
};

const KIND_ICON: Record<SimulationMutationKind, React.ComponentType<{ size?: number; className?: string }>> = {
  cancel_job: Ban,
  change_workshop_exit_date: Calendar,
  change_deadline_priority: Flag,
};

function formatMutationValue(m: SimulationMutation): string {
  switch (m.type) {
    case 'cancel_job':
      return '—';
    case 'change_workshop_exit_date':
      return m.value
        ? new Date(String(m.value)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '(suppression deadline)';
    case 'change_deadline_priority':
      return `priorité = ${String(m.value)}`;
  }
}

export function MutationEditor({ simulationId, mutations, jobs }: MutationEditorProps) {
  const jobMap = useMemo(() => {
    const map = new Map<string, JobOption>();
    for (const j of jobs) map.set(j.id, j);
    return map;
  }, [jobs]);

  const [showAdd, setShowAdd] = useState(false);
  const [kind, setKind] = useState<SimulationMutationKind>('change_workshop_exit_date');
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? '');
  const [dateValue, setDateValue] = useState<string>('');
  const [priorityValue, setPriorityValue] = useState<number>(2);

  const [append, appendState] = useAppendMutationMutation();
  const [remove] = useRemoveMutationMutation();

  const handleAdd = async () => {
    if (!jobId) return;
    const mutation: SimulationMutation = (() => {
      if (kind === 'cancel_job') return { type: 'cancel_job', jobId };
      if (kind === 'change_workshop_exit_date') {
        return {
          type: 'change_workshop_exit_date',
          jobId,
          value: dateValue ? `${dateValue.replace('T', ' ')}:00` : null,
        };
      }
      return { type: 'change_deadline_priority', jobId, value: priorityValue };
    })();

    try {
      await append({ simulationId, mutation }).unwrap();
      setShowAdd(false);
      setDateValue('');
    } catch {
      // appendState.error displays the message
    }
  };

  const handleRemove = (index: number) => {
    void remove({ simulationId, index });
  };

  return (
    <div className="rounded-md border border-zinc-800 overflow-hidden">
      <header className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Mutations à appliquer ({mutations.length})
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            if (!jobId) setJobId(jobs[0]?.id ?? '');
          }}
          disabled={jobs.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
          data-testid="mutation-add-trigger"
        >
          <Plus size={10} />
          Ajouter
        </button>
      </header>

      {showAdd && (
        <div className="p-3 bg-violet-950/10 border-b border-zinc-800 space-y-2">
          <label className="block">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SimulationMutationKind)}
              className="mt-1 w-full px-2 py-1.5 rounded text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
            >
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Job</span>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
              data-testid="mutation-job-picker"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.reference} — {j.description.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          {kind === 'change_workshop_exit_date' && (
            <label className="block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nouvelle deadline</span>
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Vide = supprimer la deadline</span>
            </label>
          )}
          {kind === 'change_deadline_priority' && (
            <label className="block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nouvelle priorité (0 = max, 3 = min)</span>
              <input
                type="number"
                min={0}
                max={3}
                value={priorityValue}
                onChange={(e) => setPriorityValue(Number.parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-32 px-2 py-1.5 rounded text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500"
              />
            </label>
          )}
          {appendState.error && (
            <div className="text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={11} />
              Échec de l'ajout (l'API a refusé la mutation).
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-2.5 py-1 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!jobId || appendState.isLoading}
              className="px-2.5 py-1 rounded text-[11px] bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {mutations.length === 0 && !showAdd && (
        <div className="p-4 text-center text-[11px] text-zinc-500">
          Aucune mutation. Ajoute des changements à appliquer à la préprod
          au moment de la conversion.
        </div>
      )}

      {mutations.length > 0 && (
        <ul className="divide-y divide-zinc-900">
          {mutations.map((m, idx) => {
            const Icon = KIND_ICON[m.type];
            const job = jobMap.get(m.jobId);
            return (
              <li
                key={`${m.type}-${m.jobId}-${idx}`}
                className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-zinc-900/50"
                data-testid={`mutation-row-${idx}`}
              >
                <Icon size={12} className="text-violet-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-200 truncate">
                    <span className="font-mono text-zinc-400">{job?.reference ?? m.jobId.slice(0, 8)}</span>
                    {job?.description && (
                      <span className="text-zinc-500"> — {job.description.slice(0, 60)}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {KIND_LABEL[m.type]} · {formatMutationValue(m)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="px-1.5 py-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40"
                  aria-label="Retirer la mutation"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
