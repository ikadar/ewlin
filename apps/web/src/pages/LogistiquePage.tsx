/**
 * LogistiquePage — /logistique
 *
 * Operational view of the warehouse: incoming reception (sous-traitance returns)
 * and outgoing shipments (sous-traitance dispatch + client expedition).
 *
 * Phase 1.0 scope (validated 2026-04-27):
 *   - Three flows derived from existing data: ST departure, ST return, client expedition
 *   - Each "checkbox" call mutates the existing source-of-truth status:
 *       · ST pending → progress  via PATCH /api/v1/flux/tasks/{id}/status
 *       · ST progress → done     via PATCH /api/v1/flux/tasks/{id}/status
 *       · Job !shipped → shipped via PUT   /api/v1/jobs/{id}
 *   - Anomaly comments live in the new logistics_notes table (logisticsApi).
 *
 * Out of scope in P1: scheduler feedback when a return slips, supplier inbound
 * (paper/plates), per-user audit ("who+when"), printable transport documents.
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRightToLine, ArrowRightFromLine, MessageSquare, Check, Pencil, X, ArrowRight } from 'lucide-react';
import {
  useGetFluxJobsQuery,
  useUpdateSTStatusMutation,
  useToggleJobShippedMutation,
} from '../store/api/fluxApi';
import { useGetProvidersQuery } from '../store/api/providerApi';
import {
  useGetLogisticsNotesQuery,
  useCreateLogisticsNoteMutation,
  useDeleteLogisticsNoteMutation,
} from '../store/api/logisticsApi';
import type { LogisticsNoteResponse, LogisticsRefType } from '../store/api/logisticsApi';
import type { FluxJob, FluxSTStatus } from '../components/FluxTable/fluxTypes';

// ============================================================================
// Movement model — shaped from FluxJob + Provider data
// ============================================================================

type MovementType = 'st' | 'client';
type DateFilter = 'yesterday' | 'today' | 'tomorrow' | 'week';

interface Movement {
  /** Stable key, distinct between departure/arrival of the same task */
  id: string;
  kind: 'arrival' | 'departure';
  type: MovementType;
  /** Backend reference for note attachment */
  refType: LogisticsRefType;
  refId: string;
  /** Display fields */
  time: string;
  title: string;
  subtitle: string;
  counterparty: string;
  jobRef: string;
  /** ST-only: current FluxSTStatus (used to know which transition to fire) */
  stStatus?: FluxSTStatus;
  /** Job internal id for the shipped toggle */
  jobInternalId?: string;
}

// ============================================================================
// Derivation — FluxJob[] + ProviderResponse[] → Movement[]
// ============================================================================

interface ProviderTimes {
  departure: string;
  reception: string;
}

const DEFAULT_TIMES: ProviderTimes = { departure: '14:00', reception: '09:00' };

function lookupProviderTimes(providerName: string, providersByName: Map<string, ProviderTimes>): ProviderTimes {
  return providersByName.get(providerName) ?? DEFAULT_TIMES;
}

function deriveMovements(
  jobs: FluxJob[],
  providersByName: Map<string, ProviderTimes>,
): Movement[] {
  const movements: Movement[] = [];

  for (const job of jobs) {
    const jobLabel = job.designation ? `${job.client} · ${job.designation}` : job.client;

    for (const element of job.elements) {
      for (const out of element.outsourcing) {
        if (out.status === 'done') continue;

        const times = lookupProviderTimes(out.providerName, providersByName);

        if (out.status === 'pending') {
          movements.push({
            id: `task-departure-${out.taskId}`,
            kind: 'departure',
            type: 'st',
            refType: 'task',
            refId: out.taskId,
            time: times.departure,
            title: `Départ ST · ${out.actionType || 'sous-traitance'}`,
            subtitle: `Job #${job.id} — ${jobLabel}`,
            counterparty: out.providerName || '—',
            jobRef: `#${job.id}`,
            stStatus: 'pending',
          });
        } else if (out.status === 'progress') {
          movements.push({
            id: `task-arrival-${out.taskId}`,
            kind: 'arrival',
            type: 'st',
            refType: 'task',
            refId: out.taskId,
            time: times.reception,
            title: `Retour ST · ${out.actionType || 'sous-traitance'}`,
            subtitle: `Job #${job.id} — ${jobLabel}`,
            counterparty: out.providerName || '—',
            jobRef: `#${job.id}`,
            stStatus: 'progress',
          });
        }
      }
    }

    if (!job.parti.shipped && job.internalId !== undefined) {
      movements.push({
        id: `job-shipped-${job.internalId}`,
        kind: 'departure',
        type: 'client',
        refType: 'job',
        refId: job.internalId,
        time: '',
        title: `Expédition client`,
        subtitle: `Job #${job.id} — ${jobLabel}`,
        counterparty: job.client,
        jobRef: `#${job.id}`,
        jobInternalId: job.internalId,
      });
    }
  }

  movements.sort((a, b) => a.time.localeCompare(b.time));
  return movements;
}

