/**
 * Scheduling directive tools — operator absences + station maintenance.
 *
 * These tools write to the domain entities directly (not through the
 * deprecated `SchedulingConstraint` table):
 *
 *   - Operator absence  →  PATCH /api/v1/operators/{id}  (absences array)
 *   - Station maintenance →  PATCH /api/v1/stations/{id} (scheduleExceptions array)
 *
 * Both endpoints replace the full array on write, so we read first,
 * append or remove, then write the new full list. Matches how the
 * admin Settings UI already operates (OperatorsPage, StationsPage).
 *
 * Tool names stay stable for backward-compat with LLM callers + MCP
 * clients that may have memorised the `add_operator_absence` handle.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { isIsoDate, toIsoWithLocalOffset } from './dates.js';
import { uuidField } from './ids.js';

interface OperatorAbsence {
  startAt: string;
  endAt: string;
  reason?: string | null;
}

interface OperatorResponse {
  id: string;
  firstName: string;
  lastName: string;
  absences?: OperatorAbsence[] | null;
  [key: string]: unknown;
}

interface ScheduleException {
  date: string;
  type?: string | null;
  schedule?: {
    isOperating: boolean;
    slots: { start: string; end: string }[];
  } | null;
  reason?: string | null;
}

interface StationResponse {
  id: string;
  name: string;
  scheduleExceptions?: ScheduleException[] | null;
  [key: string]: unknown;
}

// Stable id for an entry so list_active_constraints / cancel_constraint
// can round-trip between listing and deletion without a real DB id.
function operatorAbsenceKey(operatorId: string, absence: OperatorAbsence): string {
  return `op:${operatorId}:${absence.startAt}:${absence.endAt}`;
}

function stationExceptionKey(stationId: string, exception: ScheduleException): string {
  return `st:${stationId}:${exception.date}`;
}

export const addOperatorAbsenceTool: ToolDefinition = {
  name: 'add_operator_absence',
  description:
    "Marque un opérateur comme absent sur un intervalle de dates (jours inclus). Utiliser resolve_operator d'abord pour obtenir l'ID. La voie canonique : Operator.absences (pas SchedulingConstraint).",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator').describe(
      "UUID de l'opérateur, OBTENU EN APPELANT resolve_operator(name=...) D'ABORD.",
    ),
    operatorLabel: z
      .string()
      .min(1)
      .describe("Nom lisible de l'opérateur, ex 'Frédéric Dupont'."),
    fromDate: z.string().describe("Premier jour d'absence inclus, YYYY-MM-DD."),
    toDate: z.string().describe("Dernier jour d'absence inclus, YYYY-MM-DD."),
    reason: z.string().optional().describe('Motif optionnel.'),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.fromDate) || !isIsoDate(input.toDate)) {
      return { ok: false, error: 'fromDate and toDate must be YYYY-MM-DD' };
    }
    if (input.toDate < input.fromDate) {
      return { ok: false, error: 'toDate must be >= fromDate' };
    }
    const startAt = toIsoWithLocalOffset(input.fromDate, '00:00');
    const endAt = toIsoWithLocalOffset(input.toDate, '23:59');
    const reasonText = input.reason ?? null;

    const newAbsence: OperatorAbsence = {
      startAt,
      endAt,
      reason: reasonText,
    };

    const preview = `${input.operatorLabel} absent du ${input.fromDate} au ${input.toDate}${
      reasonText ? ` (${reasonText})` : ''
    }`;

    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: {
          dryRun: true,
          operatorId: input.operatorId,
          absence: newAbsence,
        },
      };
    }

    // Read current operator, append the absence, PATCH back.
    const current = await ctx.php.get<OperatorResponse>(
      `/api/v1/operators/${input.operatorId}`,
    );
    const absences = [...(current.absences ?? []), newAbsence];
    const updated = await ctx.php.put<OperatorResponse>(
      `/api/v1/operators/${input.operatorId}`,
      { absences },
    );
    return {
      ok: true,
      preview,
      data: {
        absence: {
          id: operatorAbsenceKey(input.operatorId, newAbsence),
          operatorId: input.operatorId,
          startAt,
          endAt,
          reason: reasonText,
        },
        operator: updated,
      },
    };
  },
};

export const addStationMaintenanceTool: ToolDefinition = {
  name: 'add_station_maintenance',
  description:
    "Déclare une station en maintenance sur une journée (schedule exception). Pour un créneau intra-jour, passer operatingSlots = liste des plages pendant lesquelles la station OPÈRE ce jour-là (les autres plages seront bloquées). Pour toute la journée, laisser operatingSlots vide → journée fermée.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe(
      "UUID de la station, OBTENU EN APPELANT resolve_station(name=...) D'ABORD.",
    ),
    stationLabel: z.string().min(1).describe("Nom lisible de la station, ex 'MBO XL'."),
    date: z.string().describe('Date de la maintenance, YYYY-MM-DD.'),
    operatingSlots: z
      .array(
        z.object({
          start: z.string().describe('HH:MM'),
          end: z.string().describe('HH:MM'),
        }),
      )
      .optional()
      .describe(
        "Plages pendant lesquelles la station OPÈRE ce jour-là. Omis = journée entièrement fermée.",
      ),
    reason: z.string().optional().describe('Motif optionnel.'),
  }),
  handler: async (input, ctx) => {
    if (!isIsoDate(input.date)) {
      return { ok: false, error: 'date must be YYYY-MM-DD' };
    }
    const reasonText = input.reason ?? null;
    const slots = input.operatingSlots ?? [];
    const exception: ScheduleException =
      slots.length === 0
        ? {
            date: input.date,
            type: 'closed',
            schedule: null,
            reason: reasonText,
          }
        : {
            date: input.date,
            type: 'custom',
            schedule: { isOperating: true, slots },
            reason: reasonText,
          };

    const previewSlots =
      slots.length === 0
        ? 'journée entière'
        : slots.map((s: { start: string; end: string }) => `${s.start}-${s.end}`).join(', ');
    const preview = `${input.stationLabel} maintenance le ${input.date} (${previewSlots})${
      reasonText ? ` — ${reasonText}` : ''
    }`;

    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: {
          dryRun: true,
          stationId: input.stationId,
          exception,
        },
      };
    }

    const current = await ctx.php.get<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
    );
    const filtered = (current.scheduleExceptions ?? []).filter(
      (e) => e.date !== input.date,
    );
    const scheduleExceptions = [...filtered, exception];
    const updated = await ctx.php.put<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
      { scheduleExceptions },
    );
    return {
      ok: true,
      preview,
      data: {
        exception: {
          id: stationExceptionKey(input.stationId, exception),
          stationId: input.stationId,
          ...exception,
        },
        station: updated,
      },
    };
  },
};

export const cancelConstraintTool: ToolDefinition = {
  name: 'cancel_constraint',
  description:
    "Supprime une absence d'opérateur ou une maintenance de station. L'ID est fourni par list_active_constraints (format `op:{operatorId}:{startAt}:{endAt}` ou `st:{stationId}:{date}`).",
  inputSchema: z.object({
    constraintId: z
      .string()
      .min(1)
      .describe(
        'Identifiant composite retourné par list_active_constraints (`op:...` ou `st:...`).',
      ),
    label: z.string().optional().describe("Description lisible pour le preview."),
  }),
  handler: async (input, ctx) => {
    const preview = `Annuler ${input.label ?? input.constraintId}`;
    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, constraintId: input.constraintId },
      };
    }

    const parts = input.constraintId.split(':');
    if (parts[0] === 'op' && parts.length === 4) {
      const [, operatorId, startAt, endAt] = parts;
      const current = await ctx.php.get<OperatorResponse>(
        `/api/v1/operators/${operatorId}`,
      );
      const absences = (current.absences ?? []).filter(
        (a) => a.startAt !== startAt || a.endAt !== endAt,
      );
      await ctx.php.put(`/api/v1/operators/${operatorId}`, { absences });
      return {
        ok: true,
        preview,
        data: { deleted: input.constraintId, kind: 'operator-absence' },
      };
    }
    if (parts[0] === 'st' && parts.length === 3) {
      const [, stationId, date] = parts;
      const current = await ctx.php.get<StationResponse>(
        `/api/v1/stations/${stationId}`,
      );
      const scheduleExceptions = (current.scheduleExceptions ?? []).filter(
        (e) => e.date !== date,
      );
      await ctx.php.put(`/api/v1/stations/${stationId}`, { scheduleExceptions });
      return {
        ok: true,
        preview,
        data: { deleted: input.constraintId, kind: 'station-exception' },
      };
    }
    return {
      ok: false,
      error: `Unrecognised constraint id format: ${input.constraintId}`,
    };
  },
};

export const listActiveConstraintsTool: ToolDefinition = {
  name: 'list_active_constraints',
  description:
    "Liste les absences opérateur et maintenances station actives ou à venir. Filtrer par date optionnelle. Agrège Operator.absences + Station.scheduleExceptions.",
  readOnly: true,
  inputSchema: z.object({
    fromDate: z
      .string()
      .optional()
      .describe("Date YYYY-MM-DD à partir de laquelle considérer actif. Défaut: aujourd'hui."),
  }),
  handler: async (input, ctx) => {
    const cutoff = input.fromDate ?? ctx.todayIso;

    const [operatorsRaw, stationsRaw] = await Promise.all([
      ctx.php.get<OperatorResponse[] | { items: OperatorResponse[] }>('/api/v1/operators'),
      ctx.php.get<StationResponse[] | { items: StationResponse[] }>('/api/v1/stations'),
    ]);
    const operators = Array.isArray(operatorsRaw) ? operatorsRaw : operatorsRaw.items ?? [];
    const stations = Array.isArray(stationsRaw) ? stationsRaw : stationsRaw.items ?? [];

    const entries: Array<{
      id: string;
      kind: 'operator-absence' | 'station-exception';
      targetId: string;
      targetLabel: string;
      startDate: string;
      endDate: string;
      description: string | null;
    }> = [];

    for (const op of operators) {
      for (const abs of op.absences ?? []) {
        const endDate = abs.endAt.slice(0, 10);
        if (endDate < cutoff) continue;
        entries.push({
          id: operatorAbsenceKey(op.id, abs),
          kind: 'operator-absence',
          targetId: op.id,
          targetLabel: `${op.firstName} ${op.lastName}`,
          startDate: abs.startAt.slice(0, 10),
          endDate,
          description: abs.reason ?? null,
        });
      }
    }

    for (const st of stations) {
      for (const exc of st.scheduleExceptions ?? []) {
        if (exc.date < cutoff) continue;
        entries.push({
          id: stationExceptionKey(st.id, exc),
          kind: 'station-exception',
          targetId: st.id,
          targetLabel: st.name,
          startDate: exc.date,
          endDate: exc.date,
          description: exc.reason ?? null,
        });
      }
    }

    return {
      ok: true,
      data: {
        constraints: entries,
        count: entries.length,
      },
    };
  },
};
