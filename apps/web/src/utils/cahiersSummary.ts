import type { Element } from '@flux/types';

/**
 * Compute a human-readable summary of cahiers (booklet sections) for display
 * on Encarteuses-Piqueuses tiles in Tirage mode.
 *
 * Cover detection: element name contains "couv" (case-insensitive).
 * Interior paginations are grouped by equal value:
 *   [16, 16, 8, 4] + cover → "2x16p + 8p + 4p + couv"
 *
 * @param jobElements - All elements in the job
 */
export function computeCahiersSummary(jobElements: Element[]): string {
  const hasCover = jobElements.some((e) => /couv/i.test(e.name));
  const interiors = jobElements.filter((e) => !/couv/i.test(e.name));
  const pags = interiors.map((e) => e.spec?.pagination ?? 0).filter((p) => p > 0);

  const groups: string[] = [];
  let i = 0;
  while (i < pags.length) {
    let count = 1;
    while (i + count < pags.length && pags[i + count] === pags[i]) count++;
    groups.push(count > 1 ? `${count}x${pags[i]}p` : `${pags[i]}p`);
    i += count;
  }
  if (hasCover) groups.push('couv');
  return groups.join(' + ');
}
