import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { RightPanel } from '../RightPanel';

describe('RightPanel', () => {
  it('renders with expanded width by default', () => {
    const { container } = render(<RightPanel />);
    const panel = container.querySelector('aside');
    expect(panel).toHaveStyle({ width: '260px' });
  });

  it('collapses to 48px when toggle is clicked', () => {
    const { container } = render(<RightPanel />);
    const panel = container.querySelector('aside');

    // Click the collapse button
    fireEvent.click(screen.getByLabelText('Collapse Schedule Health'));

    expect(panel).toHaveStyle({ width: '48px' });
  });

  it('expands back to 260px when toggle is clicked again', () => {
    const { container } = render(<RightPanel />);
    const panel = container.querySelector('aside');

    // Collapse
    fireEvent.click(screen.getByLabelText('Collapse Schedule Health'));
    expect(panel).toHaveStyle({ width: '48px' });

    // Expand
    fireEvent.click(screen.getByLabelText('Expand Schedule Health'));
    expect(panel).toHaveStyle({ width: '260px' });
  });

  it('renders children when expanded', () => {
    render(
      <RightPanel>
        <div data-testid="child-content">Test Content</div>
      </RightPanel>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('shows icon buttons when collapsed', () => {
    render(<RightPanel />);

    // Collapse the panel
    fireEvent.click(screen.getByLabelText('Collapse Schedule Health'));

    // Check for icon buttons
    expect(screen.getByTitle('Late Jobs')).toBeInTheDocument();
    expect(screen.getByTitle('Violations')).toBeInTheDocument();
    expect(screen.getByTitle('Warnings')).toBeInTheDocument();
  });

  it('persists collapse state in Redux', () => {
    const { store } = render(<RightPanel />);

    expect(store.getState().ui.rightPanelCollapsed).toBe(false);

    fireEvent.click(screen.getByLabelText('Collapse Schedule Health'));

    expect(store.getState().ui.rightPanelCollapsed).toBe(true);
  });
});
