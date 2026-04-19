import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LensTile } from './LensTile';
import type { TileState } from '../Tile/colorUtils';
import {
  LENS_WIDTH, LENS_HEIGHT, LENS_HEADER_HEIGHT, LENS_PIXELS_PER_HOUR,
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

export interface LensAnchor {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TimelineLensProps {
  visible: boolean;
  anchor: LensAnchor | null;
  columnTitle: string;
  tiles: LensTileData[];
  /** Absolute ms used as the Y=0 reference for tile positions inside the lens. */
  gridStartMs: number;
  /** Absolute ms of the farthest point the lens may need to show. */
  gridEndMs: number;
  /** Wall-clock time the lens is centered on (vertical midpoint of body). */
  centerTimeMs: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const SCROLL_TRANSITION = `transform ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`;

function formatHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Floating, portaled panel that re-renders a column at LENS_PIXELS_PER_HOUR,
 * vertically centered on `centerTimeMs`. All tiles and grid markers live in
 * an inner wrapper that is `translateY`'d to center on the focal time —
 * tiles entering / leaving the viewport during a smooth-scroll remain mounted.
 */
export function TimelineLens({
  visible, anchor, columnTitle, tiles, gridStartMs, gridEndMs, centerTimeMs,
  onMouseEnter, onMouseLeave,
}: TimelineLensProps) {
  const bodyH = LENS_HEIGHT - LENS_HEADER_HEIGHT;
  const lpx = LENS_PIXELS_PER_HOUR;
  const fullH = ((gridEndMs - gridStartMs) / 3_600_000) * lpx;
  const centerOffset = ((centerTimeMs - gridStartMs) / 3_600_000) * lpx;
  const targetY = bodyH / 2 - centerOffset;

  const innerRef = useRef<HTMLDivElement | null>(null);
  const prevCenterRef = useRef<number | null>(null);
  const prevVisibleRef = useRef<boolean>(false);

  // Translate the inner wrapper to center on centerTimeMs. Animates only when
  // the lens stays visible AND the column layout hasn't changed across updates.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    if (!visible) {
      prevCenterRef.current = null;
      prevVisibleRef.current = false;
      return;
    }

    const wasVisible = prevVisibleRef.current;
    const wasSameCenter = prevCenterRef.current === centerTimeMs;
    const shouldAnimate = LENS_SMOOTH_SCROLL && wasVisible && !wasSameCenter;

    inner.style.transition = shouldAnimate ? SCROLL_TRANSITION : 'none';
    inner.style.transform = `translateY(${targetY}px)`;
    prevCenterRef.current = centerTimeMs;
    prevVisibleRef.current = true;
  }, [visible, targetY, centerTimeMs]);

  const { lensLeft, lensTop } = useMemo(() => {
    if (!anchor) return { lensLeft: -9999, lensTop: -9999 };
    const targetTop = anchor.top + (anchor.height / 2) - (LENS_HEIGHT / 2);
    const margin = 8;
    const clampedTop = Math.max(
      margin,
      Math.min(window.innerHeight - LENS_HEIGHT - margin, targetTop)
    );
    const clampedLeft = Math.max(
      margin,
      Math.min(
        window.innerWidth - LENS_WIDTH - margin,
        anchor.right + LENS_OFFSET_FROM_COLUMN
      )
    );
    return { lensLeft: clampedLeft, lensTop: clampedTop };
  }, [anchor]);

  // Multi-tier time grid, rendered once per grid range.
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
    transition: [
      `opacity ${fadeDuration}ms ease-out`,
      `transform ${fadeDuration}ms ease-out`,
      `top ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`,
      `left ${LENS_SCROLL_DURATION_MS}ms ${LENS_SCROLL_EASING}`,
    ].join(', '),
    pointerEvents: visible ? 'auto' : 'none',
  };

  const currentTimeLabel = formatHHMM(centerTimeMs);

  return createPortal(
    <div
      style={lensStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!visible}
    >
      <div
        style={{
          padding: '5px 8px',
          borderBottom: '1px solid #27272a',
          fontSize: '10px',
          color: '#a1a1aa',
          background: 'rgb(31, 31, 35)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          height: `${LENS_HEADER_HEIGHT}px`,
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            color: '#e4e4e7',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {columnTitle}
        </span>
        <span>{currentTimeLabel}</span>
      </div>

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
    </div>,
    document.body
  );
}
