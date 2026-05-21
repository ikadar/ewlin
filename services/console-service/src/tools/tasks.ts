/**
 * Task-level tools: duration tweak, station replace, pinning, overtime.
 *
 * Most of these are minimal stubs in Phase 2 — Phase 7 fleshes them out
 * with the full set of edge cases and PHP endpoint calls.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { combineDateAndTime, isIsoDate, toIsoWithLocalOffset } from './dates.js';
import { uuidField } from './ids.js';

interface OvertimeEntry {
  startAt: string;
  endAt: string;
  reason: string | null;
}

interface OperatorOvertimesRow {
  id: string;
  overtimes?: OvertimeEntry[] | null;
}

export const addOperatorOvertimeTool: ToolDefinition = {
  name: 'add_operator_overtime',
  description:
    "Ajoute des heures supplémentaires (heures sup, extension d'horaire) pour un opérateur sur une date donnée. Crée une nouvelle plage [startAt, endAt] dans son champ `overtimes`. Le moteur de planification l'utilise comme une plage de disponibilité supplémentaire qui s'ajoute à l'horaire de base de l'opérateur. Le serveur rejette (HTTP 400) tout chevauchement avec une absence existante de l'opérateur — dans ce cas, prévenir l'utilisateur et lui suggérer d'éditer l'absence ou d'ajuster les horaires.",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator'),
    operatorLabel: z.string().min(1),
    date: z.string().describe("Date YYYY-MM-DD."),
    fromTime: z.string().describe("HH:MM, début de la plage supplémentaire."),
    toTime: z.string().describe("HH:MM, fin de la plage supplémentaire."),
    reason: z.string().optional(),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.date)) {
      return { ok: false, error: 'date must be YYYY-MM-DD' };
    }
    let startAt: string;
    let endAt: string;
    try {
      startAt = combineDateAndTime(input.date, input.fromTime);
      endAt = combineDateAndTime(input.date, input.toTime);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (startAt > endAt) {
      return { ok: false, error: 'fromTime must be <= toTime' };
    }
    const preview = `Heure sup pour ${input.operatorLabel} le ${input.date} de ${input.fromTime} à ${input.toTime}${
      input.reason ? ` (${input.reason})` : ''
    }`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input, startAt, endAt } };
    }
    // Fetch existing overtimes, append the new range, PUT back the full list.
    // The PHP service enforces disjointness against absences and returns 400
    // on overlap — that error message bubbles up to the LLM via ctx.php.put.
    const op = await ctx.php.get<OperatorOvertimesRow>(`/api/v1/operators/${input.operatorId}`);
    const overtimes: OvertimeEntry[] = [
      ...(op.overtimes ?? []),
      { startAt, endAt, reason: input.reason ?? null },
    ];
    const updated = await ctx.php.put<OperatorOvertimesRow>(
      `/api/v1/operators/${input.operatorId}`,
      { overtimes },
    );
    return { ok: true, preview, data: { operator: updated } };
  },
};

export const updateTaskDurationTool: ToolDefinition = {
  name: 'update_task_duration',
  description:
    "Modifie la durée setup et/ou run d'une tâche. Format usuel : '30+150' = 30 min de setup + 150 min de run. Au moins un des deux champs doit être fourni. La tâche est résolue via resolve_task_in_job.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job').describe("UUID de la tâche."),
    taskLabel: z.string().min(1).describe("Nom lisible (ex 'MBO XL du job 12345')."),
    setupMinutes: z.number().int().nonnegative().optional(),
    runMinutes: z.number().int().nonnegative().optional(),
  }),
  handler: async (input, ctx) => {
    if (input.setupMinutes === undefined && input.runMinutes === undefined) {
      return { ok: false, error: 'Provide at least one of setupMinutes / runMinutes.' };
    }
    const parts: string[] = [];
    if (input.setupMinutes !== undefined) parts.push(`setup=${input.setupMinutes}min`);
    if (input.runMinutes !== undefined) parts.push(`run=${input.runMinutes}min`);
    const preview = `Durée de ${input.taskLabel} : ${parts.join(', ')}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // PATCH /api/v1/tasks/{taskId}/duration accepts runMinutes today.
    // Setup minutes might require a separate PHP-side enhancement later.
    const body: Record<string, number> = {};
    if (input.runMinutes !== undefined) body['runMinutes'] = input.runMinutes;
    if (input.setupMinutes !== undefined) body['setupMinutes'] = input.setupMinutes;
    const result = await ctx.php.patch<unknown>(`/api/v1/tasks/${input.taskId}/duration`, body);
    return { ok: true, preview, data: { task: result } };
  },
};

interface SaisieResult {
  taskId: string;
  scheduledEnd: string;
  lastSaisieAt: string;
  productivityRatio: number;
  recordedProgressPct: number;
  recordedAt: string;
}

export const reportProgressTool: ToolDefinition = {
  name: 'report_progress',
  description:
    "Saisie d'avancement terrain : l'opérateur ou le chef déclare quand une tâche EN COURS finira réellement. C'est l'équivalent IA de la modale de saisie d'avancement. Appelle le vrai endpoint de saisie qui : (1) calcule le ratio de productivité, (2) met à jour scheduledEnd, (3) enregistre le % de progression, (4) cascade-invalide les tâches aval si extension, (5) émet un ProductionEvent, (6) déclenche un replan. La tâche DOIT être en cours (scheduledStart ≤ now < scheduledEnd). Utiliser list_running_tasks pour vérifier et obtenir le scheduledEnd courant si besoin de calculer un offset ('+30min de retard' → scheduledEnd + 30min). NE PAS confondre avec update_task_duration (modifie la recette) ni extend_running_task (corrige la durée théorique).",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job').describe("UUID de la tâche en cours."),
    taskLabel: z.string().min(1).describe("Nom lisible (ex 'MBO XL du dossier 35202')."),
    date: z.string().describe("Date YYYY-MM-DD de l'heure de fin estimée."),
    time: z.string().describe("Heure HH:MM de fin estimée. Ex : l'opérateur dit 'je finirai à 14h' → '14:00'. Dit '30 min de retard' et scheduledEnd=13:30 → '14:00'."),
  }),
  handler: async (input, ctx) => {
    let estimatedEndTime: string;
    try {
      estimatedEndTime = toIsoWithLocalOffset(input.date, input.time);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const preview = `Saisie : ${input.taskLabel} finira à ${input.time} le ${input.date}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, estimatedEndTime, ...input } };
    }
    const result = await ctx.php.post<SaisieResult>(
      `/api/v1/scenarios/prod/saisie/${input.taskId}`,
      { estimatedEndTime },
    );
    const ratio = result.productivityRatio;
    const statusLabel =
      ratio >= 1.0 ? 'en avance ou à l\'heure' :
      ratio >= 0.8 ? 'léger retard' : 'retard significatif';
    const fullPreview = `${preview} — ratio ${ratio.toFixed(2)} (${statusLabel}), progression ${Math.round(result.recordedProgressPct)}%`;
    return { ok: true, preview: fullPreview, data: result };
  },
};

export const replaceTaskStationTool: ToolDefinition = {
  name: 'replace_task_station',
  description:
    "Remplace la station d'une tâche existante par une autre, optionnellement en changeant aussi sa durée. Exemple : 'remplace la tâche MBO XL du job 1234 par une tâche MBO M de 20+120'. Les stations doivent être résolues via resolve_station, et la tâche via resolve_task_in_job.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1).describe("Nom lisible avant remplacement."),
    newStationId: z.string().min(1),
    newStationLabel: z.string().min(1),
    newSetupMinutes: z.number().int().nonnegative().optional(),
    newRunMinutes: z.number().int().nonnegative().optional(),
  }),
  handler: async (input, ctx) => {
    const durationParts: string[] = [];
    if (input.newSetupMinutes !== undefined) durationParts.push(`${input.newSetupMinutes}+`);
    if (input.newRunMinutes !== undefined) durationParts.push(`${input.newRunMinutes}min`);
    const preview = `Remplacer ${input.taskLabel} par ${input.newStationLabel}${
      durationParts.length ? ` (${durationParts.join('')})` : ''
    }`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // Step 1: reassign task to new station (preserves scheduling)
    const reassigned = await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/assign`, {
      targetId: input.newStationId,
      bypassPrecedence: false,
    });
    // Step 2: optionally update duration
    if (input.newSetupMinutes !== undefined || input.newRunMinutes !== undefined) {
      const body: Record<string, number> = {};
      if (input.newRunMinutes !== undefined) body['runMinutes'] = input.newRunMinutes;
      if (input.newSetupMinutes !== undefined) body['setupMinutes'] = input.newSetupMinutes;
      await ctx.php.patch<unknown>(`/api/v1/tasks/${input.taskId}/duration`, body);
    }
    return { ok: true, preview, data: { task: reassigned } };
  },
};

/**
 * PUT /api/v1/tasks/{id}/pin is a TOGGLE server-side (see
 * TaskController::togglePin). To keep our tools idempotent, we fetch
 * the current isPinned state first and only toggle when needed.
 *
 * Returns null when the task has no assignment yet (pre-placement or
 * unknown task) — callers decide what to do in that case.
 */
