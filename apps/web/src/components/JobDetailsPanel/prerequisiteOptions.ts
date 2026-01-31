/**
 * Prerequisite Dropdown Options
 *
 * Option arrays with French labels for prerequisite status dropdowns.
 */

import type { PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';

export interface PrerequisiteOption<T> {
  value: T;
  label: string;
  colorClass: string;
}

export const paperOptions: PrerequisiteOption<PaperStatus>[] = [
  { value: 'none', label: 'Pas de papier', colorClass: 'text-zinc-400' },
  { value: 'in_stock', label: 'En stock', colorClass: 'text-emerald-400' },
  { value: 'to_order', label: 'À commander', colorClass: 'text-red-400' },
  { value: 'ordered', label: 'Commandé', colorClass: 'text-amber-400' },
  { value: 'delivered', label: 'Livré', colorClass: 'text-emerald-400' },
];

export const batOptions: PrerequisiteOption<BatStatus>[] = [
  { value: 'none', label: 'Pas de BAT', colorClass: 'text-zinc-400' },
  { value: 'waiting_files', label: 'Attente fichiers', colorClass: 'text-red-400' },
  { value: 'files_received', label: 'Fichiers reçus', colorClass: 'text-amber-400' },
  { value: 'bat_sent', label: 'BAT envoyé', colorClass: 'text-amber-400' },
  { value: 'bat_approved', label: 'BAT OK', colorClass: 'text-emerald-400' },
];

export const plateOptions: PrerequisiteOption<PlateStatus>[] = [
  { value: 'none', label: 'Pas de plaques', colorClass: 'text-zinc-400' },
  { value: 'to_make', label: 'À faire', colorClass: 'text-red-400' },
  { value: 'ready', label: 'Prêtes', colorClass: 'text-emerald-400' },
];

export const formeOptions: PrerequisiteOption<FormeStatus>[] = [
  { value: 'none', label: 'Pas de forme', colorClass: 'text-zinc-400' },
  { value: 'in_stock', label: 'Sur stock', colorClass: 'text-emerald-400' },
  { value: 'to_order', label: 'À commander', colorClass: 'text-red-400' },
  { value: 'ordered', label: 'Commandée', colorClass: 'text-amber-400' },
  { value: 'delivered', label: 'Livrée', colorClass: 'text-emerald-400' },
];
