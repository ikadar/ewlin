import { useCallback, useRef, useEffect } from 'react';
import type { JcfElement, JcfLinkableField } from '../components/JcfElementsTable/types';

/**
 * Linkable field names for reference.
 * Only these fields can be linked between elements.
 */
export const LINKABLE_FIELDS: JcfLinkableField[] = [
  'format',
  'papier',
  'imposition',
  'impression',
  'surfacage',
];

/**
 * Check if a field is linkable.
 */
export function isLinkableField(field: string): field is JcfLinkableField {
  return LINKABLE_FIELDS.includes(field as JcfLinkableField);
}

/**
 * Check if a field is linked on an element.
 */
export function isFieldLinked(element: JcfElement, field: JcfLinkableField): boolean {
  return element.links?.[field] === true;
}

export interface UseLinkPropagationOptions {
  /** Current elements array */
  elements: JcfElement[];
  /** Callback to update elements */
  onElementsChange: (elements: JcfElement[]) => void;
}

export interface UseLinkPropagationResult {
  /**
   * Toggle link state for a specific element and field.
   * When linking: copies value from previous element.
   * When unlinking: preserves current value.
   *
   * @param elementIndex - Index of the element (must be > 0, first element cannot link)
   * @param field - The linkable field name
   */
  toggleLink: (elementIndex: number, field: JcfLinkableField) => void;

  /**
   * Check if a specific element/field is linked.
   */
  isLinked: (elementIndex: number, field: JcfLinkableField) => boolean;

  /**
   * Check if linking is possible for an element (not first element).
   */
  canLink: (elementIndex: number) => boolean;

  /**
   * Update a field value and propagate to linked downstream elements.
   * Use this instead of direct field updates to ensure propagation.
   */
  updateFieldWithPropagation: (
    elementIndex: number,
    field: JcfLinkableField,
    value: string
  ) => void;
}

/**
 * Hook for managing link propagation between elements.
 *
 * Link Behavior (from §4 of implicit-logic-specification.md):
 * 1. First element cannot have links (no previous element)
 * 2. When link is activated: copy value from previous element
 * 3. When source value changes: automatically propagate to linked downstream elements
 * 4. Visual: blue text + blue background when linked
 *
 * @see v0.4.35 - JCF: Link Propagation
 */
export function useLinkPropagation({
  elements,
  onElementsChange,
}: UseLinkPropagationOptions): UseLinkPropagationResult {
  // Keep track of previous elements to detect source changes
  const prevElementsRef = useRef<JcfElement[]>(elements);

  /**
   * Check if linking is possible (not first element).
   */
  const canLink = useCallback((elementIndex: number): boolean => {
    return elementIndex > 0 && elementIndex < elements.length;
  }, [elements.length]);

  /**
   * Check if a specific element/field is linked.
   */
  const isLinked = useCallback(
    (elementIndex: number, field: JcfLinkableField): boolean => {
      if (!canLink(elementIndex)) return false;
      return elements[elementIndex]?.links?.[field] === true;
    },
    [elements, canLink]
  );

  /**
   * Toggle link state for a specific element and field.
   */
  const toggleLink = useCallback(
    (elementIndex: number, field: JcfLinkableField): void => {
      if (!canLink(elementIndex)) return;

      const newElements = [...elements];
      const element = { ...newElements[elementIndex] };
      const prevElement = newElements[elementIndex - 1];
      const currentlyLinked = element.links?.[field] === true;

      if (currentlyLinked) {
        // Unlinking: preserve current value, just remove link flag
        element.links = { ...element.links, [field]: false };
      } else {
        // Linking: copy value from previous element and set link flag
        element[field] = prevElement[field];
        element.links = { ...element.links, [field]: true };
      }

      newElements[elementIndex] = element;
      onElementsChange(newElements);
    },
    [elements, onElementsChange, canLink]
  );

  /**
   * Update a field value and propagate to linked downstream elements.
   */
  const updateFieldWithPropagation = useCallback(
    (elementIndex: number, field: JcfLinkableField, value: string): void => {
      const newElements = [...elements];

      // Update the source element
      newElements[elementIndex] = {
        ...newElements[elementIndex],
        [field]: value,
      };

      // Propagate to all linked downstream elements
      for (let i = elementIndex + 1; i < newElements.length; i++) {
        if (newElements[i].links?.[field] === true) {
          newElements[i] = {
            ...newElements[i],
            [field]: newElements[i - 1][field], // Get from immediate previous
          };
        } else {
          // Stop propagation if element is not linked
          // (subsequent elements might be linked to this one, so check them too)
        }
      }

      onElementsChange(newElements);
    },
    [elements, onElementsChange]
  );

  /**
   * Effect to propagate changes when source element values change.
   * This handles cases where updateFieldWithPropagation wasn't used directly.
   */
  useEffect(() => {
    const prevElements = prevElementsRef.current;

    // Skip if same reference (no change) or different length (structure change)
    if (prevElements === elements || prevElements.length !== elements.length) {
      prevElementsRef.current = elements;
      return;
    }

    // Check for linkable field changes and propagate
    let needsUpdate = false;
    const newElements = [...elements];

    for (const field of LINKABLE_FIELDS) {
      for (let i = 1; i < elements.length; i++) {
        const currentLinked = elements[i].links?.[field] === true;
        if (currentLinked) {
          const prevValue = elements[i - 1][field];
          if (elements[i][field] !== prevValue) {
            // Source changed but linked element wasn't updated - propagate
            newElements[i] = { ...newElements[i], [field]: prevValue };
            needsUpdate = true;
          }
        }
      }
    }

    if (needsUpdate) {
      onElementsChange(newElements);
    }

    prevElementsRef.current = elements;
  }, [elements, onElementsChange]);

  return {
    toggleLink,
    isLinked,
    canLink,
    updateFieldWithPropagation,
  };
}
