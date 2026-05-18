import { useEffect, useRef, type ReactElement } from 'react';

export interface HeartbeatOverlayProps {
  timeRemainingMin: number;
  thresholdMin: number;
  active: boolean;
}

const BEAT_MS = 600;

export function HeartbeatOverlay({ timeRemainingMin, thresholdMin, active }: HeartbeatOverlayProps): ReactElement | null {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!active || thresholdMin <= 0) return;
    const ratio = Math.max(0, Math.min(1, timeRemainingMin / thresholdMin));
    const restMs = 200 + ratio * 3500;
    const totalMs = BEAT_MS + restMs;
    const beatEnd = (BEAT_MS / totalMs) * 100;
    const p = (frac: number) => (frac * beatEnd).toFixed(1);

    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      document.head.appendChild(styleRef.current);
    }
    styleRef.current.textContent = `
      @keyframes mobile-heartbeat {
        0%          { opacity: 0; }
        ${p(0.12)}% { opacity: 0.45; }
        ${p(0.22)}% { opacity: 0.08; }
        ${p(0.34)}% { opacity: 0.45; }
        ${p(0.56)}% { opacity: 0; }
        100%        { opacity: 0; }
      }
      .mobile-heartbeat-active {
        animation: mobile-heartbeat ${totalMs}ms ease-in-out infinite;
      }`;

    return () => {
      styleRef.current?.remove();
      styleRef.current = null;
    };
  }, [active, timeRemainingMin, thresholdMin]);

  if (!active) return null;

  return (
    <div
      className="mobile-heartbeat-active"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        opacity: 0,
      }}
    />
  );
}
