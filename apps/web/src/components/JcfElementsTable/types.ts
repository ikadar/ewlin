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
}

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
