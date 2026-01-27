/**
 * Pagination validation for the JCF Pagination field.
 *
 * Valid values: 2 (feuillet) or multiples of 4 (cahier: 4, 8, 12, 16, ...)
 *
 * @see implicit-logic-specification.md §1.6 (Pagination)
 */

/**
 * Validate whether a pagination value is valid.
 *
 * Rules:
 * - Empty string is valid (field may be optional)
 * - Value must be exactly 2 (feuillet) or a multiple of 4 (cahier)
 * - Values like 1, 3, 5, 6, 7, 9, 10, 11 are invalid
 */
export function isValidPagination(value: string): boolean {
  if (value === '') return true;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1) return false;
  return num === 2 || (num >= 4 && num % 4 === 0);
}
