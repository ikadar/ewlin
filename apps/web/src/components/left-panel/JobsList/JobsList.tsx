import { useMemo, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { setSelectedJobId, setJobFilter } from '../../../store/uiSlice';
import { JobFilter } from './JobFilter';
import { JobListItem } from './JobListItem';
import { Plus } from 'lucide-react';
import { Button } from '../../common/Button';

interface JobsListProps {
  className?: string;
  onAddJob?: () => void;
}

export function JobsList({ className, onAddJob }: JobsListProps) {
  const dispatch = useAppDispatch();
  const listRef = useRef<HTMLDivElement>(null);

  const jobs = useAppSelector((state) => state.schedule.snapshot?.jobs ?? []);
  const lateJobs = useAppSelector(
    (state) => state.schedule.snapshot?.lateJobs ?? []
  );
  const selectedJobId = useAppSelector((state) => state.ui.selectedJobId);
  const filterText = useAppSelector((state) => state.ui.jobFilter);

  // Create set of late job IDs for O(1) lookup
  const lateJobIds = useMemo(
    () => new Set(lateJobs.map((lj) => lj.jobId)),
    [lateJobs]
  );

  // Filter jobs
  const filteredJobs = useMemo(() => {
    if (!filterText.trim()) {
      return jobs;
    }
    const search = filterText.toLowerCase();
    return jobs.filter(
      (job) =>
        job.reference.toLowerCase().includes(search) ||
        job.client.toLowerCase().includes(search) ||
        job.description.toLowerCase().includes(search)
    );
  }, [jobs, filterText]);

  // Get current selected index for keyboard navigation
  const selectedIndex = useMemo(
    () => filteredJobs.findIndex((j) => j.id === selectedJobId),
    [filteredJobs, selectedJobId]
  );

  const handleFilterChange = useCallback(
    (value: string) => {
      dispatch(setJobFilter(value));
    },
    [dispatch]
  );

  const handleJobSelect = useCallback(
    (jobId: string) => {
      dispatch(setSelectedJobId(jobId));
    },
    [dispatch]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredJobs.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, filteredJobs.length - 1);
        if (nextIndex >= 0) {
          dispatch(setSelectedJobId(filteredJobs[nextIndex].id));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, 0);
        if (filteredJobs.length > 0) {
          dispatch(setSelectedJobId(filteredJobs[prevIndex].id));
        }
      }
    },
    [dispatch, filteredJobs, selectedIndex]
  );

  // Auto-scroll to selected job
  useEffect(() => {
    if (selectedJobId && listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-job-id="${selectedJobId}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedJobId]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with filter and add button */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Jobs</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddJob}
            className="h-7 px-2"
            title="Add Job"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <JobFilter value={filterText} onChange={handleFilterChange} />
      </div>

      {/* Jobs list */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Jobs list"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto focus:outline-none"
      >
        {filteredJobs.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {jobs.length === 0
              ? 'No jobs available'
              : 'No jobs match the filter'}
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div key={job.id} data-job-id={job.id}>
              <JobListItem
                job={job}
                isSelected={job.id === selectedJobId}
                isLate={lateJobIds.has(job.id)}
                onClick={() => handleJobSelect(job.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Job count */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground">
        {filteredJobs.length} of {jobs.length} jobs
      </div>
    </div>
  );
}
