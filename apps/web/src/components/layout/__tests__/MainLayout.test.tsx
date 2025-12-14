import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '../../../test/utils';
import { MainLayout } from '../MainLayout';

// Mock window.innerWidth
const mockInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('MainLayout', () => {
  beforeEach(() => {
    // Reset to default large width
    mockInnerWidth(1400);
  });

  it('renders 3-column structure', () => {
    render(<MainLayout />);

    // Header should be present
    expect(screen.getByText('Flux Print Shop')).toBeInTheDocument();

    // Should have panels
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    expect(screen.getByText('Schedule Health')).toBeInTheDocument();
  });

  it('renders left panel content', () => {
    render(
      <MainLayout
        leftPanelContent={<div data-testid="left-content">Left</div>}
      />
    );
    expect(screen.getByTestId('left-content')).toBeInTheDocument();
  });

  it('renders center content', () => {
    render(
      <MainLayout centerContent={<div data-testid="center-content">Center</div>} />
    );
    expect(screen.getByTestId('center-content')).toBeInTheDocument();
  });

  it('renders right panel content', () => {
    render(
      <MainLayout
        rightPanelContent={<div data-testid="right-content">Right</div>}
      />
    );
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
  });

  it('has h-screen class for full height', () => {
    const { container } = render(<MainLayout />);
    expect(container.firstChild).toHaveClass('h-screen');
  });

  it('applies custom className', () => {
    const { container } = render(<MainLayout className="custom-layout" />);
    expect(container.firstChild).toHaveClass('custom-layout');
  });

  describe('responsive behavior', () => {
    it('collapses both panels on medium screens (< 1024px)', () => {
      const { store } = render(<MainLayout />);

      // Trigger resize to medium screen
      mockInnerWidth(900);

      expect(store.getState().ui.leftPanelCollapsed).toBe(true);
      expect(store.getState().ui.rightPanelCollapsed).toBe(true);
    });

    it('collapses only right panel on large screens (< 1280px)', () => {
      const { store } = render(<MainLayout />);

      // Trigger resize to large screen
      mockInnerWidth(1100);

      expect(store.getState().ui.leftPanelCollapsed).toBe(false);
      expect(store.getState().ui.rightPanelCollapsed).toBe(true);
    });

    it('shows all panels on extra large screens (>= 1280px)', () => {
      const { store } = render(<MainLayout />);

      // Trigger resize to extra large screen
      mockInnerWidth(1400);

      expect(store.getState().ui.leftPanelCollapsed).toBe(false);
      expect(store.getState().ui.rightPanelCollapsed).toBe(false);
    });
  });
});
