import { useState } from 'react';
import { Settings } from 'lucide-react';
import {
  useGetOperatorsQuery,
  useUpdateOperatorMutation,
  useReplaceSkillsMutation,
  useReplaceConcurrentGroupsMutation,
} from '../../store/api/operatorApi';
import type {
  AbsencePayload,
  ConcurrentGroupPayload,
  OperatorSkillResponse,
  OvertimePayload,
} from '../../store/api/operatorApi';
import { useGetStationsQuery } from '../../store/api/stationApi';
import { useGetStationCategoriesQuery } from '../../store/api/stationCategoryApi';
import { OperatorFormModal } from '../../pages/OperatorsPage';
import type { OperatingSchedule } from '../ScheduleEditor';

export interface OperatorSettingsButtonProps {
  operatorId: string;
  operatorLabel: string;
}

export function OperatorSettingsButton({ operatorId, operatorLabel }: OperatorSettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: operators = [] } = useGetOperatorsQuery();
  const { data: stations = [] } = useGetStationsQuery();
  const { data: categories = [] } = useGetStationCategoriesQuery();
  const [updateOperator, { isLoading: isUpdating }] = useUpdateOperatorMutation();
  const [replaceSkills] = useReplaceSkillsMutation();
  const [replaceConcurrentGroups] = useReplaceConcurrentGroupsMutation();

  const operator = operators.find((op) => op.id === operatorId) ?? null;

  const handleSave = async (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedules: OperatingSchedule[];
    scheduleRotationReferenceWeek: number | null;
    scheduleNames: string[];
    absences: AbsencePayload[];
    overtimes: OvertimePayload[];
    skills: OperatorSkillResponse[];
    concurrentGroups: ConcurrentGroupPayload[];
  }) => {
    if (!operator) return;
    await updateOperator({
      id: operator.id,
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || null,
        operatingSchedules: data.operatingSchedules as unknown as Array<Record<string, unknown>>,
        scheduleRotationReferenceWeek: data.scheduleRotationReferenceWeek,
        scheduleNames: data.scheduleNames.length > 0 ? data.scheduleNames : null,
        absences: data.absences,
        overtimes: data.overtimes,
      },
    }).unwrap();
    await replaceSkills({ id: operator.id, skills: data.skills }).unwrap();
    await replaceConcurrentGroups({ id: operator.id, groups: data.concurrentGroups }).unwrap();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!operator}
        aria-label={`Paramétrer ${operatorLabel}`}
        title="Paramétrer"
        className="shrink-0 text-zinc-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        data-testid={`operator-header-settings-button-${operatorId}`}
      >
        <Settings className="w-4 h-4" />
      </button>
      {isOpen && operator && (
        <OperatorFormModal
          initial={operator}
          stations={stations}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setIsOpen(false)}
          isSaving={isUpdating}
        />
      )}
    </>
  );
}
