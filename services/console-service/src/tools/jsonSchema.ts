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
