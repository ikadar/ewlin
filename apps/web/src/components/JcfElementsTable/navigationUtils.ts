/**
 * JCF Elements Table - Navigation Utilities
 *
 * Shared navigation logic for Tab and Arrow key navigation in the JCF table.
 * Extracted to reduce cognitive complexity in JcfElementsTable.tsx.
 *
 * @see v0.4.39 - SonarQube cognitive complexity refactoring
 */

/**
 * Handles Tab/Shift+Tab navigation within the table.
 * Returns the new cell position to focus, or null if navigation should exit the table.
 */
export function getTabNavigationTarget(
  direction: 'forward' | 'backward',
  elementIndex: number,
  rowIndex: number,
  rowCount: number,
  elementCount: number,
): { elementIndex: number; rowIndex: number } | null {
  const lastRow = rowCount - 1;
  const lastEl = elementCount - 1;

  if (direction === 'forward') {
    if (rowIndex < lastRow) {
      return { elementIndex, rowIndex: rowIndex + 1 };
    }
    if (elementIndex < lastEl) {
      return { elementIndex: elementIndex + 1, rowIndex: 0 };
    }
    // Last cell of table → exit
    return null;
  }

  // backward
  if (rowIndex > 0) {
    return { elementIndex, rowIndex: rowIndex - 1 };
  }
  if (elementIndex > 0) {
    return { elementIndex: elementIndex - 1, rowIndex: lastRow };
  }
  // First cell of table → exit
  return null;
}

/**
 * Handles Alt+Arrow navigation with circular wrap.
 * Always returns a valid cell position (wraps around).
 */
export function getArrowNavigationTarget(
  direction: 'up' | 'down' | 'left' | 'right',
  elementIndex: number,
  rowIndex: number,
  rowCount: number,
  elementCount: number,
): { elementIndex: number; rowIndex: number } {
  switch (direction) {
    case 'down':
      return { elementIndex, rowIndex: (rowIndex + 1) % rowCount };
    case 'up':
      return { elementIndex, rowIndex: (rowIndex - 1 + rowCount) % rowCount };
    case 'right':
      return { elementIndex: (elementIndex + 1) % elementCount, rowIndex };
    case 'left':
      return { elementIndex: (elementIndex - 1 + elementCount) % elementCount, rowIndex };
  }
}

/**
 * Creates a Tab navigation handler for autocomplete components.
 */
export function createTabOutHandler(
  focusCell: (elementIndex: number, rowIndex: number) => void,
  elementIndex: number,
  rowIndex: number,
  rowCount: number,
  elementCount: number,
): (e: React.KeyboardEvent, direction: 'forward' | 'backward') => void {
  return (e, direction) => {
    const target = getTabNavigationTarget(direction, elementIndex, rowIndex, rowCount, elementCount);
    if (target) {
      e.preventDefault();
      focusCell(target.elementIndex, target.rowIndex);
    }
    // If null, let native Tab behavior exit the table
  };
}

/**
 * Creates an Arrow navigation handler for autocomplete components.
 */
export function createArrowNavHandler(
  focusCell: (elementIndex: number, rowIndex: number) => void,
  elementIndex: number,
  rowIndex: number,
  rowCount: number,
  elementCount: number,
): (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right') => void {
  return (_e, direction) => {
    const target = getArrowNavigationTarget(direction, elementIndex, rowIndex, rowCount, elementCount);
    focusCell(target.elementIndex, target.rowIndex);
  };
}
