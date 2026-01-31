/**
 * JCF Elements Table - Validation System
 *
 * Three-level validation:
 * - Level 1: Live format validation during typing (lenient)
 * - Level 2: Required field indicators (amber dots) - see requiredFields.ts
 * - Level 3: Submit validation (strict, converts required to errors)
 *
 * @see docs/releases/v0.4.23-jcf-live-format-validation.md
 * @see docs/releases/v0.4.30-jcf-submit-validation.md
 * @see reference/jcf/docs/implicit-logic-specification.md §2.1
 */

import type { JcfElement, JcfFieldKey } from './types';
import {
  isSequenceLineInvalid,
  isValidSequenceLine,
} from '../JcfSequenceAutocomplete/sequenceDsl';
import { getRequiredFields, type JcfMode } from './requiredFields';

// ── Types ────────────────────────────────────────────────────────────────────

export type ValidationErrorType = 'live' | 'submit';

export interface ValidationError {
  /** Element index in the array */
  elementIndex: number;
  /** Field key that has the error */
  field: JcfFieldKey;
  /** HTML message for tooltip (supports <strong>, <code>, <br>) */
  message: string;
  /** Error type: 'live' for format errors, 'submit' for required field errors */
  type: ValidationErrorType;
}

// ── Validation Messages ──────────────────────────────────────────────────────

// Level 1: Live format validation messages
const MESSAGES = {
  pagination: `<strong>Pagination invalide</strong><br>Doit être <code>2</code> (feuillet) ou un multiple de 4 (cahier).<br>Exemples : <code>2</code>, <code>4</code>, <code>8</code>, <code>16</code>`,
  papier: `<strong>Format Papier invalide</strong><br>Syntaxe attendue : <code>Type:Grammage</code><br>Exemples : <code>Couché:135</code>, <code>Offset:80</code>`,
  imposition: `<strong>Format Imposition invalide</strong><br>Syntaxe attendue : <code>LxH(poses)</code><br>Exemples : <code>50x70(8)</code>, <code>65x90(16p)</code>`,
  impression: `<strong>Format Impression invalide</strong><br>Syntaxe attendue : <code>recto/verso</code><br>Exemples : <code>Q/Q</code>, <code>Q/</code>, <code>CMJN/CMJN</code>`,
  surfacage: `<strong>Format Surfacage invalide</strong><br>Syntaxe attendue : <code>recto/verso</code><br>Exemples : <code>mat/mat</code>, <code>brillant/</code>, <code>vernis/</code>`,
  format: `<strong>Format produit invalide</strong><br>Formats acceptés :<br>• ISO : <code>A4</code>, <code>A3</code><br>• Dimensions : <code>210x297</code><br>• Fini : <code>A4f</code>, <code>A4fi</code><br>• Composite : <code>A3/A6</code>`,
  sequence: `<strong>Format Séquence invalide</strong><br>Une ligne par opération :<br>• Poste : <code>Komori(20+40)</code><br>• Sous-traitant : <code>ST:Reliure(3j):desc</code>`,
};

// Level 3: Submit validation messages for required fields
const SUBMIT_MESSAGES: Record<JcfFieldKey, string> = {
  sequence: `<strong>Séquence requise</strong><br>Définissez au moins une opération pour cet élément.`,
  papier: `<strong>Papier requis</strong><br>Indiquez le type et grammage du papier.`,
  pagination: `<strong>Pagination requise</strong><br>Nombre de pages de l'élément.`,
  format: `<strong>Format requis</strong><br>Format du produit fini.`,
  qteFeuilles: `<strong>Quantité feuilles requise</strong><br>Nombre de feuilles à imprimer.`,
  imposition: `<strong>Imposition requise</strong><br>Format feuille et nombre de poses.`,
  impression: `<strong>Impression requise</strong><br>Couleurs recto/verso.`,
  // Fields that are never required but need entries for type safety
  precedences: `<strong>Champ requis</strong>`,
  quantite: `<strong>Quantité requise</strong>`,
  surfacage: `<strong>Surfacage requis</strong>`,
  autres: `<strong>Champ requis</strong>`,
  commentaires: `<strong>Champ requis</strong>`,
};

