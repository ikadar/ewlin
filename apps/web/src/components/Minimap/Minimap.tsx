import { useRef, useState, useEffect, useCallback, memo } from 'react';
import type { Station, StationCategory, TaskAssignment, Task, Element, Job, ScheduleConflict } from '@flux/types';
import type { SchedulingGridHandle } from '../SchedulingGrid/SchedulingGrid';
import { useMinimapData } from './useMinimapData';
import { MINIMAP_TILE_COLORS, MINIMAP_TILE_COLORS_DIMMED } from './minimapColors';
import { timeToYPosition } from '../TimelineColumn/utils';
import { getLayoutDimensions, getTotalContentWidth } from '../../utils/gridLayout';

const MINIMAP_WIDTH = 200;
const BUCKET_HOURS = 3;

export interface MinimapProps {
  stations: Station[];
  categories: StationCategory[];
  assignments: TaskAssignment[];
  elements: Element[];
  jobs: Job[];
  tasks: Task[];
  totalDays: number;
  pixelsPerHour: number;
  startDate: Date;
  startHour: number;
  selectedJobId: string | null;
  lateJobIds: Set<string>;
  shippedJobIds: Set<string>;
  conflicts: ScheduleConflict[];
  gridRef: React.RefObject<SchedulingGridHandle | null>;
  scrollTop: number;
  scrollLeft: number;
  theme: 'dark' | 'light';
}

