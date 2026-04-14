import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SlackUrgencyDatum } from '../../utils/statsData';
import {
  PRIORITY_LABELS,
  LATE_COLOR,
  ONTIME_COLOR,
  AXIS_COLOR,
  GRID_COLOR,
  DIAG_COLOR,
  styleAxes,
} from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: SlackUrgencyDatum[];
}

export function SlackUrgencyScatter({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: ttRef, show: showTt, hide: hideTt } = useChartTooltip();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;
    const { width: cw } = containerRef.current.getBoundingClientRect();
    const width = cw;
    const height = 380;
    const margin = { top: 16, right: 20, bottom: 44, left: 56 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xMax = (d3.max(data, (d) => d.daysToDeadline) ?? 14) * 1.1;
    const yMax = (d3.max(data, (d) => d.totalProductionHours) ?? 40) * 1.1;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // Grid
    g.append('g')
      .selectAll('line')
      .data(y.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', GRID_COLOR);

    // Diagonal: slack = 0 (production hours = days * 8h)
    const diagEndX = Math.min(xMax, yMax / 8);
    g.append('line')
      .attr('x1', x(0)).attr('y1', y(0))
      .attr('x2', x(diagEndX)).attr('y2', y(diagEndX * 8))
      .attr('stroke', DIAG_COLOR).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4').attr('opacity', 0.6);

    g.append('text')
      .attr('x', x(diagEndX * 0.65) + 4).attr('y', y(diagEndX * 0.65 * 8) - 6)
      .attr('fill', DIAG_COLOR).attr('font-size', 10).attr('opacity', 0.7)
      .text('slack = 0');

    // Danger zone shading
    g.append('path')
      .attr('d', `M${x(0)},${y(0)} L${x(diagEndX)},${y(diagEndX * 8)} L${x(0)},${y(diagEndX * 8)} Z`)
      .attr('fill', LATE_COLOR).attr('opacity', 0.04);

    // Size scale for priority
    const sizeScale = d3.scaleOrdinal<number, number>()
      .domain([0, 1, 2, 3]).range([8, 6.5, 5, 4]);

    const fmtDate = d3.timeFormat('%d/%m/%Y');

    // Dots
    g.selectAll('circle').data(data).join('circle')
      .attr('cx', (d) => x(d.daysToDeadline))
      .attr('cy', (d) => y(d.totalProductionHours))
      .attr('r', (d) => sizeScale(d.priorityTier))
      .attr('fill', (d) => d.isLate ? LATE_COLOR : ONTIME_COLOR)
      .attr('opacity', 0.7)
      .attr('stroke', (d) => d.isLate ? '#fca5a5' : '#86efac')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
        showTt(event, `
          <div class="tt-title">${d.reference}</div>
          <div class="tt-row"><span class="tt-label">Client</span><span class="tt-value">${d.client}</span></div>
          <div class="tt-row"><span class="tt-label">Priorité</span><span class="tt-value">${PRIORITY_LABELS[d.priorityTier]}</span></div>
          <div class="tt-row"><span class="tt-label">Deadline</span><span class="tt-value">${fmtDate(d.deadline)}</span></div>
          <div class="tt-row"><span class="tt-label">Production</span><span class="tt-value">${d.totalProductionHours.toFixed(1)}h</span></div>
          <div class="tt-row"><span class="tt-label">Jours avant deadline</span><span class="tt-value">${d.daysToDeadline.toFixed(1)}j</span></div>
          <div class="tt-row"><span class="tt-label">Slack</span><span class="tt-value">${d.slackHours.toFixed(1)}h</span></div>
          <div class="tt-row"><span class="tt-label">Statut</span><span class="${d.isLate ? 'tt-late' : 'tt-ontime'}">${d.isLate ? `En retard (${d.delayDays.toFixed(1)}j)` : "À l'heure"}</span></div>
        `);
      })
      .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.7).attr('stroke-width', 0.5);
        hideTt();
      });

    // Axes
    const xAxis = g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8));
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(6));
    styleAxes(xAxis, yAxis);

    g.append('text').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle')
      .attr('fill', AXIS_COLOR).attr('font-size', 11).text('Jours avant deadline');
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -42)
      .attr('text-anchor', 'middle').attr('fill', AXIS_COLOR).attr('font-size', 11)
      .text('Durée de production (heures)');
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
