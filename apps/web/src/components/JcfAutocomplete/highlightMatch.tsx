import type { ReactNode } from 'react';

/**
 * Highlights the matching portion of text in autocomplete suggestions.
 *
 * - Match found: bold + blue (or bold + underline when highlighted)
 * - No match / empty search: plain text span
 */
export function highlightMatch(
  label: string,
  searchValue: string,
  isHighlighted: boolean
): ReactNode {
  if (!searchValue) return <span>{label}</span>;

  const lowerLabel = label.toLowerCase();
  const lowerValue = searchValue.toLowerCase();
  const matchIndex = lowerLabel.indexOf(lowerValue);

  if (matchIndex === -1) return <span>{label}</span>;

  const before = label.slice(0, matchIndex);
  const match = label.slice(matchIndex, matchIndex + searchValue.length);
  const after = label.slice(matchIndex + searchValue.length);

  return (
    <span>
      {before}
      <span className={isHighlighted ? 'font-bold underline' : 'font-bold text-blue-400'}>
        {match}
      </span>
      {after}
    </span>
  );
}
