import type { Element, PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';
import { Workflow } from 'lucide-react';
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
  // For single-element jobs, show prerequisite status but not the element header
  if (isSingleElement) {
    return (
      <div className="space-y-1.5">
        {/* Show prerequisite status even for single elements */}
        <div className="px-1 mb-2">
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
        </div>
        {children}
      </div>
    );
  }

  // Build prerequisite suffix list
  const prerequisiteSuffixes = element.prerequisiteElementIds
    .map((id) => allElements.find((e) => e.id === id)?.name)
    .filter(Boolean)
    .map((s) => s!.toLowerCase());

  const hasPrerequisites = prerequisiteSuffixes.length > 0;

  return (
    <div className="mb-3">
      {/* Element header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 tracking-wide">
            {element.name.toUpperCase()}
          </span>
          {element.label && (
            <span className="text-xs text-zinc-500">
              {element.label}
            </span>
          )}
        </div>

        {hasPrerequisites && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Workflow className="w-3 h-3" />
            <span>{prerequisiteSuffixes.join(' ')}</span>
          </div>
        )}
      </div>

      {/* Prerequisite status row */}
      <div className="px-1 mb-2">
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
      </div>

      {/* Tasks */}
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}
