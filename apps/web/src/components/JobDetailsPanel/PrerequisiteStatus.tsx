import type { PaperStatus, BatStatus, PlateStatus } from '@flux/types';
import { PrerequisiteDropdown } from './PrerequisiteDropdown';
import { paperOptions, batOptions, plateOptions } from './prerequisiteOptions';

export interface PrerequisiteStatusProps {
  paperStatus: PaperStatus;
  batStatus: BatStatus;
  plateStatus: PlateStatus;
  /** Whether this element has offset printing (show plates dropdown) */
  hasOffset?: boolean;
  /** Whether this is an assembly element (show "pas de prérequis") */
  isAssembly?: boolean;
  /** Callback when paper status changes */
  onPaperStatusChange?: (status: PaperStatus) => void;
  /** Callback when BAT status changes */
  onBatStatusChange?: (status: BatStatus) => void;
  /** Callback when plate status changes */
  onPlateStatusChange?: (status: PlateStatus) => void;
}

/**
 * Prerequisite status dropdowns for an element.
 * Shows Paper, BAT, and optionally Plates status with editable dropdowns.
 */
export function PrerequisiteStatus({
  paperStatus,
  batStatus,
  plateStatus,
  hasOffset = true,
  isAssembly = false,
  onPaperStatusChange,
  onBatStatusChange,
  onPlateStatusChange,
}: PrerequisiteStatusProps) {
  // Assembly elements show a simple message
  if (isAssembly) {
    return (
      <div className="text-xs text-zinc-500 italic" data-testid="prerequisite-assembly">
        (pas de prérequis)
      </div>
    );
  }

  // Don't show anything if all statuses are 'none' and no handlers provided
  const allNone = paperStatus === 'none' && batStatus === 'none' && plateStatus === 'none';
  const hasHandlers = onPaperStatusChange || onBatStatusChange || onPlateStatusChange;

  if (allNone && !hasHandlers) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="prerequisite-status">
      {/* Paper status dropdown */}
      <PrerequisiteDropdown
        label="Papier"
        value={paperStatus}
        options={paperOptions}
        type="paper"
        onChange={onPaperStatusChange ?? (() => {})}
      />

      {/* BAT status dropdown */}
      <PrerequisiteDropdown
        label="BAT"
        value={batStatus}
        options={batOptions}
        type="bat"
        onChange={onBatStatusChange ?? (() => {})}
      />

      {/* Plates status dropdown - only for offset elements */}
      {hasOffset && (
        <PrerequisiteDropdown
          label="Plaques"
          value={plateStatus}
          options={plateOptions}
          type="plate"
          onChange={onPlateStatusChange ?? (() => {})}
        />
      )}
    </div>
  );
}
