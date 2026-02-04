/**
 * Business Day Utilities
 *
 * v0.5.11: Outsourcing Mini-Form
 * Functions for calculating business days (Monday-Friday).
 */

/**
 * Check if a date is a business day (Monday-Friday).
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
}

/**
 * Add business days to a date.
 * Skips weekends (Saturday and Sunday).
 *
 * @param date - Start date
 * @param days - Number of business days to add (must be >= 0)
 * @returns New date after adding business days
 */
export function addBusinessDays(date: Date, days: number): Date {
  if (days < 0) {
    throw new Error('days must be non-negative');
  }

  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Subtract business days from a date.
 * Skips weekends (Saturday and Sunday).
 *
 * @param date - Start date
 * @param days - Number of business days to subtract (must be >= 0)
 * @returns New date after subtracting business days
 */
export function subtractBusinessDays(date: Date, days: number): Date {
  if (days < 0) {
    throw new Error('days must be non-negative');
  }

  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Get the next business day from a date.
 * If the date is already a business day, returns that date.
 *
 * @param date - Start date
 * @returns The same date if it's a business day, or the next business day
 */
export function getNextBusinessDay(date: Date): Date {
  const result = new Date(date);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Get the previous business day from a date.
 * If the date is already a business day, returns that date.
 *
 * @param date - Start date
 * @returns The same date if it's a business day, or the previous business day
 */
export function getPreviousBusinessDay(date: Date): Date {
  const result = new Date(date);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}
