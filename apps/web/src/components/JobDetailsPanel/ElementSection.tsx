import type { Element } from '@flux/types';
import { Workflow } from 'lucide-react';

export interface ElementSectionProps {
  /** The element to display */
  element: Element;
  /** All elements in the job (for resolving prerequisite suffixes) */
  allElements: Element[];
  /** Whether this is a single-element job (hides the section header) */
  isSingleElement?: boolean;
  /** Children (task tiles) */
  children: React.ReactNode;
}

/**
 * Section header for an element in the JobDetailsPanel.
 * Shows the element suffix and prerequisite elements.
 */
export function ElementSection({
  element,
  allElements,
  isSingleElement = false,
  children,
}: ElementSectionProps) {
  // For single-element jobs, don't show the header but still add spacing
  if (isSingleElement) {
    return <div className="space-y-1.5">{children}</div>;
  }

  // Build prerequisite suffix list
  const prerequisiteSuffixes = element.prerequisiteElementIds
    .map((id) => allElements.find((e) => e.id === id)?.suffix)
    .filter(Boolean)
    .map((s) => s!.toLowerCase());

  const hasPrerequisites = prerequisiteSuffixes.length > 0;

  return (
    <div className="mb-3">
      {/* Element header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 tracking-wide">
            {element.suffix.toUpperCase()}
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

      {/* Tasks */}
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}
