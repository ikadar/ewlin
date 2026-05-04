import type { JcfLinkableField, JcfElementLinks } from '@flux/types';

// ── JCF Element type (local form state, all string fields) ──

export interface JcfElement {
  name: string;
  precedences: string;
  quantite: string;
  format: string;
  pagination: string;
  papier: string;
  imposition: string;
  impression: string;
  surfacage: string;
  autres: string;
  qteFeuilles: string;
  commentaires: string;
  sequence: string;
  /**
   * Per-element prerequisite "needed" flags. The chef toggles these
   * via switches in JCF (under the sequence row) — they map to
   * initial prerequisite status on the backend (none vs first-
   * real-state).
   *
   * Defaults:
   *   needsBat   = true (always)
   *   needsPaper = true (always)
   *   needsForme = `null` → smart default "true unless sequence
   *                contains a machine of category 'typo'"
   *   needsPlates = `null` → smart default "false unless sequence
   *                contains a machine of category 'Presse offset'"
   *
   * `null` on needsForme / needsPlates means "use smart default".
   * As soon as the chef clicks a switch the value becomes concrete
   * and the smart default no longer applies (sequence edits don't
   * auto-flip a manually-set switch).
   */
  needsBat: boolean;
  needsPaper: boolean;
  needsForme: boolean | null;
  needsPlates: boolean | null;
  /**
   * Link state for propagation from previous element (v0.4.35).
   * When a field is linked, it inherits and auto-updates from the previous element.
   */
  links?: JcfElementLinks;
}

/**
 * Fields that can be linked between elements.
 * Re-exported from @flux/types for convenience.
 */
export type { JcfLinkableField, JcfElementLinks };

export type JcfFieldKey = keyof Omit<JcfElement, 'name'>;

export const DEFAULT_ELEMENT: JcfElement = {
  name: 'ELT',
  precedences: '',
  quantite: '1',
  format: '',
  pagination: '',
  papier: '',
  imposition: '',
  impression: '',
  surfacage: '',
  autres: '',
  qteFeuilles: '',
  commentaires: '',
  sequence: '',
  needsBat: true,
  needsPaper: true,
  needsForme: null,
  needsPlates: null,
};

export function generateElementName(elements: JcfElement[]): string {
  const existingNumbers = elements
    .map((el) => {
      const match = el.name.match(/^ELEM(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const maxNum = Math.max(0, ...existingNumbers, elements.length);
  return `ELEM${maxNum + 1}`;
}
