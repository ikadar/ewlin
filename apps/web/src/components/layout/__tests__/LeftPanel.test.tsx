import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { LeftPanel } from '../LeftPanel';

describe('LeftPanel', () => {
  it('renders with expanded width by default', () => {
    const { container } = render(<LeftPanel />);
    const panel = container.querySelector('aside');
    expect(panel).toHaveStyle({ width: '280px' });
  });

  it('collapses to 48px when toggle is clicked', () => {
    const { container } = render(<LeftPanel />);
    const panel = container.querySelector('aside');

    // Click the collapse button
    fireEvent.click(screen.getByLabelText('Collapse Jobs'));

    expect(panel).toHaveStyle({ width: '48px' });
  });

  it('expands back to 280px when toggle is clicked again', () => {
    const { container } = render(<LeftPanel />);
    const panel = container.querySelector('aside');

    // Collapse
    fireEvent.click(screen.getByLabelText('Collapse Jobs'));
    expect(panel).toHaveStyle({ width: '48px' });

    // Expand
    fireEvent.click(screen.getByLabelText('Expand Jobs'));
    expect(panel).toHaveStyle({ width: '280px' });
  });

  it('renders children when expanded', () => {
    render(
      <LeftPanel>
        <div data-testid="child-content">Test Content</div>
      </LeftPanel>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('shows icon buttons when collapsed', () => {
    render(<LeftPanel />);

    // Collapse the panel
    fireEvent.click(screen.getByLabelText('Collapse Jobs'));

    // Check for icon buttons
    expect(screen.getByTitle('Jobs')).toBeInTheDocument();
    expect(screen.getByTitle('Tasks')).toBeInTheDocument();
    expect(screen.getByTitle('Status')).toBeInTheDocument();
    expect(screen.getByTitle('Date')).toBeInTheDocument();
  });

  it('persists collapse state in Redux', () => {
    const { store } = render(<LeftPanel />);

    expect(store.getState().ui.leftPanelCollapsed).toBe(false);

    fireEvent.click(screen.getByLabelText('Collapse Jobs'));

    expect(store.getState().ui.leftPanelCollapsed).toBe(true);
  });
});
