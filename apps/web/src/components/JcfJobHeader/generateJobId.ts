/**
 * Generate a unique Job ID in J-YYYY-NNNN format.
 *
 * Example: "J-2026-0042"
 */
export function generateJobId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `J-${year}-${num}`;
}
