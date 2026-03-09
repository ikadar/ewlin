import type { Element, PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';
import { PrerequisiteStatus } from './PrerequisiteStatus';

export interface ElementSectionProps {
  /** The element to display */
  element: Element;
  /** All elements in the job (for resolving prerequisite suffixes) */
  allElements: Element[];
  /** Whether this is a single-element job (hides the section header) */
  isSingleElement?: boolean;
  /** Whether this element has offset printing tasks (show plates dropdown) */
  hasOffset?: boolean;
  /** Whether this element has die-cutting tasks (show forme dropdown) */
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
  /** Children (task tiles) */
  children: React.ReactNode;
}

/**
 * Section header for an element in the JobDetailsPanel.
 * Shows the element suffix, prerequisite elements, and production statuses.
 */
export function ElementSection({
  element,
  allElements,
  isSingleElement = false,
  hasOffset = true,
  hasDieCutting = false,
  isAssembly = false,
  onPaperStatusChange,
  onBatStatusChange,
  onPlateStatusChange,
  onFormeStatusChange,
  children,
}: ElementSectionProps) {
  const prerequisiteStatusElement = (
    <PrerequisiteStatus
      paperStatus={element.paperStatus}
      batStatus={element.batStatus}
      plateStatus={element.plateStatus}
      formeStatus={element.formeStatus}
      hasOffset={hasOffset}
      hasDieCutting={hasDieCutting}
      isAssembly={isAssembly}
      onPaperStatusChange={onPaperStatusChange}
      onBatStatusChange={onBatStatusChange}
      onPlateStatusChange={onPlateStatusChange}
      onFormeStatusChange={onFormeStatusChange}
      paperOrderedAt={element.paperOrderedAt}
      paperDeliveredAt={element.paperDeliveredAt}
      filesReceivedAt={element.filesReceivedAt}
      batSentAt={element.batSentAt}
      batApprovedAt={element.batApprovedAt}
      formeOrderedAt={element.formeOrderedAt}
      formeDeliveredAt={element.formeDeliveredAt}
    />
  );

  // For single-element jobs, show prerequisite status but not the element header
  if (isSingleElement) {
    return (
      <div className="space-y-1.5">
        <div className="px-1 mb-2">
          {prerequisiteStatusElement}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Element header: name + prerequisite pills on same row */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-zinc-400 tracking-wide truncate min-w-0 shrink">
          {element.name.toUpperCase()}
        </span>
        <div className="shrink-0">
          {prerequisiteStatusElement}
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}
