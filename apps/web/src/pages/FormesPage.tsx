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

const FORME_COLUMNS: KanbanColumnDef[] = [
  { id: 'to_order', label: 'A commander', dotColor: '#ef4444', apiStatus: 'to_order' },
  { id: 'ordered', label: 'Commandée', dotColor: '#f59e0b', apiStatus: 'ordered' },
  { id: 'available', label: 'Disponible', dotColor: '#22c55e', apiStatus: 'delivered' },
];

function buildFormesKanbanJobs(
  fluxJobs: FluxJob[],
  elementNameById: Map<string, string>,
): KanbanJob[] {
  const result: KanbanJob[] = [];

  for (const fj of fluxJobs) {
    const formeElements: PaperGroupElement[] = [];

    for (const el of fj.elements) {
      if (el.formes === 'none') continue;

      const name = elementNameById.get(el.id) || 'Élément';

      formeElements.push({
        elementId: el.id,
        paperStatus: el.formes,
        paperKey: el.id,
        paperLabel: name,
        sheetQty: 0,
      });
    }

    if (formeElements.length === 0) continue;

    const groups: PaperGroup[] = formeElements.map((el) => ({
      paperKey: el.paperKey,
      paperLabel: el.paperLabel,
      elements: [el],
      totalSheets: 0,
      column: deriveColumnFromStatus(el.paperStatus, FORME_COLUMNS),
    }));

    result.push({
      jobUuid: fj.internalId,
      jobNum: fj.id,
      client: fj.client,
      label: fj.designation,
      deadline: fj.sortieIso,
      groups,
      leftmostColumn: leftmostColumn(groups, FORME_COLUMNS),
    });
  }

  return result;
}

export function FormesPage() {
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
    const jobs = buildFormesKanbanJobs(fluxJobs, elementNameById);
    jobs.sort((a, b) => {
      if (sortKey === 'client') return a.client.localeCompare(b.client);
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
    return jobs;
  }, [fluxJobs, elementNameById, sortKey]);

  const handleDrop = useCallback(async (elementIds: string[], targetColId: string) => {
    const newStatus = columnToApiStatus(targetColId, FORME_COLUMNS);
    const job = kanbanJobs.find((j) =>
      j.groups.some((g) => g.elements.some((e) => elementIds.includes(e.elementId))),
    );
    if (!job) return;

    await Promise.all(
      elementIds.map((eid) =>
        updatePrereq({ elementId: eid, jobId: job.jobUuid, column: 'formes', value: newStatus }),
      ),
    );
  }, [kanbanJobs, updatePrereq]);

  return (
    <PrerequisKanbanBoard
      title="Formes"
      columns={FORME_COLUMNS}
      jobs={kanbanJobs}
      sortKey={sortKey}
      onSortChange={setSortKey}
      onDrop={handleDrop}
      showQuantity={false}
    />
  );
}
