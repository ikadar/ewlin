import { useCallback, useMemo, useState } from 'react';
import { JcfModal } from '../JcfModal';
import { JcfDonePanel } from '../JcfDonePanel/JcfDonePanel';
import {
  computeRemainingDsl,
  type TaskForRemainingDsl,
} from '../JcfDonePanel/computeRemainingDsl';

/**
 * JCF modification modal — opens on a job that's already created and
 * (probably) promoted in Prod. Strict visual continuity with the
 * creation JCF : same modal frame, same field labels, same fonts.
 * Differences : non-modifiable fields are `disabled`, the Sequence
 * cell gets a "Déjà fait" panel above the textarea showing what's
 * gravé in reality.
 *
 * MVP scope : edit job-level fields (deadline / batDeadline / priority
 * / référent / transporteur / required jobs) + per-element edit
 * sequence DSL + comments + gate needsX toggles + delete an element.
 * Add element is left out of V1 (separate flow).
 *
 * @see docs/architecture/preprod-prod-photo-model.md  (Pillar B)
 * @see playground-jcf-sequence-cell.html
 */

export interface JobModificationData {
  id: string;
  reference: string;
  client: string;
  intitule: string;
  quantity: number | null;
  referent: string | null;
  transporteurId: string | null;
  workshopExitDate: string | null;
  batDeadline: string | null;
  deadlinePriority: number;
  requiredJobIds: string[];
  elements: ElementModificationData[];
}

export interface ElementModificationData {
  id: string;
  name: string;
  label: string | null;
  commentaires: string | null;
  needsBat: boolean;
  needsPaper: boolean;
  needsForme: boolean;
  needsPlates: boolean;
  tasks: TaskForRemainingDsl[];
}

export interface JcfModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobModificationData;
  /** Called when the user saves : { jobPatch, elementPatches }. */
  onSave: (changes: ModificationChanges) => Promise<void>;
  /** Optional : surface 409/server errors. */
  error?: string | null;
  isSaving?: boolean;
}

export interface ModificationChanges {
  job: Partial<{
    referent: string | null;
    transporteurId: string | null;
    workshopExitDate: string | null;
    batDeadline: string | null;
    deadlinePriority: number;
    requiredJobIds: string[];
    intitule: string;
  }>;
  elements: Array<{
    id: string;
    dsl: string;
    commentaires: string | null;
    needsBat: boolean | null;
    needsPaper: boolean | null;
    needsForme: boolean | null;
    needsPlates: boolean | null;
  }>;
  deletedElementIds: string[];
}

