import type { ScheduleSnapshot } from '@flux/types';

export interface PromotionChangeSummary {
  jcf: { added: number; removed: number; modified: number };
  stations: { modified: number };
  operators: { modified: number };
}

function jobFingerprint(j: ScheduleSnapshot['jobs'][number]): string {
  return JSON.stringify({
    reference: j.reference,
    client: j.client,
    referent: j.referent,
    description: j.description,
    workshopExitDate: j.workshopExitDate,
    quantity: j.quantity,
    status: j.status,
    paperType: j.paperType,
    paperFormat: j.paperFormat,
    inking: j.inking,
    shipperId: j.shipperId,
    elementIds: j.elementIds?.slice().sort(),
  });
}

function stationFingerprint(s: ScheduleSnapshot['stations'][number]): string {
  return JSON.stringify({
    name: s.name,
    status: s.status,
    capacity: s.capacity,
    operatingSchedule: s.operatingSchedule,
    exceptions: s.exceptions,
    attentionSetup: s.attentionSetup,
    attentionRun: s.attentionRun,
    maskedTimeEnabled: s.maskedTimeEnabled,
    attentionMasked: s.attentionMasked,
    maskedProductivity: s.maskedProductivity,
    tickMinutes: s.tickMinutes,
    peremptionThresholdMinutes: s.peremptionThresholdMinutes,
    maxChunkMinutes: s.maxChunkMinutes,
    minSetupOperators: s.minSetupOperators,
    maxSetupOperators: s.maxSetupOperators,
    minRunOperators: s.minRunOperators,
    maxRunOperators: s.maxRunOperators,
    maxRunAttention: s.maxRunAttention,
  });
}

function operatorFingerprint(o: ScheduleSnapshot['operators'][number]): string {
  return JSON.stringify({
    firstName: o.firstName,
    lastName: o.lastName,
    role: o.role,
    operatingSchedules: o.operatingSchedules,
    scheduleRotationReferenceWeek: o.scheduleRotationReferenceWeek,
    absences: o.absences,
    overtimes: o.overtimes,
    skills: o.skills,
    concurrentGroups: o.concurrentGroups,
  });
}

export function computePromotionChanges(
  preprod: ScheduleSnapshot,
  prod: ScheduleSnapshot,
): PromotionChangeSummary {
  const prodJobMap = new Map(prod.jobs.map((j) => [j.id, jobFingerprint(j)]));
  const preprodJobMap = new Map(preprod.jobs.map((j) => [j.id, jobFingerprint(j)]));

  let jcfAdded = 0;
  let jcfRemoved = 0;
  let jcfModified = 0;

  for (const [id, fp] of preprodJobMap) {
    const prodFp = prodJobMap.get(id);
    if (!prodFp) jcfAdded++;
    else if (prodFp !== fp) jcfModified++;
  }
  for (const id of prodJobMap.keys()) {
    if (!preprodJobMap.has(id)) jcfRemoved++;
  }

  const prodStationMap = new Map(prod.stations.map((s) => [s.id, stationFingerprint(s)]));
  let stationsModified = 0;
  for (const s of preprod.stations) {
    const prodFp = prodStationMap.get(s.id);
    if (prodFp && prodFp !== stationFingerprint(s)) stationsModified++;
  }

  const prodOpMap = new Map(prod.operators.map((o) => [o.id, operatorFingerprint(o)]));
  let operatorsModified = 0;
  for (const o of preprod.operators) {
    const prodFp = prodOpMap.get(o.id);
    if (prodFp && prodFp !== operatorFingerprint(o)) operatorsModified++;
  }

  return {
    jcf: { added: jcfAdded, removed: jcfRemoved, modified: jcfModified },
    stations: { modified: stationsModified },
    operators: { modified: operatorsModified },
  };
}
