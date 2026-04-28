/**
 * Minimal zod → JSON Schema converter for LLM function calling.
 *
 * Ollama (in OpenAI-compatible mode) and Claude both accept JSON Schema
 * as the function input format. We don't need the full spec — only the
 * subset we use in our tool inputs: object, string, number, boolean,
 * array, enum, optional fields, descriptions.
 *
 * If the schema becomes more elaborate (unions, refinements, etc.) we
 * can swap to `zod-to-json-schema` from npm — but the tradeoff is added
 * dependency weight for one extra-corner case.
 */
import { z, ZodTypeAny } from 'zod';

export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return walk(schema);
}

/**
 * Render a JSON Schema as a compact TypeScript-like signature, e.g.
 * `{ constraintId: string, label?: string }` or
 * `{ ids: string[], mode?: 'all' | 'subset' }`.
 *
 * Used in the system prompt for action tools whose schema needs to be
 * conveyed to the LLM but isn't on the function-calling channel — the
 * verbose JSON Schema form costs ~7× the tokens for the same info.
 * Per-property descriptions are dropped (already covered by the tool's
 * own description); types only.
 */
export function compactJsonSchema(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'unknown';
  const s = schema as Record<string, unknown>;

  if (Array.isArray(s.anyOf)) return s.anyOf.map(compactJsonSchema).join(' | ');
  if (Array.isArray(s.oneOf)) return s.oneOf.map(compactJsonSchema).join(' | ');

  if (Array.isArray(s.enum)) {
    return s.enum
      .map((v) => (typeof v === 'string' ? `'${v}'` : String(v)))
      .join(' | ');
  }

  switch (s.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `${compactJsonSchema(s.items)}[]`;
    case 'object': {
      const props = (s.properties as Record<string, unknown>) ?? {};
      const required = new Set<string>(Array.isArray(s.required) ? s.required as string[] : []);
      const entries = Object.entries(props).map(([key, value]) => {
        const optional = required.has(key) ? '' : '?';
        return `${key}${optional}: ${compactJsonSchema(value)}`;
      });
      return `{ ${entries.join(', ')} }`;
    }
    default:
      return typeof s.type === 'string' ? s.type : 'unknown';
  }
}

function walk(schema: ZodTypeAny): Record<string, unknown> {
  const def = (schema as { _def: { typeName: string; description?: string } })._def;
  const description = (schema as { description?: string }).description;

  // Unwrap optional
  if (def.typeName === 'ZodOptional') {
    const inner = (schema as unknown as z.ZodOptional<ZodTypeAny>).unwrap();
    return walk(inner);
  }
  // Unwrap nullable
  if (def.typeName === 'ZodNullable') {
    const inner = (schema as unknown as z.ZodNullable<ZodTypeAny>).unwrap();
    const sub = walk(inner);
    return { ...sub, nullable: true };
  }
  // Default value
  if (def.typeName === 'ZodDefault') {
    const inner = (schema as unknown as z.ZodDefault<ZodTypeAny>)._def.innerType;
    return walk(inner);
  }

  if (def.typeName === 'ZodObject') {
    const obj = schema as unknown as z.ZodObject<z.ZodRawShape>;
    const shape = obj.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = walk(value as ZodTypeAny);
      const valueDef = (value as { _def: { typeName: string } })._def;
      if (valueDef.typeName !== 'ZodOptional' && valueDef.typeName !== 'ZodDefault') {
        required.push(key);
      }
    }
    const result: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) result['required'] = required;
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodString') {
    const result: Record<string, unknown> = { type: 'string' };
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodNumber') {
    const result: Record<string, unknown> = { type: 'number' };
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodBoolean') {
    const result: Record<string, unknown> = { type: 'boolean' };
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodArray') {
    const arr = schema as unknown as z.ZodArray<ZodTypeAny>;
    const result: Record<string, unknown> = {
      type: 'array',
      items: walk(arr.element),
    };
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodEnum') {
    const en = schema as unknown as z.ZodEnum<[string, ...string[]]>;
    const result: Record<string, unknown> = {
      type: 'string',
      enum: en.options,
    };
    if (description) result['description'] = description;
    return result;
  }

  if (def.typeName === 'ZodLiteral') {
    const lit = schema as unknown as z.ZodLiteral<string | number | boolean>;
    const value = lit.value;
    const type = typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'boolean';
    return { type, enum: [value], ...(description ? { description } : {}) };
  }

  if (def.typeName === 'ZodRecord') {
    return { type: 'object', additionalProperties: true, ...(description ? { description } : {}) };
  }

  // Fallback — accept anything
  return { ...(description ? { description } : {}) };
}
