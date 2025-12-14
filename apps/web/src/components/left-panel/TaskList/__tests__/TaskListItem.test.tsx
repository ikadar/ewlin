import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskListItem } from '../TaskListItem';
import type { Task } from '../../../../types';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  jobId: 'job-1',
  sequenceOrder: 1,
  type: 'internal',
  stationId: 'station-1',
  stationName: 'Komori G37',
  setupMinutes: 15,
  runMinutes: 45,
  totalMinutes: 60,
  providerId: null,
  providerName: null,
  actionType: null,
  durationOpenDays: null,
  comment: null,
  status: 'Ready',
  rawInput: '[Komori G37] 15+45',
  ...overrides,
});

const defaultProps = {
  isScheduled: false,
  jobColor: '#3B82F6',
  onJumpTo: vi.fn(),
  onRecall: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  canMoveUp: true,
  canMoveDown: true,
};

describe('TaskListItem', () => {
  it('renders station name for internal task', () => {
    const task = createMockTask({ stationName: 'Heidelberg XL' });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('Heidelberg XL')).toBeInTheDocument();
  });

  it('renders provider name for outsourced task', () => {
    const task = createMockTask({
      type: 'outsourced',
      stationId: null,
      stationName: null,
      providerId: 'provider-1',
      providerName: 'Clément',
      actionType: 'Pelliculage',
      durationOpenDays: 2,
    });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('Clément')).toBeInTheDocument();
  });

  it('displays duration correctly for internal task (hours + minutes)', () => {
    const task = createMockTask({ setupMinutes: 30, runMinutes: 90 });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('displays duration correctly for internal task (minutes only)', () => {
    const task = createMockTask({ setupMinutes: 10, runMinutes: 35 });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('displays duration correctly for outsourced task (days)', () => {
    const task = createMockTask({
      type: 'outsourced',
      durationOpenDays: 3,
    });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('shows setup time for internal tasks', () => {
    const task = createMockTask({ setupMinutes: 20 });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('(20m setup)')).toBeInTheDocument();
  });

  it('shows action type for outsourced tasks', () => {
    const task = createMockTask({
      type: 'outsourced',
      actionType: 'Pelliculage',
      durationOpenDays: 2,
    });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByText('Pelliculage')).toBeInTheDocument();
  });

  it('shows full opacity for unscheduled tasks', () => {
    const task = createMockTask();
    const { container } = render(
      <TaskListItem task={task} {...defaultProps} isScheduled={false} />
    );
    expect(container.firstChild).toHaveClass('opacity-100');
  });

  it('shows reduced opacity for scheduled tasks', () => {
    const task = createMockTask();
    const { container } = render(
      <TaskListItem task={task} {...defaultProps} isScheduled={true} />
    );
    expect(container.firstChild).toHaveClass('opacity-50');
  });

  it('shows move up/down buttons for unscheduled tasks', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={false} />);
    expect(screen.getByLabelText('Move task up')).toBeInTheDocument();
    expect(screen.getByLabelText('Move task down')).toBeInTheDocument();
  });

  it('hides move buttons for scheduled tasks', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={true} />);
    expect(screen.queryByLabelText('Move task up')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move task down')).not.toBeInTheDocument();
  });

  it('disables move up when canMoveUp is false', () => {
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} canMoveUp={false} isScheduled={false} />
    );
    expect(screen.getByLabelText('Move task up')).toBeDisabled();
  });

  it('disables move down when canMoveDown is false', () => {
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} canMoveDown={false} isScheduled={false} />
    );
    expect(screen.getByLabelText('Move task down')).toBeDisabled();
  });

  it('calls onMoveUp when move up button clicked', () => {
    const onMoveUp = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onMoveUp={onMoveUp} isScheduled={false} />
    );
    fireEvent.click(screen.getByLabelText('Move task up'));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move down button clicked', () => {
    const onMoveDown = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onMoveDown={onMoveDown} isScheduled={false} />
    );
    fireEvent.click(screen.getByLabelText('Move task down'));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('shows hover buttons on mouse enter for scheduled tasks', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={true} />);

    // Initially no hover buttons
    expect(screen.queryByTestId('hover-buttons')).not.toBeInTheDocument();

    // Trigger hover
    fireEvent.mouseEnter(screen.getByRole('listitem'));
    expect(screen.getByTestId('hover-buttons')).toBeInTheDocument();
    expect(screen.getByLabelText('Jump to task')).toBeInTheDocument();
    expect(screen.getByLabelText('Recall task')).toBeInTheDocument();
  });

  it('hides hover buttons on mouse leave', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={true} />);

    // Trigger hover
    fireEvent.mouseEnter(screen.getByRole('listitem'));
    expect(screen.getByTestId('hover-buttons')).toBeInTheDocument();

    // Trigger leave
    fireEvent.mouseLeave(screen.getByRole('listitem'));
    expect(screen.queryByTestId('hover-buttons')).not.toBeInTheDocument();
  });

  it('calls onJumpTo on single click for scheduled task', () => {
    const onJumpTo = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onJumpTo={onJumpTo} isScheduled={true} />
    );
    fireEvent.click(screen.getByRole('listitem'));
    expect(onJumpTo).toHaveBeenCalledTimes(1);
  });

  it('does not call onJumpTo on single click for unscheduled task', () => {
    const onJumpTo = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onJumpTo={onJumpTo} isScheduled={false} />
    );
    fireEvent.click(screen.getByRole('listitem'));
    expect(onJumpTo).not.toHaveBeenCalled();
  });

  it('calls onRecall on double click for scheduled task', () => {
    const onRecall = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onRecall={onRecall} isScheduled={true} />
    );
    fireEvent.doubleClick(screen.getByRole('listitem'));
    expect(onRecall).toHaveBeenCalledTimes(1);
  });

  it('calls onJumpTo when Jump to button clicked', () => {
    const onJumpTo = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onJumpTo={onJumpTo} isScheduled={true} />
    );

    fireEvent.mouseEnter(screen.getByRole('listitem'));
    fireEvent.click(screen.getByLabelText('Jump to task'));
    expect(onJumpTo).toHaveBeenCalledTimes(1);
  });

  it('calls onRecall when Recall button clicked', () => {
    const onRecall = vi.fn();
    const task = createMockTask();
    render(
      <TaskListItem task={task} {...defaultProps} onRecall={onRecall} isScheduled={true} />
    );

    fireEvent.mouseEnter(screen.getByRole('listitem'));
    fireEvent.click(screen.getByLabelText('Recall task'));
    expect(onRecall).toHaveBeenCalledTimes(1);
  });

  it('applies job color to left border', () => {
    const task = createMockTask();
    const { container } = render(
      <TaskListItem task={task} {...defaultProps} jobColor="#FF5733" />
    );
    expect(container.firstChild).toHaveStyle({ borderLeftColor: '#FF5733' });
  });

  it('has data-task-id attribute', () => {
    const task = createMockTask({ id: 'my-task-123' });
    render(<TaskListItem task={task} {...defaultProps} />);
    expect(screen.getByRole('listitem')).toHaveAttribute('data-task-id', 'my-task-123');
  });

  it('is draggable when unscheduled', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={false} />);
    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'true');
  });

  it('is not draggable when scheduled', () => {
    const task = createMockTask();
    render(<TaskListItem task={task} {...defaultProps} isScheduled={true} />);
    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false');
  });
});
