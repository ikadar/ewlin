import { useCallback, useMemo, useState } from 'react';
import { JcfModal } from '../JcfModal';
import { JcfJobHeader } from '../JcfJobHeader';
import {
  JcfElementsTable,
  type JcfElement,
  type SequenceDonePanelData,
} from '../JcfElementsTable';

/**
 * JCF modification modal — Pillar B entry point. Reuses the **same**
 * UI primitives as the creation JCF (`JcfModal`, `JcfJobHeader`,
 * `JcfElementsTable`) so chefs see one consistent surface : header
 * fields with autocompletes, full per-element table with all the
 * production columns + gate switches. Modification-only behaviors are
 * applied via existing props :
 *
 *  - `onJobIdChange` / `onTemplateSelect` left undefined ⇒ disabled
 *    visually + wired to no-op handlers.
 *  - `donePanelByElementName` ⇒ "Déjà fait" panel above the Sequence
 *    textarea (completed + in-progress tasks shown read-only above
 *    the editable remaining-DSL textarea).
 *  - `disableAddElement` ⇒ no per-column "+" affordance (V1 doesn't
 *    persist new elements via POST /elements yet).
 *
 * The wrapping container (JobModificationContainer) handles the diff
 * between initial elements and the user-edited list, then dispatches
 * the appropriate Pillar B mutations (PUT /elements/{id}/sequence,
 * DELETE /elements/{id}, PUT /jobs/{id}).
 *
 * @see docs/architecture/preprod-prod-photo-model.md  (Pillar B)
 * @see playground-jcf-sequence-cell.html
 */

export interface JobModificationData {
  // Job-level header fields
  id: string;
  reference: string;
  client: string;
  intitule: string;
  quantity: string;
  referent: string;
  shipperId: string;
  workshopExitDate: string;
  deadlineRelativeDays: string;
  batDeadline: string;
  deadlinePriority: number;
  requiredJobs: string;

  /** Elements pre-mapped to the table's row shape. */
  elements: JcfElement[];

  /**
   * Stable element-name → DB id mapping. Names are what
   * `JcfElementsTable` exposes ; ids are needed for save-time
   * mutations. Renaming an element preserves its id (the mapping is
   * keyed on the *initial* name).
   */
  elementDbIdByInitialName: Record<string, string>;

  /** "Déjà fait" data per element (keyed by name). */
  donePanelByElementName: Record<string, SequenceDonePanelData>;

  /** Job suggestions for the "required jobs" autocomplete. */
  jobSuggestions: Array<{ reference: string; client: string }>;
}

export interface JcfModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobModificationData;
  onSave: (changes: ModificationChanges) => Promise<void>;
  error?: string | null;
  isSaving?: boolean;
}

export interface ModificationChanges {
  /** Job header diff. Undefined fields = "don't touch". */
  job: Partial<{
    client: string;
    referent: string | null;
    shipperId: string | null;
    workshopExitDate: string | null;
    deadlineRelativeDays: number | null;
    batDeadline: string | null;
    deadlinePriority: number;
    intitule: string;
    quantity: string;
    requiredJobs: string;
  }>;
  /** Element changes — by initial element name (stable id surrogate). */
  elements: Array<{
    initialName: string;
    dbId: string;
    sequenceDsl: string;
    commentaires: string | null;
    needsBat: boolean | null;
    needsPaper: boolean | null;
    needsForme: boolean | null;
    needsPlates: boolean | null;
    precedences: string;
  }>;
  /** Element DB ids that were removed (no longer present in the table). */
  deletedElementIds: string[];
  /** Element names that were added but cannot be persisted in V1. */
  unsavedNewElements: string[];
}

