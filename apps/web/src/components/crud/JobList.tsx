import { format } from 'date-fns';
import { useAppSelector } from '../../store/hooks';
import { EntityList, StatusBadge } from './EntityList';
import type { Job } from '../../types';

interface JobListProps {
  onSelect?: (job: Job) => void;
  selectedId?: string;
  className?: string;
}

export function JobList({ onSelect, selectedId, className }: JobListProps) {
  const jobs = useAppSelector((state) => state.schedule.snapshot?.jobs ?? []);

  const columns = [
    { key: 'reference', header: 'Ref', className: 'w-24' },
    { key: 'client', header: 'Client', className: 'w-32' },
    {
      key: 'status',
      header: 'Status',
      render: (job: Job) => <StatusBadge status={job.status} />,
      className: 'w-28',
    },
    {
      key: 'deadline',
      header: 'Exit Date',
      render: (job: Job) => format(new Date(job.workshopExitDate), 'MMM d'),
      className: 'w-20',
    },
    {
      key: 'tasks',
      header: 'Tasks',
      render: (job: Job) => <span>{job.tasks.length}</span>,
      className: 'w-16 text-center',
    },
  ];

  return (
    <EntityList
      items={jobs}
      columns={columns}
      onSelect={onSelect}
      selectedId={selectedId}
      keyExtractor={(job) => job.id}
      className={className}
      emptyMessage="No jobs found"
    />
  );
}
