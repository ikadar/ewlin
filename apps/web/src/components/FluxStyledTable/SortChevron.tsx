import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface SortChevronProps<T extends string> {
  col: T;
  active: T;
  dir: 'asc' | 'desc';
}

export function SortChevron<T extends string>({ col, active, dir }: SortChevronProps<T>) {
  if (col !== active) {
    return (
      <ChevronsUpDown
        className="w-3 h-3 text-flux-text-muted opacity-0 group-hover:opacity-100 transition-opacity inline ml-0.5"
        strokeWidth={2}
      />
    );
  }
  if (dir === 'asc') {
    return (
      <ChevronUp
        className="w-3 h-3 text-blue-400 inline ml-0.5"
        strokeWidth={2.5}
      />
    );
  }
  return (
    <ChevronDown
      className="w-3 h-3 text-blue-400 inline ml-0.5"
      strokeWidth={2.5}
    />
  );
}
