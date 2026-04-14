import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { StationUtilizationDatum } from '../../utils/statsData';
import { AXIS_COLOR, HEATMAP_LOW, HEATMAP_HIGH } from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: StationUtilizationDatum[];
  horizonStart: Date;
}

export function StationUtilizationHeatmap({ data, horizonStart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: ttRef, show: showTt, hide: hideTt } = useChartTooltip();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;
    const { width: cw } = containerRef.current.getBoundingClientRect();

    // Group by category for visual order
    const catOrder = [...new Set(data.map((s) => s.categoryName))];
    const sorted = catOrder.flatMap((cat) => data.filter((s) => s.categoryName === cat));

    const maxBlocks = d3.max(sorted, (s) => s.blocks.length) ?? 70;
    const displayCols = Math.min(maxBlocks, 70); // cap at 7 days * 10h
    const numRows = sorted.length;
    const cellH = 22;

    const width = cw;
    const margin = { top: 36, right: 16, bottom: 28, left: 140 };
    const w = width - margin.left - margin.right;
    const height = margin.top + numRows * cellH + margin.bottom;
    const cellW = w / displayCols;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const colorScale = d3.scaleSequential()
      .domain([0, 1])
      .interpolator((t) => d3.interpolateRgb(HEATMAP_LOW, HEATMAP_HIGH)(t));

    // Day headers
    const hoursPerDay = 10;
    const numDays = Math.ceil(displayCols / hoursPerDay);
    const fmtDay = d3.timeFormat('%a %d/%m');

    for (let d = 0; d < numDays; d++) {
      const dayDate = new Date(horizonStart);
      dayDate.setDate(dayDate.getDate() + d);
      g.append('text')
        .attr('x', d * hoursPerDay * cellW + (hoursPerDay * cellW) / 2)
        .attr('y', -18)
        .attr('text-anchor', 'middle')
        .attr('fill', AXIS_COLOR).attr('font-size', 10)
        .text(fmtDay(dayDate));

      if (d > 0) {
        g.append('line')
          .attr('x1', d * hoursPerDay * cellW).attr('x2', d * hoursPerDay * cellW)
          .attr('y1', -8).attr('y2', numRows * cellH)
          .attr('stroke', 'rgba(255,255,255,0.08)');
      }

      // Hour sub-labels every 2h
      for (let h = 0; h < hoursPerDay; h += 2) {
        g.append('text')
          .attr('x', (d * hoursPerDay + h) * cellW + cellW)
          .attr('y', -6)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,255,255,0.2)').attr('font-size', 8)
          .text(`${h + 6}h`);
      }
    }

    // Station labels
    let prevCat = '';
    sorted.forEach((st, row) => {
      const label = st.categoryName !== prevCat ? `${st.categoryName} / ${st.name}` : st.name;
      prevCat = st.categoryName;
      g.append('text')
        .attr('x', -6).attr('y', row * cellH + cellH / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', AXIS_COLOR).attr('font-size', 10)
        .text(label);
    });

    // Cells
    sorted.forEach((st, row) => {
      const blocks = st.blocks.slice(0, displayCols);
      g.selectAll(null).data(blocks).join('rect')
        .attr('x', (_, i) => i * cellW)
        .attr('y', row * cellH)
        .attr('width', Math.max(1, cellW - 1))
        .attr('height', cellH - 2)
        .attr('fill', (d) => colorScale(d.utilization))
        .attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
          const pct = Math.round(d.utilization * 100);
          const col = pct > 80 ? '#ef4444' : pct > 50 ? '#fbbf24' : '#22c55e';
          const hod = d.startTime.getHours();
          showTt(event, `
            <div class="tt-title">${st.stationName}</div>
            <div class="tt-row"><span class="tt-label">Catégorie</span><span class="tt-value">${st.categoryName}</span></div>
            <div class="tt-row"><span class="tt-label">Créneau</span><span class="tt-value">${hod}h – ${hod + 1}h</span></div>
            <div class="tt-row"><span class="tt-label">Occupation</span><span class="tt-value" style="color:${col}">${pct}%</span></div>
          `);
        })
        .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
        .on('mouseout', function () {
          d3.select(this).attr('stroke', 'none');
          hideTt();
        });
    });

    // Color scale legend
    const legendW = 150;
    const legendH = 10;
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'util-grad');
    grad.append('stop').attr('offset', '0%').attr('stop-color', HEATMAP_LOW);
    grad.append('stop').attr('offset', '100%').attr('stop-color', HEATMAP_HIGH);

    const legendG = svg.append('g')
      .attr('transform', `translate(${margin.left + w - legendW - 10},${height - 16})`);
    legendG.append('rect').attr('width', legendW).attr('height', legendH).attr('rx', 3)
      .attr('fill', 'url(#util-grad)');
    legendG.append('text').attr('x', -4).attr('y', legendH / 2 + 3).attr('text-anchor', 'end')
      .attr('fill', AXIS_COLOR).attr('font-size', 9).text('0%');
    legendG.append('text').attr('x', legendW + 4).attr('y', legendH / 2 + 3)
      .attr('fill', AXIS_COLOR).attr('font-size', 9).text('100%');
  }, [data, horizonStart, showTt, hideTt, ttRef]);

  return (
    <div ref={containerRef} className="relative">
      <svg ref={svgRef} className="w-full" />
      <div
        ref={ttRef}
        className="fixed pointer-events-none bg-flux-elevated border border-flux-border-light rounded-lg px-3 py-2.5 text-[11px] leading-relaxed text-flux-text-secondary shadow-xl z-50 max-w-[260px] opacity-0 transition-opacity duration-100"
      />
    </div>
  );
}
