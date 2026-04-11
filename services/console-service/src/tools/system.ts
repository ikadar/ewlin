/**
 * System tools — only the LLM calls these, never the user or external clients.
 *
 * - propose_plan : the LLM signals it has finished reasoning and presents
 *   the action plan for user confirmation.
 * - ask_user     : the LLM needs to disambiguate (e.g., multiple Frédérics)
 *   and asks the user a question. The frontend renders the question, the
 *   user answers, the conversation continues with the answer appended.
 *
 * Both tools simply return their inputs structured. The LLM execute loop
 * detects them by name and short-circuits the loop accordingly.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const proposePlanTool: ToolDefinition = {
  name: 'propose_plan',
  description:
    "ÉTAPE FINALE OBLIGATOIRE quand tu as fini de raisonner et que tu veux proposer une action concrète à l'utilisateur. Tu DOIS appeler ce tool pour terminer ton tour. Inclus une narration claire en français et la liste structurée des actions à appliquer.",
  internal: true,
  inputSchema: z.object({
    narration: z
      .string()
      .min(1)
      .describe("Phrase en français qui résume ce que tu vas faire, claire et concise."),
    actions: z
      .array(
        z.object({
          tool: z.string().min(1).describe("Nom du tool (snake_case) à appeler."),
          args: z.record(z.unknown()).describe("Arguments du tool, clés en camelCase."),
          preview: z
            .string()
            .min(1)
            .describe("Description en français d'une ligne de cette action précise."),
        }),
      )
      .min(1),
  }),
  handler: async (input) => ({
    ok: true,
    data: {
      kind: 'plan',
      narration: input.narration,
      actions: input.actions,
    },
  }),
};

export const askUserTool: ToolDefinition = {
  name: 'ask_user',
  description:
    "Pose une question à l'utilisateur quand tu as besoin de désambiguïser une référence (deux opérateurs avec le même prénom, deux jobs proches, intention floue). Utilise des options courtes si tu peux les énumérer. La conversation continuera avec la réponse de l'utilisateur.",
  internal: true,
  inputSchema: z.object({
    question: z.string().min(1).describe("La question à poser, en français."),
    options: z
      .array(z.string())
      .optional()
      .describe("Options de réponse rapide à présenter, chacune au format label court."),
  }),
  handler: async (input) => ({
    ok: true,
    data: {
      kind: 'question',
      question: input.question,
      options: input.options ?? [],
    },
  }),
};
