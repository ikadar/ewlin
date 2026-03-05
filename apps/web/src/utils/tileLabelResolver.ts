import type { Element, Task, Job } from '@flux/types';
import { parsePapierDSL } from './papierDSL';
import { detectBrochureOrLeaflet } from './brochureDetection';
import { computeCahiersSummary } from './cahiersSummary';

/** Extract "LxH" dimensions from an imposition string like "50x70(8)". */
function extractDimensions(imposition: string | undefined): string {
  if (!imposition) return '';
  const parenIdx = imposition.indexOf('(');
  if (parenIdx === -1) return imposition.trim();
  return imposition.slice(0, parenIdx).trim();
}

/**
 * Default column widths (px) by category name pattern.
 * Checked in order — first match wins.
 */
const DEFAULT_WIDTHS: Array<{ pattern: string; width: number }> = [
  { pattern: 'pelliculeuse', width: 400 },
  { pattern: 'encarteuse', width: 400 },
  { pattern: 'offset', width: 340 },
  { pattern: 'typographie', width: 340 },
  { pattern: 'plieuse', width: 340 },
  { pattern: 'piqueuse', width: 280 },
  // massicot, assembleuse, conditionnement → fallback to CSS w-60 (240px)
];

/**
 * Return a default column width in pixels for a station category,
 * or null if the category should use the CSS default (w-60).
 */
export function getDefaultCategoryWidth(categoryName: string): number | null {
  const n = categoryName.toLowerCase();
  for (const { pattern, width } of DEFAULT_WIDTHS) {
    if (n.includes(pattern)) return width;
  }
  return null;
}

/**
 * Compute the Tirage-mode tile label for a given element.
 *
 * Returns a string like `"{reference} • {content}"` for single-element jobs,
 * or `"{reference} · {element.name} • {content}"` for multi-element jobs.
 * Returns an empty string when the category has no Tirage format defined
 * (e.g. Conditionnement) — the caller should fall back to the Produit label.
 *
 * Category matching is performed on `categoryName.toLowerCase()`.
 * Important: "piqueuse" check must come before "assembleuse" check.
 *
 * @param categoryName       - Name of the station category
 * @param element            - The element associated with the tile
 * @param job                - Parent job
 * @param jobElements        - All elements in the same job
 * @param taskMap            - Map of task ID → Task
 * @param assemblyStationIds - Set of station IDs for Encarteuses/Assembleuses-Piqueuses
 */
export function getTirageLabel(
  categoryName: string,
  element: Element,
  job: Job,
  jobElements: Element[],
  taskMap: Map<string, Task>,
  assemblyStationIds: Set<string>,
): string {
  const s = element.spec;
  const name = categoryName.toLowerCase();
  const prefix = jobElements.length === 1
    ? `${job.reference} •`
    : `${job.reference} · ${element.name} •`;

  let content = '';

  if (name.includes('offset')) {
    const { type, grammage } = parsePapierDSL(s?.papier ?? '');
    const dims = extractDimensions(s?.imposition);
    content = [type, grammage, dims, s?.impression, s?.quantite ? `${s.quantite}ex` : '']
      .filter(Boolean)
      .join(' ');
  } else if (name.includes('massicot')) {
    content = [s?.format, s?.quantite ? `${s.quantite}ex` : ''].filter(Boolean).join(' ');
  } else if (name.includes('plieuse')) {
    const { type, grammage } = parsePapierDSL(s?.papier ?? '');
    const mode = detectBrochureOrLeaflet(element, jobElements, taskMap, assemblyStationIds);
    if (mode === 'leaflet') {
      content = [s?.format, type, grammage, s?.quantite ? `${s.quantite}ex` : '']
        .filter(Boolean)
        .join(' ');
    } else {
      content = [
        s?.format,
        s?.pagination ? `${s.pagination}p` : null,
        type,
        grammage,
        s?.quantite ? `${s.quantite}ex` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
  } else if (name.includes('piqueuse')) {
    // Must check piqueuse BEFORE assembleuse to handle "Assembleuses-Piqueuses" correctly.
    if (name.includes('encarteuse')) {
      // Encarteuses-Piqueuses (cat-booklet)
      content = [s?.format, computeCahiersSummary(jobElements)].filter(Boolean).join(' ');
    } else {
      // Assembleuses-Piqueuses (cat-saddle-stitch)
      const hasCover = jobElements.some((e) => /couv/i.test(e.name));
      const total = jobElements
        .filter((e) => !/couv/i.test(e.name))
        .reduce((sum, e) => sum + (e.spec?.pagination ?? 0), 0);
      const parts: (string | null)[] = [
        s?.format ?? null,
        total ? `${total}p` : null,
        hasCover ? '+ couv' : null,
      ];
      content = parts.filter(Boolean).join(' ');
    }
  } else if (name.includes('assembleuse')) {
    // Assembleuses (not piqueuse — already handled above)
    const feuillets = s?.pagination ? Math.ceil(s.pagination / 4) : null;
    content = [feuillets ? `${feuillets} feuillets` : null, s?.quantite ? `${s.quantite}ex` : '']
      .filter(Boolean)
      .join(' ');
  } else if (name.includes('typographie')) {
    const { type, grammage } = parsePapierDSL(s?.papier ?? '');
    content = [s?.imposition, s?.qteFeuilles ? `${s.qteFeuilles}F` : null, type, grammage]
      .filter(Boolean)
      .join(' ');
  } else if (name.includes('pelliculeuse')) {
    const { type, grammage } = parsePapierDSL(s?.papier ?? '');
    content = [s?.surfacage, s?.imposition, s?.qteFeuilles ? `${s.qteFeuilles}F` : null, type, grammage]
      .filter(Boolean)
      .join(' ');
  }
  // Conditionnement + unknown categories → content stays '' → caller uses Produit fallback

  if (!content) return '';
  return `${prefix} ${content}`;
}
