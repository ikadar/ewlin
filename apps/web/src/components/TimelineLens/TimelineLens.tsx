import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LensTile } from './LensTile';
import type { TileState } from '../Tile/colorUtils';
import {
  LENS_WIDTH, LENS_HEIGHT, LENS_PIXELS_PER_HOUR,
  LENS_FADE_IN_MS, LENS_FADE_OUT_MS, LENS_SCROLL_DURATION_MS, LENS_SCROLL_EASING,
  LENS_SMOOTH_SCROLL, LENS_OFFSET_FROM_COLUMN, LENS_Z_INDEX,
} from './lensConfig';

export interface LensTileData {
  id: string;
  startMs: number;
  endMs: number;
  setupMinutes?: number;
  state: TileState;
  title: string;
  subtitle?: string;
}

/**
 * Where to dock the lens. Viewport-relative coordinates captured at the
 * moment the user hovered a tile. We derive the lens's vertical position
 * from the tile's center (NOT the column's — station/operator columns
 * extend far beyond the viewport in multi-day views, so their bounding
 * rect is useless for centering).
 */
export interface LensAnchor {
  columnLeft: number;
  columnRight: number;
  /** Viewport Y of the hovered tile's vertical midpoint. */
  tileCenterY: number;
}

export interface TimelineLensProps {
  visible: boolean;
  /** The column currently under the lens. Used to decide whether inner-scroll
   *  animates (same column = scroll smoothly; cross-column = snap). */
  activeColumnId: string | null;
  anchor: LensAnchor | null;
  tiles: LensTileData[];
  /** Hatched unavailability bands for the active column, absolute ms. */
  unavailabilitySegments?: Array<{ startMs: number; endMs: number }>;
  /** Absolute ms used as the Y=0 reference for tile positions inside the lens. */
  gridStartMs: number;
  /** Absolute ms of the farthest point the lens may need to show. */
  gridEndMs: number;
  /** Wall-clock time the lens is centered on (vertical midpoint of body). */
  centerTimeMs: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const INNER_SCROLL_TRANSITION = `transform ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`;

function formatHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Floating, portaled panel that re-renders a column at LENS_PIXELS_PER_HOUR,
 * vertically centered on `centerTimeMs`. Tiles + grid live in an inner
 * wrapper that is `translateY`'d to re-center on the focal time — tiles
 * entering / leaving the viewport during a smooth-scroll remain mounted.
 *
 * Three transitions layered:
 *   • opacity/transform → fade-in / fade-out (always on)
 *   • top/left          → position glide when docking to a new anchor
 *                         (only after first positioning, else a first
 *                         appearance "flies in" from the placeholder -9999)
 *   • inner translateY  → smooth temporal scroll when the focal time
 *                         changes within the same column
 */
export function TimelineLens({
  visible, activeColumnId, anchor, tiles, unavailabilitySegments = [],
  gridStartMs, gridEndMs, centerTimeMs,
  onMouseEnter, onMouseLeave,
}: TimelineLensProps) {
  // The lens is header-less, so the whole envelope is the body — tiles at the
  // body's vertical midpoint align pixel-for-pixel with the source tile Y.
  const bodyH = LENS_HEIGHT;
  const lpx = LENS_PIXELS_PER_HOUR;
  const fullH = Math.max(0, ((gridEndMs - gridStartMs) / 3_600_000) * lpx);
  const centerOffset = ((centerTimeMs - gridStartMs) / 3_600_000) * lpx;
  const targetY = bodyH / 2 - centerOffset;

  const innerRef = useRef<HTMLDivElement | null>(null);
  const prevCenterRef = useRef<number | null>(null);
  const prevVisibleRef = useRef<boolean>(false);
  const prevColumnRef = useRef<string | null>(null);

  // ── Gate top/left transitions on readyToAnimate ────────────────────
  // First frame after visible=true: no top/left transition (so the lens
  // snaps to its docking position). One rAF later: enable top/left, so
  // moves to a different tile glide in.
  const [readyToAnimate, setReadyToAnimate] = useState(false);
  useEffect(() => {
    if (!visible) {
      setReadyToAnimate(false);
      return;
    }
    const raf = requestAnimationFrame(() => setReadyToAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // ── Inner translate: snap on first visible / cross-column, animate on ──
  // same-column focal-time changes. useLayoutEffect runs pre-paint so the
  // transition property is set before the browser composits, avoiding a
  // dropped first frame on rapid hover transitions.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    if (!visible) {
      prevCenterRef.current = null;
      prevVisibleRef.current = false;
      prevColumnRef.current = null;
      return;
    }

    const wasVisible = prevVisibleRef.current;
    const wasSameColumn = prevColumnRef.current === activeColumnId;
    const wasSameCenter = prevCenterRef.current === centerTimeMs;
    const shouldAnimate = LENS_SMOOTH_SCROLL && wasVisible && wasSameColumn && !wasSameCenter;

    inner.style.transition = shouldAnimate ? INNER_SCROLL_TRANSITION : 'none';
    inner.style.transform = `translateY(${targetY}px)`;

    prevCenterRef.current = centerTimeMs;
    prevVisibleRef.current = true;
    prevColumnRef.current = activeColumnId;
  }, [visible, activeColumnId, targetY, centerTimeMs]);

  // ── Position the lens envelope at the tile's Y (not the column's Y) ──
  const { lensLeft, lensTop } = useMemo(() => {
    if (!anchor) return { lensLeft: -9999, lensTop: -9999 };
    const margin = 8;
    const preferredTop = anchor.tileCenterY - LENS_HEIGHT / 2;
    const clampedTop = Math.max(
      margin,
      Math.min(window.innerHeight - LENS_HEIGHT - margin, preferredTop)
    );
    const preferredLeft = anchor.columnRight + LENS_OFFSET_FROM_COLUMN;
    const clampedLeft = Math.max(
      margin,
      Math.min(window.innerWidth - LENS_WIDTH - margin, preferredLeft)
    );
    return { lensLeft: clampedLeft, lensTop: clampedTop };
  }, [anchor]);

  // ── Multi-tier time grid, rendered once per grid range ──
  const gridElements = useMemo<ReactNode[]>(() => {
    const elements: ReactNode[] = [];
    const gridSpanMinutes = Math.floor((gridEndMs - gridStartMs) / 60_000);
    if (gridSpanMinutes <= 0) return elements;

    const tiers = [
      { step: 60, lineOpacity: 0.09, label: true,  labelStrong: true,  tiny: false },
      { step: 30, lineOpacity: 0.06, label: true,  labelStrong: false, tiny: false },
      { step: 15, lineOpacity: 0.04, label: true,  labelStrong: false, tiny: true  },
      { step:  5, lineOpacity: 0.02, label: true,  labelStrong: false, tiny: true  },
    ];
    const drawn = new Set<number>();
    tiers.forEach((tier) => {
      for (let m = 0; m <= gridSpanMinutes; m += tier.step) {
        if (drawn.has(m)) continue;
        drawn.add(m);
        const y = (m / 60) * lpx;
        const absMs = gridStartMs + m * 60_000;
        elements.push(
          <div
            key={`l-${m}`}
            style={{
              position: 'absolute',
              left: 0, right: 0, top: `${y}px`, height: '1px',
              background: `rgba(255,255,255,${tier.lineOpacity})`,
              pointerEvents: 'none',
            }}
          />
        );
        if (tier.label) {
          elements.push(
            <div
              key={`t-${m}`}
              style={{
                position: 'absolute',
                left: '4px', top: `${y}px`,
                fontSize: tier.tiny ? '8px' : '9px',
                color: tier.labelStrong ? '#e4e4e7' : '#52525b',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                transform: 'translateY(-50%)',
                background: 'rgb(24, 24, 27)',
                padding: '0 3px',
                borderRadius: '2px',
                zIndex: 3,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {formatHHMM(absMs)}
            </div>
          );
        }
      }
    });
    return elements;
  }, [gridStartMs, gridEndMs, lpx]);

  if (typeof document === 'undefined') return null;

  const fadeDuration = visible ? LENS_FADE_IN_MS : LENS_FADE_OUT_MS;
  const transitionParts = [
    `opacity ${fadeDuration}ms ease-out`,
    `transform ${fadeDuration}ms ease-out`,
  ];
  if (readyToAnimate) {
    transitionParts.push(
      `top ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`,
      `left ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`,
    );
  }

  const lensStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${lensLeft}px`,
    top: `${lensTop}px`,
    width: `${LENS_WIDTH}px`,
    height: `${LENS_HEIGHT}px`,
    zIndex: LENS_Z_INDEX,
    background: 'rgb(24, 24, 27)',
    border: '1px solid rgba(147, 197, 253, 0.3)',
    borderRadius: '6px',
    boxShadow: '0 14px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
    transition: transitionParts.join(', '),
    pointerEvents: visible ? 'auto' : 'none',
  };

  // Source endpoint = tile edge (column right side at tile Y).
  // Destination endpoint = lens's left-middle edge (which sits exactly at
  // tileCenterY when unclamped, so the line is horizontal in the common case).
  const connectorSrcX = anchor ? anchor.columnRight : 0;
  const connectorSrcY = anchor ? anchor.tileCenterY : 0;
  const connectorDstX = lensLeft;
  const connectorDstY = lensTop + LENS_HEIGHT / 2;

  return createPortal(
    <>
      {anchor && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: LENS_Z_INDEX - 1,
            opacity: visible ? 1 : 0,
            transition: `opacity ${fadeDuration}ms ease-out`,
          }}
          aria-hidden="true"
        >
          <line
            x1={connectorSrcX}
            y1={connectorSrcY}
            x2={connectorDstX}
            y2={connectorDstY}
            stroke="rgba(147, 197, 253, 0.35)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle cx={connectorSrcX} cy={connectorSrcY} r="2.5" fill="rgba(147, 197, 253, 0.85)" />
          <circle cx={connectorDstX} cy={connectorDstY} r="2.5" fill="rgba(147, 197, 253, 0.85)" />
        </svg>
      )}
      <div
        style={lensStyle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-hidden={!visible}
      >
      <div style={{ position: 'relative', overflow: 'hidden', height: `${bodyH}px` }}>
        <div
          ref={innerRef}
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 0,
            height: `${fullH}px`,
            willChange: 'transform',
          }}
        >
          {gridElements}
          {unavailabilitySegments.map((seg, idx) => {
            const top = ((seg.startMs - gridStartMs) / 3_600_000) * lpx;
            const height = Math.max(
              1,
              ((seg.endMs - seg.startMs) / 3_600_000) * lpx,
            );
            return (
              <div
                key={`u-${idx}-${seg.startMs}`}
                className="bg-stripes-dark"
                style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  top: `${top}px`,
                  height: `${height}px`,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            );
          })}
          {tiles.map((t) => (
            <LensTile
              key={t.id}
              startMs={t.startMs}
              endMs={t.endMs}
              setupMinutes={t.setupMinutes}
              gridStartMs={gridStartMs}
              pixelsPerHour={lpx}
              state={t.state}
              title={t.title}
              subtitle={t.subtitle}
            />
          ))}
        </div>
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: '18px',
            background: 'linear-gradient(to bottom, rgb(24,24,27) 0%, transparent 100%)',
            pointerEvents: 'none', zIndex: 6,
          }}
        />
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '18px',
            background: 'linear-gradient(to top, rgb(24,24,27) 0%, transparent 100%)',
            pointerEvents: 'none', zIndex: 6,
          }}
        />
        </div>
      </div>
    </>,
    document.body
  );
}
