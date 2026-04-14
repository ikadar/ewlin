export const PRIORITY_LABELS = ['Impératif', 'Important', 'Standard', 'Flexible'];
export const PRIORITY_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e'];
export const LATE_COLOR = '#ef4444';
export const ONTIME_COLOR = '#22c55e';
export const AXIS_COLOR = '#a1a1a1';
export const GRID_COLOR = 'rgba(255,255,255,0.05)';
export const DIAG_COLOR = '#6366f1';
export const HEATMAP_LOW = '#1a1a2e';
export const HEATMAP_HIGH = '#7c3aed';

export const MARGINS = { top: 16, right: 20, bottom: 44, left: 56 };

export function styleAxes(
  ...axes: d3.Selection<SVGGElement, unknown, null, undefined>[]
) {
  for (const ax of axes) {
    ax.selectAll('text').attr('fill', AXIS_COLOR).attr('font-size', 10);
    ax.selectAll('line').attr('stroke', AXIS_COLOR).attr('opacity', 0.3);
    ax.select('.domain').attr('stroke', AXIS_COLOR).attr('opacity', 0.3);
  }
}
