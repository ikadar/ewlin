import { useParams } from 'react-router-dom';
import { useGetProdSnapshotQuery } from '../store/api/prodSnapshotApi';
import { MobileHeader } from '../components/MobileLayout/MobileHeader';
import { TaskCardStack } from '../components/MobileCardStack/TaskCardStack';
import type { TaskAssignment } from '@flux/types';

export interface MobilePageProps {
  mode: 'operator' | 'station';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function MobilePage({ mode }: MobilePageProps) {
  const { id } = useParams<{ id: string }>();
  const { data: snapshot, isLoading } = useGetProdSnapshotQuery();

  if (isLoading || !snapshot) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Chargement…
      </div>
    );
  }

  const now = new Date();

  const todayAssignments = snapshot.assignments
    .filter((a: TaskAssignment) => {
      if (a.isOutsourced || a.isCompleted) return false;
      if (!isSameDay(new Date(a.scheduledStart), now)) return false;

      if (mode === 'operator') {
        return a.operators?.some(op => op.operatorId === id);
      }
      return a.targetId === id;
    })
    .sort((a: TaskAssignment, b: TaskAssignment) =>
      new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
    );

  const entity = mode === 'operator'
    ? snapshot.operators.find(o => o.id === id)
    : snapshot.stations.find(s => s.id === id);

  const headerName = entity
    ? (mode === 'operator'
      ? `${(entity as { firstName: string }).firstName} ${(entity as { lastName: string }).lastName}`
      : (entity as { name: string }).name)
    : id ?? '?';

  return (
    <>
      <MobileHeader
        name={headerName}
        modeLabel={mode === 'operator' ? 'Opérateur' : 'Station'}
      />
      <TaskCardStack
        assignments={todayAssignments}
        snapshot={snapshot}
        mode={mode}
      />
    </>
  );
}
