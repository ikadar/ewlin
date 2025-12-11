import { useAppSelector } from '../../store/hooks';
import { EntityList, StatusBadge } from './EntityList';
import type { Operator } from '../../types';

interface OperatorListProps {
  onSelect?: (operator: Operator) => void;
  selectedId?: string;
  className?: string;
}

export function OperatorList({ onSelect, selectedId, className }: OperatorListProps) {
  const operators = useAppSelector((state) => state.schedule.snapshot?.operators ?? []);

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'status',
      header: 'Status',
      render: (op: Operator) => <StatusBadge status={op.status} />,
      className: 'w-24',
    },
    {
      key: 'skills',
      header: 'Skills',
      render: (op: Operator) => <span>{op.skills.length}</span>,
      className: 'w-16 text-center',
    },
  ];

  return (
    <EntityList
      items={operators}
      columns={columns}
      onSelect={onSelect}
      selectedId={selectedId}
      keyExtractor={(op) => op.id}
      className={className}
      emptyMessage="No operators found"
    />
  );
}
