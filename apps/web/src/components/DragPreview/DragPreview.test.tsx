import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DragPreview } from './DragPreview';
import type { InternalTask, Job } from '@flux/types';

const mockJob: Job = {
  id: 'job-1',
  reference: '12345',
  client: 'Test Client',
  description: 'Test Job',
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
  stationId: 'station-1',
  type: 'Internal',
  sequenceOrder: 1,
  status: 'Pending',
  duration: {
    setupMinutes: 30,
    runMinutes: 60,
  },
};

describe('DragPreview', () => {
  it('renders with correct testId', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    expect(screen.getByTestId('drag-preview')).toBeInTheDocument();
  });

  it('displays station ID for internal task', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    expect(screen.getByText('station-1')).toBeInTheDocument();
  });

  it('displays formatted duration', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    // 30 + 60 = 90 minutes = 1h30
    expect(screen.getByText('1h30')).toBeInTheDocument();
  });

  it('displays job reference and client', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    expect(screen.getByText('12345 · Test Client')).toBeInTheDocument();
  });

  it('applies opacity class for transparency', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    expect(preview).toHaveClass('opacity-80');
  });

  it('applies grabbing cursor', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    expect(preview).toHaveClass('cursor-grabbing');
  });

  it('has shadow for visual elevation', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    expect(preview).toHaveClass('shadow-lg');
  });

  it('applies job color border', () => {
    render(<DragPreview task={mockTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    expect(preview).toHaveClass('border-l-4');
    expect(preview).toHaveClass('border-l-purple-500');
  });

  it('calculates correct height for short tasks', () => {
    const shortTask: InternalTask = {
      ...mockTask,
      duration: { setupMinutes: 15, runMinutes: 15 },
    };
    render(<DragPreview task={shortTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    // 30 minutes = 40px, but minimum is 40px
    expect(preview).toHaveStyle({ height: '40px' });
  });

  it('calculates correct height for long tasks', () => {
    const longTask: InternalTask = {
      ...mockTask,
      duration: { setupMinutes: 60, runMinutes: 60 },
    };
    render(<DragPreview task={longTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    // 120 minutes = 2 hours = 160px
    expect(preview).toHaveStyle({ height: '160px' });
  });

  it('caps height at maximum', () => {
    const veryLongTask: InternalTask = {
      ...mockTask,
      duration: { setupMinutes: 180, runMinutes: 180 },
    };
    render(<DragPreview task={veryLongTask} job={mockJob} />);
    const preview = screen.getByTestId('drag-preview');
    // Max 200px
    expect(preview).toHaveStyle({ height: '200px' });
  });
});
