/**
 * Workshop configuration tools — operator skills, concurrent pairs (paires),
 * and station characteristics. These are structural mutations meant to be
 * triggered by the chef d'atelier via natural language.
 *
 * Backend routes:
 *   - PUT /api/v1/operators/{id}/skills
 *   - POST/DELETE /api/v1/operators/{id}/concurrent-groups[/id]
 *   - PUT /api/v1/stations/{id}
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { uuidField } from './ids.js';

interface OperatorSkill {
  stationId: string;
  proficiency?: number;
  setupProficiency?: number;
  runProficiency?: number;
}

interface OperatorWithSkills {
  id: string;
  firstName: string;
  lastName: string;
  skills?: OperatorSkill[];
  [key: string]: unknown;
}

interface StationResponse {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ConcurrentGroupResponse {
  id: string;
  [key: string]: unknown;
}

// ============================================================
// Skills
// ============================================================

export const setOperatorSkillTool: ToolDefinition = {
  name: 'set_operator_skill',
  description:
    "Définit (ou met à jour) une compétence d'un opérateur sur une station. Si la skill existe déjà, on met à jour ses proficiencies ; sinon on l'ajoute. Pour SUPPRIMER une skill, passer setupProficiency=0 ET runProficiency=0 (l'opérateur ne peut alors plus opérer la station). Utiliser resolve_operator + resolve_station d'abord pour obtenir les UUIDs. Pour ramener une skill à un état neutre, utiliser proficiency=1.0 (1.0 = standard, <1 plus lent, >1 plus rapide).",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator').describe("UUID de l'opérateur."),
    operatorLabel: z
      .string()
      .min(1)
      .describe("Nom lisible de l'opérateur (ex 'Cindy Auzanneau')."),
    stationId: uuidField('resolve_station').describe('UUID de la station.'),
    stationLabel: z.string().min(1).describe("Nom lisible de la station (ex 'Stahl')."),
    setupProficiency: z
      .number()
      .min(0)
      .max(2)
      .describe('Proficiency calage (0 = ne sait pas faire, 1.0 = standard, >1 plus rapide).'),
    runProficiency: z
      .number()
      .min(0)
      .max(2)
      .describe('Proficiency roule (0 = ne sait pas faire, 1.0 = standard, >1 plus rapide).'),
  }),
  handler: async (input, ctx) => {
    const preview = `${input.operatorLabel} ↔ ${input.stationLabel} : setup=${input.setupProficiency}, run=${input.runProficiency}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const op = await ctx.php.get<OperatorWithSkills>(
      `/api/v1/operators/${input.operatorId}`,
    );
    const skills = (op.skills ?? []).slice();
    const existingIdx = skills.findIndex((s) => s.stationId === input.stationId);
    const newSkill: OperatorSkill = {
      stationId: input.stationId,
      proficiency: (input.setupProficiency + input.runProficiency) / 2,
      setupProficiency: input.setupProficiency,
      runProficiency: input.runProficiency,
    };
    if (existingIdx >= 0) skills[existingIdx] = newSkill;
    else skills.push(newSkill);
    await ctx.php.put<unknown>(`/api/v1/operators/${input.operatorId}/skills`, skills);
    return { ok: true, preview, data: { operatorId: input.operatorId, stationId: input.stationId } };
  },
};

// ============================================================
// Concurrent pairs (paires de machines)
// ============================================================

export const addOperatorConcurrentPairTool: ToolDefinition = {
  name: 'add_operator_concurrent_pair',
  description:
    "Crée une paire de stations conduisible simultanément par un opérateur. Quand l'opérateur est sur cette paire, l'algo peut planifier les 2 stations en parallèle (typiquement utile pour deux machines à temps masqué). La productivity1 et productivity2 indiquent le rendement de chaque station quand les deux tournent ensemble (souvent <1 car attention partagée). 1.0 = pleine productivité, 0.5 = moitié, etc.",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator').describe("UUID de l'opérateur."),
    operatorLabel: z.string().min(1).describe("Nom lisible de l'opérateur."),
    station1Id: uuidField('resolve_station').describe('UUID 1ère station de la paire.'),
    station1Label: z.string().min(1).describe("Nom lisible 1ère station."),
    station2Id: uuidField('resolve_station').describe('UUID 2ème station de la paire.'),
    station2Label: z.string().min(1).describe("Nom lisible 2ème station."),
    productivity1: z
      .number()
      .min(0)
      .max(1.5)
      .describe('Productivité station 1 quand les 2 tournent en simultané.'),
    productivity2: z
      .number()
      .min(0)
      .max(1.5)
      .describe('Productivité station 2 quand les 2 tournent en simultané.'),
  }),
  handler: async (input, ctx) => {
    if (input.station1Id === input.station2Id) {
      return { ok: false, error: 'Les deux stations de la paire doivent être différentes.' };
    }
    const preview = `${input.operatorLabel} paire ${input.station1Label}(${input.productivity1}) + ${input.station2Label}(${input.productivity2})`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const body = {
      stationIds: [input.station1Id, input.station2Id],
      effectiveProductivity: {
        [input.station1Id]: input.productivity1,
        [input.station2Id]: input.productivity2,
      },
    };
    const created = await ctx.php.post<ConcurrentGroupResponse>(
      `/api/v1/operators/${input.operatorId}/concurrent-groups`,
      body,
    );
    return {
      ok: true,
      preview,
      data: { operatorId: input.operatorId, groupId: created.id },
    };
  },
};

export const removeOperatorConcurrentPairTool: ToolDefinition = {
  name: 'remove_operator_concurrent_pair',
  description:
    "Supprime une paire de stations d'un opérateur. À utiliser quand on retire la possibilité pour cet opérateur de conduire 2 stations en simultané (ex: changement d'organisation, machine retirée).",
  inputSchema: z.object({
    operatorId: uuidField('resolve_operator').describe("UUID de l'opérateur."),
    operatorLabel: z.string().min(1).describe("Nom lisible de l'opérateur."),
    groupId: uuidField('resolve_operator').describe('UUID de la paire à supprimer.'),
    pairDescription: z
      .string()
      .min(1)
      .describe("Description de la paire pour la preview (ex 'Stahl + MBO')."),
  }),
  handler: async (input, ctx) => {
    const preview = `${input.operatorLabel} : suppression paire ${input.pairDescription}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    await ctx.php.delete<unknown>(
      `/api/v1/operators/${input.operatorId}/concurrent-groups/${input.groupId}`,
    );
    return { ok: true, preview, data: { operatorId: input.operatorId, groupId: input.groupId } };
  },
};

// ============================================================
// Station characteristics
// ============================================================

export const updateStationCapacityTool: ToolDefinition = {
  name: 'update_station_capacity',
  description:
    "Change la capacité (nombre de tâches en parallèle) d'une station. Par défaut 1. À utiliser quand on ajoute un second poste sur une station qui peut accueillir 2 tâches simultanées.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe('UUID de la station.'),
    stationLabel: z.string().min(1).describe('Nom lisible de la station.'),
    capacity: z.number().int().min(1).max(20).describe('Nouvelle capacité (>= 1).'),
  }),
  handler: async (input, ctx) => {
    const preview = `${input.stationLabel} : capacity → ${input.capacity}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const updated = await ctx.php.put<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
      { capacity: input.capacity },
    );
    return { ok: true, preview, data: { stationId: updated.id, capacity: input.capacity } };
  },
};

export const updateStationAttentionTool: ToolDefinition = {
  name: 'update_station_attention',
  description:
    "Change le coefficient d'attention d'une station (setup, run ou les deux). Le coefficient pondère le temps de présence opérateur requis (0 = pas de présence, 1 = présence pleine, >1 = plusieurs opérateurs requis simultanément). Au moins un des deux champs doit être fourni.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe('UUID de la station.'),
    stationLabel: z.string().min(1).describe('Nom lisible de la station.'),
    attentionSetup: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe('Attention requise pendant le calage (optionnel).'),
    attentionRun: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe('Attention requise pendant le roule (optionnel).'),
  }),
  handler: async (input, ctx) => {
    if (input.attentionSetup === undefined && input.attentionRun === undefined) {
      return { ok: false, error: 'Au moins un des champs attentionSetup / attentionRun doit être fourni.' };
    }
    const parts: string[] = [];
    if (input.attentionSetup !== undefined) parts.push(`setup=${input.attentionSetup}`);
    if (input.attentionRun !== undefined) parts.push(`run=${input.attentionRun}`);
    const preview = `${input.stationLabel} : attention ${parts.join(', ')}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    const body: Record<string, number> = {};
    if (input.attentionSetup !== undefined) body.attentionSetup = input.attentionSetup;
    if (input.attentionRun !== undefined) body.attentionRun = input.attentionRun;
    await ctx.php.put<StationResponse>(`/api/v1/stations/${input.stationId}`, body);
    return { ok: true, preview, data: { stationId: input.stationId, ...body } };
  },
};

export const updateStationPeremptionThresholdTool: ToolDefinition = {
  name: 'update_station_peremption_threshold',
  description:
    "Change le délai (en minutes) au-delà duquel le calage d'une station est considéré comme périmé et doit être refait. Typique : 120 min pour une presse offset (le calage tient 2h), 9999 (= illimité) pour les machines dont le calage est mécanique et tient indéfiniment.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe('UUID de la station.'),
    stationLabel: z.string().min(1).describe('Nom lisible de la station.'),
    minutes: z.number().int().min(1).describe('Délai en minutes avant péremption du calage.'),
  }),
  handler: async (input, ctx) => {
    const preview = `${input.stationLabel} : péremption calage → ${input.minutes} min`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    await ctx.php.put<StationResponse>(
      `/api/v1/stations/${input.stationId}`,
      { peremptionThresholdMinutes: input.minutes },
    );
    return { ok: true, preview, data: { stationId: input.stationId, peremptionThresholdMinutes: input.minutes } };
  },
};

export const updateStationOperatorRequirementsTool: ToolDefinition = {
  name: 'update_station_operator_requirements',
  description:
    "Change le nombre min/max d'opérateurs requis pour conduire une station, séparément pour le calage et le roule. Au moins un des 4 champs doit être fourni. Ex: 'la Stahl demande 2 opérateurs minimum en calage' → minSetup=2.",
  inputSchema: z.object({
    stationId: uuidField('resolve_station').describe('UUID de la station.'),
    stationLabel: z.string().min(1).describe('Nom lisible de la station.'),
    minSetup: z.number().int().min(0).optional().describe('Min opérateurs en calage.'),
    maxSetup: z.number().int().min(0).optional().describe('Max opérateurs en calage.'),
    minRun: z.number().int().min(0).optional().describe('Min opérateurs en roule.'),
    maxRun: z.number().int().min(0).optional().describe('Max opérateurs en roule.'),
  }),
  handler: async (input, ctx) => {
    const body: Record<string, number> = {};
    const parts: string[] = [];
    if (input.minSetup !== undefined) { body.minSetupOperators = input.minSetup; parts.push(`minSetup=${input.minSetup}`); }
    if (input.maxSetup !== undefined) { body.maxSetupOperators = input.maxSetup; parts.push(`maxSetup=${input.maxSetup}`); }
    if (input.minRun !== undefined) { body.minRunOperators = input.minRun; parts.push(`minRun=${input.minRun}`); }
    if (input.maxRun !== undefined) { body.maxRunOperators = input.maxRun; parts.push(`maxRun=${input.maxRun}`); }
    if (Object.keys(body).length === 0) {
      return { ok: false, error: 'Au moins un des champs min/max setup/run doit être fourni.' };
    }
    const preview = `${input.stationLabel} : ${parts.join(', ')}`;
    if (ctx.dryRun) {
      return { ok: true, preview, data: { dryRun: true, ...input } };
    }
    await ctx.php.put<StationResponse>(`/api/v1/stations/${input.stationId}`, body);
    return { ok: true, preview, data: { stationId: input.stationId, ...body } };
  },
};