export function JcfModificationModal({
  isOpen,
  onClose,
  job,
  onSave,
  error = null,
  isSaving = false,
}: JcfModificationModalProps) {
  // ── Header state ─────────────────────────────────────────────────────────
  // Mirrors the legacy `isEditMode` flow in App.tsx : ID Job + Template
  // are non-editable (passed as `undefined` callbacks below) ; everything
  // else stays editable, including Client (the legacy create JCF in edit
  // mode lets the chef adjust it ; we keep that latitude here too).
  const [client, setClient] = useState(job.client);
  const [referent, setReferent] = useState(job.referent);
  const [intitule, setIntitule] = useState(job.intitule);
  const [quantity, setQuantity] = useState(job.quantity);
  const [shipperId, setShipperId] = useState(job.shipperId);
  const [workshopExitDate, setWorkshopExitDate] = useState(
    job.workshopExitDate,
  );
  const [deadlineRelativeDays, setDeadlineRelativeDays] = useState(
    job.deadlineRelativeDays,
  );
  const [batDeadline, setBatDeadline] = useState(job.batDeadline);
  const [deadlinePriority, setDeadlinePriority] = useState(job.deadlinePriority);
  const [requiredJobs, setRequiredJobs] = useState(job.requiredJobs);

  // ── Elements state ───────────────────────────────────────────────────────
  // Local list of elements as they appear in the table. Initialized from
  // the snapshot ; mutated by JcfElementsTable callbacks. Renaming is
  // disabled in modification mode (see `disableElementRename` below),
  // so `el.name` is a stable join key with `job.elementDbIdByInitialName`.
  const [elements, setElements] = useState<JcfElement[]>(job.elements);

  // ── Save handler ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const finalNames = new Set(elements.map(el => el.name));
    const elementChanges: ModificationChanges['elements'] = [];
    const unsavedNewElements: string[] = [];

    for (const el of elements) {
      const dbId = job.elementDbIdByInitialName[el.name];
      if (!dbId) {
        // New element added in-session — V1 doesn't persist it.
        unsavedNewElements.push(el.name);
        continue;
      }
      elementChanges.push({
        initialName: el.name,
        dbId,
        sequenceDsl: el.sequence,
        commentaires:
          el.commentaires.length > 0 ? el.commentaires : null,
        needsBat: el.needsBat,
        needsPaper: el.needsPaper,
        needsForme: el.needsForme,
        needsPlates: el.needsPlates,
        precedences: el.precedences,
      });
    }

    const deletedElementIds = Object.entries(job.elementDbIdByInitialName)
      .filter(([name]) => !finalNames.has(name))
      .map(([, id]) => id);

    const parsedRelativeDays = deadlineRelativeDays.trim() === ''
      ? null
      : parseInt(deadlineRelativeDays, 10);

    await onSave({
      job: {
        client,
        referent: referent.length > 0 ? referent : null,
        intitule,
        quantity,
        shipperId: shipperId.length > 0 ? shipperId : null,
        workshopExitDate: workshopExitDate.length > 0 ? workshopExitDate : null,
        deadlineRelativeDays: parsedRelativeDays,
        batDeadline: batDeadline.length > 0 ? batDeadline : null,
        deadlinePriority,
        requiredJobs,
      },
      elements: elementChanges,
      deletedElementIds,
      unsavedNewElements,
    });
  }, [
    elements,
    job.elementDbIdByInitialName,
    client,
    referent,
    intitule,
    quantity,
    shipperId,
    workshopExitDate,
    deadlineRelativeDays,
    batDeadline,
    deadlinePriority,
    requiredJobs,
    onSave,
  ]);

  const title = useMemo(
    () => `Modifier le Job ${job.reference} · ${job.client}`,
    [job.reference, job.client],
  );

  // We don't pass onJobIdChange / onTemplateSelect — that's how the
  // creation JCF already conveys "disabled" for those fields. Same
  // mechanism, no special edit-mode UI.

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
      <JcfJobHeader
        jobId={job.reference}
        client={client}
        onClientChange={setClient}
        disabledFields={['client', 'template', 'quantity']}
        referent={referent}
        onReferentChange={setReferent}
        template=""
        onTemplateChange={() => {
          /* template selection not applicable in edit mode */
        }}
        intitule={intitule}
        onIntituleChange={setIntitule}
        quantity={quantity}
        onQuantityChange={setQuantity}
        shipperId={shipperId}
        onShipperIdChange={setShipperId}
        deadline={workshopExitDate}
        onDeadlineChange={setWorkshopExitDate}
        deadlineRelativeDays={deadlineRelativeDays}
        onDeadlineRelativeDaysChange={setDeadlineRelativeDays}
        batDeadline={batDeadline}
        onBatDeadlineChange={setBatDeadline}
        deadlinePriority={deadlinePriority}
        onDeadlinePriorityChange={setDeadlinePriority}
        requiredJobs={requiredJobs}
        onRequiredJobsChange={setRequiredJobs}
        jobSuggestions={job.jobSuggestions}
      />

      <div className="mt-[13px]">
        <JcfElementsTable
          elements={elements}
          onElementsChange={setElements}
          jobQuantity={quantity}
          mode="job"
          donePanelByElementName={job.donePanelByElementName}
          disableElementRename
          disabledRowKeys={[
            'quantite',
            'pagination',
            'format',
            'papier',
            'impression',
            'surfacage',
            'autres',
            'imposition',
            'qteFeuilles',
            'commentaires',
          ]}
          lockedElementNames={Object.keys(job.elementDbIdByInitialName)}
        />
      </div>
    </JcfModal>
  );
}
