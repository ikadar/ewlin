import { Link, Unlink } from 'lucide-react';
import type { SimilarityResult } from './similarityUtils';

export interface SimilarityIndicatorsProps {
  /** Array of similarity comparison results */
  results: SimilarityResult[];
}

/**
 * SimilarityIndicators - displays link/unlink icons showing
 * which criteria are matched between consecutive tiles.
 *
 * Positioned at the top-right of the lower tile, overlapping
 * the junction between tiles.
 */
export function SimilarityIndicators({ results }: SimilarityIndicatorsProps) {
  // Don't render if no criteria to show
  if (results.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute right-3 flex gap-0.5 px-1.5 py-1 rounded-full"
      style={{ top: '-10px' }}
      data-testid="similarity-indicators"
    >
      {results.map((result, index) => (
        <span
          key={result.criterion.id || index}
          title={result.criterion.name}
          data-testid={`similarity-icon-${index}`}
        >
          {result.isMatched ? (
            <Link
              className="w-3.5 h-3.5 text-zinc-400"
              data-testid="similarity-link-icon"
            />
          ) : (
            <Unlink
              className="w-3.5 h-3.5 text-zinc-800"
              data-testid="similarity-unlink-icon"
            />
          )}
        </span>
      ))}
    </div>
  );
}
