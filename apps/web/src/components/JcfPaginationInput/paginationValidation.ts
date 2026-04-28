/**
 * Pagination validation for the JCF Pagination field.
 *
 * Valid values: any positive integer.
 */

/**
 * Validate whether a pagination value is valid.
 *
 * Rules:
 * - Empty string is valid (field may be optional)
 * - Value must be a strictly positive integer
 */
export function isValidPagination(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (!/^\d+$/.test(trimmed)) return false;
  return parseInt(trimmed, 10) >= 1;
}
