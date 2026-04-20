/**
 * SimilarityBadge — N indicateurs par catégorie, remplissage ordinal.
 *
 * Rend un indicateur par niveau atteignable sur la catégorie de station.
 * Le Nème indicateur est allumé ssi `score.points >= levels[n]`. Les niveaux
 * sont dérivés dynamiquement depuis `category.similarityScoreRules` via
 * {@link reachableLevels} — si une règle s'ajoute côté serveur (ex. R4 sur
 * Offset) le composant s'adapte sans toucher à ce fichier.
 *
 * ## Config UX verrouillée (source : `apps/web/playgrounds/similarity-badge-links.html`)
 *
 * ```json
 * {
 *   "base": {
 *     "indicatorModel": "n-per-category",
 *     "ordinalFill": true,
 *     "visibility": "positive-only"
 *   },
 *   "refine": {
 *     "shape": "links",
 *     "sizePx": 10,
 *     "gapPx": 2,
 *     "fillColor": "emerald",
 *     "emptyColor": "zinc-light",
 *     "modulation": "none"
 *   }
 * }
 * ```
 *
 * Le playground reste l'oracle visuel — sous la même config, le composant
 * React doit rendre des chaînes identiques pixel-pour-pixel.
 *
 * @see apps/web/src/utils/similarityScore.ts pour `reachableLevels` et `computeSimilarityScore`.
 */

import { Link as LinkIcon, Unlink as UnlinkIcon } from 'lucide-react';
import type { SimilarityScore, StationCategory } from '@flux/types';
import { reachableLevels } from '../../utils/similarityScore';

interface SimilarityBadgeProps {
  score: SimilarityScore;
  category: StationCategory;
}

// ─── Refine (see playground config above) ───
const SIZE_PX = 10;
const GAP_PX = 2;
const FILL_COLOR = 'rgb(52, 211, 153)';    // emerald-400
const EMPTY_COLOR = 'rgb(113, 113, 122)';  // zinc-500

// ─── Positioning (inherited from the earlier gauge iteration) ───
// Badge sits centered on the top edge of the successor tile, pulled 2 px up
// so the indicators straddle the junction between prev and curr tiles.
const OFFSET_Y_PX = -2;

export function SimilarityBadge({ score, category }: SimilarityBadgeProps) {
  if (score.points <= 0) return null;

  const rules = category.similarityScoreRules ?? [];
  if (rules.length === 0) return null;

  const levels = reachableLevels(rules);
  if (levels.length === 0) return null;

  return (
    <span
      aria-hidden
      className="absolute block pointer-events-none"
      style={{
        top: 0,
        left: '50%',
        transform: `translate(-50%, calc(-50% + ${OFFSET_Y_PX}px))`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${GAP_PX}px`,
        zIndex: 2,
      }}
    >
      {levels.map((level, idx) => {
        const filled = score.points >= level;
        const Icon = filled ? LinkIcon : UnlinkIcon;
        return (
          <Icon
            key={idx}
            size={SIZE_PX}
            strokeWidth={2.5}
            color={filled ? FILL_COLOR : EMPTY_COLOR}
            style={{ flexShrink: 0 }}
          />
        );
      })}
    </span>
  );
}
