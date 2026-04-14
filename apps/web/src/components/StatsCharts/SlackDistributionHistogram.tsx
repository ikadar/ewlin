import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SlackDistributionDatum } from '../../utils/statsData';
import {
  LATE_COLOR,
  ONTIME_COLOR,
  AXIS_COLOR,
  GRID_COLOR,
  DIAG_COLOR,
  styleAxes,
} from './chartTheme';
import { useChartTooltip } from './useChartTooltip';

interface Props {
  data: SlackDistributionDatum[];
}

interface BinData {
  x0: number;
  x1: number;
  late: number;
  onTime: number;
  total: number;
}

export function SlackDistributionHistogram({ data }: Props) {
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

    const slackValues = data.map((d) => d.slackHours);
    const ext = d3.extent(slackValues) as [number, number];
    const xDomain: [number, number] = [Math.min(-20, ext[0] - 5), Math.max(80, ext[1] + 5)];

    const x = d3.scaleLinear().domain(xDomain).range([0, w]);

    // Build bins
    const binGen = d3.bin<SlackDistributionDatum, number>()
      .domain(xDomain)
      .thresholds(20)
      .value((d) => d.slackHours);
    const bins = binGen(data);

    const binsData: BinData[] = bins.map((bin) => ({
      x0: bin.x0 ?? 0,
      x1: bin.x1 ?? 0,
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

    // Slack = 0 vertical line
    if (xDomain[0] < 0) {
      g.append('line')
        .attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h)
        .attr('stroke', DIAG_COLOR).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4').attr('opacity', 0.6);
      g.append('text').attr('x', x(0) + 4).attr('y', 12)
        .attr('fill', DIAG_COLOR).attr('font-size', 10).attr('opacity', 0.7)
        .text('slack = 0');
      // Danger zone
      g.append('rect')
        .attr('x', x(xDomain[0])).attr('y', 0)
        .attr('width', x(0) - x(xDomain[0])).attr('height', h)
        .attr('fill', LATE_COLOR).attr('opacity', 0.04);
    }

    const barW = (d: BinData) => Math.max(1, x(d.x1) - x(d.x0) - 1);

    // On-time bars (bottom)
    g.selectAll('.hist-ontime').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0) + 0.5)
      .attr('y', (d) => y(d.total))
      .attr('width', barW)
      .attr('height', (d) => h - y(d.onTime))
      .attr('fill', ONTIME_COLOR).attr('opacity', 0.75).attr('rx', 1);

    // Late bars (stacked)
    g.selectAll('.hist-late').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0) + 0.5)
      .attr('y', (d) => y(d.total))
      .attr('width', barW)
      .attr('height', (d) => h - y(d.late))
      .attr('fill', LATE_COLOR).attr('opacity', 0.75).attr('rx', 1);

    // Hover targets
    g.selectAll('.hist-hover').data(binsData).join('rect')
      .attr('x', (d) => x(d.x0))
      .attr('y', (d) => y(d.total))
      .attr('width', (d) => x(d.x1) - x(d.x0))
      .attr('height', (d) => h - y(d.total))
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        showTt(event, `
          <div class="tt-title">Slack : ${d.x0.toFixed(0)}h à ${d.x1.toFixed(0)}h</div>
          <div class="tt-row"><span class="tt-label">Jobs</span><span class="tt-value">${d.total}</span></div>
          <div class="tt-row"><span class="tt-label">À l'heure</span><span class="tt-ontime">${d.onTime}</span></div>
          <div class="tt-row"><span class="tt-label">En retard</span><span class="tt-late">${d.late}</span></div>
        `);
      })
      .on('mousemove', function (event) { showTt(event, ttRef.current?.innerHTML ?? ''); })
      .on('mouseout', hideTt);

    // Axes
    const xAxis = g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(10));
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));
    styleAxes(xAxis, yAxis);

    g.append('text').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle')
      .attr('fill', AXIS_COLOR).attr('font-size', 11).text('Slack (heures)');
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
