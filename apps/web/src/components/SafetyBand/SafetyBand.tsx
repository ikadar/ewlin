/**
 * SafetyBand — Sky horizontal band overlaid on the planning view.
 *
 * Marks the rolling "safety zone" below which scheduled tasks are
 * frozen by the engine. Rendered between `nowPx` and `nowPx +
 * zoneHeightPx`. No interactivity — it's a visual indicator only.
 *
 * Style validated in playground-safety-zone.html (tint: tint-horizontal,
 * hue: Sky).
 */

interface Props {
  /** Y pixel position of "now" on the planning grid. */
  nowPx: number;
  /** Zone height in pixels (safetyZoneHours × pxPerHour, collapse-agnostic). */
  zoneHeightPx: number;
  /** Optional label to display on the boundary line (e.g. "+12 h"). */
  boundaryLabel?: string;
}

export function SafetyBand({ nowPx, zoneHeightPx, boundaryLabel }: Props) {
  if (zoneHeightPx <= 0) return null;

  return (
    <>
      <div
        className="safety-zone-band"
        style={{ top: `${nowPx}px`, height: `${zoneHeightPx}px` }}
        aria-hidden="true"
      />
      {boundaryLabel && (
        <div
          className="safety-zone-band-label"
          style={{ top: `${nowPx + zoneHeightPx}px` }}
        >
          {boundaryLabel}
        </div>
      )}
    </>
  );
}
