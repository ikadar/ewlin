import { type ReactNode } from 'react';
import { SortChevron } from './SortChevron';

interface SortableHeaderProps<T extends string> {
  col: T;
  active: T;
  dir: 'asc' | 'desc';
  onSort: (col: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  children: ReactNode;
}

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function SortableHeader<T extends string>({
  col,
  active,
  dir,
  onSort,
  align = 'left',
  className,
  children,
}: SortableHeaderProps<T>) {
  return (
    <th
      className={`px-2 py-3 ${ALIGN_CLASS[align]} text-sm font-medium whitespace-nowrap text-flux-text-secondary group cursor-pointer select-none${className ? ` ${className}` : ''}`}
      onClick={() => onSort(col)}
    >
      {children} <SortChevron col={col} active={active} dir={dir} />
    </th>
  );
}
