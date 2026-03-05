import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutsourcingTimeIndicator } from './OutsourcingTimeIndicator';

describe('OutsourcingTimeIndicator', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <OutsourcingTimeIndicator
        departureY={100}
        returnY={200}
        isVisible={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when arrow height would be zero or negative', () => {
    const { container } = render(
      <OutsourcingTimeIndicator
        departureY={200}
        returnY={100}
        isVisible={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders arrow, line and label when visible with valid Y positions', () => {
    render(
      <OutsourcingTimeIndicator
        departureY={100}
        returnY={200}
        isVisible={true}
      />
    );

    // Check arrow is rendered
    expect(screen.getByTestId('outsourcing-time-arrow')).toBeInTheDocument();

    // Check arrowhead is rendered
    expect(screen.getByTestId('outsourcing-time-arrowhead')).toBeInTheDocument();

    // Check horizontal line is rendered
    expect(screen.getByTestId('outsourcing-time-line')).toBeInTheDocument();

    // Check label is rendered
    expect(screen.getByTestId('outsourcing-time-label')).toBeInTheDocument();
    expect(screen.getByText('Fin')).toBeInTheDocument();
    expect(screen.getByText('outsourcing')).toBeInTheDocument();
  });

  it('positions arrow correctly based on Y values', () => {
    render(
      <OutsourcingTimeIndicator
        departureY={100}
        returnY={300}
        isVisible={true}
      />
    );

    const arrow = screen.getByTestId('outsourcing-time-arrow');
    expect(arrow).toHaveStyle({ top: '100px', height: '200px' });
  });

  it('positions return line at returnY', () => {
    render(
      <OutsourcingTimeIndicator
        departureY={100}
        returnY={300}
        isVisible={true}
      />
    );

    const line = screen.getByTestId('outsourcing-time-line');
    expect(line).toHaveStyle({ top: '300px' });
  });

  it('uses cyan/teal color scheme', () => {
    render(
      <OutsourcingTimeIndicator
        departureY={100}
        returnY={200}
        isVisible={true}
      />
    );

    const arrow = screen.getByTestId('outsourcing-time-arrow');
    // Check it has the cyan gradient
    expect(arrow).toHaveStyle({
      background: 'linear-gradient(to bottom, #06b6d4, #0891b2)',
    });
  });
});
