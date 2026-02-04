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