// ── Individual Field Validators ──────────────────────────────────────────────

/**
 * Validate pagination: must be 2 (feuillet) or multiple of 4 (cahier)
 */
export function isValidPagination(value: string): boolean {
  if (!value) return true; // Empty is valid (not our concern at L1)
  const num = parseInt(value, 10);
  if (isNaN(num)) return false;
  return num === 2 || (num >= 4 && num % 4 === 0);
}

/**
 * Validate papier DSL: must contain ":" (e.g., "Couché:135")
 */
export function isValidPapier(value: string): boolean {
  if (!value) return true;
  return value.includes(':');
}

/**
 * Validate imposition DSL: must contain "(N)" or "(Np)" pattern
 */
export function isValidImposition(value: string): boolean {
  if (!value) return true;
  return /\(\d+p?\)/.test(value);
}

/**
 * Validate impression DSL: must contain "/" (e.g., "Q/Q", "CMJN/")
 */
export function isValidImpression(value: string): boolean {
  if (!value) return true;
  return value.includes('/');
}

/**
 * Validate surfacage DSL: must contain "/" (e.g., "mat/mat", "brillant/")
 */
export function isValidSurfacage(value: string): boolean {
  if (!value) return true;
  return value.includes('/');
}

/**
 * Validate format DSL:
 * - ISO: A0-A10 with optional f/fi suffix
 * - Custom: LxH with optional f/fi suffix
 * - Composite: format/format
 */
export function isValidFormat(value: string): boolean {
  if (!value) return true;

  const isoPattern = /^A([0-9]|10)(f|fi)?$/i;
  const customPattern = /^\d+x\d+(f|fi)?$/i;
  const compositePattern = /^(A([0-9]|10)|\d+x\d+)\/(A([0-9]|10)|\d+x\d+)$/i;

  return (
    isoPattern.test(value) ||
    customPattern.test(value) ||
    compositePattern.test(value)
  );
}

/**
 * Validate sequence DSL (lenient during typing):
 * - Only flag lines that are "finished" (have closing paren) but invalid
 * - Lines without closing paren are considered "in progress"
 */
export function isValidSequenceLenient(value: string): boolean {
  if (!value) return true;

  const lines = value.split('\n');
  // Check each line: only flag if it looks complete but is invalid
  return !lines.some((line) => isSequenceLineInvalid(line));
}

/**
 * Validate sequence DSL (strict, for after blur):
 * - All non-empty lines must be valid
 */
export function isValidSequenceStrict(value: string): boolean {
  if (!value) return true;

  const lines = value.split('\n');
  return !lines.some((line) => line.trim() && !isValidSequenceLine(line));
}

// ── Main Validation Function ─────────────────────────────────────────────────

/**
 * Validate all fields of an element (Level 1 - Live Format)
 *
 * @param element - The element to validate
 * @param index - Element index for error tracking
 * @param useStrictSequence - If true, use strict sequence validation (after blur)
 * @returns Array of validation errors
 */