export function JcfModificationModal({
  isOpen,
  onClose,
  job,
  onSave,
  error = null,
  isSaving = false,
}: JcfModificationModalProps) {
  // Local form state — initialized from the prop, mutated by the user,
  // committed via onSave.
  const [referent, setReferent] = useState(job.referent ?? '');
  const [intitule, setIntitule] = useState(job.intitule);
  const [workshopExitDate, setWorkshopExitDate] = useState(
    job.workshopExitDate ?? '',
  );
  const [batDeadline, setBatDeadline] = useState(job.batDeadline ?? '');
  const [deadlinePriority, setDeadlinePriority] = useState(
    job.deadlinePriority,
  );

  const [elementStates, setElementStates] = useState(() =>
    job.elements.map(el => {
      const remaining = computeRemainingDsl(el.tasks);
      return {
        id: el.id,
        name: el.name,
        commentaires: el.commentaires ?? '',
        needsBat: el.needsBat,
        needsPaper: el.needsPaper,
        needsForme: el.needsForme,
        needsPlates: el.needsPlates,
        dsl: remaining.dsl,
        completedTasks: remaining.completedTasks,
        inProgressTask: remaining.inProgressTask,
        markedForDeletion: false,
      };
    }),
  );

  const updateElement = useCallback(
    (
      id: string,
      patch: Partial<(typeof elementStates)[number]>,
    ) => {
      setElementStates(prev =>
        prev.map(el => (el.id === id ? { ...el, ...patch } : el)),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const elements = elementStates
      .filter(el => !el.markedForDeletion)
      .map(el => ({
        id: el.id,
        dsl: el.dsl,
        commentaires: el.commentaires.length > 0 ? el.commentaires : null,
        needsBat:
          el.needsBat !==
          (job.elements.find(j => j.id === el.id)?.needsBat ?? false)
            ? el.needsBat
            : null,
        needsPaper:
          el.needsPaper !==
          (job.elements.find(j => j.id === el.id)?.needsPaper ?? false)
            ? el.needsPaper
            : null,
        needsForme:
          el.needsForme !==
          (job.elements.find(j => j.id === el.id)?.needsForme ?? false)
            ? el.needsForme
            : null,
        needsPlates:
          el.needsPlates !==
          (job.elements.find(j => j.id === el.id)?.needsPlates ?? false)
            ? el.needsPlates
            : null,
      }));

    const deletedElementIds = elementStates
      .filter(el => el.markedForDeletion)
      .map(el => el.id);

    await onSave({
      job: {
        referent: referent.length > 0 ? referent : null,
        intitule,
        workshopExitDate: workshopExitDate.length > 0 ? workshopExitDate : null,
        batDeadline: batDeadline.length > 0 ? batDeadline : null,
        deadlinePriority,
      },
      elements,
      deletedElementIds,
    });
  }, [
    elementStates,
    referent,
    intitule,
    workshopExitDate,
    batDeadline,
    deadlinePriority,
    job.elements,
    onSave,
  ]);

  const title = useMemo(
    () => `Modifier le Job ${job.reference} · ${job.client}`,
    [job.reference, job.client],
  );

  return (
    <JcfModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
      saveLabel="Enregistrer les modifications"
    >
      <div className="space-y-[18px]" data-testid="jcf-modification-content">
        {/* Job header — disabled fields where appropriate */}
        <section className="grid grid-cols-11 gap-[10px] pb-[14px] border-b border-zinc-800">
          <DisabledField label="ID Job" value={job.reference} />
          <DisabledField label="Client" value={job.client} />
          <EditableField
            label="Référent"
            value={referent}
            onChange={setReferent}
          />
          <DisabledField label="Template" value="—" />
          <div className="col-span-2 flex flex-col gap-[3px]">
            <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
              Intitulé
            </span>
            <input
              className="bg-transparent border border-zinc-700 rounded-[3px] px-[8px] py-[5px] text-zinc-100 text-[13px] font-mono w-full focus:border-zinc-600 focus:outline-none"
              value={intitule}
              onChange={e => setIntitule(e.target.value)}
            />
          </div>
          <DisabledField
            label="Quantité"
            value={String(job.quantity ?? '—')}
          />
          <DisabledField label="Transporteur" value="—" />
          <EditableField
            label="Deadline"
            value={workshopExitDate}
            onChange={setWorkshopExitDate}
            type="datetime-local"
          />
          <EditableField
            label="BAT"
            value={batDeadline}
            onChange={setBatDeadline}
            type="datetime-local"
          />
          <PrioritySelect
            value={deadlinePriority}
            onChange={setDeadlinePriority}
          />
        </section>

        {/* Per-element sections */}
        <section className="space-y-[14px]">
          {elementStates.map(el => (
            <ElementEditCard
              key={el.id}
              state={el}
              onChangeDsl={dsl => updateElement(el.id, { dsl })}
              onChangeCommentaires={commentaires =>
                updateElement(el.id, { commentaires })
              }
              onToggleGate={(gate, value) =>
                updateElement(el.id, { [gate]: value })
              }
              onMarkDelete={() =>
                updateElement(el.id, { markedForDeletion: true })
              }
              onUndoDelete={() =>
                updateElement(el.id, { markedForDeletion: false })
              }
            />
          ))}
        </section>
      </div>
    </JcfModal>
  );
}

interface ElementEditCardProps {
  state: {
    id: string;
    name: string;
    commentaires: string;
    needsBat: boolean;
    needsPaper: boolean;
    needsForme: boolean;
    needsPlates: boolean;
    dsl: string;
    completedTasks: TaskForRemainingDsl[];
    inProgressTask: TaskForRemainingDsl | null;
    markedForDeletion: boolean;
  };
  onChangeDsl: (dsl: string) => void;
  onChangeCommentaires: (text: string) => void;
  onToggleGate: (
    gate: 'needsBat' | 'needsPaper' | 'needsForme' | 'needsPlates',
    value: boolean,
  ) => void;
  onMarkDelete: () => void;
  onUndoDelete: () => void;
}

function ElementEditCard({
  state,
  onChangeDsl,
  onChangeCommentaires,
  onToggleGate,
  onMarkDelete,
  onUndoDelete,
}: ElementEditCardProps) {
  if (state.markedForDeletion) {
    return (
      <div className="border border-red-900/40 bg-red-950/20 rounded-[5px] p-[14px] flex items-center justify-between">
        <span className="text-red-400 text-[13px]">
          Élément <strong>{state.name}</strong> sera supprimé à
          l'enregistrement (toutes ses tasks passeront en Cancelled,
          historique mur préservé).
        </span>
        <button
          onClick={onUndoDelete}
          className="text-zinc-300 text-[12px] hover:text-zinc-100"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-[5px] overflow-hidden">
      <header className="bg-zinc-900 px-[14px] py-[8px] flex items-center justify-between border-b border-zinc-800">
        <h3 className="text-zinc-100 text-[14px] font-semibold">
          {state.name}
        </h3>
        <button
          onClick={onMarkDelete}
          className="text-zinc-500 hover:text-red-400 text-[12px]"
          data-testid={`delete-element-${state.id}`}
        >
          Supprimer l'élément
        </button>
      </header>

      <div className="p-[14px] space-y-[12px]">
        {/* Sequence */}
        <div>
          <label className="text-zinc-500 text-[11px] uppercase tracking-wider block mb-[4px]">
            Séquence
          </label>
          <JcfDonePanel
            completedTasks={state.completedTasks}
            inProgressTask={state.inProgressTask}
          />
          <textarea
            className="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded-[3px] px-[5px] py-[2px] font-mono text-zinc-100 text-[13px] resize-none focus:outline-none"
            rows={Math.max(3, state.dsl.split('\n').length)}
            value={state.dsl}
            onChange={e => onChangeDsl(e.target.value)}
            data-testid={`sequence-textarea-${state.id}`}
          />
        </div>

        {/* Gates */}
        <GatesRow state={state} onToggleGate={onToggleGate} />

        {/* Commentaires */}
        <div>
          <label className="text-zinc-500 text-[11px] uppercase tracking-wider block mb-[4px]">
            Commentaires
          </label>
          <input
            className="w-full bg-transparent border border-zinc-700 rounded-[3px] px-[8px] py-[5px] text-zinc-100 text-[13px] focus:border-zinc-600 focus:outline-none"
            value={state.commentaires}
            onChange={e => onChangeCommentaires(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

interface GatesRowProps {
  state: ElementEditCardProps['state'];
  onToggleGate: ElementEditCardProps['onToggleGate'];
}

function GatesRow({ state, onToggleGate }: GatesRowProps) {
  return (
    <div>
      <label className="text-zinc-500 text-[11px] uppercase tracking-wider block mb-[4px]">
        Gates
      </label>
      <div className="flex gap-[14px] flex-wrap">
        <GateToggle
          label="BAT"
          checked={state.needsBat}
          onChange={v => onToggleGate('needsBat', v)}
        />
        <GateToggle
          label="Papier"
          checked={state.needsPaper}
          onChange={v => onToggleGate('needsPaper', v)}
        />
        <GateToggle
          label="Plaque"
          checked={state.needsPlates}
          onChange={v => onToggleGate('needsPlates', v)}
        />
        <GateToggle
          label="Forme"
          checked={state.needsForme}
          onChange={v => onToggleGate('needsForme', v)}
        />
      </div>
    </div>
  );
}

function GateToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-[6px] cursor-pointer text-[12px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-[13px] h-[13px]"
      />
      <span className={checked ? 'text-zinc-200' : 'text-zinc-500'}>
        {label} {checked ? 'requis' : 'non requis'}
      </span>
    </label>
  );
}

function DisabledField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
        {label}
      </span>
      <input
        className="bg-zinc-900/40 border border-zinc-800 rounded-[3px] px-[8px] py-[5px] text-zinc-500 text-[13px] font-mono w-full cursor-not-allowed"
        value={value}
        disabled
      />
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
        {label}
      </span>
      <input
        type={type}
        className="bg-transparent border border-zinc-700 rounded-[3px] px-[8px] py-[5px] text-zinc-100 text-[13px] font-mono w-full focus:border-zinc-600 focus:outline-none"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
        Priorité
      </span>
      <select
        className="bg-transparent border border-zinc-700 rounded-[3px] px-[8px] py-[5px] text-zinc-100 text-[13px] font-mono w-full focus:border-zinc-600 focus:outline-none"
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
      >
        <option value={0}>Impérative (0)</option>
        <option value={1}>Importante (1)</option>
        <option value={2}>Standard (2)</option>
        <option value={3}>Flexible (3)</option>
      </select>
    </div>
  );
}