async function currentIsPinned(
  ctx: Parameters<ToolDefinition['handler']>[1],
  taskId: string,
): Promise<boolean | null> {
  const snap = await ctx.php.get<Snapshot>('/api/v1/schedule/snapshot');
  const asn = snap.assignments.find((a) => a.taskId === taskId);
  return asn ? asn.isPinned ?? false : null;
}

// JS Date.getDay() is 0=Sun..6=Sat — index into this array to get the
// lowercase English key used by Station.operatingSchedule.
const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;
const DAY_LABELS_FR: Record<string, string> = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche',
};

export interface AvailabilityCheck {
  available: boolean;
  reason?: string;
}

/**
 * Pre-validate that a station has at least one qualified operator
 * scheduled at the requested local datetime. Returns `{ available: true }`
 * when the station's effective operating window covers the moment AND no
 * `ScheduleException` masks it.
 *
 * Limitation: cannot detect "all qualified operators are busy on another
 * station at the same tick" — that depends on a recompute. We catch the
 * common cases (off-day, after hours, station maintenance window) which
 * are the typical cause of pin → tile-without-operator regressions.
 *
 * Snapshot shape: `station.operatingSchedule` is the union of qualified
 * operators' schedules (per the "machine dispo = operator dispo" rule),
 * pre-computed by SnapshotBuilder::buildOperatorSchedulesByStation.
 */
