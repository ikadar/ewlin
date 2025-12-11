import { cn } from '../../lib/utils';
import { Badge } from '../common/Badge';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface EntityListProps<T> {
  items: T[];
  columns: Column<T>[];
  onSelect?: (item: T) => void;
  selectedId?: string;
  keyExtractor: (item: T) => string;
  className?: string;
  emptyMessage?: string;
}

export function EntityList<T>({
  items,
  columns,
  onSelect,
  selectedId,
  keyExtractor,
  className,
  emptyMessage = 'No items',
}: EntityListProps<T>) {
  if (items.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto', className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'text-left font-medium p-2 border-b',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = keyExtractor(item);
            const isSelected = id === selectedId;

            return (
              <tr
                key={id}
                onClick={() => onSelect?.(item)}
                className={cn(
                  'border-b cursor-pointer transition-colors',
                  'hover:bg-muted/50',
                  isSelected && 'bg-muted'
                )}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className={cn('p-2', col.className)}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Status badge helper for common status rendering
export function StatusBadge({ status }: { status: string }) {
  const variant = (() => {
    const lower = status.toLowerCase();
    if (lower.includes('active') || lower.includes('available') || lower.includes('completed')) {
      return 'success';
    }
    if (lower.includes('inactive') || lower.includes('maintenance') || lower.includes('delayed')) {
      return 'warning';
    }
    if (lower.includes('deactivated') || lower.includes('outofservice') || lower.includes('failed') || lower.includes('cancelled')) {
      return 'destructive';
    }
    return 'secondary';
  })();

  return <Badge variant={variant}>{status}</Badge>;
}
