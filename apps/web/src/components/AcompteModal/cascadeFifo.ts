/**
 * FE mirror of the backend AcompteProgressCascadeService::cascadeFifo().
 *
 * Pure function — distributes `declaredTotal` exemplaires across acomptes
 * by ascending positionIndex. Acompte 1 saturates first, then 2 with the
 * remainder, then 3, etc. The result is what the engine fan-out also computes
 * server-side — we re-compute locally only for the live cascade preview in
 * the modal.
 */

export interface AcompteForCascade {
  id: string;
  positionIndex: number;
  quantityShare: number;
}

export interface CascadeRow {
  acompteId: string;
  position: number;
  copiesTaken: number;
  capacity: number;
  progressPct: number;
  saturated: boolean;
  empty: boolean;
}

export function cascadeFifo(
  declaredTotalCopies: number,
  acomptes: AcompteForCascade[],
): CascadeRow[] {
  const sorted = [...acomptes].sort((a, b) => a.positionIndex - b.positionIndex);
  let remaining = Math.max(0, declaredTotalCopies);
  return sorted.map((a) => {
    const capacity = Math.max(0, a.quantityShare);
    const taken = Math.min(remaining, capacity);
    remaining -= taken;
    const progressPct = capacity > 0 ? (taken / capacity) * 100 : 0;
    return {
      acompteId: a.id,
      position: a.positionIndex,
      copiesTaken: taken,
      capacity,
      progressPct,
      saturated: capacity > 0 && taken >= capacity,
      empty: taken === 0,
    };
  });
}