export function checkStationOperatorAvailability(
  snapshot: { stations: SnapshotStation[] },
  stationId: string,
  isoLocal: string,
): AvailabilityCheck {
  const station = snapshot.stations.find((s) => s.id === stationId);
  if (!station) {
    return { available: false, reason: `Station ${stationId} introuvable dans le snapshot.` };
  }
  const dt = new Date(isoLocal);
  if (Number.isNaN(dt.getTime())) {
    return { available: false, reason: `Datetime invalide : ${isoLocal}.` };
  }
  const dayKey = DAY_KEYS[dt.getDay()]!;
  const dayLabel = DAY_LABELS_FR[dayKey] ?? dayKey;
  const day = station.operatingSchedule?.[dayKey];
  if (!day || !day.isOperating || day.slots.length === 0) {
    return {
      available: false,
      reason: `Aucun opérateur qualifié n'est planifié sur ${station.name} le ${dayLabel}.`,
    };
  }
  const hhmm = isoLocal.slice(11, 16);
  const inSlot = day.slots.some((slot) => slot.start <= hhmm && hhmm < slot.end);
  if (!inSlot) {
    const slotsStr = day.slots.map((s) => `${s.start}-${s.end}`).join(', ');
    return {
      available: false,
      reason: `${hhmm} est hors des plages opérateurs sur ${station.name} le ${dayLabel} (plages : ${slotsStr}).`,
    };
  }
  // exceptions are naive local ISO ("YYYY-MM-DDTHH:MM:SS"), inclusive
  // endpoints — same shape as `isoLocal`, so string compare is safe.
  const masking = (station.exceptions ?? []).find(
    (ex) => ex.startAt <= isoLocal && isoLocal <= ex.endAt,
  );
  if (masking) {
    const r = masking.reason ? ` (${masking.reason})` : '';
    return {
      available: false,
      reason: `${station.name} est marquée indisponible sur ce créneau${r}.`,
    };
  }
  return { available: true };
}

