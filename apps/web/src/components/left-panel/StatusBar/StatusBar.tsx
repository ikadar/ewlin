import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { useAppSelector } from '../../../store/hooks';
import { BatStatusIcon } from './BatStatusIcon';
import { PlatesStatusIcon } from './PlatesStatusIcon';
import { PaperStatusIcon } from './PaperStatusIcon';

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  const selectedJobId = useAppSelector((state) => state.ui.selectedJobId);
  const jobs = useAppSelector((state) => state.schedule.snapshot?.jobs ?? []);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  // Don't render if no job selected
  if (!selectedJob) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4 px-3 py-2 border-b bg-muted/20',
        className
      )}
      data-testid="status-bar"
    >
      <BatStatusIcon
        proofSentAt={selectedJob.proofSentAt}
        proofApprovedAt={selectedJob.proofApprovedAt}
      />
      <PlatesStatusIcon status={selectedJob.platesStatus} />
      <PaperStatusIcon status={selectedJob.paperPurchaseStatus} />
    </div>
  );
}
