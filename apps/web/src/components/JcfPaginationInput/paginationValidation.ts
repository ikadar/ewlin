/**
 * Pagination validation for the JCF Pagination field.
 *
 * Valid values: 1 (single sheet / recto only) or any even integer ≥ 2
 * (folded signature always yields an even page count).
 */
export function isValidPagination(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (!/^\d+$/.test(trimmed)) return false;
  const n = parseInt(trimmed, 10);
  if (n === 1) return true;
  return n >= 2 && n % 2 === 0;
}
