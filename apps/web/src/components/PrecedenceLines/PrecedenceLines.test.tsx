import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrecedenceLines } from './PrecedenceLines';

describe('PrecedenceLines', () => {
  it('renders purple line when earliestY is provided', () => {
    render(<PrecedenceLines earliestY={100} latestY={null} isVisible={true} />);

    const purpleLine = screen.getByTestId('precedence-line-earliest');
    expect(purpleLine).toBeInTheDocument();
    expect(purpleLine).toHaveStyle({ top: '100px' });
    expect(purpleLine).toHaveClass('bg-purple-500');
  });

  it('renders orange line when latestY is provided', () => {
    render(<PrecedenceLines earliestY={null} latestY={200} isVisible={true} />);

    const orangeLine = screen.getByTestId('precedence-line-latest');
    expect(orangeLine).toBeInTheDocument();
    expect(orangeLine).toHaveStyle({ top: '200px' });
    expect(orangeLine).toHaveClass('bg-orange-500');
  });

  it('renders both lines when both Y values are provided', () => {
    render(<PrecedenceLines earliestY={100} latestY={200} isVisible={true} />);

    expect(screen.getByTestId('precedence-line-earliest')).toBeInTheDocument();
    expect(screen.getByTestId('precedence-line-latest')).toBeInTheDocument();
  });

  it('renders nothing when both Y values are null', () => {
    const { container } = render(
      <PrecedenceLines earliestY={null} latestY={null} isVisible={true} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <PrecedenceLines earliestY={100} latestY={200} isVisible={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('has glow effect on purple line', () => {
    render(<PrecedenceLines earliestY={100} latestY={null} isVisible={true} />);

    const purpleLine = screen.getByTestId('precedence-line-earliest');
    expect(purpleLine).toHaveStyle({ boxShadow: '0 0 12px rgba(168, 85, 247, 0.8)' });
  });

  it('has glow effect on orange line', () => {
    render(<PrecedenceLines earliestY={null} latestY={200} isVisible={true} />);

    const orangeLine = screen.getByTestId('precedence-line-latest');
    expect(orangeLine).toHaveStyle({ boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)' });
  });

  it('lines are positioned absolutely with full width', () => {
    render(<PrecedenceLines earliestY={100} latestY={200} isVisible={true} />);

    const purpleLine = screen.getByTestId('precedence-line-earliest');
    expect(purpleLine).toHaveClass('absolute', 'left-0', 'right-0');
  });

  it('lines have correct z-index and pointer-events', () => {
    render(<PrecedenceLines earliestY={100} latestY={null} isVisible={true} />);

    const purpleLine = screen.getByTestId('precedence-line-earliest');
    expect(purpleLine).toHaveClass('z-30', 'pointer-events-none');
  });
});
