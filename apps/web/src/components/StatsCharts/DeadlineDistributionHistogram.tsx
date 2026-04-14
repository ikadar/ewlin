import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { DeadlineDistributionDatum } from '../../utils/statsData';
import {
  LATE_COLOR,
  ONTIME_COLOR,
  AXIS_COLOR,
  GRID_COLOR,
  styleAxes,
} from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: DeadlineDistributionDatum[];
}

interface BinData {
  x0: Date;
  x1: Date;
  late: number;
  onTime: number;
  total: number;
}

export function DeadlineDistributionHistogram({ data }: Props) {
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

    const deadlines = data.map((d) => d.deadline);
    const dateExtent = d3.extent(deadlines) as [Date, Date];

    // Pad by 1 day on each side
    const padMs = 86400000;
    const xMin = new Date(dateExtent[0].getTime() - padMs);
    const xMax = new Date(dateExtent[1].getTime() + padMs);

    const x = d3.scaleTime().domain([xMin, xMax]).range([0, w]);

    // Build time-based bins (1 day per bin)
    const dayCount = Math.max(1, Math.ceil((xMax.getTime() - xMin.getTime()) / 86400000));
    const binCount = Math.min(dayCount, 20);
    const thresholds = d3.timeDay.range(xMin, xMax, Math.max(1, Math.floor(dayCount / binCount)));

    const binGen = d3.bin<DeadlineDistributionDatum, Date>()
      .domain([xMin, xMax])
      .thresholds(thresholds)
      .value((d) => d.deadline);
    const bins = binGen(data);

    const binsData: BinData[] = bins.map((bin) => ({
      x0: bin.x0 ?? xMin,
      x1: bin.x1 ?? xMax,
      late: bin.filter((j) => j.isLate).length,
      onTime: bin.filter((j) => !j.isLate).length,
      total: bin.length,
    }));

    const yMax = Math.max(1, (d3.max(binsData, (d) => d.total) ?? 1) * 1.15);
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // Grid
    g.append('g').selectAll('line').data(y.ticks(5)).join('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', GRID_COLOR);

    // "Today" line
    const now = new Date();
    if (now >= xMin && now <= xMax) {
      g.append('line')
        .attr('x1', x(now)).attr('x2', x(now)).attr('y1', 0).attr('y2', h)
        .attr('stroke', '#6366f1').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4').attr('opacity', 0.6);
      g.append('text').attr('x', x(now) + 4).attr('y', 12)
        .attr('fill', '#6366f1').attr('font-size', 10).attr('opacity', 0.7)
        .text("aujourd'hui");
    }

    const barW = (d: BinData) => Math.max(1, x(d.x1) - x(d.x0) - 2);

    // On-time bars (bottom)
    g.selectAll('.hist-ontime').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0) + 1)
      .attr('y', (d) => y(d.onTime))
      .attr('width', barW)
      .attr('height', (d) => h - y(d.onTime))
      .attr('fill', ONTIME_COLOR).attr('opacity', 0.75).attr('rx', 2);

    // Late bars (stacked on top)
    g.selectAll('.hist-late').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0) + 1)
      .attr('y', (d) => y(d.total))
      .attr('width', barW)
      .attr('height', (d) => y(d.onTime) - y(d.total))
      .attr('fill', LATE_COLOR).attr('opacity', 0.75).attr('rx', 2);

    // Hover targets
    const fmtDate = d3.timeFormat('%d/%m');
    g.selectAll('.hist-hover').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0))
      .attr('y', (d) => y(d.total))
      .attr('width', (d) => x(d.x1) - x(d.x0))
      .attr('height', (d) => h - y(d.total))
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        showTt(event, `
          <div class="tt-title">${fmtDate(d.x0)} – ${fmtDate(d.x1)}</div>
          <div class="tt-row"><span class="tt-label">Jobs</span><span class="tt-value">${d.total}</span></div>
          <div class="tt-row"><span class="tt-label">À l'heure</span><span class="tt-ontime">${d.onTime}</span></div>
          <div class="tt-row"><span class="tt-label">En retard</span><span class="tt-late">${d.late}</span></div>
        `);
      })
      .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
      .on('mouseout', hideTt);

    // Axes
    const fmtTick = d3.timeFormat('%d/%m');
    const xAxis = g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(8).tickFormat(fmtTick as (d: Date | d3.NumberValue, i: number) => string));
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));
    styleAxes(xAxis, yAxis);

    g.append('text').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle')
      .attr('fill', AXIS_COLOR).attr('font-size', 11).text('Date de deadline');
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
