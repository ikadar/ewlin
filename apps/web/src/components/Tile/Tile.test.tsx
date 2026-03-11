import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tile } from './Tile';
import { SwapButtons } from './SwapButtons';
import { SimilarityIndicators } from './SimilarityIndicators';
import { getStateColorClasses, computeTileState } from './colorUtils';
import type { TileState } from './colorUtils';
import type { TaskAssignment, InternalTask, Job } from '@flux/types';

// Mock data
const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Autosphere',
  description: 'Brochures',
  status: 'Planned',
  workshopExitDate: new Date().toISOString(),
  fullyScheduled: false,
  color: '#8B5CF6', // Purple
  comments: [],
  elementIds: [],
  taskIds: [],
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
    shipped: false,
    shippedAt: null,
};

const mockTask: InternalTask = {
  id: 'task-1',
  elementId: 'elem-1',
  type: 'Internal',
  stationId: 'station-1',
  sequenceOrder: 0,
  status: 'Defined',
  duration: {
    setupMinutes: 30,
    runMinutes: 60,
  },
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
};

const mockAssignment: TaskAssignment = {
  id: 'assignment-1',
  taskId: 'task-1',
  targetId: 'station-1',
  isOutsourced: false,
  // 90 minutes span (30 setup + 60 run) = 1.5 hours = 120px at 80px/hour
  scheduledStart: '2025-12-15T09:00:00Z',
  scheduledEnd: '2025-12-15T10:30:00Z',
  isCompleted: false,
  completedAt: null,
  createdAt: '2025-12-15T08:00:00Z',
  updatedAt: '2025-12-15T08:00:00Z',
};

