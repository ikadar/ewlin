import { useAppSelector } from '../../store/hooks';
import { EntityList, StatusBadge } from './EntityList';
import type { Equipment } from '../../types';

interface EquipmentListProps {
  onSelect?: (equipment: Equipment) => void;
  selectedId?: string;
  className?: string;
}

export function EquipmentList({ onSelect, selectedId, className }: EquipmentListProps) {
  const equipment = useAppSelector((state) => state.schedule.snapshot?.equipment ?? []);

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'status',
      header: 'Status',
      render: (eq: Equipment) => <StatusBadge status={eq.status} />,
      className: 'w-28',
    },
    {
      key: 'location',
      header: 'Location',
      className: 'w-32',
    },
  ];

  return (
    <EntityList
      items={equipment}
      columns={columns}
      onSelect={onSelect}
      selectedId={selectedId}
      keyExtractor={(eq) => eq.id}
      className={className}
      emptyMessage="No equipment found"
    />
  );
}