// ============================================================================
// Helpers
// ============================================================================

const TYPE_BADGE_CLASS: Record<MovementType, string> = {
  st: 'text-blue-300 bg-blue-500/10',
  client: 'text-amber-300 bg-amber-500/10',
};

const TYPE_BADGE_LABEL: Record<MovementType, string> = {
  st: 'ST',
  client: 'CLIENT',
};

const TYPE_FULL_LABEL: Record<MovementType, string> = {
  st: 'Sous-traitant',
  client: 'Client',
};

// ============================================================================
// Page
// ============================================================================

export function LogistiquePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DateFilter>('today');
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [sheetMovement, setSheetMovement] = useState<Movement | null>(null);

  const { data: jobs = [] } = useGetFluxJobsQuery();
  const { data: providers = [] } = useGetProvidersQuery();
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [toggleJobShipped] = useToggleJobShippedMutation();
  const [createNote] = useCreateLogisticsNoteMutation();
  const [deleteNote] = useDeleteLogisticsNoteMutation();

  const providersByName = useMemo(() => {
    const map = new Map<string, ProviderTimes>();
    for (const p of providers) {
      map.set(p.name, { departure: p.latestDepartureTime, reception: p.receptionTime });
    }
    return map;
  }, [providers]);

  const movements = useMemo(() => deriveMovements(jobs, providersByName), [jobs, providersByName]);

  const arrivals = movements.filter((m) => m.kind === 'arrival');
  const departures = movements.filter((m) => m.kind === 'departure');

  const taskRefIds = movements.filter((m) => m.refType === 'task').map((m) => m.refId);
  const jobRefIds = movements.filter((m) => m.refType === 'job').map((m) => m.refId);

  const { data: taskNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'task', refIds: taskRefIds },
    { skip: taskRefIds.length === 0 },
  );
  const { data: jobNotes = [] } = useGetLogisticsNotesQuery(
    { refType: 'job', refIds: jobRefIds },
    { skip: jobRefIds.length === 0 },
  );

  const notesByRef = useMemo(() => {
    const map = new Map<string, LogisticsNoteResponse>();
    for (const n of [...taskNotes, ...jobNotes]) {
      const key = `${n.refType}:${n.refId}`;
      const existing = map.get(key);
      if (!existing || existing.createdAt < n.createdAt) {
        map.set(key, n);
      }
    }
    return map;
  }, [taskNotes, jobNotes]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(
    async (m: Movement) => {
      if (m.type === 'st' && m.stStatus !== undefined) {
        const next: FluxSTStatus = m.stStatus === 'pending' ? 'progress' : 'done';
        await updateSTStatus({ taskId: m.refId, status: next });
      } else if (m.type === 'client' && m.jobInternalId !== undefined) {
        await toggleJobShipped({ jobInternalId: m.jobInternalId, shipped: true });
      }
    },
    [updateSTStatus, toggleJobShipped],
  );

  const handleSaveNote = useCallback(
    async (m: Movement, content: string) => {
      const trimmed = content.trim();
      if (trimmed === '') return;
      await createNote({ refType: m.refType, refId: m.refId, note: trimmed });
      setOpenCommentId(null);
      setEditingNoteId(null);
      setDraft('');
    },
    [createNote],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
    },
    [deleteNote],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      {/* Header */}
      <header className="border-b border-flux-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            title="Retour (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-flux-text-primary">Logistique</h1>
            <div className="text-flux-text-tertiary text-xs">Réceptions et expéditions de l'atelier</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Toolbar — filters + counters */}
        <div className="flex items-center justify-between gap-6 flex-wrap mb-5">
          <div className="flex gap-1">
            {(['yesterday', 'today', 'tomorrow', 'week'] as DateFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  filter === f
                    ? 'bg-flux-hover border-flux-border-light text-flux-text-primary'
                    : 'border-flux-border text-flux-text-secondary hover:bg-flux-hover hover:text-flux-text-primary'
                }`}
              >
                {f === 'yesterday' ? 'Hier' : f === 'today' ? "Aujourd'hui" : f === 'tomorrow' ? 'Demain' : 'Cette semaine'}
              </button>
            ))}
          </div>

          <div className="flex gap-6 text-sm text-flux-text-tertiary">
            <div>
              <span className="text-flux-text-primary font-semibold mr-1">{arrivals.length}</span>
              arrivées
            </div>
            <div>
              <span className="text-flux-text-primary font-semibold mr-1">{departures.length}</span>
              départs
            </div>
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Column
            title="Arrivées"
            icon={<ArrowRightToLine size={16} className="text-flux-text-tertiary" />}
            count={arrivals.length}
            movements={arrivals}
            notesByRef={notesByRef}
            openCommentId={openCommentId}
            editingNoteId={editingNoteId}
            draft={draft}
            onCheck={handleCheck}
            onToggleComment={(id) => {
              setOpenCommentId((prev) => (prev === id ? null : id));
              setDraft('');
              setEditingNoteId(null);
            }}
            onEditNote={(noteId, content) => {
              setEditingNoteId(noteId);
              setDraft(content);
            }}
            onDraftChange={setDraft}
            onSave={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onOpenSheet={setSheetMovement}
          />
          <Column
            title="Départs"
            icon={<ArrowRightFromLine size={16} className="text-flux-text-tertiary" />}
            count={departures.length}
            movements={departures}
            notesByRef={notesByRef}
            openCommentId={openCommentId}
            editingNoteId={editingNoteId}
            draft={draft}
            onCheck={handleCheck}
            onToggleComment={(id) => {
              setOpenCommentId((prev) => (prev === id ? null : id));
              setDraft('');
              setEditingNoteId(null);
            }}
            onEditNote={(noteId, content) => {
              setEditingNoteId(noteId);
              setDraft(content);
            }}
            onDraftChange={setDraft}
            onSave={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onOpenSheet={setSheetMovement}
          />
        </div>
      </main>

      {/* Side-sheet for movement details */}
      {sheetMovement && (
        <DetailSheet
          movement={sheetMovement}
          note={notesByRef.get(`${sheetMovement.refType}:${sheetMovement.refId}`) ?? null}
          onClose={() => setSheetMovement(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Column
// ============================================================================

interface ColumnProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  movements: Movement[];
  notesByRef: Map<string, LogisticsNoteResponse>;
  openCommentId: string | null;
  editingNoteId: string | null;
  draft: string;
  onCheck: (m: Movement) => void;
  onToggleComment: (id: string) => void;
  onEditNote: (noteId: string, content: string) => void;
  onDraftChange: (v: string) => void;
  onSave: (m: Movement, content: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenSheet: (m: Movement) => void;
}

function Column({
  title,
  icon,
  count,
  movements,
  notesByRef,
  openCommentId,
  editingNoteId,
  draft,
  onCheck,
  onToggleComment,
  onEditNote,
  onDraftChange,
  onSave,
  onDeleteNote,
  onOpenSheet,
}: ColumnProps) {
  return (
    <section>
      <header className="flex items-center justify-between border-b border-flux-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-flux-text-primary font-semibold text-base">{title}</h2>
        </div>
        <div className="text-flux-text-tertiary text-xs">{count} prévues</div>
      </header>

      {movements.length === 0 ? (
        <div className="bg-flux-elevated border border-flux-border rounded-md text-center text-flux-text-muted text-xs italic py-8">
          Aucun mouvement prévu
        </div>
      ) : (
        <div className="bg-flux-elevated border border-flux-border rounded-md overflow-hidden">
          {movements.map((m, idx) => {
            const note = notesByRef.get(`${m.refType}:${m.refId}`);
            const isCommentOpen = openCommentId === m.id;
            const isEditingNote = note !== undefined && editingNoteId === note.id;
            return (
              <div
                key={m.id}
                className={idx < movements.length - 1 ? 'border-b border-flux-border' : ''}
              >
                <MovementRow
                  movement={m}
                  hasNote={note !== undefined}
                  onCheck={onCheck}
                  onToggleComment={onToggleComment}
                  onOpenSheet={onOpenSheet}
                />
                {isCommentOpen && (
                  <div className="px-3.5 pl-[88px] pb-3 pt-1 bg-flux-surface border-t border-dashed border-flux-border">
                    {note && !isEditingNote ? (
                      <div className="flex items-center gap-2 text-flux-text-secondary text-xs bg-flux-hover px-2.5 py-1.5 rounded border-l-2 border-blue-400">
                        <MessageSquare size={12} className="text-blue-400 shrink-0" />
                        <span className="flex-1">{note.note}</span>
                        <button
                          onClick={() => onEditNote(note.id, note.note)}
                          className="p-1 text-flux-text-tertiary hover:text-flux-text-primary"
                          title="Éditer"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="p-1 text-flux-text-tertiary hover:text-red-400"
                          title="Supprimer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          autoFocus
                          value={draft}
                          onChange={(e) => onDraftChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onSave(m, draft);
                            else if (e.key === 'Escape') onToggleComment(m.id);
                          }}
                          placeholder="Anomalie, retard, manque…  (Entrée pour valider, Esc pour fermer)"
                          className="w-full px-2.5 py-1.5 bg-flux-hover border border-flux-border-light rounded text-flux-text-primary text-xs focus:outline-none focus:border-flux-text-tertiary"
                        />
                        <div className="text-flux-text-muted text-[10px] mt-1">
                          Texte libre — visible par toute l'équipe
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Movement row
// ============================================================================

interface MovementRowProps {
  movement: Movement;
  hasNote: boolean;
  onCheck: (m: Movement) => void;
  onToggleComment: (id: string) => void;
  onOpenSheet: (m: Movement) => void;
}

function MovementRow({ movement, hasNote, onCheck, onToggleComment, onOpenSheet }: MovementRowProps) {
  return (
    <div
      className="grid items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-flux-hover transition-colors"
      style={{ gridTemplateColumns: '52px 76px 1fr auto' }}
      onClick={() => onOpenSheet(movement)}
    >
      <div className="text-flux-text-secondary text-sm tabular-nums">{movement.time || '—'}</div>
      <div>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE_CLASS[movement.type]}`}>
          {TYPE_BADGE_LABEL[movement.type]}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-flux-text-primary text-sm font-medium truncate">{movement.title}</div>
        <div className="text-flux-text-tertiary text-xs truncate">{movement.subtitle}</div>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onToggleComment(movement.id)}
          className={`w-7 h-7 inline-flex items-center justify-center rounded hover:bg-flux-active transition-colors ${
            hasNote ? 'text-blue-400' : 'text-flux-text-tertiary hover:text-flux-text-primary'
          }`}
          title={hasNote ? 'Voir / éditer le commentaire' : 'Ajouter un commentaire'}
        >
          <MessageSquare size={14} />
        </button>
        <button
          type="button"
          onClick={() => onCheck(movement)}
          className="w-[22px] h-[22px] inline-flex items-center justify-center rounded border-[1.5px] border-flux-border-light hover:border-flux-text-tertiary bg-transparent text-transparent shrink-0 transition-colors"
          title="Marquer comme effectué"
          aria-label="Marquer comme effectué"
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Side-sheet
// ============================================================================

interface DetailSheetProps {
  movement: Movement;
  note: LogisticsNoteResponse | null;
  onClose: () => void;
}

function DetailSheet({ movement, note, onClose }: DetailSheetProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 w-[420px] h-screen bg-flux-elevated border-l border-flux-border-light z-50 flex flex-col">
        <div className="px-5 py-4 border-b border-flux-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-flux-text-primary">{movement.title}</h3>
          <button onClick={onClose} className="p-1 text-flux-text-tertiary hover:text-flux-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <Field label="Type" value={
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE_CLASS[movement.type]}`}>
              {TYPE_FULL_LABEL[movement.type]}
            </span>
          } />
          <Field label="Heure prévue" value={movement.time || '—'} />
          <Field label="Contrepartie" value={movement.counterparty} />
          <Field label="Référence" value={movement.jobRef} />
          <Field label="Détail" value={movement.subtitle} />
          {note && (
            <Field label="Commentaire" value={
              <div className="bg-flux-surface border-l-2 border-blue-400 px-2.5 py-2 rounded-r text-flux-text-secondary">
                {note.note}
              </div>
            } />
          )}
          <button
            type="button"
            className="mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-flux-text-primary rounded text-xs font-medium inline-flex items-center gap-1.5"
          >
            Voir le job complet <ArrowRight size={12} />
          </button>
        </div>
      </aside>
    </>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-flux-text-muted font-semibold mb-0.5">{label}</div>
      <div className="text-sm text-flux-text-primary">{value}</div>
    </div>
  );
}

