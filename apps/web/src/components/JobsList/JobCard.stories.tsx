import type { Meta, StoryObj } from '@storybook/react-vite';
import { JobCard } from './JobCard';

const meta: Meta<typeof JobCard> = {
  title: 'Components/JobCard',
  component: JobCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    problemType: {
      control: 'select',
      options: [null, 'late', 'conflict'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-72 bg-zinc-900">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default job card in normal state.
 */
export const Default: Story = {
  args: {
    id: 'job-1',
    reference: 'ABC-001',
    client: 'Acme Corp',
    description: 'Annual Report 2025 - Full color brochure',
    taskCount: 5,
    completedTaskCount: 2,
    deadline: '20/12',
  },
};

/**
 * Selected state with white border highlight.
 */
export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};

/**
 * Late job with red background and "En retard" badge.
 */
export const Late: Story = {
  args: {
    id: 'job-late',
    reference: 'DEF-002',
    client: 'Big Client Inc',
    description: 'Marketing Flyers - Urgent delivery',
    taskCount: 3,
    completedTaskCount: 1,
    problemType: 'late',
  },
};

/**
 * Late job in selected state.
 */
export const LateSelected: Story = {
  args: {
    ...Late.args,
    isSelected: true,
  },
};

/**
 * Job with scheduling conflict (amber background).
 */
export const Conflict: Story = {
  args: {
    id: 'job-conflict',
    reference: 'GHI-003',
    client: 'Tech Solutions',
    description: 'Product Catalog - Precedence issue',
    taskCount: 4,
    completedTaskCount: 0,
    problemType: 'conflict',
  },
};

/**
 * Conflict job in selected state.
 */
export const ConflictSelected: Story = {
  args: {
    ...Conflict.args,
    isSelected: true,
  },
};

/**
 * Fully completed job (all tasks done).
 */
export const Completed: Story = {
  args: {
    id: 'job-done',
    reference: 'JKL-004',
    client: 'Local Business',
    description: 'Business Cards - 500 units',
    taskCount: 3,
    completedTaskCount: 3,
    deadline: '15/12',
  },
};

/**
 * Job with no completed tasks yet.
 */
export const NotStarted: Story = {
  args: {
    id: 'job-new',
    reference: 'MNO-005',
    client: 'Startup Ltd',
    description: 'Pitch Deck Printing - Premium finish',
    taskCount: 6,
    completedTaskCount: 0,
    deadline: '25/12',
  },
};

/**
 * Job with long text that truncates.
 */
export const LongText: Story = {
  args: {
    id: 'job-long',
    reference: 'PQR-006',
    client: 'International Corporation of Very Long Names',
    description: 'This is a very long job description that should be truncated because it exceeds the available width',
    taskCount: 8,
    completedTaskCount: 4,
    deadline: '30/12',
  },
};
