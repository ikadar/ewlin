/**
 * Gate manipulation tools — set the per-element status of paper / BAT / plates / forme.
 *
 * Backend canonical route: PUT /api/v1/elements/{id}/prerequisites
 * Status enums match the PaperStatus / BatStatus / PlateStatus / FormeStatus PHP enums.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { uuidField } from './ids.js';

interface ElementSummary {
  id: string;
  name: string;
  label?: string;
}

interface JobLookupResponse {
  id: string;
  reference: string;
  client?: string;
  description?: string;
  elements?: ElementSummary[];
}

interface GatePrerequisitesResponse {
  id: string;
  paperStatus: string;
  batStatus: string;
  plateStatus: string;
  formeStatus: string;
  [key: string]: unknown;
}

const PAPER_STATUSES = ['none', 'in_stock', 'to_order', 'ordered', 'delivered'] as const;
const BAT_STATUSES = ['none', 'waiting_files', 'files_received', 'bat_sent', 'bat_approved'] as const;
const PLATE_STATUSES = ['none', 'to_make', 'ready'] as const;
const FORME_STATUSES = ['none', 'in_stock', 'to_order', 'ordered', 'delivered'] as const;

const GATE_FIELD = {
  paper: 'paperStatus',
  bat: 'batStatus',
  plate: 'plateStatus',
  forme: 'formeStatus',
} as const;

const GATE_LABEL = {
  paper: 'papier',
  bat: 'BAT',
  plate: 'plaques',
  forme: 'forme',
} as const;

const ALLOWED_STATUSES = {
  paper: PAPER_STATUSES,
  bat: BAT_STATUSES,
  plate: PLATE_STATUSES,
  forme: FORME_STATUSES,
} as const;

export const resolveElementInJobTool: ToolDefinition = {
  name: 'resolve_element_in_job',
  description:
    "Retrouve l'UUID d'un élément d'un job par son nom métier (GLOBAL, PAP1, PAP2, COUV, INT...). Étape OBLIGATOIRE avant set_element_gate_status quand l'utilisateur parle d'un élément par son nom (ex: 'le papier de PAP2 du job 202510.0219'). Renvoie l'ID Flux + le libellé complet de l'élément.",
  readOnly: true,
  inputSchema: z.object({
    jobReference: z
      .string()
      .min(1)
      .describe("Référence du job (NUMDO MasterPrint), ex '202510.0219'."),
    elementName: z
      .string()
      .min(1)
      .describe("Nom court de l'élément, ex 'PAP1', 'GLOBAL', 'COUV'."),
  }),
  handler: async (input, ctx) => {
    let job: JobLookupResponse;
    try {
      job = await ctx.php.get<JobLookupResponse>(
        `/api/v1/jobs/lookup-by-reference?reference=${encodeURIComponent(input.jobReference)}`,
      );
    } catch (err) {
      return {
        ok: false,
        error: `Job '${input.jobReference}' introuvable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const elements = job.elements ?? [];
    const target = elements.find((e) => e.name.toUpperCase() === input.elementName.toUpperCase());
    if (!target) {
      const available = elements.map((e) => e.name).join(', ') || '(aucun)';
      return {
        ok: false,
        error: `Élément '${input.elementName}' introuvable dans le job ${input.jobReference}. Disponibles: ${available}`,
      };
    }
    return {
      ok: true,
      preview: `Élément '${target.name}' du job ${input.jobReference} → ${target.id}`,
      data: { elementId: target.id, name: target.name, label: target.label ?? null, jobId: job.id },
    };
  },
};

export const setElementGateStatusTool: ToolDefinition = {
  name: 'set_element_gate_status',
  description:
    "Change le statut d'une gate (papier / BAT / plaques / forme) sur un élément donné. Utiliser resolve_element_in_job d'abord pour obtenir elementId. Les statuts dépendent de la gate : paper={none,in_stock,to_order,ordered,delivered}, bat={none,waiting_files,files_received,bat_sent,bat_approved}, plate={none,to_make,ready}, forme={none,in_stock,to_order,ordered,delivered}. Le passage à 'ordered'/'delivered'/'bat_approved'/'ready' débloque la gate côté planning.",
  inputSchema: z.object({
    elementId: uuidField('resolve_element_in_job').describe(
      "UUID de l'élément (obtenu via resolve_element_in_job).",
    ),
    elementLabel: z
      .string()
      .min(1)
      .describe("Libellé lisible (ex 'PAP1 du job 202510.0219') pour la preview."),
    gate: z
      .enum(['paper', 'bat', 'plate', 'forme'])
      .describe('Quelle gate manipuler.'),
    status: z
      .string()
      .min(1)
      .describe(
        "Nouveau statut. Valeurs valides selon gate (cf. description). Erreur retournée si statut invalide pour la gate choisie.",
      ),
  }),
  handler: async (input, ctx) => {
    const gate = input.gate as keyof typeof ALLOWED_STATUSES;
    const allowed = ALLOWED_STATUSES[gate];
    if (!(allowed as readonly string[]).includes(input.status)) {
      return {
        ok: false,
        error: `Statut '${input.status}' invalide pour gate '${gate}'. Valeurs valides: ${allowed.join(', ')}`,
      };
    }
    const field = GATE_FIELD[gate];
    const label = GATE_LABEL[gate];
    const preview = `${label} de ${input.elementLabel} → ${input.status}`;

    if (ctx.dryRun) {
      return {
        ok: true,
        preview,
        data: { dryRun: true, elementId: input.elementId, [field]: input.status },
      };
    }
    const updated = await ctx.php.put<GatePrerequisitesResponse>(
      `/api/v1/elements/${input.elementId}/prerequisites`,
      { [field]: input.status },
    );
    return {
      ok: true,
      preview,
      data: {
        elementId: updated.id,
        gate: input.gate,
        status: input.status,
        allStatuses: {
          paperStatus: updated.paperStatus,
          batStatus: updated.batStatus,
          plateStatus: updated.plateStatus,
          formeStatus: updated.formeStatus,
        },
      },
    };
  },
};
