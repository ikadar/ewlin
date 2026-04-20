/**
 * SimilarityBadge — gauge horizontale à hauteur de microdot, fill mono-emerald.
 *
 * Rend le score de practicité entre la tuile prédécesseur et la tuile courante
 * d'une même station. Pas de chiffre ; l'info passe par la largeur remplie
 * (ratio score/maxPoints) et l'opacité (palette mono stepped).
 *
 * ## Config UX verrouillée (source : `apps/web/playgrounds/similarity-badge-refine.html`)
 *
 * ```json
 * {
 *   "base": {
 *     "shape": "gauge",
 *     "infoDensity": "visual-only",
 *     "position": "junction-overlay",
 *     "color": "stepped",
 *     "visibility": "positive-only",
 *     "interaction": "static"
 *   },
 *   "refine": {
 *     "gaugeHeightPx": 6,
 *     "widthMode": "fixed",
 *     "unitWidthPx": 4,
 *     "fixedWidthPx": 28,
 *     "borderRadiusPx": 3,
 *     "trackShade": "light",
 *     "trackOpacityPct": 100,
 *     "trackDepth": "flat",
 *     "fillInsetPx": 0,
 *     "fillCap": "inherit",
 *     "fillHighlight": "none",
 *     "fillStyle": "solid",
 *     "palette": "mono",
 *     "thresholds": "33-66",
 *     "align": "center",
 *     "offsetYPx": -2,
 *     "border": "contrast",
 *     "shadow": "none"
 *   }
 * }
 * ```
 *
 * Le playground reste l'oracle visuel — sous la même config, le rendu React
 * doit être pixel-pour-pixel identique.
 *
 * @see apps/web/src/utils/similarityScore.ts pour le calcul du score.
 */

import type { SimilarityScore } from '@flux/types';

interface SimilarityBadgeProps {
  score: SimilarityScore;
}

/** Palette mono — emerald à 3 opacités + emerald-500 full pour extraHigh. */
const PALETTE_MONO = {
  low:  'rgba(52, 211, 153, 0.35)',
  mid:  'rgba(52, 211, 153, 0.65)',
  high: 'rgba(52, 211, 153, 1.0)',
  extraHigh: 'rgb(16, 185, 129)',
} as const;

/** Classification stepped 33-66 (ratio = points / maxPoints). */
function classifyScore(points: number, maxPoints: number): keyof typeof PALETTE_MONO {
  const ratio = maxPoints > 0 ? points / maxPoints : 0;
  if (ratio < 1 / 3) return 'low';
  if (ratio < 2 / 3) return 'mid';
  return 'high';
}

// Geometry (from refine)
const GAUGE_HEIGHT_PX = 6;
const GAUGE_WIDTH_PX = 28;
const BORDER_RADIUS_PX = Math.min(3, GAUGE_HEIGHT_PX / 2);
const OFFSET_Y_PX = -2;
const TRACK_COLOR = 'rgb(63, 63, 70)';          // zinc-700 (trackShade=light)
const BORDER_COLOR = 'rgb(36, 36, 36)';         // --flux-elevated (border=contrast)

export function SimilarityBadge({ score }: SimilarityBadgeProps) {
  if (score.points <= 0) return null;

  const fillBg = PALETTE_MONO[classifyScore(score.points, score.maxPoints)];
  const fillWidth =
    score.maxPoints > 0 ? (score.points / score.maxPoints) * GAUGE_WIDTH_PX : 0;

  return (
    <span
      aria-hidden
      className="absolute block overflow-hidden pointer-events-none"
      style={{
        top: 0,
        left: '50%',
        transform: `translate(-50%, calc(-50% + ${OFFSET_Y_PX}px))`,
        width: `${GAUGE_WIDTH_PX}px`,
        height: `${GAUGE_HEIGHT_PX}px`,
        borderRadius: `${BORDER_RADIUS_PX}px`,
        background: TRACK_COLOR,
        border: `1px solid ${BORDER_COLOR}`,
        zIndex: 2,
      }}
    >
      <span
        className="block h-full"
        style={{
          width: `${fillWidth}px`,
          background: fillBg,
          borderRadius: 'inherit',
        }}
      />
    </span>
  );
}
