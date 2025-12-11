import { useAppSelector } from '../../store/hooks';
import { EntityList, StatusBadge } from './EntityList';
import type { Station } from '../../types';

interface StationListProps {
  onSelect?: (station: Station) => void;
  selectedId?: string;
  className?: string;
}

export function StationList({ onSelect, selectedId, className }: StationListProps) {
  const stations = useAppSelector((state) => state.schedule.snapshot?.stations ?? []);
  const categories = useAppSelector((state) => state.schedule.snapshot?.categories ?? []);

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name ?? '-';
  };

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'category',
      header: 'Category',
      render: (station: Station) => <span>{getCategoryName(station.categoryId)}</span>,
      className: 'w-28',
    },
    {
      key: 'status',
      header: 'Status',
      render: (station: Station) => <StatusBadge status={station.status} />,
      className: 'w-28',
    },
    {
      key: 'capacity',
      header: 'Cap.',
      render: (station: Station) => <span>{station.capacity}</span>,
      className: 'w-16 text-center',
    },
  ];

  return (
    <EntityList
      items={stations}
      columns={columns}
      onSelect={onSelect}
      selectedId={selectedId}
      keyExtractor={(station) => station.id}
      className={className}
      emptyMessage="No stations found"
    />
  );
}
