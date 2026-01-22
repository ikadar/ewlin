/**
 * Validation Messages - French localization for conflict messages
 * v0.3.52: Human-Readable Validation Messages (REQ-07)
 */

import type { ScheduleConflict } from '@flux/types';

/**
 * Convert a conflict to a human-readable French message.
 * Returns null if no message should be shown.
 */
export function getValidationMessage(conflict: ScheduleConflict): string {
  switch (conflict.type) {
    case 'AvailabilityConflict':
      return getAvailabilityMessage(conflict);
    case 'PrecedenceConflict':
      return getPrecedenceMessage(conflict);
    case 'ApprovalGateConflict':
      return getApprovalMessage(conflict);
    case 'GroupCapacityConflict':
      return getGroupCapacityMessage(conflict);
    case 'StationMismatchConflict':
      return 'Station incompatible';
    case 'DeadlineConflict':
      return getDeadlineMessage(conflict);
    case 'StationConflict':
      // Station conflicts are auto-resolved by push-down, don't show message
      return 'Conflit horaire (sera résolu)';
    default:
      return 'Position invalide';
  }
}

/**
 * Get the primary (most important) validation message from conflicts.
 * Returns null if there are no blocking conflicts.
 */
export function getPrimaryValidationMessage(
  conflicts: ScheduleConflict[],
  isValid: boolean,
  hasWarningOnly: boolean
): string | null {
  // Don't show message if valid or only warnings
  if (isValid || hasWarningOnly) {
    return null;
  }

  // Filter to blocking conflicts only
  const blockingConflicts = conflicts.filter(
    (c) =>
      c.type !== 'StationConflict' && // Auto-resolved
      !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates') // Warning only
  );

  if (blockingConflicts.length === 0) {
    return null;
  }

  // Priority order for conflicts
  const priorityOrder: ScheduleConflict['type'][] = [
    'StationMismatchConflict', // Most critical - wrong station type
    'ApprovalGateConflict',     // BAT not approved
    'AvailabilityConflict',     // Station closed
    'PrecedenceConflict',       // Sequence violation
    'GroupCapacityConflict',    // Capacity exceeded
    'DeadlineConflict',         // Will miss deadline
  ];

  // Find highest priority conflict
  for (const type of priorityOrder) {
    const conflict = blockingConflicts.find((c) => c.type === type);
    if (conflict) {
      return getValidationMessage(conflict);
    }
  }

  // Fallback to first conflict
  return getValidationMessage(blockingConflicts[0]);
}

function getAvailabilityMessage(conflict: ScheduleConflict): string {
  const reason = conflict.details?.reason as string | undefined;

  if (reason?.includes('closed due to')) {
    return 'Station fermée';
  }

  if (reason?.includes('not operating')) {
    return 'Station non opérationnelle';
  }

  if (reason?.includes('outside operating hours')) {
    // Try to extract time from reason
    const timeMatch = reason.match(/Time (\d{2}:\d{2})/);
    if (timeMatch) {
      return `Hors horaires (${timeMatch[1]})`;
    }
    return 'Hors horaires d\'ouverture';
  }

  return 'Station indisponible';
}

function getPrecedenceMessage(conflict: ScheduleConflict): string {
  const details = conflict.details as Record<string, unknown> | undefined;

  if (details?.constraintType === 'predecessor') {
    const hasDryTime = details.hasDryTime as boolean;
    const predecessorEnd = details.predecessorEnd as string | undefined;
    const suggestedStart = details.suggestedStart as string | undefined;
    const proposedStart = details.proposedStart as string | undefined;

    // Determine if we're before predecessor end or in drying time
    if (predecessorEnd && proposedStart) {
      const predecessorEndTime = new Date(predecessorEnd).getTime();
      const proposedStartTime = new Date(proposedStart).getTime();

      // If proposed start is before predecessor ends
      if (proposedStartTime < predecessorEndTime) {
        const time = formatTime(predecessorEnd);
        return `Prédécesseur finit à ${time}`;
      }

      // If we're in drying time (after predecessor end but before suggested start)
      if (hasDryTime && suggestedStart) {
        const effectiveTime = formatTime(suggestedStart);
        return `Séchage jusqu'à ${effectiveTime}`;
      }
    }

    // Fallback
    if (predecessorEnd) {
      const time = formatTime(predecessorEnd);
      if (hasDryTime) {
        return `Prédécesseur finit à ${time} + 4h séchage`;
      }
      return `Prédécesseur finit à ${time}`;
    }

    return hasDryTime
      ? 'Trop tôt (séchage requis)'
      : 'Trop tôt';
  }

  if (details?.constraintType === 'successor') {
    const successorStart = details.successorStart as string | undefined;

    if (successorStart) {
      const time = formatTime(successorStart);
      return `Successeur commence à ${time}`;
    }

    return 'Trop tard';
  }

  return 'Conflit de séquence';
}

function getApprovalMessage(conflict: ScheduleConflict): string {
  const gate = conflict.details?.gate as string | undefined;
  const status = conflict.details?.status as string | undefined;

  if (gate === 'BAT') {
    if (status === 'AwaitingFile') {
      return 'En attente du fichier client';
    }
    if (status === 'NotSent') {
      return 'BAT non envoyé';
    }
    return 'BAT non approuvé';
  }

  if (gate === 'Plates') {
    return 'Plaques non prêtes';
  }

  return 'Approbation requise';
}

function getGroupCapacityMessage(conflict: ScheduleConflict): string {
  const details = conflict.details as Record<string, unknown> | undefined;
  const current = details?.currentUsage as number | undefined;
  const max = details?.maxConcurrent as number | undefined;

  if (current !== undefined && max !== undefined) {
    return `Capacité groupe dépassée (${current}/${max})`;
  }

  return 'Capacité groupe dépassée';
}

function getDeadlineMessage(conflict: ScheduleConflict): string {
  const details = conflict.details as Record<string, unknown> | undefined;
  const daysLate = details?.daysLate as number | undefined;

  if (daysLate !== undefined) {
    if (daysLate === 1) {
      return 'Dépasse l\'échéance de 1 jour';
    }
    return `Dépasse l'échéance de ${daysLate} jours`;
  }

  return 'Dépasse l\'échéance';
}

/**
 * Format ISO timestamp to HH:MM
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}