describe('colorUtils', () => {
  describe('computeTileState', () => {
    it('returns shipped when isShipped (highest priority)', () => {
      expect(computeTileState(true, true, true, true, true)).toBe('shipped');
    });

    it('returns late when isLate (second highest priority)', () => {
      expect(computeTileState(false, true, true, true, true)).toBe('late');
    });

    it('returns conflict when hasConflict and not late/shipped', () => {
      expect(computeTileState(false, false, true, true, true)).toBe('conflict');
    });

    it('returns blocked when isBlocked and no higher priority', () => {
      expect(computeTileState(false, false, false, true, true)).toBe('blocked');
    });

    it('returns completed when isCompleted and no higher priority', () => {
      expect(computeTileState(false, false, false, false, true)).toBe('completed');
    });

    it('returns default when no flags set', () => {
      expect(computeTileState(false, false, false, false, false)).toBe('default');
    });
  });

  describe('getStateColorClasses', () => {
    const states: TileState[] = ['default', 'completed', 'conflict', 'late', 'blocked'];

    it('returns classes for all 5 states', () => {
      states.forEach((state) => {
        const classes = getStateColorClasses(state);
        expect(classes.border).toBeTruthy();
        expect(classes.setupBg).toBeTruthy();
        expect(classes.setupBorder).toBeTruthy();
        expect(classes.runBg).toBeTruthy();
        expect(classes.text).toBeTruthy();
      });
    });

    it('returns blue classes for default state', () => {
      const classes = getStateColorClasses('default');
      expect(classes.border).toBe('border-l-blue-500');
      expect(classes.text).toBe('text-blue-300');
    });

    it('returns green classes for completed state', () => {
      const classes = getStateColorClasses('completed');
      expect(classes.border).toBe('border-l-green-500');
      expect(classes.text).toBe('text-green-300');
    });

    it('returns amber classes for conflict state', () => {
      const classes = getStateColorClasses('conflict');
      expect(classes.border).toBe('border-l-amber-500');
      expect(classes.text).toBe('text-amber-300');
    });

    it('returns red classes for late state', () => {
      const classes = getStateColorClasses('late');
      expect(classes.border).toBe('border-l-red-500');
      expect(classes.text).toBe('text-red-300');
    });

    it('returns zinc classes for blocked state', () => {
      const classes = getStateColorClasses('blocked');
      expect(classes.border).toBe('border-l-zinc-500');
      expect(classes.text).toBe('text-zinc-400');
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

  it('has data-job-id attribute for CSS selection highlighting', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveAttribute('data-job-id', 'job-1');
  });

  it('calls onSelect with job id when clicked (non-selected tile)', () => {
    const onSelect = vi.fn();
    render(<Tile {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('tile-assignment-1'));
    expect(onSelect).toHaveBeenCalledWith('job-1');
  });

  it('calls onPickFromGrid when clicking an already-selected non-completed tile', () => {
    const onPickFromGrid = vi.fn();
    render(<Tile {...defaultProps} isSelected={true} onPickFromGrid={onPickFromGrid} />);

    fireEvent.click(screen.getByTestId('tile-assignment-1'));
    expect(onPickFromGrid).toHaveBeenCalledWith(mockTask, mockJob, 'assignment-1');
  });

  it('calls onSelect when clicking a selected but completed tile', () => {
    const onSelect = vi.fn();
    const onPickFromGrid = vi.fn();
    const completedAssignment: TaskAssignment = { ...mockAssignment, isCompleted: true };
    render(
      <Tile {...defaultProps} assignment={completedAssignment} isSelected={true} onSelect={onSelect} onPickFromGrid={onPickFromGrid} />
    );

    fireEvent.click(screen.getByTestId('tile-assignment-1'));
    expect(onSelect).toHaveBeenCalledWith('job-1');
    expect(onPickFromGrid).not.toHaveBeenCalled();
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

  it('calculates correct height based on scheduled time span', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    // scheduledEnd - scheduledStart = 90 minutes = 1.5 hours = 120px (at 80px/hour)
    expect(tile).toHaveStyle({ height: '120px' });
  });

  it('calculates stretched height for overnight assignments (downtime-aware)', () => {
    // Assignment that spans overnight: 17:00 to 09:00 next day = 16 hours
    const stretchedAssignment: TaskAssignment = {
      ...mockAssignment,
      id: 'stretched-1',
      scheduledStart: '2025-12-15T17:00:00Z',
      scheduledEnd: '2025-12-16T09:00:00Z', // 16 hours later
    };

    render(<Tile {...defaultProps} assignment={stretchedAssignment} />);

    const tile = screen.getByTestId('tile-stretched-1');
    // 16 hours = 960 minutes = 1280px (at 80px/hour)
    expect(tile).toHaveStyle({ height: '1280px' });
  });

  it('maintains setup/run ratio for stretched tiles', () => {
    // Assignment that spans overnight: 17:00 to 09:00 next day = 16 hours
    const stretchedAssignment: TaskAssignment = {
      ...mockAssignment,
      id: 'stretched-2',
      scheduledStart: '2025-12-15T17:00:00Z',
      scheduledEnd: '2025-12-16T09:00:00Z', // 16 hours later
    };

    render(<Tile {...defaultProps} assignment={stretchedAssignment} />);

    const setupSection = screen.getByTestId('tile-setup-section');
    const runSection = screen.getByTestId('tile-run-section');

    // Original ratio: 30 setup / 90 total = 1/3
    // Stretched total height: 1280px
    const setupHeight = parseFloat(setupSection.style.height);
    const runHeight = parseFloat(runSection.style.height);

    // Check ratio is maintained (setup should be 1/3 of total)
    expect(setupHeight / (setupHeight + runHeight)).toBeCloseTo(30 / 90, 2);
  });

  it('positions at correct top position', () => {
    render(<Tile {...defaultProps} top={200} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveStyle({ top: '200px' });
  });

  it('applies default (blue) color when no tileState specified', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-blue-500');
  });

  it('applies late (red) color for late tileState', () => {
    render(<Tile {...defaultProps} tileState="late" />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-red-500');
  });

  it('applies conflict (amber) color for conflict tileState', () => {
    render(<Tile {...defaultProps} tileState="conflict" />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-amber-500');
  });

  it('applies completed (green) color for completed tileState', () => {
    render(<Tile {...defaultProps} tileState="completed" />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-green-500');
  });

  it('applies blocked (zinc) color for blocked tileState', () => {
    render(<Tile {...defaultProps} tileState="blocked" />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('border-l-zinc-500');
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
    // Tile uses div with role="button" due to nested interactive elements (SwapButtons)
    expect(tile).toHaveAttribute('role', 'button');
    expect(tile).toHaveAttribute('tabIndex', '0');
  });

  it('renders similarity indicators when provided', () => {
    const similarityResults = [
      { criterion: { id: 'crit-1', name: 'Same paper', fieldPath: 'paperType' }, isMatched: true },
      { criterion: { id: 'crit-2', name: 'Same client', fieldPath: 'client' }, isMatched: false },
    ];

    render(<Tile {...defaultProps} similarityResults={similarityResults} />);

    expect(screen.getByTestId('similarity-indicators')).toBeInTheDocument();
    expect(screen.getAllByTestId(/similarity-icon-/)).toHaveLength(2);
  });

  it('does not render similarity indicators when not provided', () => {
    render(<Tile {...defaultProps} />);

    expect(screen.queryByTestId('similarity-indicators')).not.toBeInTheDocument();
  });

  it('does not render similarity indicators when empty array', () => {
    render(<Tile {...defaultProps} similarityResults={[]} />);

    expect(screen.queryByTestId('similarity-indicators')).not.toBeInTheDocument();
  });

  it('has transition classes for smooth animation', () => {
    render(<Tile {...defaultProps} />);

    const tile = screen.getByTestId('tile-assignment-1');
    expect(tile).toHaveClass('transition-[filter,opacity,box-shadow]');
    expect(tile).toHaveClass('duration-150');
    expect(tile).toHaveClass('ease-out');
  });

  describe('completion toggle (v0.3.33)', () => {
    it('calls onToggleComplete with assignment id when incomplete icon is clicked', () => {
      const onToggleComplete = vi.fn();
      render(<Tile {...defaultProps} onToggleComplete={onToggleComplete} />);

      fireEvent.click(screen.getByTestId('tile-incomplete-icon'));
      expect(onToggleComplete).toHaveBeenCalledWith('assignment-1');
    });

    it('calls onToggleComplete with assignment id when completed icon is clicked', () => {
      const completedAssignment: TaskAssignment = {
        ...mockAssignment,
        isCompleted: true,
      };
      const onToggleComplete = vi.fn();
      render(
        <Tile {...defaultProps} assignment={completedAssignment} onToggleComplete={onToggleComplete} />
      );

      fireEvent.click(screen.getByTestId('tile-completed-icon'));
      expect(onToggleComplete).toHaveBeenCalledWith('assignment-1');
    });

    it('does not call onSelect when icon is clicked (stopPropagation)', () => {
      const onSelect = vi.fn();
      const onToggleComplete = vi.fn();
      render(
        <Tile {...defaultProps} onSelect={onSelect} onToggleComplete={onToggleComplete} />
      );

      fireEvent.click(screen.getByTestId('tile-incomplete-icon'));
      expect(onToggleComplete).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('icon has hover cursor class', () => {
      render(<Tile {...defaultProps} />);

      const icon = screen.getByTestId('tile-incomplete-icon');
      expect(icon).toHaveClass('cursor-pointer');
    });

    it('icon has transition class for hover effect', () => {
      render(<Tile {...defaultProps} />);

      const icon = screen.getByTestId('tile-incomplete-icon');
      expect(icon).toHaveClass('transition-colors');
    });
  });
});

describe('SimilarityIndicators', () => {
  it('renders link icon for matched criterion', () => {
    const results = [
      { criterion: { id: 'crit-1', name: 'Same paper', fieldPath: 'paperType' }, isMatched: true },
    ];

    render(<SimilarityIndicators results={results} />);

    expect(screen.getByTestId('similarity-link-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('similarity-unlink-icon')).not.toBeInTheDocument();
  });

  it('renders unlink icon for non-matched criterion', () => {
    const results = [
      { criterion: { id: 'crit-1', name: 'Same paper', fieldPath: 'paperType' }, isMatched: false },
    ];

    render(<SimilarityIndicators results={results} />);

    expect(screen.getByTestId('similarity-unlink-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('similarity-link-icon')).not.toBeInTheDocument();
  });

  it('renders mixed icons for mixed results', () => {
    const results = [
      { criterion: { id: 'crit-1', name: 'Same paper', fieldPath: 'paperType' }, isMatched: true },
      { criterion: { id: 'crit-2', name: 'Same client', fieldPath: 'client' }, isMatched: false },
      { criterion: { id: 'crit-3', name: 'Same color', fieldPath: 'color' }, isMatched: true },
    ];

    render(<SimilarityIndicators results={results} />);

    const linkIcons = screen.getAllByTestId('similarity-link-icon');
    const unlinkIcons = screen.getAllByTestId('similarity-unlink-icon');

    expect(linkIcons).toHaveLength(2);
    expect(unlinkIcons).toHaveLength(1);
  });

  it('renders nothing when results array is empty', () => {
    const { container } = render(<SimilarityIndicators results={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays correct number of icons', () => {
    const results = [
      { criterion: { id: 'crit-1', name: 'Paper', fieldPath: 'p' }, isMatched: true },
      { criterion: { id: 'crit-2', name: 'Client', fieldPath: 'c' }, isMatched: true },
      { criterion: { id: 'crit-3', name: 'Color', fieldPath: 'col' }, isMatched: false },
      { criterion: { id: 'crit-4', name: 'Size', fieldPath: 's' }, isMatched: true },
    ];

    render(<SimilarityIndicators results={results} />);

    const icons = screen.getAllByTestId(/similarity-icon-/);
    expect(icons).toHaveLength(4);
  });

  it('has correct styling classes', () => {
    const results = [
      { criterion: { id: 'crit-1', name: 'Paper', fieldPath: 'p' }, isMatched: true },
    ];

    render(<SimilarityIndicators results={results} />);

    const container = screen.getByTestId('similarity-indicators');
    expect(container).toHaveClass('absolute', 'right-3', 'flex', 'gap-0.5');
  });
});
