/**
 * Parser for the papier DSL used in ElementSpec.
 * Format: "PaperType:grammage" (e.g., "Couché mat:135")
 * Or just a type with no colon (e.g., "Offset")
 */
export function parsePapierDSL(papier: string): { type: string; grammage: string } {
  const colonIdx = papier.indexOf(':');
  if (colonIdx === -1) return { type: papier.trim(), grammage: '' };
  return {
    type: papier.slice(0, colonIdx).trim(),
    grammage: papier.slice(colonIdx + 1).trim() + 'g',
  };
}
