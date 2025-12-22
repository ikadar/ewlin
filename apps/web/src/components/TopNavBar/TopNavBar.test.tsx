import { render, screen, fireEvent } from '@testing-library/react';
import { TopNavBar } from './TopNavBar';
import { ZOOM_LEVELS, DEFAULT_PIXELS_PER_HOUR } from './constants';

describe('TopNavBar', () => {
  const defaultProps = {
    isQuickPlacementMode: false,
    onToggleQuickPlacement: vi.fn(),
    canEnableQuickPlacement: false,
    pixelsPerHour: DEFAULT_PIXELS_PER_HOUR,
    onZoomChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the logo', () => {
      render(<TopNavBar {...defaultProps} />);
      expect(screen.getByTestId('nav-logo')).toHaveTextContent('Flux');
    });

    it('renders the Quick Placement button', () => {
      render(<TopNavBar {...defaultProps} />);
      expect(screen.getByTestId('quick-placement-button')).toBeInTheDocument();
    });

    it('renders the zoom control', () => {
      render(<TopNavBar {...defaultProps} />);
      expect(screen.getByTestId('zoom-control')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-level')).toBeInTheDocument();
    });

    it('renders user and settings buttons (disabled)', () => {
      render(<TopNavBar {...defaultProps} />);
      expect(screen.getByTestId('user-button')).toBeDisabled();
      expect(screen.getByTestId('settings-button')).toBeDisabled();
    });
  });

  describe('Quick Placement button', () => {
    it('is disabled when canEnableQuickPlacement is false', () => {
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={false} />);
      expect(screen.getByTestId('quick-placement-button')).toBeDisabled();
    });

    it('is enabled when canEnableQuickPlacement is true', () => {
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={true} />);
      expect(screen.getByTestId('quick-placement-button')).not.toBeDisabled();
    });

    it('shows active state when isQuickPlacementMode is true', () => {
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={true} isQuickPlacementMode={true} />);
      const button = screen.getByTestId('quick-placement-button');
      expect(button).toHaveClass('bg-emerald-500/20');
      expect(button).toHaveClass('text-emerald-400');
    });

    it('shows inactive state when isQuickPlacementMode is false', () => {
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={true} isQuickPlacementMode={false} />);
      const button = screen.getByTestId('quick-placement-button');
      expect(button).toHaveClass('text-zinc-400');
      expect(button).not.toHaveClass('bg-emerald-500/20');
    });

    it('calls onToggleQuickPlacement when clicked', () => {
      const mockToggle = vi.fn();
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={true} onToggleQuickPlacement={mockToggle} />);
      fireEvent.click(screen.getByTestId('quick-placement-button'));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggleQuickPlacement when disabled and clicked', () => {
      const mockToggle = vi.fn();
      render(<TopNavBar {...defaultProps} canEnableQuickPlacement={false} onToggleQuickPlacement={mockToggle} />);
      fireEvent.click(screen.getByTestId('quick-placement-button'));
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('Zoom control', () => {
    it('displays current zoom level', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={80} />);
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
    });

    it('displays 50% when pixelsPerHour is 40', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={40} />);
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('50%');
    });

    it('displays 200% when pixelsPerHour is 160', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={160} />);
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('200%');
    });

    it('calls onZoomChange with next level when zoom in is clicked', () => {
      const mockZoomChange = vi.fn();
      render(<TopNavBar {...defaultProps} pixelsPerHour={80} onZoomChange={mockZoomChange} />);
      fireEvent.click(screen.getByTestId('zoom-in-button'));
      expect(mockZoomChange).toHaveBeenCalledWith(120); // 150% level
    });

    it('calls onZoomChange with previous level when zoom out is clicked', () => {
      const mockZoomChange = vi.fn();
      render(<TopNavBar {...defaultProps} pixelsPerHour={80} onZoomChange={mockZoomChange} />);
      fireEvent.click(screen.getByTestId('zoom-out-button'));
      expect(mockZoomChange).toHaveBeenCalledWith(60); // 75% level
    });

    it('disables zoom in button at maximum zoom', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={160} />);
      expect(screen.getByTestId('zoom-in-button')).toBeDisabled();
    });

    it('disables zoom out button at minimum zoom', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={40} />);
      expect(screen.getByTestId('zoom-out-button')).toBeDisabled();
    });

    it('enables both zoom buttons at middle zoom levels', () => {
      render(<TopNavBar {...defaultProps} pixelsPerHour={80} />);
      expect(screen.getByTestId('zoom-in-button')).not.toBeDisabled();
      expect(screen.getByTestId('zoom-out-button')).not.toBeDisabled();
    });
  });

  describe('ZOOM_LEVELS constant', () => {
    it('has correct number of levels', () => {
      expect(ZOOM_LEVELS).toHaveLength(5);
    });

    it('has correct pixelsPerHour values', () => {
      expect(ZOOM_LEVELS[0].pixelsPerHour).toBe(40);
      expect(ZOOM_LEVELS[1].pixelsPerHour).toBe(60);
      expect(ZOOM_LEVELS[2].pixelsPerHour).toBe(80);
      expect(ZOOM_LEVELS[3].pixelsPerHour).toBe(120);
      expect(ZOOM_LEVELS[4].pixelsPerHour).toBe(160);
    });

    it('has correct labels', () => {
      expect(ZOOM_LEVELS[0].label).toBe('50%');
      expect(ZOOM_LEVELS[1].label).toBe('75%');
      expect(ZOOM_LEVELS[2].label).toBe('100%');
      expect(ZOOM_LEVELS[3].label).toBe('150%');
      expect(ZOOM_LEVELS[4].label).toBe('200%');
    });
  });

  describe('DEFAULT_PIXELS_PER_HOUR constant', () => {
    it('equals 80 (100% zoom)', () => {
      expect(DEFAULT_PIXELS_PER_HOUR).toBe(80);
    });
  });
});
