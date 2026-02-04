/**
 * Shared keyboard handling utilities for JCF autocomplete components.
 * Extracted to reduce cognitive complexity in individual components.
 *
 * @see SonarQube cognitive complexity refactoring v0.4.39
 */

/**
 * Direction mapping for Alt+Arrow navigation.
 */
export const ARROW_DIRECTION_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Handle keyboard navigation when dropdown is open.
 * Returns true if the key was handled, false otherwise.
 */
export function handleOpenDropdownKey<T>(
  e: React.KeyboardEvent,
  options: {
    displayedItems: T[];
    highlightedIndex: number;
    setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
    isKeyboardNavRef: React.MutableRefObject<boolean>;
    onSelect: (item: T) => void;
    onClose: () => void;
  },
): boolean {
  const { displayedItems, highlightedIndex, setHighlightedIndex, isKeyboardNavRef, onSelect, onClose } = options;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex((prev) =>
        prev < displayedItems.length - 1 ? prev + 1 : prev,
      );
      return true;
    case 'ArrowUp':
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      return true;
    case 'Enter':
      e.preventDefault();
      if (displayedItems[highlightedIndex]) {
        onSelect(displayedItems[highlightedIndex]);
      }
      return true;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation(); // Prevent modal close
      onClose();
      return true;
    default:
      return false;
  }
}
