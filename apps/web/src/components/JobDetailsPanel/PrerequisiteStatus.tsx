import type { PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';
import { PrerequisiteDropdown } from './PrerequisiteDropdown';
import { paperOptions, batOptions, plateOptions, formeOptions } from './prerequisiteOptions';

export interface PrerequisiteStatusProps {
  paperStatus: PaperStatus;
  batStatus: BatStatus;
  plateStatus: PlateStatus;
  formeStatus: FormeStatus;
  /** Whether this element has offset printing (show plates dropdown) */
  hasOffset?: boolean;
  /** Whether this element has die-cutting (show forme dropdown) */
  hasDieCutting?: boolean;
  /** Whether this is an assembly element (show "pas de prérequis") */
  isAssembly?: boolean;
  /** Callback when paper status changes */
  onPaperStatusChange?: (status: PaperStatus) => void;
  /** Callback when BAT status changes */
  onBatStatusChange?: (status: BatStatus) => void;
  /** Callback when plate status changes */
  onPlateStatusChange?: (status: PlateStatus) => void;
  /** Callback when forme status changes */
  onFormeStatusChange?: (status: FormeStatus) => void;
  /** Date fields for display */
  paperOrderedAt?: string;
  paperDeliveredAt?: string;
  filesReceivedAt?: string;
  batSentAt?: string;
  batApprovedAt?: string;
  formeOrderedAt?: string;
  formeDeliveredAt?: string;
}

/**
 * Get the relevant date for an ordered/delivered status.
 * Works for both Paper and Forme statuses which share the same date logic.
 */
function getOrderedDeliveredDate(
  status: string,
  orderedAt?: string,
  deliveredAt?: string
): string | undefined {
  if (status === 'delivered') return deliveredAt;
  if (status === 'ordered') return orderedAt;
  return undefined;
}

function getBatDate(
  status: BatStatus,
  filesReceivedAt?: string,
  sentAt?: string,
  approvedAt?: string
): string | undefined {
  if (status === 'bat_approved') return approvedAt;
  if (status === 'bat_sent') return sentAt;
  if (status === 'files_received') return filesReceivedAt;
  return undefined;
}

// Type-safe wrappers using the shared implementation
const getPaperDate = (status: PaperStatus, orderedAt?: string, deliveredAt?: string) =>
  getOrderedDeliveredDate(status, orderedAt, deliveredAt);
const getFormeDate = (status: FormeStatus, orderedAt?: string, deliveredAt?: string) =>
  getOrderedDeliveredDate(status, orderedAt, deliveredAt);

/**
 * Prerequisite status dropdowns for an element.
 * Shows Paper, BAT, and optionally Plates/Forme status with editable dropdowns.
 */
export function PrerequisiteStatus({
  paperStatus,
  batStatus,
  plateStatus,
  formeStatus,
  hasOffset = true,
  hasDieCutting = false,
  isAssembly = false,
  onPaperStatusChange,
  onBatStatusChange,
  onPlateStatusChange,
  onFormeStatusChange,
  paperOrderedAt,
  paperDeliveredAt,
  filesReceivedAt,
  batSentAt,
  batApprovedAt,
  formeOrderedAt,
  formeDeliveredAt,
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
  const allNone =
    paperStatus === 'none' && batStatus === 'none' && plateStatus === 'none' && formeStatus === 'none';
  const hasHandlers =
    onPaperStatusChange || onBatStatusChange || onPlateStatusChange || onFormeStatusChange;

  if (allNone && !hasHandlers) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="prerequisite-status">
      {/* Paper status dropdown */}
      <PrerequisiteDropdown
        label="Papier"
        value={paperStatus}
        options={paperOptions}
        type="paper"
        onChange={onPaperStatusChange ?? (() => {})}
        dateValue={getPaperDate(paperStatus, paperOrderedAt, paperDeliveredAt)}
      />

      {/* BAT status dropdown */}
      <PrerequisiteDropdown
        label="BAT"
        value={batStatus}
        options={batOptions}
        type="bat"
        onChange={onBatStatusChange ?? (() => {})}
        dateValue={getBatDate(batStatus, filesReceivedAt, batSentAt, batApprovedAt)}
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

      {/* Forme status dropdown - only for die-cutting elements */}
      {hasDieCutting && (
        <PrerequisiteDropdown
          label="Forme"
          value={formeStatus}
          options={formeOptions}
          type="forme"
          onChange={onFormeStatusChange ?? (() => {})}
          dateValue={getFormeDate(formeStatus, formeOrderedAt, formeDeliveredAt)}
        />
      )}
    </div>
  );
}
