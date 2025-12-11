import { useAppSelector } from '../../store/hooks';
import { EntityList, StatusBadge } from './EntityList';
import type { OutsourcedProvider } from '../../types';

interface ProviderListProps {
  onSelect?: (provider: OutsourcedProvider) => void;
  selectedId?: string;
  className?: string;
}

export function ProviderList({ onSelect, selectedId, className }: ProviderListProps) {
  const providers = useAppSelector((state) => state.schedule.snapshot?.providers ?? []);

  const columns = [
    { key: 'name', header: 'Name' },
    {
      key: 'status',
      header: 'Status',
      render: (provider: OutsourcedProvider) => <StatusBadge status={provider.status} />,
      className: 'w-28',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (provider: OutsourcedProvider) => (
        <span title={provider.supportedActionTypes.join(', ')}>
          {provider.supportedActionTypes.length}
        </span>
      ),
      className: 'w-20 text-center',
    },
  ];

  return (
    <EntityList
      items={providers}
      columns={columns}
      onSelect={onSelect}
      selectedId={selectedId}
      keyExtractor={(provider) => provider.id}
      className={className}
      emptyMessage="No providers found"
    />
  );
}
