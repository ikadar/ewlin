import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobListItem } from '../JobListItem';
import type { Job } from '../../../../types';

const createMockJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  reference: '45001',
  client: 'Test Client',
  description: 'Test Description',
  workshopExitDate: new Date().toISOString(),
  status: 'Planned',
  fullyScheduled: false,
  color: '#3B82F6',
  paperType: 'Couché Mat 135g',
  paperFormat: '45x64',
  paperPurchaseStatus: 'InStock',
  paperOrderedAt: null,
  proofSentAt: null,
  proofApprovedAt: null,
  platesStatus: 'Todo',
  notes: '',
  comments: [],
  dependencies: [],
  tasks: [],
  ...overrides,
});

describe('JobListItem', () => {
  it('renders job reference', () => {
    const job = createMockJob({ reference: '45123' });
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.getByText('45123')).toBeInTheDocument();
  });

  it('renders client name', () => {
    const job = createMockJob({ client: 'Acme Corp' });
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const job = createMockJob();
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={onClick} />
    );

    fireEvent.click(screen.getByRole('option'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows late warning indicator when isLate is true', () => {
    const job = createMockJob();
    render(
      <JobListItem job={job} isSelected={false} isLate={true} onClick={vi.fn()} />
    );
    expect(screen.getByLabelText('Late job')).toBeInTheDocument();
  });

  it('does not show late warning when isLate is false', () => {
    const job = createMockJob();
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.queryByLabelText('Late job')).not.toBeInTheDocument();
  });

  it('has aria-selected when selected', () => {
    const job = createMockJob();
    render(
      <JobListItem job={job} isSelected={true} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });

  it('does not have aria-selected when not selected', () => {
    const job = createMockJob();
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
  });

  it('shows status indicator with correct title', () => {
    const job = createMockJob({ status: 'InProgress' });
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    expect(screen.getByTitle('InProgress')).toBeInTheDocument();
  });

  it('applies strikethrough for cancelled jobs', () => {
    const job = createMockJob({ status: 'Cancelled' });
    render(
      <JobListItem job={job} isSelected={false} isLate={false} onClick={vi.fn()} />
    );
    const reference = screen.getByText(job.reference);
    expect(reference).toHaveClass('line-through');
  });
});
