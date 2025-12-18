import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tile } from './Tile';
import { DragStateProvider } from '../../dnd';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';

// Sample data for stories
const createJob = (color: string, reference: string = 'ABC-001'): Job => ({
  id: 'job-1',
  reference,
  client: 'Acme Corp',
  description: 'Annual Report 2025',
  departureDate: '2025-12-20T14:00:00Z',
  color,
  batApproved: true,
  platesReady: true,
});

const createTask = (setupMinutes: number, runMinutes: number): InternalTask => ({
  id: 'task-1',
  jobId: 'job-1',
  stationId: 'station-komori',
  name: 'Print',
  sequence: 1,
  status: 'assigned',
  duration: {
    setupMinutes,
    runMinutes,
  },
});

const createAssignment = (isCompleted: boolean = false): TaskAssignment => ({
  id: 'assign-1',
  taskId: 'task-1',
  scheduledStart: '2025-12-18T08:00:00Z',
  scheduledEnd: '2025-12-18T10:30:00Z',
  isCompleted,
  completedAt: isCompleted ? '2025-12-18T10:30:00Z' : undefined,
});

const meta: Meta<typeof Tile> = {
  title: 'Components/Tile',
  component: Tile,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DragStateProvider>
        <div className="relative w-60 h-96 bg-slate-900">
          <Story />
        </div>
      </DragStateProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default tile with setup and run sections (purple color).
 */
export const Default: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(30, 120),
    job: createJob('#A855F7'), // purple
    top: 20,
  },
};

/**
 * Tile in selected state with glow effect.
 */
export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};

/**
 * Completed tile with green gradient.
 */
export const Completed: Story = {
  args: {
    assignment: createAssignment(true),
    task: createTask(30, 120),
    job: createJob('#A855F7'),
    top: 20,
  },
};

/**
 * Completed tile in selected state.
 */
export const CompletedSelected: Story = {
  args: {
    ...Completed.args,
    isSelected: true,
  },
};

/**
 * Tile without setup time (run only).
 */
export const NoSetup: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(0, 90),
    job: createJob('#3B82F6'), // blue
    top: 20,
  },
};

/**
 * Blue colored tile.
 */
export const Blue: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#3B82F6'),
    top: 20,
  },
};

/**
 * Green colored tile.
 */
export const Green: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#22C55E'),
    top: 20,
  },
};

/**
 * Orange colored tile.
 */
export const Orange: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#F97316'),
    top: 20,
  },
};

/**
 * Rose colored tile.
 */
export const Rose: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#F43F5E'),
    top: 20,
  },
};

/**
 * Cyan colored tile.
 */
export const Cyan: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#06B6D4'),
    top: 20,
  },
};

/**
 * Amber colored tile.
 */
export const Amber: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(15, 60),
    job: createJob('#F59E0B'),
    top: 20,
  },
};

/**
 * Tile with swap buttons (hover to see).
 */
export const WithSwapButtons: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(30, 90),
    job: createJob('#8B5CF6'),
    top: 20,
    showSwapUp: true,
    showSwapDown: true,
  },
};

/**
 * Top tile (no swap up button).
 */
export const TopTile: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(30, 90),
    job: createJob('#8B5CF6'),
    top: 20,
    showSwapUp: false,
    showSwapDown: true,
  },
};

/**
 * Bottom tile (no swap down button).
 */
export const BottomTile: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(30, 90),
    job: createJob('#8B5CF6'),
    top: 20,
    showSwapUp: true,
    showSwapDown: false,
  },
};

/**
 * Long job reference and client name.
 */
export const LongText: Story = {
  args: {
    assignment: createAssignment(),
    task: createTask(30, 120),
    job: createJob('#A855F7', 'VERY-LONG-REF-123'),
    top: 20,
  },
  decorators: [
    (Story) => (
      <DragStateProvider>
        <div className="relative w-60 h-96 bg-slate-900">
          <Story />
        </div>
      </DragStateProvider>
    ),
  ],
};
