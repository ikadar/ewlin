import { useState } from 'react';
import { Settings } from 'lucide-react';
import {
  useGetStationsQuery,
  useUpdateStationMutation,
} from '../../store/api/stationApi';
import type { StationInput } from '../../store/api/stationApi';
import { useGetStationCategoriesQuery } from '../../store/api/stationCategoryApi';
import { StationFormModal } from '../../pages/StationsPage';

export interface StationSettingsButtonProps {
  stationId: string;
  stationLabel: string;
}

export function StationSettingsButton({ stationId, stationLabel }: StationSettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: stations = [] } = useGetStationsQuery();
  const { data: categories = [] } = useGetStationCategoriesQuery();
  const [updateStation, { isLoading: isUpdating }] = useUpdateStationMutation();

  const station = stations.find((s) => s.id === stationId) ?? null;

  const handleSave = async (data: StationInput) => {
    if (!station) return;
    await updateStation({ id: station.id, body: data }).unwrap();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!station}
        aria-label={`Paramétrer ${stationLabel}`}
        title="Paramétrer"
        className="shrink-0 text-zinc-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        data-testid={`station-header-settings-button-${stationId}`}
      >
        <Settings className="w-4 h-4" />
      </button>
      {isOpen && station && (
        <StationFormModal
          initial={station}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setIsOpen(false)}
          isSaving={isUpdating}
        />
      )}
    </>
  );
}
