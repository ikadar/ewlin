import type { Job } from '@flux/types';
import { InfoField } from './InfoField';

export interface JobInfoProps {
  /** The job to display */
  job: Job;
  /** REQ-02: Callback when departure date is clicked */
  onDateClick?: (date: Date) => void;
}

/**
 * Job information section displaying Code, Client, Intitulé, Départ.
 */
export function JobInfo({ job, onDateClick }: JobInfoProps) {
  // Format date as DD/MM/YYYY HH:mm
  const formatDate = (dateStr: string): string => {
    if (dateStr.includes('T')) {
      // Datetime format: parse from string directly to avoid timezone shifts
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (match) {
        const [, year, month, day, hours, minutes] = match;
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
    }
    // Date-only fallback
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year} 14:00`;
  };

  // REQ-02: Handle departure date click
  const handleDateClick = onDateClick
    ? () => onDateClick(new Date(job.workshopExitDate))
    : undefined;

  return (
    <>
      <InfoField label="Code" value={job.reference} mono />
      <InfoField label="Client" value={job.client} />
      <InfoField label="Intitulé" value={job.description} />
      <InfoField
        label="Départ"
        value={formatDate(job.workshopExitDate)}
        onClick={handleDateClick}
      />
    </>
  );
}
