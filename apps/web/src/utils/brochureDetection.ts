import type { Element, Task } from '@flux/types';
import { isInternalTask } from '@flux/types';

/**
 * Detect whether a folding element (Plieuse) belongs to a brochure or a leaflet.
 *
 * Logic: if any sibling element in the same job has a task assigned to an
 * assembly station (Encarteuses-Piqueuses or Assembleuses-Piqueuses), the job
 * is a brochure — otherwise it's a leaflet.
 *
 * @param element          - The current element (the one on the Plieuse)
 * @param jobElements      - All elements in the same job
 * @param taskMap          - Map of task ID → Task
 * @param assemblyStationIds - Set of station IDs categorised as assembly stations
 */
export function detectBrochureOrLeaflet(
  element: Element,
  jobElements: Element[],
  taskMap: Map<string, Task>,
  assemblyStationIds: Set<string>,
): 'brochure' | 'leaflet' {
  if (jobElements.length <= 1) return 'leaflet';

  const siblings = jobElements.filter((e) => e.id !== element.id);
  const isbrochure = siblings.some((sibling) =>
    sibling.taskIds.some((tid) => {
      const t = taskMap.get(tid);
      return t !== undefined && isInternalTask(t) && assemblyStationIds.has(t.stationId);
    }),
  );

  return isbrochure ? 'brochure' : 'leaflet';
}