export const checkStationOperatorAvailabilityTool: ToolDefinition = {
  name: 'check_station_operator_availability',
  description:
    "Vérifie qu'au moins un opérateur qualifié est PLANIFIÉ sur une station à un créneau donné. À APPELER AVANT pin_task_at_time : si available=false, signale dans la narration ET dans le preview de l'action que la tuile sera placée sans opérateur (le moteur ne peut pas inventer un opérateur qui n'est pas là — il faudra ajouter une heure sup ou choisir un autre créneau). Vérifie le créneau de DÉBUT seulement ; pas besoin de vérifier toute la durée. Limite : ne détecte pas le cas où tous les opérateurs qualifiés sont déjà occupés sur une autre station au même tick (visible seulement après recompute).",
  readOnly: true,
  inputSchema: z.object({
    stationId: uuidField('resolve_station'),
    stationLabel: z.string().min(1),
    date: z.string().describe("Date YYYY-MM-DD du créneau."),
    time: z.string().describe("Heure HH:MM du créneau."),
  }),
  handler: async (input, ctx) => {
    let isoLocal: string;
    try {
      isoLocal = combineDateAndTime(input.date, input.time);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const snap = await ctx.php.get<Snapshot>('/api/v1/schedule/snapshot');
    const result = checkStationOperatorAvailability(snap, input.stationId, isoLocal);
    return {
      ok: true,
      data: {
        stationId: input.stationId,
        stationLabel: input.stationLabel,
        date: input.date,
        time: input.time,
        ...result,
      },
    };
  },
};

export const pinTaskAtTimeTool: ToolDefinition = {
  name: 'pin_task_at_time',
  description:
    "Force une tâche à démarrer à un instant précis sur une station précise. Combine assign + pin : la tâche est replanifiée (éventuellement déplacée vers une autre station) puis épinglée pour qu'aucune opération automatique ne la bouge. Exemples : 'le job 12345 doit passer à 15h le 15 avril sur la G40' (la tâche peut être sur une autre presse aujourd'hui, le tool la déplace), 're-pin la tâche MBO XL du job 3 à mardi 14h'. Idempotent : si la tâche est déjà épinglée, ne dé-épingle pas par erreur. Pour un déplacement, bien résoudre la station cible via resolve_station AVANT, et la tâche via resolve_task_in_job(jobId) SANS stationName (car stationName filtre sur l'affectation actuelle, pas sur la cible).",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1),
    stationId: uuidField('resolve_station'),
    stationLabel: z.string().min(1),
    date: z.string().describe("Date YYYY-MM-DD du début."),
    time: z.string().describe("Heure HH:MM du début."),
  }),
  handler: async (input, ctx) => {
    let scheduledStart: string;
    let scheduledStartLocal: string;
    try {
      // PHP API requires full ISO 8601 with offset (server is TZ=Europe/Paris).
      scheduledStart = toIsoWithLocalOffset(input.date, input.time);
      // Naive local form for the operator-availability check (matches the
      // shape of Station.exceptions and operatingSchedule HH:MM windows).
      scheduledStartLocal = combineDateAndTime(input.date, input.time);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const preview = `Pin de ${input.taskLabel} à ${input.date} ${input.time} sur ${input.stationLabel}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, scheduledStart, ...input } };
    }
    // Step 1: reschedule (or assign) the task at the requested time/station.
    await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/assign`, {
      targetId: input.stationId,
      scheduledStart,
      bypassPrecedence: false,
    });
    // Step 2: ensure pinned. /pin is a toggle, so only call it if the
    // current state is unpinned; otherwise we would silently un-pin
    // a previously-pinned task just because the user re-issued the
    // command with a new time.
    //
    // We fetch the snapshot once here and reuse it for the post-pin
    // operator-availability safety net below (see Step 3).
    const snap = await ctx.php.get<Snapshot>('/api/v1/schedule/snapshot');
    const asn = snap.assignments.find((a) => a.taskId === input.taskId);
    const alreadyPinned = asn ? asn.isPinned ?? false : null;
    if (alreadyPinned === false) {
      await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/pin`, {});
    }
    // Step 3: safety-net availability check. If the LLM skipped
    // check_station_operator_availability (or conditions changed since),
    // we still surface a warning so the user can see why the engine
    // produced a tile without an operator (forward_pass.rs deliberately
    // leaves operators=[] when none is qualified-and-available, rather
    // than ghost-assigning a busy/absent op).
    const availability = checkStationOperatorAvailability(
      snap,
      input.stationId,
      scheduledStartLocal,
    );
    return {
      ok: true,
      preview,
      data: {
        taskId: input.taskId,
        scheduledStart,
        wasAlreadyPinned: alreadyPinned === true,
        ...(availability.available ? {} : { warning: availability.reason }),
      },
    };
  },
};

export const unpinTaskTool: ToolDefinition = {
  name: 'unpin_task',
  description:
    "Retire le pin d'une tâche, la rendant éligible aux opérations automatiques de replanification. Idempotent : si la tâche est déjà non-épinglée, ne l'épingle pas par erreur.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job'),
    taskLabel: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    const preview = `Retirer le pin de ${input.taskLabel}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    // /pin is a toggle: only call it if currently pinned.
    const alreadyPinned = await currentIsPinned(ctx, input.taskId);
    if (alreadyPinned === true) {
      await ctx.php.put<unknown>(`/api/v1/tasks/${input.taskId}/pin`, {});
    }
    return {
      ok: true,
      preview,
      data: { taskId: input.taskId, wasAlreadyUnpinned: alreadyPinned !== true },
    };
  },
};

