import { useState, useCallback } from 'react';

export interface UseSortResult<T extends string> {
  sortCol: T;
  sortDir: 'asc' | 'desc';
  handleSort: (col: T) => void;
}

export function useSort<T extends string>(
  defaultCol: T,
  defaultDir: 'asc' | 'desc' = 'asc',
  defaultDirForCol?: (col: T) => 'asc' | 'desc',
): UseSortResult<T> {
  const [sortCol, setSortCol] = useState<T>(defaultCol);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const handleSort = useCallback((col: T) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(defaultDirForCol ? defaultDirForCol(col) : 'asc');
    }
  }, [sortCol, defaultDirForCol]);

  return { sortCol, sortDir, handleSort };
}
