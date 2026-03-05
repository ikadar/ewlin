import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluxStationIndicator } from './FluxStationIndicator';

describe('FluxStationIndicator', () => {
  it('renders nothing for empty state', () => {
    const { container } = render(
      <FluxStationIndicator data={{ state: 'empty' }} stationName="Offset" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for undefined data', () => {
    const { container } = render(
      <FluxStationIndicator data={undefined} stationName="Offset" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG for planned state', () => {
    render(<FluxStationIndicator data={{ state: 'planned' }} stationName="Offset" />);
    const svg = screen.getByTestId('flux-station-indicator');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-state', 'planned');
  });

  it('renders SVG for done state', () => {
    render(<FluxStationIndicator data={{ state: 'done' }} stationName="Massicot" />);
    const svg = screen.getByTestId('flux-station-indicator');
    expect(svg).toHaveAttribute('data-state', 'done');
  });

  it('renders SVG for in-progress state', () => {
    render(
      <FluxStationIndicator data={{ state: 'in-progress', progress: 40 }} stationName="Offset" />
    );
    const svg = screen.getByTestId('flux-station-indicator');
    expect(svg).toHaveAttribute('data-state', 'in-progress');
  });

  it('renders SVG for late state', () => {
    render(
      <FluxStationIndicator data={{ state: 'late', progress: 60 }} stationName="Offset" />
    );
    const svg = screen.getByTestId('flux-station-indicator');
    expect(svg).toHaveAttribute('data-state', 'late');
  });

  it('has tooltip with station name and status for planned', () => {
    render(<FluxStationIndicator data={{ state: 'planned' }} stationName="Offset" />);
    expect(screen.getByTitle('Offset — Planifié')).toBeInTheDocument();
  });

  it('has tooltip with station name and status for done', () => {
    render(<FluxStationIndicator data={{ state: 'done' }} stationName="Massicot" />);
    expect(screen.getByTitle('Massicot — Terminé')).toBeInTheDocument();
  });

  it('has tooltip for in-progress', () => {
    render(
      <FluxStationIndicator data={{ state: 'in-progress', progress: 40 }} stationName="Plieuse" />
    );
    expect(screen.getByTitle('Plieuse — En cours')).toBeInTheDocument();
  });

  it('has tooltip for late', () => {
    render(
      <FluxStationIndicator data={{ state: 'late', progress: 60 }} stationName="Offset" />
    );
    expect(screen.getByTitle('Offset — En retard')).toBeInTheDocument();
  });

  it('planned state has small dot at center', () => {
    const { container } = render(
      <FluxStationIndicator data={{ state: 'planned' }} stationName="Offset" />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]).toHaveAttribute('r', '3.5');
  });

  it('done state has larger dot at center', () => {
    const { container } = render(
      <FluxStationIndicator data={{ state: 'done' }} stationName="Offset" />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]).toHaveAttribute('r', '5');
  });

  it('in-progress state has three elements: track, arc, center dot', () => {
    const { container } = render(
      <FluxStationIndicator data={{ state: 'in-progress', progress: 50 }} stationName="Offset" />
    );
    const circles = container.querySelectorAll('circle');
    // track ring + progress arc + center dot
    expect(circles).toHaveLength(3);
  });
});