interface ExtendAndReplanResult {
  taskId: string;
  previousRunMinutes: number;
  newRunMinutes: number;
  impactedTaskIds: string[];
  unassignedCount: number;
  replacedCount: number;
  lateJobs: Array<{ jobId: string; reference: string }>;
}

interface SnapshotAssignment {
  id: string;
  taskId: string;
  targetId: string;
  isOutsourced?: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  isCompleted?: boolean;
  isPinned?: boolean;
}
interface SnapshotTask {
  id: string;
  elementId?: string;
  stationId?: string;
  type?: string;
  duration?: { setupMinutes?: number; runMinutes?: number };
}
interface SnapshotElement { id: string; jobId?: string; name?: string | null }
interface SnapshotJob { id: string; reference?: string | null; client?: string | null }
interface SnapshotDaySchedule {
  isOperating: boolean;
  slots: Array<{ start: string; end: string }>;
}
interface SnapshotScheduleException {
  startAt: string;
  endAt: string;
  reason: string | null;
}
interface SnapshotStation {
  id: string;
  name: string;
  abbreviation?: string | null;
  // Effective operating schedule = union of qualified-operator schedules.
  // See SnapshotBuilder::buildOperatorSchedulesByStation (PHP).
  operatingSchedule?: Partial<Record<string, SnapshotDaySchedule>> | null;
  exceptions?: SnapshotScheduleException[] | null;
}
interface Snapshot {
  assignments: SnapshotAssignment[];
  tasks: SnapshotTask[];
  elements: SnapshotElement[];
  jobs: SnapshotJob[];
  stations: SnapshotStation[];
}

