import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setSelectedTask } from '../../store/uiSlice';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { X } from 'lucide-react';

interface TaskDetailPanelProps {
  className?: string;
}

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const selectedTask = useAppSelector((state) => state.ui.selectedTask);
  const snapshot = useAppSelector((state) => state.schedule.snapshot);
  const dispatch = useAppDispatch();

  if (!selectedTask) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base">Task Details</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select a task to view details</p>
        </CardContent>
      </Card>
    );
  }

  const { task, assignment } = selectedTask;
  const job = snapshot?.jobs.find((j) => j.tasks.some((t) => t.id === task.id));
  const station = task.stationId
    ? snapshot?.stations.find((s) => s.id === task.stationId)
    : null;
  const provider = task.providerId
    ? snapshot?.providers.find((p) => p.id === task.providerId)
    : null;

  const getStatusVariant = () => {
    switch (task.status) {
      case 'Completed':
        return 'success';
      case 'Cancelled':
        return 'destructive';
      case 'InProgress':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleClose = () => {
    dispatch(setSelectedTask(null));
  };

  const getTaskLabel = () => {
    if (task.type === 'internal') {
      return task.stationName ?? 'Internal Task';
    }
    return task.providerName ?? task.actionType ?? 'Outsourced Task';
  };

  const getTaskDuration = () => {
    if (task.type === 'internal') {
      if (task.setupMinutes > 0) {
        return `${task.setupMinutes}+${task.runMinutes}m (total: ${task.totalMinutes}m)`;
      }
      return `${task.totalMinutes}m`;
    }
    return `${task.durationOpenDays ?? 0} open days`;
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="py-3 px-4 border-b flex-row items-center justify-between">
        <CardTitle className="text-base">Task Details</CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 space-y-4">
        {/* Task Info */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{getTaskLabel()}</span>
            <Badge variant={getStatusVariant()}>{task.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Duration: {getTaskDuration()}</div>
          {task.comment && (
            <div className="text-sm text-muted-foreground mt-1">Note: {task.comment}</div>
          )}
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            DSL: {task.rawInput}
          </div>
        </div>

        {/* Station/Provider Info */}
        {station && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Station</h4>
            <div className="text-sm">
              <div>{station.name}</div>
              <div className="text-muted-foreground">
                Status: {station.status} | Capacity: {station.capacity}
              </div>
            </div>
          </div>
        )}

        {provider && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Provider</h4>
            <div className="text-sm">
              <div>{provider.name}</div>
              <div className="text-muted-foreground">
                Action: {task.actionType}
              </div>
            </div>
          </div>
        )}

        {/* Job Info */}
        {job && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Job</h4>
            <div className="text-sm">
              <div className="font-medium">{job.reference}</div>
              <div className="text-muted-foreground">{job.client}</div>
              <div className="text-muted-foreground truncate">{job.description}</div>
              <div className="text-muted-foreground">
                Exit: {format(new Date(job.workshopExitDate), 'MMM d, yyyy')}
              </div>
              {job.paperType && (
                <div className="text-muted-foreground">
                  Paper: {job.paperType} {job.paperFormat}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assignment Info */}
        {assignment && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Assignment</h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Start: </span>
                {format(new Date(assignment.scheduledStart), 'MMM d, HH:mm')}
              </div>
              <div>
                <span className="text-muted-foreground">End: </span>
                {format(new Date(assignment.scheduledEnd), 'MMM d, HH:mm')}
              </div>
            </div>
          </div>
        )}

        {/* Job Dependencies */}
        {job && job.dependencies.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Job Dependencies</h4>
            <div className="space-y-1">
              {job.dependencies.map((dep) => {
                const depJob = snapshot?.jobs.find((j) => j.id === dep.dependsOnJobId);
                return (
                  <div key={dep.dependsOnJobId} className="text-sm flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        depJob?.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                    <span>{depJob?.reference ?? 'Unknown'}</span>
                    <span className="text-muted-foreground text-xs">
                      (task #{dep.dependsOnTaskSequence})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t pt-3 space-y-2">
          <Button variant="outline" size="sm" className="w-full">
            Edit Task
          </Button>
          {!assignment && (
            <Button variant="default" size="sm" className="w-full">
              Assign to Grid
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
