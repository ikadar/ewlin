/**
 * JCF Elements Table - Level 2 Required Field Logic
 *
 * Computes which fields are required based on BLOC triggers.
 * Required fields show amber dot indicators (not errors) as visual guidance.
 *
 * @see docs/releases/v0.4.24-jcf-required-indicators-calculated-fields.md
 * @see reference/jcf/docs/implicit-logic-specification.md §2.2
 */

import type { JcfElement, JcfFieldKey } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RequiredField {
  /** Element index in the array */
  elementIndex: number;
  /** Field key that is required */
  field: JcfFieldKey;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if element has any content (non-empty fields)
 */
export function hasElementContent(element: JcfElement): boolean {
  return !!(
    element.papier ||
    element.imposition ||
    element.sequence ||
    element.impression ||
    element.surfacage ||
    element.format ||
    element.pagination ||
    element.quantite !== '1' || // Default is '1', so check for non-default
    element.qteFeuilles ||
    element.autres ||
    element.commentaires
  );
}

/**
 * Check if BLOC SUPPORT trigger is active
 * Triggered by: imposition OR impression OR surfacage OR format
 */
export function hasBlocSupportTrigger(element: JcfElement): boolean {
  return !!(
    element.imposition ||
    element.impression ||
    element.surfacage ||
    element.format
  );
}

/**
 * Check if BLOC IMPRESSION trigger is active
 * Triggered by: imposition OR impression
 */
export function hasBlocImpressionTrigger(element: JcfElement): boolean {
  return !!(element.imposition || element.impression);
}

// ── Main Function ────────────────────────────────────────────────────────────

export type JcfMode = 'job' | 'template';

/**
 * Get required fields for a single element
 *
 * @param element - The element to check
 * @param index - Element index for tracking
 * @param mode - 'job' or 'template' mode
 * @returns Array of required field descriptors
 */
/**
 * Add required field if the element is missing the specified value.
 * Helper to reduce cognitive complexity.
 */
function addIfMissing(
  required: RequiredField[],
  element: JcfElement,
  index: number,
  field: JcfFieldKey,
): void {
  if (!element[field]) {
    required.push({ elementIndex: index, field });
  }
}

/**
 * Fields required for BLOC SUPPORT.
 */
const BLOC_SUPPORT_FIELDS: JcfFieldKey[] = ['papier', 'pagination', 'format', 'qteFeuilles', 'imposition'];

export function getRequiredFields(
  element: JcfElement,
  index: number,
  mode: JcfMode = 'job',
): RequiredField[] {
  // Template mode: no required fields
  if (mode === 'template') return [];

  const required: RequiredField[] = [];

  // Skip completely empty elements
  if (!hasElementContent(element)) return required;

  // Séquence is ALWAYS required if element has any content
  addIfMissing(required, element, index, 'sequence');

  // BLOC SUPPORT: triggered by Imposition OR Impression OR Surfacage OR Format
  if (hasBlocSupportTrigger(element)) {
    BLOC_SUPPORT_FIELDS.forEach((field) => addIfMissing(required, element, index, field));
  }

  // BLOC IMPRESSION: triggered by Imposition OR Impression only
  if (hasBlocImpressionTrigger(element)) {
    addIfMissing(required, element, index, 'impression');
  }

  return required;
}

/**
 * Get all required fields for multiple elements
 *
 * @param elements - Array of elements to check
 * @param mode - 'job' or 'template' mode
 * @returns Map of required fields keyed by "elementIndex-field"
 */
export function getAllRequiredFields(
  elements: JcfElement[],
  mode: JcfMode = 'job',
): Map<string, RequiredField> {
  const requiredMap = new Map<string, RequiredField>();

  elements.forEach((element, index) => {
    const required = getRequiredFields(element, index, mode);
    required.forEach((rf) => {
      const key = `${rf.elementIndex}-${rf.field}`;
      requiredMap.set(key, rf);
    });
  });

  return requiredMap;
}

/**
 * Check if a specific cell has a required indicator
 */
export function hasRequiredIndicator(
  requiredMap: Map<string, RequiredField>,
  errorMap: Map<string, unknown>,
  elementIndex: number,
  field: JcfFieldKey,
): boolean {
  const key = `${elementIndex}-${field}`;
  // Show indicator only if required AND not already showing an error
  return requiredMap.has(key) && !errorMap.has(key);
}
