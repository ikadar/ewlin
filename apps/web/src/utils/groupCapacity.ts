/**
 * Group Capacity Utilities
 * Calculate concurrent task counts per station group (REQ-18)
 */

import type { TaskAssignment, Station, StationGroup } from '@flux/types';
import type { GroupCapacityInfo } from '../components/StationHeaders';

/**
 * Calculate how many concurrent tasks are running in each group at a given time.
 * Returns a map of groupId -> current usage count.
 */
export function calculateGroupUsageAtTime(
  assignments: TaskAssignment[],
  stations: Station[],
  time: Date
): Map<string, number> {
  const usageMap = new Map<string, number>();
  const stationGroupMap = new Map<string, string>();

  // Build station -> group lookup
  stations.forEach((station) => {
    stationGroupMap.set(station.id, station.groupId);
  });

  // Count concurrent assignments per group at the given time
  assignments.forEach((assignment) => {
    // Skip outsourced assignments (they have unlimited capacity)
    if (assignment.isOutsourced) return;

    const groupId = stationGroupMap.get(assignment.targetId);
    if (!groupId) return;

    // Check if assignment is active at the given time
    const start = new Date(assignment.scheduledStart);
    const end = new Date(assignment.scheduledEnd);

    if (start <= time && time < end) {
      const currentCount = usageMap.get(groupId) || 0;
      usageMap.set(groupId, currentCount + 1);
    }
  });

  return usageMap;
}

/**
 * Calculate the maximum concurrent usage for each group across all time points.
 * This is used to detect if any group capacity is exceeded.
 */
export function calculateMaxGroupUsage(
  assignments: TaskAssignment[],
  stations: Station[]
): Map<string, number> {
  const maxUsageMap = new Map<string, number>();
  const stationGroupMap = new Map<string, string>();

  // Build station -> group lookup
  stations.forEach((station) => {
    stationGroupMap.set(station.id, station.groupId);
  });

  // Collect all time boundaries
  const timeBoundaries = new Set<number>();
  assignments.forEach((assignment) => {
    if (assignment.isOutsourced) return;
    timeBoundaries.add(new Date(assignment.scheduledStart).getTime());
    timeBoundaries.add(new Date(assignment.scheduledEnd).getTime());
  });

  // Check usage at each time boundary
  const sortedTimes = Array.from(timeBoundaries).sort((a, b) => a - b);

  sortedTimes.forEach((timestamp) => {
    // Check slightly after the start to catch active tasks
    const time = new Date(timestamp + 1);
    const usageAtTime = calculateGroupUsageAtTime(assignments, stations, time);

    usageAtTime.forEach((usage, groupId) => {
      const currentMax = maxUsageMap.get(groupId) || 0;
      if (usage > currentMax) {
        maxUsageMap.set(groupId, usage);
      }
    });
  });

  return maxUsageMap;
}

/**
 * Build GroupCapacityInfo for a station.
 * Uses current time to determine active usage.
 */
export function getGroupCapacityInfo(
  station: Station,
  groups: StationGroup[],
  assignments: TaskAssignment[],
  stations: Station[],
  referenceTime?: Date
): GroupCapacityInfo | undefined {
  const group = groups.find((g) => g.id === station.groupId);
  if (!group) return undefined;

  // For unlimited capacity groups, don't show capacity info
  if (group.maxConcurrent === null) return undefined;

  const time = referenceTime || new Date();
  const usageMap = calculateGroupUsageAtTime(assignments, stations, time);
  const currentUsage = usageMap.get(group.id) || 0;

  return {
    groupId: group.id,
    groupName: group.name,
    maxConcurrent: group.maxConcurrent,
    currentUsage,
  };
}

/**
 * Build GroupCapacityInfo map for all stations.
 */
export function buildGroupCapacityMap(
  stations: Station[],
  groups: StationGroup[],
  assignments: TaskAssignment[],
  referenceTime?: Date
): Map<string, GroupCapacityInfo> {
  const capacityMap = new Map<string, GroupCapacityInfo>();

  stations.forEach((station) => {
    const info = getGroupCapacityInfo(station, groups, assignments, stations, referenceTime);
    if (info) {
      capacityMap.set(station.id, info);
    }
  });

  return capacityMap;
}

/**
 * Find groups that have exceeded their capacity.
 * Returns array of group IDs that are over capacity.
 */
export function findExceededGroups(
  groups: StationGroup[],
  assignments: TaskAssignment[],
  stations: Station[]
): string[] {
  const maxUsageMap = calculateMaxGroupUsage(assignments, stations);
  const exceededGroups: string[] = [];

  groups.forEach((group) => {
    if (group.maxConcurrent === null) return;

    const maxUsage = maxUsageMap.get(group.id) || 0;
    if (maxUsage > group.maxConcurrent) {
      exceededGroups.push(group.id);
    }
  });

  return exceededGroups;
}
