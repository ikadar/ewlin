import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluxStackedDots } from './FluxStackedDots';
import type { FluxStationData } from './fluxTypes';

describe('FluxStackedDots', () => {
  it('renders nothing for empty data array', () => {
    const { container } = render(
      <FluxStackedDots data={[]} stationName="Offset" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all states are empty', () => {
    const data: FluxStationData[] = [{ state: 'empty' }, { state: 'empty' }];
    const { container } = render(<FluxStackedDots data={data} stationName="Offset" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG when there is at least one non-empty state', () => {
    const data: FluxStationData[] = [{ state: 'planned' }];
    render(<FluxStackedDots data={data} stationName="Offset" />);
    expect(screen.getByTestId('flux-stacked-dots')).toBeInTheDocument();
  });

  it('renders correct number of circles', () => {
    const data: FluxStationData[] = [
      { state: 'late', progress: 60 },
      { state: 'in-progress', progress: 40 },
      { state: 'planned' },
    ];
    const { container } = render(<FluxStackedDots data={data} stationName="Offset" />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
  });

  it('renders 2 circles for 2 elements', () => {
    const data: FluxStationData[] = [
      { state: 'in-progress', progress: 40 },
      { state: 'planned' },
    ];
    const { container } = render(<FluxStackedDots data={data} stationName="Massicot" />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('sorts worst state first (late before in-progress before planned)', () => {
    const data: FluxStationData[] = [
      { state: 'planned' },
      { state: 'late', progress: 60 },
      { state: 'in-progress', progress: 40 },
    ];
    const { container } = render(<FluxStackedDots data={data} stationName="Offset" />);
    const circles = container.querySelectorAll('circle');
    // First circle: late (red), last: planned (gray)
    expect(circles[0]).toHaveAttribute('fill', 'rgb(248 113 113)');
    expect(circles[2]).toHaveAttribute('fill', 'rgb(156 163 175)');
  });

  it('renders only 1 circle when 1 non-empty state', () => {
    const data: FluxStationData[] = [{ state: 'done' }, { state: 'empty' }];
    const { container } = render(<FluxStackedDots data={data} stationName="Offset" />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});