export function validateElementLive(
  element: JcfElement,
  index: number,
  useStrictSequence = false,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Pagination validation
  if (element.pagination && !isValidPagination(element.pagination)) {
    errors.push({
      elementIndex: index,
      field: 'pagination',
      message: MESSAGES.pagination,
      type: 'live',
    });
  }

  // Papier validation
  if (element.papier && !isValidPapier(element.papier)) {
    errors.push({
      elementIndex: index,
      field: 'papier',
      message: MESSAGES.papier,
      type: 'live',
    });
  }

  // Imposition validation
  if (element.imposition && !isValidImposition(element.imposition)) {
    errors.push({
      elementIndex: index,
      field: 'imposition',
      message: MESSAGES.imposition,
      type: 'live',
    });
  }

  // Impression validation
  if (element.impression && !isValidImpression(element.impression)) {
    errors.push({
      elementIndex: index,
      field: 'impression',
      message: MESSAGES.impression,
      type: 'live',
    });
  }

  // Surfacage validation
  if (element.surfacage && !isValidSurfacage(element.surfacage)) {
    errors.push({
      elementIndex: index,
      field: 'surfacage',
      message: MESSAGES.surfacage,
      type: 'live',
    });
  }

  // Format validation
  if (element.format && !isValidFormat(element.format)) {
    errors.push({
      elementIndex: index,
      field: 'format',
      message: MESSAGES.format,
      type: 'live',
    });
  }

  // Sequence validation (lenient or strict based on parameter)
  const sequenceValid = useStrictSequence
    ? isValidSequenceStrict(element.sequence)
    : isValidSequenceLenient(element.sequence);

  if (element.sequence && !sequenceValid) {
    errors.push({
      elementIndex: index,
      field: 'sequence',
      message: MESSAGES.sequence,
      type: 'live',
    });
  }

  return errors;
}

/**
 * Validate all elements and return a map of errors by element-field key
 *
 * @param elements - Array of elements to validate
 * @param touchedFields - Set of field keys that have been blurred (for strict sequence validation)
 * @returns Map of errors keyed by "elementIndex-field"
 */
export function validateAllElements(
  elements: JcfElement[],
  touchedFields: Set<string> = new Set(),
): Map<string, ValidationError> {
  const errorMap = new Map<string, ValidationError>();

  elements.forEach((element, index) => {
    const sequenceTouched = touchedFields.has(`${index}-sequence`);
    const errors = validateElementLive(element, index, sequenceTouched);
    errors.forEach((error) => {
      const key = `${error.elementIndex}-${error.field}`;
      errorMap.set(key, error);
    });
  });

  return errorMap;
}

/**
 * Get error for a specific cell
 */
export function getCellError(
  errorMap: Map<string, ValidationError>,
  elementIndex: number,
  field: JcfFieldKey,
): ValidationError | undefined {
  return errorMap.get(`${elementIndex}-${field}`);
}

// ── Level 3: Submit Validation ────────────────────────────────────────────────

/**
 * Validate all elements for submit (Level 3 - Strict)
 *
 * Combines:
 * - Strict DSL format validation (no leniency for incomplete input)
 * - Required field validation (converts amber indicators to red errors)
 *
 * @param elements - Array of elements to validate
 * @param mode - 'job' or 'template' mode (template skips required validation)
 * @returns Array of all validation errors
 */
export function validateForSubmit(
  elements: JcfElement[],
  mode: JcfMode = 'job',
): ValidationError[] {
  const errors: ValidationError[] = [];

  elements.forEach((element, index) => {
    // Level 1 STRICT: DSL format validation (always strict on submit)
    const dslErrors = validateElementLive(element, index, true);
    errors.push(...dslErrors);

    // Level 3: Convert required fields to submit errors
    const requiredFields = getRequiredFields(element, index, mode);
    requiredFields.forEach((rf) => {
      errors.push({
        elementIndex: rf.elementIndex,
        field: rf.field,
        message: SUBMIT_MESSAGES[rf.field],
        type: 'submit',
      });
    });
  });

  return errors;
}

/**
 * Validate all elements for submit and return as a map
 *
 * @param elements - Array of elements to validate
 * @param mode - 'job' or 'template' mode
 * @returns Map of errors keyed by "elementIndex-field"
 */
export function validateAllForSubmit(
  elements: JcfElement[],
  mode: JcfMode = 'job',
): Map<string, ValidationError> {
  const errorMap = new Map<string, ValidationError>();
  const errors = validateForSubmit(elements, mode);

  errors.forEach((error) => {
    const key = `${error.elementIndex}-${error.field}`;
    errorMap.set(key, error);
  });

  return errorMap;
}
