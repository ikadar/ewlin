/**
 * Utility for conditionally joining class names.
 * Uses clsx for efficient class name merging.
 */

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
