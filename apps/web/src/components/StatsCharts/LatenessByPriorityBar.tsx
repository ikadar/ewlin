import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { LatenessByPriorityDatum } from '../../utils/statsData';
import {
  PRIORITY_COLORS,
  LATE_COLOR,
  ONTIME_COLOR,
  AXIS_COLOR,
  GRID_COLOR,
  styleAxes,
} from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: LatenessByPriorityDatum[];
}

export function LatenessByPriorityBar({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: ttRef, show: showTt, hide: hideTt } = useChartTooltip();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;
    const { width: cw } = containerRef.current.getBoundingClientRect();
    const width = cw;
    const height = 380;
    const margin = { top: 16, right: 20, bottom: 44, left: 48 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(data.map((t) => t.tierLabel)).range([0, w]).padding(0.35);
    const yMax = Math.max(1, (d3.max(data, (t) => t.total) ?? 1) * 1.15);
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // Grid
    g.append('g').selectAll('line').data(y.ticks(5)).join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', GRID_COLOR);

    // On-time bars (bottom portion)
    g.selectAll('.bar-ontime').data(data).join('rect')
      .attr('x', (d) => x(d.tierLabel) ?? 0)
      .attr('y', (d) => y(d.total))
      .attr('width', x.bandwidth())
      .attr('height', (d) => h - y(d.onTimeCount))
      .attr('fill', ONTIME_COLOR)
      .attr('opacity', 0.8)
      .attr('rx', 3);

    // Late bars (stacked on top)
    g.selectAll('.bar-late').data(data).join('rect')
      .attr('x', (d) => x(d.tierLabel) ?? 0)
      .attr('y', (d) => y(d.total))
      .attr('width', x.bandwidth())
      .attr('height', (d) => h - y(d.lateCount))
      .attr('fill', LATE_COLOR)
      .attr('opacity', 0.8)
      .attr('rx', 3);

    // Invisible hover targets (full bar)
    g.selectAll('.bar-hover').data(data).join('rect')
      .attr('x', (d) => x(d.tierLabel) ?? 0)
      .attr('y', (d) => y(d.total))
      .attr('width', x.bandwidth())
      .attr('height', (d) => h - y(d.total))
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        showTt(event, `
          <div class="tt-title">${d.tierLabel}</div>
          <div class="tt-row"><span class="tt-label">Total</span><span class="tt-value">${d.total} jobs</span></div>
          <div class="tt-row"><span class="tt-label">À l'heure</span><span class="tt-ontime">${d.onTimeCount}</span></div>
          <div class="tt-row"><span class="tt-label">En retard</span><span class="tt-late">${d.lateCount}</span></div>
          <div class="tt-row"><span class="tt-label">Taux</span><span class="tt-value">${d.total > 0 ? Math.round((d.onTimeCount / d.total) * 100) : 100}%</span></div>
        `);
      })
      .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
      .on('mouseout', hideTt);

    // Count labels above bars
    g.selectAll('.bar-label').data(data).join('text')
      .attr('x', (d) => (x(d.tierLabel) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.total) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', AXIS_COLOR).attr('font-size', 11).attr('font-weight', 600)
      .text((d) => d.total);

    // Axes
    const xAxis = g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x));
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));
    styleAxes(xAxis, yAxis);

    // Color x-axis labels by priority
    xAxis.selectAll('text').each(function (_, i) {
      d3.select(this).attr('fill', PRIORITY_COLORS[i]).attr('font-weight', 600);
    });

    g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -34)
      .attr('text-anchor', 'middle').attr('fill', AXIS_COLOR).attr('font-size', 11)
      .text('Nombre de jobs');
  }, [data, showTt, hideTt, ttRef]);

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