export const listRunningTasksTool: ToolDefinition = {
  name: 'list_running_tasks',
  description:
    "Liste les tâches actuellement en cours d'exécution à l'instant présent (scheduledStart ≤ maintenant < scheduledEnd, non terminées). Optionnellement filtré sur une station pour répondre à 'qu'est-ce qui tourne sur la MBO XL ?'. Indispensable avant extend_running_task quand l'opérateur parle d'une machine sans citer la tâche.",
  readOnly: true,
  inputSchema: z.object({
    stationId: uuidField('resolve_station')
      .optional()
      .describe(
        "UUID de la station à filtrer (via resolve_station). Si omis, retourne toutes les tâches en cours sur toutes les stations.",
      ),
  }),
  handler: async (input, ctx) => {
    const snap = await ctx.php.get<Snapshot>('/api/v1/schedule/snapshot');
    const now = new Date();
    const nowMs = now.getTime();

    const tasksById = new Map(snap.tasks.map((t) => [t.id, t]));
    const elementsById = new Map(snap.elements.map((e) => [e.id, e]));
    const jobsById = new Map(snap.jobs.map((j) => [j.id, j]));
    const stationsById = new Map(snap.stations.map((s) => [s.id, s]));

    const running: Array<{
      taskId: string;
      taskLabel: string;
      stationId: string;
      stationName: string | null;
      jobId: string | null;
      jobReference: string | null;
      scheduledStart: string;
      scheduledEnd: string;
      elapsedMinutes: number;
      remainingMinutes: number;
      isPinned: boolean;
    }> = [];

    for (const asn of snap.assignments) {
      if (asn.isCompleted) continue;
      if (input.stationId && asn.targetId !== input.stationId) continue;

      const startMs = new Date(asn.scheduledStart).getTime();
      const endMs = new Date(asn.scheduledEnd).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
      if (startMs > nowMs || endMs <= nowMs) continue;

      const task = tasksById.get(asn.taskId);
      const element = task?.elementId ? elementsById.get(task.elementId) : undefined;
      const job = element?.jobId ? jobsById.get(element.jobId) : undefined;
      const station = stationsById.get(asn.targetId);

      running.push({
        taskId: asn.taskId,
        taskLabel: `${station?.name ?? 'Station inconnue'} du ${job?.reference ? `dossier ${job.reference}` : 'job inconnu'}`,
        stationId: asn.targetId,
        stationName: station?.name ?? null,
        jobId: job?.id ?? null,
        jobReference: job?.reference ?? null,
        scheduledStart: asn.scheduledStart,
        scheduledEnd: asn.scheduledEnd,
        elapsedMinutes: Math.round((nowMs - startMs) / 60000),
        remainingMinutes: Math.round((endMs - nowMs) / 60000),
        isPinned: asn.isPinned ?? false,
      });
    }

    running.sort((a, b) => (a.stationName ?? '').localeCompare(b.stationName ?? ''));

    return {
      ok: true,
      data: {
        now: now.toISOString(),
        tasks: running,
        count: running.length,
      },
    };
  },
};

export const extendRunningTaskTool: ToolDefinition = {
  name: 'extend_running_task',
  description:
    "Corrige la durée de recette (runMinutes théoriques) d'une tâche en cours quand on découvre que la durée PLANIFIÉE était fausse. Ex : 'cette tâche fait 4h de run, pas 2h comme prévu dans le devis' — on corrige la fiche technique. NE PAS utiliser pour une saisie d'avancement terrain ('je finirai à 14h', '30 min de retard') — utiliser report_progress à la place, qui écrit le ratio de productivité et enregistre la progression. Utiliser `update_task_duration` pour une tâche pas encore démarrée.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job').describe("UUID de la tâche en cours."),
    taskLabel: z
      .string()
      .min(1)
      .describe("Nom lisible (ex 'MBO XL du dossier 35202')."),
    newRunMinutes: z
      .number()
      .int()
      .positive()
      .describe(
        "Nouvelle durée de run TOTALE en minutes (pas la durée restante). Ex : si la task de 90min a démarré à 10h et l'opérateur dit 'fini à 14h', passer 240 (=4h total de run).",
      ),
  }),
  handler: async (input, ctx) => {
    const preview = `Étendre ${input.taskLabel} à ${input.newRunMinutes}min (replanifie les tâches aval)`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const result = await ctx.php.post<ExtendAndReplanResult>(
      `/api/v1/tasks/${input.taskId}/extend-and-replan`,
      { runMinutes: input.newRunMinutes },
    );
    const lateSummary = result.lateJobs.length > 0
      ? ` — ${result.lateJobs.length} job(s) en retard : ${result.lateJobs.map((j) => j.reference).join(', ')}`
      : '';
    const fullPreview = `${preview} • ${result.replacedCount}/${result.impactedTaskIds.length} tâche(s) replacée(s)${lateSummary}`;
    return { ok: true, preview: fullPreview, data: result };
  },
};

// ============================================================
// Catégorie B — Saisie rétroactive (déclaration de complétion à une heure passée)
// ============================================================

/**
 * Use case typique : "j'ai fini la task G37 du dossier 12345 lundi à 15h au lieu de
 * vendredi à 10h". L'opérateur déclare APRÈS COUP la vraie heure de fin. Réutilise
 * l'endpoint /saisie existant (qui calcule le ratio + déclenche le recompute aval).
 *
 * Différence avec report_progress :
 *   - report_progress = "je vais finir à HH:MM" (estimation, tâche encore en cours)
 *   - record_task_completion_at = "j'ai fini à HH:MM le JJ/MM" (déclaration passée)
 *
 * Le backend gère la cascade aval naturellement via le recompute.
 */
