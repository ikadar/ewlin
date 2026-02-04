import { memo, useCallback, useMemo } from 'react';
import type { OutsourcedTask, OutsourcedProvider } from '@flux/types';
import { WorkDaysInput } from './WorkDaysInput';
import { DateTimePicker } from './DateTimePicker';
import { calculateOutsourcingDates } from '../../../utils/outsourcingCalculation';

export interface OutsourcingMiniFormProps {
  /** The outsourced task */
  task: OutsourcedTask;
  /** The provider for this task */
  provider: OutsourcedProvider | undefined;
  /** Job color for styling */
  jobColor: string;
  /** End time of predecessor task (if scheduled) - ISO string */
  predecessorEndTime?: string;
  /** Callback when work days changes */
  onWorkDaysChange?: (taskId: string, workDays: number) => void;
  /** Callback when manual departure changes */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** Callback when manual return changes */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
}

/**
 * OutsourcingMiniForm - Embedded form for editing outsourced task parameters.
 * Displays provider info, work days input, and departure/return date pickers.
 * v0.5.11: Outsourcing Mini-Form
 */
export const OutsourcingMiniForm = memo(function OutsourcingMiniForm({
  task,
  provider,
  jobColor,
  predecessorEndTime,
  onWorkDaysChange,
  onDepartureChange,
  onReturnChange,
}: OutsourcingMiniFormProps) {
  // Calculate dates from predecessor if available and no manual override
  const calculatedDates = useMemo(() => {
    if (!provider || !predecessorEndTime) return null;

    return calculateOutsourcingDates(predecessorEndTime, {
      workDays: task.duration.openDays,
      latestDepartureTime: provider.latestDepartureTime,
      receptionTime: provider.receptionTime,
      transitDays: provider.transitDays,
    });
  }, [predecessorEndTime, provider, task.duration.openDays]);

  // Use manual values if set, otherwise use calculated values
  const departureValue = useMemo(() => {
    if (task.manualDeparture) {
      return new Date(task.manualDeparture);
    }
    return calculatedDates?.departure;
  }, [task.manualDeparture, calculatedDates]);

  const returnValue = useMemo(() => {
    if (task.manualReturn) {
      return new Date(task.manualReturn);
    }
    return calculatedDates?.return;
  }, [task.manualReturn, calculatedDates]);

  // Handlers
  const handleWorkDaysChange = useCallback(
    (value: number) => {
      onWorkDaysChange?.(task.id, value);
    },
    [task.id, onWorkDaysChange]
  );

  const handleDepartureChange = useCallback(
    (value: Date | undefined) => {
      onDepartureChange?.(task.id, value);
    },
    [task.id, onDepartureChange]
  );

  const handleReturnChange = useCallback(
    (value: Date | undefined) => {
      onReturnChange?.(task.id, value);
    },
    [task.id, onReturnChange]
  );

  // Provider name display
  const providerName = provider?.name ?? 'Unknown Provider';

  return (
    <div
      className="text-sm border-l-4 bg-zinc-900/50"
      style={{ borderLeftColor: jobColor }}
      data-testid={`outsourcing-mini-form-${task.id}`}
    >
      {/* Header: Action type */}
      <div
        className="px-2 py-1 flex items-center gap-2"
        style={{ backgroundColor: `${jobColor}15` }}
      >
        <span
          className="font-medium truncate"
          style={{ color: jobColor }}
          data-testid="outsourcing-action-type"
        >
          {task.actionType}
        </span>
      </div>

      {/* Provider name */}
      <div className="px-2 pt-1 text-xs text-zinc-500" data-testid="outsourcing-provider-name">
        Provider: {providerName}
      </div>

      {/* Form fields */}
      <div className="px-2 py-2 space-y-1.5">
        {/* Work days input */}
        <WorkDaysInput
          value={task.duration.openDays}
          onChange={handleWorkDaysChange}
          disabled={!onWorkDaysChange}
        />

        {/* Departure date/time */}
        <DateTimePicker
          label="Dép:"
          value={departureValue}
          onChange={handleDepartureChange}
          disabled={!onDepartureChange}
          testId="outsourcing-departure"
        />

        {/* Return date/time */}
        <DateTimePicker
          label="Ret:"
          value={returnValue}
          onChange={handleReturnChange}
          disabled={!onReturnChange}
          testId="outsourcing-return"
        />
      </div>
    </div>
  );
});
