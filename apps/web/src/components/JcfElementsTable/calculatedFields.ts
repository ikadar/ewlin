/**
 * JCF Elements Table - Calculated Fields
 *
 * Utilities for auto-calculating qteFeuilles based on job quantity,
 * element quantity, and imposition poses.
 *
 * @see docs/releases/v0.4.24-jcf-required-indicators-calculated-fields.md
 * @see reference/jcf/docs/implicit-logic-specification.md §3
 */

// ── Poses Extraction ─────────────────────────────────────────────────────────

/**
 * Extract number of poses from imposition DSL or pretty format
 *
 * Supported formats:
 * - DSL format: "50x70(8)" or "50x70(8p)" → 8
 * - Pretty format: "8 poses" → 8
 *
 * @param imposition - The imposition value to parse
 * @returns Number of poses or null if cannot be parsed
 */
export function extractPosesFromImposition(imposition: string): number | null {
  if (!imposition) return null;

  // Try DSL format: something(Np) e.g., 50x70(8), 50x70(8p), A3(4p)
  const dslMatch = imposition.match(/\((\d+)p?\)/);
  if (dslMatch) {
    return parseInt(dslMatch[1], 10);
  }

  // Try pretty format: N poses e.g., "8 poses"
  const prettyMatch = imposition.match(/(\d+)\s*poses?/i);
  if (prettyMatch) {
    return parseInt(prettyMatch[1], 10);
  }

  return null;
}

// ── qteFeuilles Calculation ──────────────────────────────────────────────────

/**
 * Calculate qteFeuilles (quantity of sheets)
 *
 * Formula: ceil((jobQuantity × elementQuantity) / poses)
 *
 * @param jobQuantity - Total job quantity
 * @param elementQuantity - Quantity for this element (multiplier)
 * @param poses - Number of poses per sheet (from imposition)
 * @returns Calculated qteFeuilles as string, or null if cannot calculate
 */
export function calculateQteFeuilles(
  jobQuantity: number,
  elementQuantity: number,
  poses: number,
): string | null {
  if (jobQuantity <= 0 || elementQuantity <= 0 || poses <= 0) {
    return null;
  }

  const totalNeeded = jobQuantity * elementQuantity;
  const qteFeuilles = Math.ceil(totalNeeded / poses);

  return qteFeuilles.toString();
}

/**
 * Calculate qteFeuilles from string inputs
 *
 * @param jobQuantity - Job quantity as string
 * @param elementQuantity - Element quantity as string (defaults to "1")
 * @param imposition - Imposition DSL value
 * @returns Calculated qteFeuilles as string, or null if cannot calculate
 */
export function calculateQteFeuillesFromStrings(
  jobQuantity: string,
  elementQuantity: string,
  imposition: string,
): string | null {
  const jobQty = parseInt(jobQuantity, 10) || 0;
  if (jobQty === 0) return null;

  const elementQty = parseInt(elementQuantity, 10) || 1;
  const poses = extractPosesFromImposition(imposition);
  if (!poses) return null;

  return calculateQteFeuilles(jobQty, elementQty, poses);
}
