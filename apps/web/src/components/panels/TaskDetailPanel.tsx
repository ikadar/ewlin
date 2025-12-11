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
  const job = snapshot?.jobs.find((j) => j.id === task.jobId);
  const operator = assignment?.operatorId
    ? snapshot?.operators.find((o) => o.id === assignment.operatorId)
    : null;
  const equipment = assignment?.equipmentId
    ? snapshot?.equipment.find((e) => e.id === assignment.equipmentId)
    : null;

  const getStatusVariant = () => {
    switch (task.status) {
      case 'Completed':
        return 'success';
      case 'Failed':
      case 'Cancelled':
        return 'destructive';
      case 'Executing':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleClose = () => {
    dispatch(setSelectedTask(null));
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
            <span className="font-medium">{task.type}</span>
            <Badge variant={getStatusVariant()}>{task.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Duration: {task.duration} minutes</div>
        </div>

        {/* Job Info */}
        {job && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Job</h4>
            <div className="text-sm">
              <div>{job.name}</div>
              <div className="text-muted-foreground truncate">{job.description}</div>
              <div className="text-muted-foreground">
                Deadline: {format(new Date(job.deadline), 'MMM d, yyyy HH:mm')}
              </div>
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
              {operator && (
                <div>
                  <span className="text-muted-foreground">Operator: </span>
                  {operator.name}
                </div>
              )}
              {equipment && (
                <div>
                  <span className="text-muted-foreground">Equipment: </span>
                  {equipment.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-1">Dependencies</h4>
            <div className="space-y-1">
              {task.dependencies.map((depId) => {
                const depTask = snapshot?.tasks.find((t) => t.id === depId);
                return (
                  <div key={depId} className="text-sm flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        depTask?.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                    <span>{depTask?.type ?? 'Unknown'}</span>
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
