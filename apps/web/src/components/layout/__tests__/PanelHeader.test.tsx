import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { PanelHeader } from '../PanelHeader';

describe('PanelHeader', () => {
  it('renders title when not collapsed', () => {
    render(<PanelHeader title="Test Panel" />);
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('hides title when collapsed', () => {
    render(<PanelHeader title="Test Panel" collapsed />);
    expect(screen.queryByText('Test Panel')).not.toBeInTheDocument();
  });

  it('renders toggle button when onToggle is provided', () => {
    const onToggle = vi.fn();
    render(<PanelHeader title="Test Panel" onToggle={onToggle} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not render toggle button when onToggle is not provided', () => {
    render(<PanelHeader title="Test Panel" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onToggle when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(<PanelHeader title="Test Panel" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-label for expand when collapsed', () => {
    render(
      <PanelHeader title="Test Panel" collapsed onToggle={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Expand Test Panel'
    );
  });

  it('has correct aria-label for collapse when not collapsed', () => {
    render(
      <PanelHeader title="Test Panel" collapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Collapse Test Panel'
    );
  });
});
