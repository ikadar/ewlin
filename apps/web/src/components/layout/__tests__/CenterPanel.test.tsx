import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import { CenterPanel } from '../CenterPanel';

describe('CenterPanel', () => {
  it('renders children content', () => {
    render(
      <CenterPanel>
        <div data-testid="center-content">Center Content</div>
      </CenterPanel>
    );
    expect(screen.getByTestId('center-content')).toBeInTheDocument();
  });

  it('renders placeholder when no children provided', () => {
    render(<CenterPanel />);
    expect(screen.getByText('Scheduling Grid')).toBeInTheDocument();
    expect(
      screen.getByText('Grid component will be implemented here')
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CenterPanel className="custom-class" />);
    expect(container.querySelector('main')).toHaveClass('custom-class');
  });

  it('has flex-1 class for flexible width', () => {
    const { container } = render(<CenterPanel />);
    expect(container.querySelector('main')).toHaveClass('flex-1');
  });
});
