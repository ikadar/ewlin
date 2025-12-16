import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tile } from './Tile';
import { SwapButtons } from './SwapButtons';
import { hexToTailwindColor, getColorClasses, getJobColorClasses } from './colorUtils';
import type { TaskAssignment, InternalTask, Job } from '@flux/types';

// Mock data
const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Autosphere',
  description: 'Brochures',
  status: 'Planned',
  workshopExitDate: new Date().toISOString(),
  color: '#8B5CF6', // Purple
  paperPurchaseStatus: 'InStock',
  platesStatus: 'Done',
  proofSentAt: null,
  proofApprovedAt: null,
  requiredJobIds: [],
};

const mockTask: InternalTask = {
  id: 'task-1',
  jobId: 'job-1',
  categoryId: 'cat-1',
  sequence: 1,
  status: 'Pending',
  duration: {
    setupMinutes: 30,
    runMinutes: 60,
  },
};

const mockAssignment: TaskAssignment = {
  id: 'assignment-1',
  taskId: 'task-1',
  stationId: 'station-1',
  sequence: 1,
  startTime: '2025-12-15T09:00:00Z',
  isCompleted: false,
};

describe('colorUtils', () => {
  describe('hexToTailwindColor', () => {
    it('maps known hex colors correctly', () => {
      expect(hexToTailwindColor('#8B5CF6')).toBe('purple');
      expect(hexToTailwindColor('#F43F5E')).toBe('rose');
      expect(hexToTailwindColor('#EAB308')).toBe('yellow');
      expect(hexToTailwindColor('#14B8A6')).toBe('teal');
      expect(hexToTailwindColor('#22C55E')).toBe('green');
      expect(hexToTailwindColor('#06B6D4')).toBe('cyan');
      expect(hexToTailwindColor('#3B82F6')).toBe('blue');
      expect(hexToTailwindColor('#EC4899')).toBe('pink');
    });

    it('is case insensitive', () => {
      expect(hexToTailwindColor('#8b5cf6')).toBe('purple');
      expect(hexToTailwindColor('#8B5CF6')).toBe('purple');
    });

    it('returns purple as fallback for unknown colors', () => {
      expect(hexToTailwindColor('#000000')).toBe('purple');
      expect(hexToTailwindColor('#FFFFFF')).toBe('purple');
    });
  });

  describe('getColorClasses', () => {
    it('returns correct classes for purple', () => {
      const classes = getColorClasses('purple');
      expect(classes.border).toBe('border-l-purple-500');
      expect(classes.setupBg).toBe('bg-purple-900/40');
      expect(classes.setupBorder).toBe('border-purple-700/30');
      expect(classes.runBg).toBe('bg-purple-950/35');
      expect(classes.text).toBe('text-purple-300');
    });

    it('returns correct classes for all colors', () => {
      const colors = [
        'purple',
        'violet',
        'rose',
        'red',
        'yellow',
        'amber',
        'orange',
        'teal',
        'green',
        'emerald',
        'lime',
        'cyan',
        'sky',
        'blue',
        'indigo',
        'pink',
        'fuchsia',
      ] as const;

      colors.forEach((color) => {
        const classes = getColorClasses(color);
        expect(classes.border).toContain(color);
        expect(classes.setupBg).toContain(color);
        expect(classes.runBg).toContain(color);
        expect(classes.text).toContain(color);
      });
    });
  });

  describe('getJobColorClasses', () => {
    it('combines hex to tailwind mapping with class lookup', () => {
      const classes = getJobColorClasses('#8B5CF6');
      expect(classes.border).toBe('border-l-purple-500');
    });

    it('handles unknown hex colors with fallback', () => {
      const classes = getJobColorClasses('#123456');
      expect(classes.border).toBe('border-l-purple-500');
    });
  });
});