export const Minimap = memo(function Minimap({
  stations, categories, assignments, elements, jobs, tasks,
  totalDays, pixelsPerHour, startDate, startHour,
  selectedJobId, lateJobIds, shippedJobIds, conflicts,
  gridRef, scrollTop, scrollLeft, theme,
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [containerHeight, setContainerHeight] = useState(0);

  // Heatmap by default, switches to tiles when a job is focused
  const mode = selectedJobId ? 'tiles' : 'density';

  const { tiles, windowStartMs, windowEndMs } = useMinimapData({
    stations, categories, assignments, tasks, elements, jobs,
    totalDays, pixelsPerHour, startDate, startHour,
    lateJobIds, shippedJobIds, conflicts,
  });

  // X-axis: map against station content width, not scrollWidth (which includes timeline + spacer)
  const catMap = new Map(categories.map(c => [c.id, c]));
  const contentWidth = getTotalContentWidth(stations, catMap) || 1;
  const { timelineWidth } = getLayoutDimensions();

  // Track container height via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Convert a time (ms) to a grid scrollTop position
  const timeToScrollY = useCallback((timeMs: number) => {
    const time = new Date(timeMs);
    return timeToYPosition(time, startHour, pixelsPerHour, startDate);
  }, [startHour, pixelsPerHour, startDate]);

  const windowStartScrollY = timeToScrollY(windowStartMs);
  const windowEndScrollY = timeToScrollY(windowEndMs);
  const windowScrollSpan = windowEndScrollY - windowStartScrollY || 1;

  const getScrollDimensions = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return { scrollWidth: 1, scrollHeight: 1, viewportWidth: 1, viewportHeight: 1 };
    return {
      scrollWidth: grid.getScrollWidth() || 1,
      scrollHeight: grid.getScrollHeight() || 1,
      viewportWidth: grid.getViewportWidth() || 1,
      viewportHeight: grid.getViewportHeight() || 1,
    };
  }, [gridRef]);

  const scrollYToMinimapY = useCallback((sy: number) => {
    return ((sy - windowStartScrollY) / windowScrollSpan) * containerHeight;
  }, [windowStartScrollY, windowScrollSpan, containerHeight]);

  const minimapYToScrollY = useCallback((my: number) => {
    return windowStartScrollY + (my / containerHeight) * windowScrollSpan;
  }, [windowStartScrollY, windowScrollSpan, containerHeight]);

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = MINIMAP_WIDTH;
    const h = containerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = theme === 'dark' ? 'rgb(15,15,15)' : '#ecddf0';
    ctx.fillRect(0, 0, w, h);

    const windowDurationMs = windowEndMs - windowStartMs;

    if (mode === 'tiles') {
      for (const tile of tiles) {
        const x = tile.normX * w;
        const tileW = Math.max(tile.normW * w - 0.5, 1);
        const y = tile.normY * h;
        const tileH = Math.max(tile.normH * h, 0.5);

        const isDimmed = selectedJobId !== null && tile.jobId !== selectedJobId;
        ctx.fillStyle = isDimmed
          ? MINIMAP_TILE_COLORS_DIMMED[tile.tileState]
          : MINIMAP_TILE_COLORS[tile.tileState];
        ctx.globalAlpha = isDimmed ? 1 : 0.7;
        ctx.fillRect(x + 0.25, y, tileW, tileH);
      }
      ctx.globalAlpha = 1;
    } else {
      const bucketMs = BUCKET_HOURS * 60 * 60 * 1000;
      const numBuckets = Math.ceil(windowDurationMs / bucketMs);
      const numStations = stations.length;
      if (numBuckets > 0 && numStations > 0) {
        const coverage = new Float32Array(numStations * numBuckets);

        for (const tile of tiles) {
          const tileStartFrac = tile.normY;
          const tileEndFrac = tile.normY + tile.normH;
          const stationIdx = Math.round(tile.normX * numStations);
          if (stationIdx < 0 || stationIdx >= numStations) continue;

          const startB = Math.floor(tileStartFrac * numBuckets);
          const endB = Math.ceil(tileEndFrac * numBuckets);
          for (let b = Math.max(0, startB); b < Math.min(numBuckets, endB); b++) {
            const bStart = b / numBuckets;
            const bEnd = (b + 1) / numBuckets;
            const overlap = Math.max(0, Math.min(tileEndFrac, bEnd) - Math.max(tileStartFrac, bStart));
            const bucketSpan = 1 / numBuckets;
            coverage[stationIdx * numBuckets + b] += overlap / bucketSpan;
          }
        }

        for (let si = 0; si < numStations; si++) {
          for (let b = 0; b < numBuckets; b++) {
            const density = Math.min(coverage[si * numBuckets + b], 1);
            if (density < 0.01) continue;

            const x = (si / numStations) * w;
            const bw = Math.max(w / numStations - 0.5, 1);
            const y = (b / numBuckets) * h;
            const bh = h / numBuckets;

            const r = Math.round(59 + density * 180);
            const g = Math.round(130 - density * 62);
            const bl = Math.round(246 - density * 178);
            ctx.fillStyle = `rgba(${r},${g},${bl},${0.15 + density * 0.55})`;
            ctx.fillRect(x + 0.25, y, bw, bh);
          }
        }
      }
    }

    // Station separator lines
    ctx.strokeStyle = theme === 'dark' ? 'rgba(63,63,70,0.3)' : 'rgba(30,14,42,0.12)';
    ctx.lineWidth = 0.5;
    for (let si = 1; si < stations.length; si++) {
      const x = (si / stations.length) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Day separator lines within the window
    const msPerDay = 24 * 60 * 60 * 1000;
    const firstDayMs = Math.ceil(windowStartMs / msPerDay) * msPerDay;
    for (let dayMs = firstDayMs; dayMs < windowEndMs; dayMs += msPerDay) {
      const frac = (dayMs - windowStartMs) / windowDurationMs;
      if (frac <= 0 || frac >= 1) continue;
      const y = frac * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Now line at top
    ctx.strokeStyle = 'rgb(239,68,68)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(239,68,68,0.5)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Viewport rectangle — X mapped against content width (excludes timeline + spacer)
    const dims = getScrollDimensions();
    const contentScrollLeft = Math.max(0, scrollLeft - timelineWidth);
    const vpX = (contentScrollLeft / contentWidth) * w;
    const vpW = Math.max((dims.viewportWidth / contentWidth) * w, 4);
    const vpY = scrollYToMinimapY(scrollTop);
    const vpH = Math.max((dims.viewportHeight / windowScrollSpan) * containerHeight, 4);

    const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(147,51,234,0.7)';
    const fillColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(147,51,234,0.06)';

    ctx.fillStyle = fillColor;
    ctx.fillRect(vpX, vpY, vpW, vpH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpX, vpY, vpW, vpH);
  }, [
    containerHeight, tiles, mode, selectedJobId, theme, stations,
    windowStartMs, windowEndMs, contentWidth, timelineWidth,
    scrollTop, scrollLeft, getScrollDimensions, scrollYToMinimapY,
    windowScrollSpan,
  ]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  // Click-to-jump
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) return;
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const dims = getScrollDimensions();
    const targetScrollX = (clickX / MINIMAP_WIDTH) * contentWidth + timelineWidth - dims.viewportWidth / 2;
    const targetScrollY = minimapYToScrollY(clickY) - dims.viewportHeight / 2;

    grid.scrollTo(
      Math.max(0, targetScrollX),
      Math.max(0, targetScrollY),
      'smooth',
    );
  }, [gridRef, getScrollDimensions, minimapYToScrollY, contentWidth, timelineWidth]);

  // Drag viewport rectangle
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const dims = getScrollDimensions();
    const contentSL = Math.max(0, scrollLeft - timelineWidth);
    const vpX = (contentSL / contentWidth) * MINIMAP_WIDTH;
    const vpY = scrollYToMinimapY(scrollTop);
    const vpW = (dims.viewportWidth / contentWidth) * MINIMAP_WIDTH;
    const vpH = (dims.viewportHeight / windowScrollSpan) * containerHeight;

    if (mx >= vpX && mx <= vpX + vpW && my >= vpY && my <= vpY + vpH) {
      isDraggingRef.current = true;
      dragOffsetRef.current = { x: mx - vpX, y: my - vpY };
      e.preventDefault();

      const onMouseMove = (ev: MouseEvent) => {
        const grid = gridRef.current;
        if (!grid) return;
        const canvasRect = canvas.getBoundingClientRect();
        const relX = ev.clientX - canvasRect.left - dragOffsetRef.current.x;
        const relY = ev.clientY - canvasRect.top - dragOffsetRef.current.y;

        const targetX = (relX / MINIMAP_WIDTH) * contentWidth + timelineWidth;
        const targetY = minimapYToScrollY(relY);
        grid.scrollTo(Math.max(0, targetX), Math.max(0, targetY), 'instant');
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  }, [gridRef, scrollTop, scrollLeft, containerHeight, getScrollDimensions, scrollYToMinimapY, minimapYToScrollY, windowScrollSpan, contentWidth, timelineWidth]);

  return (
    <div
      ref={containerRef}
      className="shrink-0"
      style={{
        width: MINIMAP_WIDTH,
        borderLeft: `1px solid ${theme === 'dark' ? 'rgb(42,42,42)' : '#c9b3d0'}`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MINIMAP_WIDTH,
          height: containerHeight,
          cursor: isDraggingRef.current ? 'grabbing' : 'default',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      />

    </div>
  );
});
