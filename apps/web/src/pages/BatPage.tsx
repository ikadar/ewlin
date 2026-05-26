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

const BAT_COLUMNS: KanbanColumnDef[] = [
  { id: 'waiting_files',  label: 'Attente fichiers', dotColor: '#ef4444', apiStatus: 'waiting_files' },
  { id: 'files_received', label: 'Fichiers reçus',   dotColor: '#f59e0b', apiStatus: 'files_received' },
  { id: 'bat_sent',       label: 'BAT envoyé',       dotColor: '#f59e0b', apiStatus: 'bat_sent' },
  { id: 'bat_approved',   label: 'BAT OK',           dotColor: '#22c55e', apiStatus: 'bat_approved' },
];

function buildBatKanbanJobs(
  fluxJobs: FluxJob[],
  elementNameById: Map<string, string>,
): KanbanJob[] {
  const result: KanbanJob[] = [];

  for (const fj of fluxJobs) {
    const batElements: PaperGroupElement[] = [];

    for (const el of fj.elements) {
      if (el.bat === 'none') continue;

      const name = elementNameById.get(el.id) || 'Élément';

      batElements.push({
        elementId: el.id,
        paperStatus: el.bat,
        paperKey: el.id,
        paperLabel: name,
        sheetQty: 0,
      });
    }

    if (batElements.length === 0) continue;

    const groups: PaperGroup[] = batElements.map((el) => ({
      paperKey: el.paperKey,
      paperLabel: el.paperLabel,
      elements: [el],
      totalSheets: 0,
      column: deriveColumnFromStatus(el.paperStatus, BAT_COLUMNS),
    }));

    result.push({
      jobUuid: fj.internalId,
      jobNum: fj.id,
      client: fj.client,
      label: fj.designation,
      deadline: fj.sortieIso,
      groups,
      leftmostColumn: leftmostColumn(groups, BAT_COLUMNS),
    });
  }

  return result;
}

export function BatPage() {
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
    const jobs = buildBatKanbanJobs(fluxJobs, elementNameById);
    jobs.sort((a, b) => {
      if (sortKey === 'client') return a.client.localeCompare(b.client);
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
    return jobs;
  }, [fluxJobs, elementNameById, sortKey]);

  const handleDrop = useCallback(async (elementIds: string[], targetColId: string) => {
    const newStatus = columnToApiStatus(targetColId, BAT_COLUMNS);
    await Promise.all(
      elementIds.map((eid) => {
        const job = kanbanJobs.find((j) =>
          j.groups.some((g) => g.elements.some((e) => e.elementId === eid)),
        );
        if (!job) return;
        return updatePrereq({ elementId: eid, jobId: job.jobUuid, column: 'bat', value: newStatus });
      }),
    );
  }, [kanbanJobs, updatePrereq]);

  return (
    <PrerequisKanbanBoard
      title="BAT"
      columns={BAT_COLUMNS}
      jobs={kanbanJobs}
      sortKey={sortKey}
      onSortChange={setSortKey}
      onDrop={handleDrop}
      showQuantity={false}
    />
  );
}
