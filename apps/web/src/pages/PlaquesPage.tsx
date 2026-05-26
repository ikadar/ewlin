import { useMemo, useState, useCallback } from 'react';
import { useGetFluxJobsQuery, useUpdateElementPrerequisiteMutation } from '../store/api/fluxApi';
import { useGetProdSnapshotQuery } from '../store/api/prodSnapshotApi';
import type { FluxJob } from '../components/FluxTable/fluxTypes';
import { PrerequisKanbanBoard } from '../components/PrerequisKanban/PrerequisKanbanBoard';
import type { KanbanJob } from '../components/PrerequisKanban/PrerequisKanbanBoard';
import {
  deriveColumnFromStatus,
  leftmostColumn,
  columnToApiStatus,
} from '../utils/paperKanban';
import type { KanbanColumnDef, PaperGroup, PaperGroupElement } from '../utils/paperKanban';

const PLAQUE_COLUMNS: KanbanColumnDef[] = [
  { id: 'to_make', label: 'À faire',  dotColor: '#ef4444', apiStatus: 'to_make' },
  { id: 'ready',   label: 'Prêtes',   dotColor: '#22c55e', apiStatus: 'ready' },
];

function buildPlaquesKanbanJobs(
  fluxJobs: FluxJob[],
  elementNameById: Map<string, string>,
): KanbanJob[] {
  const result: KanbanJob[] = [];

  for (const fj of fluxJobs) {
    const plaqueElements: PaperGroupElement[] = [];

    for (const el of fj.elements) {
      if (el.plaques === 'none') continue;
      if (el.plaques === 'to_make' && el.bat !== 'bat_approved') continue;

      const name = elementNameById.get(el.id) || 'Élément';

      plaqueElements.push({
        elementId: el.id,
        paperStatus: el.plaques,
        paperKey: el.id,
        paperLabel: name,
        sheetQty: 0,
      });
    }

    if (plaqueElements.length === 0) continue;

    const groups: PaperGroup[] = plaqueElements.map((el) => ({
      paperKey: el.paperKey,
      paperLabel: el.paperLabel,
      elements: [el],
      totalSheets: 0,
      column: deriveColumnFromStatus(el.paperStatus, PLAQUE_COLUMNS),
    }));

    result.push({
      jobUuid: fj.internalId,
      jobNum: fj.id,
      client: fj.client,
      label: fj.designation,
      deadline: fj.sortieIso,
      groups,
      leftmostColumn: leftmostColumn(groups, PLAQUE_COLUMNS),
    });
  }

  return result;
}

export function PlaquesPage() {
  const { data: fluxJobs = [] } = useGetFluxJobsQuery();
  const { data: snapshot } = useGetProdSnapshotQuery();
  const [updatePrereq] = useUpdateElementPrerequisiteMutation();
  const [sortKey, setSortKey] = useState<'deadline' | 'client'>('deadline');

  const elementNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (snapshot) {
      for (const el of snapshot.elements) {
        if (el.name) map.set(el.id, el.name);
      }
    }
    return map;
  }, [snapshot]);

  const kanbanJobs = useMemo(() => {
    const jobs = buildPlaquesKanbanJobs(fluxJobs, elementNameById);
    jobs.sort((a, b) => {
      if (sortKey === 'client') return a.client.localeCompare(b.client);
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
    return jobs;
  }, [fluxJobs, elementNameById, sortKey]);

  const handleDrop = useCallback(async (elementIds: string[], targetColId: string) => {
    const newStatus = columnToApiStatus(targetColId, PLAQUE_COLUMNS);
    await Promise.all(
      elementIds.map((eid) => {
        const job = kanbanJobs.find((j) =>
          j.groups.some((g) => g.elements.some((e) => e.elementId === eid)),
        );
        if (!job) return;
        return updatePrereq({ elementId: eid, jobId: job.jobUuid, column: 'plaques', value: newStatus });
      }),
    );
  }, [kanbanJobs, updatePrereq]);

  return (
    <PrerequisKanbanBoard
      title="Plaques"
      columns={PLAQUE_COLUMNS}
      jobs={kanbanJobs}
      sortKey={sortKey}
      onSortChange={setSortKey}
      onDrop={handleDrop}
      showQuantity={false}
    />
  );
}
