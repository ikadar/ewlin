import { useMemo, useState, useCallback } from 'react';
import { useGetFluxJobsQuery, useUpdateElementPrerequisiteMutation } from '../store/api/fluxApi';
import { useGetProdSnapshotQuery } from '../store/api/prodSnapshotApi';
import type { ElementSpec } from '@flux/types';
import type { FluxJob } from '../components/FluxTable/fluxTypes';
import { PrerequisKanbanBoard } from '../components/PrerequisKanban/PrerequisKanbanBoard';
import type { KanbanJob } from '../components/PrerequisKanban/PrerequisKanbanBoard';
import {
  derivePaperKey,
  deriveColumnFromStatus,
  groupElementsByPaper,
  leftmostColumn,
  columnToApiStatus,
} from '../utils/paperKanban';
import type { KanbanColumnDef, PaperGroupElement } from '../utils/paperKanban';

const PAPER_COLUMNS: KanbanColumnDef[] = [
  { id: 'to_order', label: 'A commander', dotColor: '#ef4444', apiStatus: 'to_order' },
  { id: 'ordered', label: 'Commandé', dotColor: '#f59e0b', apiStatus: 'ordered' },
  { id: 'available', label: 'Disponible', dotColor: '#22c55e', apiStatus: 'delivered' },
];

function buildKanbanJobs(
  fluxJobs: FluxJob[],
  specById: Map<string, ElementSpec>,
  jobMetaById: Map<string, { paperType?: string; paperFormat?: string; paperWeight?: number }>,
): KanbanJob[] {
  const result: KanbanJob[] = [];

  for (const fj of fluxJobs) {
    const jobMeta = jobMetaById.get(fj.internalId);
    const paperElements: PaperGroupElement[] = [];

    for (const el of fj.elements) {
      if (el.papier === 'none') continue;

      const spec = specById.get(el.id);
      const { key, label } = derivePaperKey(
        spec,
        jobMeta?.paperType,
        jobMeta?.paperFormat,
        jobMeta?.paperWeight,
      );

      paperElements.push({
        elementId: el.id,
        paperStatus: el.papier,
        paperKey: key,
        paperLabel: label,
        sheetQty: spec?.qteFeuilles ?? 0,
      });
    }

    if (paperElements.length === 0) continue;

    const groups = groupElementsByPaper(paperElements, PAPER_COLUMNS);

    result.push({
      jobUuid: fj.internalId,
      jobNum: fj.id,
      client: fj.client,
      label: fj.designation,
      deadline: fj.sortieIso,
      groups,
      leftmostColumn: leftmostColumn(groups, PAPER_COLUMNS),
    });
  }

  return result;
}

export function PapierPage() {
  const { data: fluxJobs = [] } = useGetFluxJobsQuery();
  const { data: snapshot } = useGetProdSnapshotQuery();
  const [updatePrereq] = useUpdateElementPrerequisiteMutation();
  const [sortKey, setSortKey] = useState<'deadline' | 'client'>('deadline');

  const { specById, jobMetaById } = useMemo(() => {
    const specs = new Map<string, ElementSpec>();
    const metas = new Map<string, { paperType?: string; paperFormat?: string; paperWeight?: number }>();
    if (snapshot) {
      for (const el of snapshot.elements) {
        if (el.spec) specs.set(el.id, el.spec);
      }
      for (const j of snapshot.jobs) {
        metas.set(j.id, { paperType: j.paperType, paperFormat: j.paperFormat, paperWeight: j.paperWeight });
      }
    }
    return { specById: specs, jobMetaById: metas };
  }, [snapshot]);

  const kanbanJobs = useMemo(() => {
    const jobs = buildKanbanJobs(fluxJobs, specById, jobMetaById);
    jobs.sort((a, b) => {
      if (sortKey === 'client') return a.client.localeCompare(b.client);
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
    return jobs;
  }, [fluxJobs, specById, jobMetaById, sortKey]);

  const handleDrop = useCallback(async (elementIds: string[], targetColId: string) => {
    const newStatus = columnToApiStatus(targetColId, PAPER_COLUMNS);
    await Promise.all(
      elementIds.map((eid) => {
        const job = kanbanJobs.find((j) =>
          j.groups.some((g) => g.elements.some((e) => e.elementId === eid)),
        );
        if (!job) return;
        return updatePrereq({ elementId: eid, jobId: job.jobUuid, column: 'papier', value: newStatus });
      }),
    );
  }, [kanbanJobs, updatePrereq]);

  return (
    <PrerequisKanbanBoard
      title="Papier"
      columns={PAPER_COLUMNS}
      jobs={kanbanJobs}
      sortKey={sortKey}
      onSortChange={setSortKey}
      onDrop={handleDrop}
    />
  );
}
