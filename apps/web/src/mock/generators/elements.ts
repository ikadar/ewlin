/**
 * Element Generators
 * Generate mock elements for jobs.
 */

import type { Element } from '@flux/types';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

// ============================================================================
// Element Generator
// ============================================================================

export interface GenerateElementOptions {
  jobId: string;
  suffix: string;
  label?: string;
  prerequisiteElementIds?: string[];
  taskIds: string[];
}

export function generateElement(options: GenerateElementOptions): Element {
  const { jobId, suffix, label, prerequisiteElementIds = [], taskIds } = options;
  const now = new Date();

  return {
    id: `elem-${jobId}-${suffix.toLowerCase()}`,
    jobId,
    suffix,
    label,
    prerequisiteElementIds,
    taskIds,
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };
}

// ============================================================================
// Job Pattern Types
// ============================================================================

export type JobPattern = 'single' | 'multi-sheet' | 'brochure';

export interface JobPatternConfig {
  pattern: JobPattern;
  elements: Array<{
    suffix: string;
    label?: string;
    prerequisiteSuffixes: string[];
    taskCount: number;
  }>;
}

/**
 * Get a random job pattern based on distribution:
 * - 60% single-element (ELT)
 * - 20% multi-sheet (F1, F2, FIN)
 * - 20% brochure (COUV, INT1, INT2?, FIN)
 */
export function getRandomJobPattern(): JobPatternConfig {
  const rand = Math.random();

  if (rand < 0.6) {
    // 60% single-element
    return {
      pattern: 'single',
      elements: [
        { suffix: 'ELT', label: 'Élément', prerequisiteSuffixes: [], taskCount: randomInt(2, 4) },
      ],
    };
  } else if (rand < 0.8) {
    // 20% multi-sheet
    return {
      pattern: 'multi-sheet',
      elements: [
        { suffix: 'F1', label: 'Feuille 1', prerequisiteSuffixes: [], taskCount: randomInt(2, 3) },
        { suffix: 'F2', label: 'Feuille 2', prerequisiteSuffixes: [], taskCount: randomInt(2, 3) },
        { suffix: 'FIN', label: 'Finition', prerequisiteSuffixes: ['F1', 'F2'], taskCount: randomInt(1, 2) },
      ],
    };
  } else {
    // 20% brochure
    const hasInt2 = Math.random() > 0.5;
    const intPrereqs = hasInt2 ? ['COUV', 'INT1', 'INT2'] : ['COUV', 'INT1'];

    const elements: JobPatternConfig['elements'] = [
      { suffix: 'COUV', label: 'Couverture', prerequisiteSuffixes: [], taskCount: randomInt(2, 3) },
      { suffix: 'INT1', label: 'Intérieur 1', prerequisiteSuffixes: [], taskCount: randomInt(2, 3) },
    ];

    if (hasInt2) {
      elements.push({ suffix: 'INT2', label: 'Intérieur 2', prerequisiteSuffixes: [], taskCount: randomInt(2, 3) });
    }

    elements.push({ suffix: 'FIN', label: 'Finition', prerequisiteSuffixes: intPrereqs, taskCount: randomInt(1, 2) });

    return {
      pattern: 'brochure',
      elements,
    };
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