interface MarkProgressedResult {
  completedCount: number;
  skippedCount: number;
  results: Array<{ taskId: string; action: string; reason?: string }>;
}

/**
 * Use case typique : "sur le job 12345 on a fini, on en est à l'assembleuse piqueuse".
 * Marque comme Completed toutes les tasks logiquement avant la cible :
 *   - les tasks du même élément avec sequenceOrder < target
 *   - les tasks des éléments prérequis (récursif)
 * SANS exiger qu'elles soient placées sur le planning.
 */
export const markJobProgressedPastTool: ToolDefinition = {
  name: 'mark_job_progressed_past',
  description:
    "Marque comme TERMINÉES toutes les tâches qui logiquement précèdent une tâche cible dans un job, SANS exiger qu'elles soient placées sur le planning. Use case : 'sur le job 12345 on a fini on en est à l'assembleuse piqueuse' → marque tout ce qui devait être fait avant. Couvre les tâches du même élément (sequenceOrder < target) ET les tâches des éléments prérequis (récursif). Les tâches déjà Completed/Failed/Cancelled sont skipped. Utiliser resolve_task_in_job d'abord pour obtenir taskId.",
  inputSchema: z.object({
    jobId: uuidField('resolve_job').describe('UUID du job.'),
    jobLabel: z.string().min(1).describe("Référence ou nom lisible du job (ex '12345')."),
    targetTaskId: uuidField('resolve_task_in_job').describe(
      "UUID de la tâche-repère (ex: l'assembleuse piqueuse qu'on commence ; tout AVANT sera marqué terminé).",
    ),
    targetTaskLabel: z
      .string()
      .min(1)
      .describe("Nom lisible de la tâche-repère (ex 'Duplo 10P du job 12345')."),
  }),
  handler: async (input, ctx) => {
    const preview = `Job ${input.jobLabel} : marque terminées toutes les tâches avant ${input.targetTaskLabel}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const result = await ctx.php.post<MarkProgressedResult>(
      `/api/v1/jobs/${input.jobId}/mark-progressed-past/${input.targetTaskId}`,
      {},
    );
    return {
      ok: true,
      preview: `${preview} — ${result.completedCount} terminée(s)${result.skippedCount ? `, ${result.skippedCount} déjà terminale(s)` : ''}`,
      data: result,
    };
  },
};

export const recordTaskCompletionAtTool: ToolDefinition = {
  name: 'record_task_completion_at',
  description:
    "Saisie rétroactive : déclare qu'une tâche a EFFECTIVEMENT été terminée à une date/heure passée précise. À utiliser quand l'opérateur ou le chef rapporte une complétion APRÈS COUP, possiblement bien après l'heure de fin planifiée (ex: 'j'ai fini la task G37 du dossier 12345 lundi à 15h au lieu de vendredi à 10h'). Les tâches aval qui étaient planifiées entre l'ancienne fin et la nouvelle seront recalculées par le moteur. Si l'utilisateur déclare une fin FUTURE ou si la tâche est encore en cours, utiliser report_progress plutôt.",
  inputSchema: z.object({
    taskId: uuidField('resolve_task_in_job').describe('UUID de la tâche complétée.'),
    taskLabel: z
      .string()
      .min(1)
      .describe("Nom lisible (ex 'G37 du dossier 12345')."),
    completedDate: z.string().describe("Date YYYY-MM-DD de complétion réelle."),
    completedTime: z
      .string()
      .describe("Heure HH:MM de complétion réelle (ex '15:00' pour '15h')."),
  }),
  handler: async (input, ctx) => {
    let completedAtIso: string;
    try {
      completedAtIso = toIsoWithLocalOffset(input.completedDate, input.completedTime);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const preview = `Saisie rétroactive : ${input.taskLabel} terminé le ${input.completedDate} à ${input.completedTime}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, completedAtIso, ...input } };
    }
    const result = await ctx.php.post<SaisieResult>(
      `/api/v1/scenarios/prod/saisie/${input.taskId}`,
      { estimatedEndTime: completedAtIso },
    );
    return {
      ok: true,
      preview: `${preview} — ratio ${result.productivityRatio.toFixed(2)}, progression ${Math.round(result.recordedProgressPct)}%`,
      data: result,
    };
  },
};
