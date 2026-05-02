/**
 * Feature flags — gradual rollout switches for incomplete or in-flight features.
 *
 * Reads from Vite env vars (VITE_FEATURE_*). Defaults are conservative
 * (V1 behaviour preserved). Flip a flag to true in `.env.local` or via
 * the build pipeline to opt in to a new path.
 *
 * Once a feature is fully shipped and validated, the flag and all
 * "if (FEATURE_X)" conditionals should be removed from the code.
 */

const env = import.meta.env;

/**
 * V2 progress capture (cf. docs/operator-sandbox/progress-capture-design.md).
 *
 * When enabled :
 *   - Tile renders a SaisieIndicator (3 states) instead of CompletionToggleIcon
 *   - Click on the indicator opens the ProgressCaptureModal
 *   - Auto-completion is derived (`scheduledEnd < now`) instead of via flag toggle
 *   - Hourly + tile-end triggers fire via useProgressTriggers
 *
 * Default: off — preserves the existing behaviour while V2 is being built.
 */
export const FEATURE_PROGRESS_CAPTURE_V2: boolean =
  env.VITE_FEATURE_PROGRESS_CAPTURE_V2 === 'true';
