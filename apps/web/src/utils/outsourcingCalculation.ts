/**
 * Outsourcing Calculation Utilities
 *
 * v0.5.11: Outsourcing Mini-Form
 * Functions for calculating departure and return dates for outsourced tasks.
 *
 * Based on the outsourcing specification:
 * - Departure: predecessor end time compared to latestDepartureTime
 * - Return: departure + transitDays (outbound) + workDays + transitDays (return)
 */

import { addBusinessDays } from './businessDays';

/**
 * Parameters for outsourcing calculations.
 */
export interface OutsourcingParams {
  /** Number of business days for the work at provider */
  workDays: number;
  /** Latest time to send work (HH:MM format, e.g., "14:00") */
  latestDepartureTime: string;
  /** Time when work is received back (HH:MM format, e.g., "09:00") */
  receptionTime: string;
  /** Number of business days for transit (same for outbound and return) */
  transitDays: number;
}

/**
 * Parse a time string (HH:MM) into hours and minutes.
 */
export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Set time on a date from an HH:MM string.
 */
export function setTimeOnDate(date: Date, time: string): Date {
  const result = new Date(date);
  const { hours, minutes } = parseTime(time);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Calculate the departure date/time based on predecessor end time.
 *
 * Rules:
 * - If predecessor ends ≤ latestDepartureTime on day X → departure = day X at latestDepartureTime
 * - If predecessor ends > latestDepartureTime on day X → departure = next business day at latestDepartureTime
 *
 * @param predecessorEndTime - When the predecessor task ends (ISO string or Date)
 * @param latestDepartureTime - Latest departure time (HH:MM format)
 * @returns Departure date/time as Date
 */
export function calculateDepartureDate(
  predecessorEndTime: Date | string,
  latestDepartureTime: string
): Date {
  const endTime = typeof predecessorEndTime === 'string'
    ? new Date(predecessorEndTime)
    : new Date(predecessorEndTime);

  const { hours: latestHours, minutes: latestMinutes } = parseTime(latestDepartureTime);
  const endHours = endTime.getHours();
  const endMinutes = endTime.getMinutes();

  // Compare end time with latest departure time
  const endTimeMinutes = endHours * 60 + endMinutes;
  const latestTimeMinutes = latestHours * 60 + latestMinutes;

  let departureDate: Date;

  if (endTimeMinutes <= latestTimeMinutes) {
    // Same day departure
    departureDate = new Date(endTime);
  } else {
    // Next business day departure
    departureDate = addBusinessDays(endTime, 1);
  }

  // Set the departure time
  departureDate.setHours(latestHours, latestMinutes, 0, 0);
  return departureDate;
}

/**
 * Calculate the return date/time based on departure date.
 *
 * Timeline:
 * departure → transit (T days) → work (N days) → transit (T days) → return at receptionTime
 *
 * @param departureDate - When work leaves for the provider
 * @param params - Outsourcing parameters
 * @returns Return date/time as Date
 */
export function calculateReturnDate(
  departureDate: Date | string,
  params: Pick<OutsourcingParams, 'workDays' | 'transitDays' | 'receptionTime'>
): Date {
  const departure = typeof departureDate === 'string'
    ? new Date(departureDate)
    : new Date(departureDate);

  const { workDays, transitDays, receptionTime } = params;

  // Total business days: transit out + work + transit back
  const totalDays = transitDays + workDays + transitDays;

  // Add business days to departure
  const returnDate = addBusinessDays(departure, totalDays);

  // Set the reception time
  const { hours, minutes } = parseTime(receptionTime);
  returnDate.setHours(hours, minutes, 0, 0);

  return returnDate;
}

/**
 * Calculate both departure and return dates for an outsourced task.
 *
 * @param predecessorEndTime - When the predecessor task ends (or undefined if not scheduled)
 * @param params - Outsourcing parameters
 * @returns Object with departure and return dates, or null if predecessor not scheduled
 */
export function calculateOutsourcingDates(
  predecessorEndTime: Date | string | undefined,
  params: OutsourcingParams
): { departure: Date; return: Date } | null {
  if (!predecessorEndTime) {
    return null;
  }

  const departure = calculateDepartureDate(predecessorEndTime, params.latestDepartureTime);
  const returnDate = calculateReturnDate(departure, params);

  return {
    departure,
    return: returnDate,
  };
}

/**
 * Format a date/time for display in the mini-form.
 * Format: "DD/MM HH:MM"
 */
export function formatOutsourcingDateTime(date: Date | string | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * Parse a date/time string from the mini-form format.
 * Expected format: "DD/MM HH:MM" or "DD/MM/YYYY HH:MM"
 *
 * @param value - Input string
 * @param referenceYear - Year to use if not provided in input (defaults to current year)
 * @returns Date object or null if invalid
 */
export function parseOutsourcingDateTime(value: string, referenceYear?: number): Date | null {
  if (!value) return null;

  const year = referenceYear ?? new Date().getFullYear();

  // Try format: DD/MM HH:MM
  const shortMatch = value.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (shortMatch) {
    const [, day, month, hours, minutes] = shortMatch;
    const date = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    return isNaN(date.getTime()) ? null : date;
  }

  // Try format: DD/MM/YYYY HH:MM
  const longMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (longMatch) {
    const [, day, month, fullYear, hours, minutes] = longMatch;
    const date = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}