describe('SwapButtons', () => {
  it('renders both buttons by default', () => {
    render(<SwapButtons />);

    expect(screen.getByTestId('swap-up-button')).toBeInTheDocument();
    expect(screen.getByTestId('swap-down-button')).toBeInTheDocument();
  });

  it('hides up button when showUp is false', () => {
    render(<SwapButtons showUp={false} />);

    expect(screen.queryByTestId('swap-up-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('swap-down-button')).toBeInTheDocument();
  });

  it('hides down button when showDown is false', () => {
    render(<SwapButtons showDown={false} />);

    expect(screen.getByTestId('swap-up-button')).toBeInTheDocument();
    expect(screen.queryByTestId('swap-down-button')).not.toBeInTheDocument();
  });

  it('renders nothing when both buttons are hidden', () => {
    const { container } = render(<SwapButtons showUp={false} showDown={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('calls onSwapUp when up button is clicked', () => {
    const onSwapUp = vi.fn();
    render(<SwapButtons onSwapUp={onSwapUp} />);

    fireEvent.click(screen.getByTestId('swap-up-button'));
    expect(onSwapUp).toHaveBeenCalledTimes(1);
  });

  it('calls onSwapDown when down button is clicked', () => {
    const onSwapDown = vi.fn();
    render(<SwapButtons onSwapDown={onSwapDown} />);

    fireEvent.click(screen.getByTestId('swap-down-button'));
    expect(onSwapDown).toHaveBeenCalledTimes(1);
  });

  it('stops click propagation', () => {
    const parentClick = vi.fn();
    const onSwapUp = vi.fn();

    render(
      <div onClick={parentClick}>
        <SwapButtons onSwapUp={onSwapUp} />
      </div>
    );

    fireEvent.click(screen.getByTestId('swap-up-button'));
    expect(onSwapUp).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe('Tile', () => {
  const defaultProps = {
    assignment: mockAssignment,
    task: mockTask,
    job: mockJob,
    top: 100,
  };

  it('renders with correct testId', () => {
    render(<Tile {...defaultProps} />);

    expect(screen.getByTestId('tile-assignment-1')).toBeInTheDocument();
  });

  it('displays job reference and client', () => {
    render(<Tile {...defaultProps} />);

    expect(screen.getByTestId('tile-content')).toHaveTextContent('12345 · Autosphere');
  });

  it('renders setup section when task has setup time', () => {
    render(<Tile {...defaultProps} />);

    expect(screen.getByTestId('tile-setup-section')).toBeInTheDocument();
    expect(screen.getByTestId('tile-run-section')).toBeInTheDocument();
  });

  it('does not render setup section when task has no setup time', () => {
    const taskNoSetup: InternalTask = {
      ...mockTask,
      duration: { setupMinutes: 0, runMinutes: 60 },
    };

    render(<Tile {...defaultProps} task={taskNoSetup} />);

    expect(screen.queryByTestId('tile-setup-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('tile-run-section')).toBeInTheDocument();
  });

  it('shows incomplete icon when not completed', () => {
    render(<Tile {...defaultProps} />);

    expect(screen.getByTestId('tile-incomplete-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('tile-completed-icon')).not.toBeInTheDocument();
  });

  it('shows completed icon when completed', () => {
    const completedAssignment: TaskAssignment = {
      ...mockAssignment,
      isCompleted: true,
    };

    render(<Tile {...defaultProps} assignment={completedAssignment} />);

    expect(screen.getByTestId('tile-completed-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('tile-incomplete-icon')).not.toBeInTheDocument();
  });

  it('applies selection styling when selected', () => {
    render(<Tile {...defaultProps} isSelected={true} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('ring-2');
    expect(tile).toHaveClass('ring-white/30');
  });

  it('does not apply selection styling when not selected', () => {
    render(<Tile {...defaultProps} isSelected={false} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).not.toHaveClass('ring-2');
  });

  it('calls onSelect with job id when clicked', () => {
    const onSelect = vi.fn();
    render(<Tile {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('tile-assignment-1'));
    expect(onSelect).toHaveBeenCalledWith('job-1');
  });

  it('calls onRecall with assignment id when double-clicked', () => {
    const onRecall = vi.fn();
    render(<Tile {...defaultProps} onRecall={onRecall} />);

    fireEvent.doubleClick(screen.getByTestId('tile-assignment-1'));
    expect(onRecall).toHaveBeenCalledWith('assignment-1');
  });

  it('shows swap buttons on hover (via group class)', () => {
    render(<Tile {...defaultProps} />);

    // Swap buttons should be rendered (visibility controlled by CSS)
    expect(screen.getByTestId('swap-buttons')).toBeInTheDocument();
  });

  it('hides swap up button when showSwapUp is false', () => {
    render(<Tile {...defaultProps} showSwapUp={false} />);

    expect(screen.queryByTestId('swap-up-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('swap-down-button')).toBeInTheDocument();
  });

  it('hides swap down button when showSwapDown is false', () => {
    render(<Tile {...defaultProps} showSwapDown={false} />);

    expect(screen.getByTestId('swap-up-button')).toBeInTheDocument();
    expect(screen.queryByTestId('swap-down-button')).not.toBeInTheDocument();
  });

  it('calls onSwapUp with assignment id when swap up is clicked', () => {
    const onSwapUp = vi.fn();
    render(<Tile {...defaultProps} onSwapUp={onSwapUp} />);

    fireEvent.click(screen.getByTestId('swap-up-button'));
    expect(onSwapUp).toHaveBeenCalledWith('assignment-1');
  });

  it('calls onSwapDown with assignment id when swap down is clicked', () => {
    const onSwapDown = vi.fn();
    render(<Tile {...defaultProps} onSwapDown={onSwapDown} />);

    fireEvent.click(screen.getByTestId('swap-down-button'));
    expect(onSwapDown).toHaveBeenCalledWith('assignment-1');
  });

  it('calculates correct height based on duration', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    // 30 + 60 = 90 minutes = 1.5 hours = 120px (at 80px/hour)
    expect(tile).toHaveStyle({ height: '120px' });
  });

  it('positions at correct top position', () => {
    render(<Tile {...defaultProps} top={200} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveStyle({ top: '200px' });
  });

  it('applies job color to border', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-purple-500');
  });

  it('handles keyboard Enter for selection', () => {
    const onSelect = vi.fn();
    render(<Tile {...defaultProps} onSelect={onSelect} />);

    const tile = screen.getByTestId('tile-assignment-1');
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('job-1');
  });

  it('has correct accessibility attributes', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveAttribute('role', 'button');
    expect(tile).toHaveAttribute('tabIndex', '0');
  });
});
