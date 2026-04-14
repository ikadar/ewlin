import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { ScheduleOrderDatum } from '../../utils/statsData';
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  AXIS_COLOR,
  GRID_COLOR,
  DIAG_COLOR,
  styleAxes,
} from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: ScheduleOrderDatum[];
}

export function ScheduleOrderScatter({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: ttRef, show: showTt, hide: hideTt } = useChartTooltip();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;
    const { width: cw } = containerRef.current.getBoundingClientRect();
    const width = cw;
    const height = 380;
    const margin = { top: 16, right: 20, bottom: 44, left: 72 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const allDates = [...data.map((d) => d.deadlineDate), ...data.map((d) => d.firstScheduledStart)];
    const dateMin = d3.min(allDates) as Date;
    const dateMax = d3.max(allDates) as Date;

    const x = d3.scaleTime().domain([dateMin, dateMax]).range([0, w]).nice();
    const y = d3.scaleTime().domain([dateMin, dateMax]).range([h, 0]).nice();

    // Grid
    g.append('g').selectAll('line').data(y.ticks(6)).join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', GRID_COLOR);

    // Diagonal reference
    g.append('line')
      .attr('x1', x(dateMin)).attr('y1', y(dateMin))
      .attr('x2', x(dateMax)).attr('y2', y(dateMax))
      .attr('stroke', DIAG_COLOR).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4').attr('opacity', 0.5);

    const fmtDate = d3.timeFormat('%d/%m %Hh');

    // Dots
    g.selectAll('circle').data(data).join('circle')
      .attr('cx', (d) => x(d.deadlineDate))
      .attr('cy', (d) => y(d.firstScheduledStart))
      .attr('r', 5)
      .attr('fill', (d) => PRIORITY_COLORS[d.priorityTier])
      .attr('opacity', 0.7)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('r', 7).attr('stroke-width', 2);
        showTt(event, `
          <div class="tt-title">${d.reference}</div>
          <div class="tt-row"><span class="tt-label">Client</span><span class="tt-value">${d.client}</span></div>
          <div class="tt-row"><span class="tt-label">Priorité</span><span class="tt-value" style="color:${PRIORITY_COLORS[d.priorityTier]}">${PRIORITY_LABELS[d.priorityTier]}</span></div>
          <div class="tt-row"><span class="tt-label">Deadline</span><span class="tt-value">${fmtDate(d.deadlineDate)}</span></div>
          <div class="tt-row"><span class="tt-label">1er slot planifié</span><span class="tt-value">${fmtDate(d.firstScheduledStart)}</span></div>
          <div class="tt-row"><span class="tt-label">Statut</span><span class="${d.isLate ? 'tt-late' : 'tt-ontime'}">${d.isLate ? 'En retard' : "À l'heure"}</span></div>
        `);
      })
      .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.7).attr('r', 5).attr('stroke-width', 0.5);
        hideTt();
      });

    // Axes
    const fmtTick = d3.timeFormat('%d/%m');
    const xAxis = g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(7).tickFormat(fmtTick as (d: Date | d3.NumberValue, i: number) => string));
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(7).tickFormat(fmtTick as (d: Date | d3.NumberValue, i: number) => string));
    styleAxes(xAxis, yAxis);

    g.append('text').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle')
      .attr('fill', AXIS_COLOR).attr('font-size', 11).text('Date de deadline');
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -56)
      .attr('text-anchor', 'middle').attr('fill', AXIS_COLOR).attr('font-size', 11)
      .text('1er slot planifié');
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
