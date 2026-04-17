import type { Element } from '@flux/types';

export interface ElementSectionProps {
  /** The element to display */
  element: Element;
  /** All elements in the job (for resolving upstream precedence names) */
  allElements: Element[];
  /** Whether this is a single-element job (bypasses card + header) */
  isSingleElement?: boolean;
  /** Children (task tiles) */
  children: React.ReactNode;
}

/**
 * Section for an element in the JobDetailsPanel.
 * Renders a card with the element name and its upstream precedences (if any)
 * inline-right of the name. Single-element jobs bypass the card entirely.
 */
export function ElementSection({
  element,
  allElements,
  isSingleElement = false,
  children,
}: ElementSectionProps) {
  if (isSingleElement) {
    return <div className="space-y-1">{children}</div>;
  }

  const precedenceElements = element.prerequisiteElementIds
    .map((id) => allElements.find((e) => e.id === id))
    .filter((e): e is Element => e !== undefined);
  const hasPrecedence = precedenceElements.length > 0;

  return (
    <div className="bg-white/[0.015] border border-white/5 p-2.5 mb-2.5 rounded-none">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-zinc-200 truncate min-w-0">
          {element.name}
        </span>
        {hasPrecedence && (
          <div className="ml-auto flex items-center gap-[3px] shrink-0">
            <span className="italic text-[9.5px] text-zinc-600 tracking-[0.03em] mr-px">après</span>
            {precedenceElements.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center px-1.5 py-px rounded-[3px] text-[9.5px] font-medium bg-white/[0.04] border border-white/5 text-zinc-400"
              >
                {e.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
