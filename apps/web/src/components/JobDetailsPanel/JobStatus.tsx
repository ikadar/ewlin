import type { Job } from '@flux/types';
import { InfoField } from './InfoField';

export interface JobStatusProps {
  /** The job to display status for */
  job: Job;
  /** REQ-02: Callback when BAT approval date is clicked */
  onDateClick?: (date: Date) => void;
}

/**
 * Job status section displaying BAT, Papier, Plaques.
 */
export function JobStatus({ job, onDateClick }: JobStatusProps) {
  // Format BAT (proof) status
  const formatBatStatus = (): string => {
    const { proofApproval } = job;

    if (proofApproval.approvedAt) {
      const date = new Date(proofApproval.approvedAt);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `Approuvé ${day}/${month} ${hours}:${minutes}`;
    }

    if (proofApproval.sentAt === 'AwaitingFile') {
      return 'En attente fichier';
    }

    if (proofApproval.sentAt === 'NoProofRequired') {
      return 'Pas de BAT requis';
    }

    if (proofApproval.sentAt) {
      const date = new Date(proofApproval.sentAt);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `Reçu ${day}/${month} ${hours}:${minutes}`;
    }

    return 'En attente';
  };

  // REQ-02: Handle BAT date click (only when approved)
  const handleBatDateClick = onDateClick && job.proofApproval.approvedAt
    ? () => onDateClick(new Date(job.proofApproval.approvedAt!))
    : undefined;

  // Format paper status
  const formatPaperStatus = (): string => {
    const statusMap: Record<string, string> = {
      InStock: 'En stock',
      ToOrder: 'À commander',
      Ordered: 'Commandé',
      Received: 'Reçu',
    };
    return statusMap[job.paperPurchaseStatus] || job.paperPurchaseStatus;
  };

  // Format plates status
  const formatPlatesStatus = (): string => {
    const statusMap: Record<string, string> = {
      Todo: 'À faire',
      Done: 'Prêtes',
    };
    return statusMap[job.platesStatus] || job.platesStatus;
  };

  return (
    <>
      <InfoField label="BAT" value={formatBatStatus()} onClick={handleBatDateClick} />
      <InfoField label="Papier" value={formatPaperStatus()} />
      <InfoField label="Plaques" value={formatPlatesStatus()} />
    </>
  );
}
