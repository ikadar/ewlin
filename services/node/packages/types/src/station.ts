/**
 * Station Types
 * A station is a physical machine or workstation in the print shop.
 */

/** Status of a station */
export type StationStatus = 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';

/** A time slot within a day schedule */
export interface TimeSlot {
  /** Start time in HH:MM format */
  start: string;
  /** End time in HH:MM format */
  end: string;
}

/** Schedule for a single day */
export interface DaySchedule {
  /** Whether the station operates on this day */
  isOperating: boolean;
  /** Time slots when the station is available */
  slots: TimeSlot[];
}

/** Weekly operating schedule pattern */
export interface OperatingSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

/** A one-time override to the regular operating schedule */
export interface ScheduleException {
  id: string;
  /** Date of the exception (ISO date string) */
  date: string;
  /** Override schedule for this date */
  schedule: DaySchedule;
  /** Reason for the exception */
  reason?: string;
}

/** Criterion for measuring similarity between consecutive jobs */
export interface SimilarityCriterion {
  id: string;
  name: string;
  /** Field path on Job to compare */
  fieldPath: string;
}

/** Classification of stations by work type */
export interface StationCategory {
  id: string;
  name: string;
  description?: string;
  /** Criteria for measuring time-saving similarity */
  similarityCriteria: SimilarityCriterion[];
}

/** Logical grouping of stations with capacity constraints */
export interface StationGroup {
  id: string;
  name: string;
  /** Maximum concurrent tasks across all stations in group (null = unlimited) */
  maxConcurrent: number | null;
}

/** A physical machine or workstation */
export interface Station {
  id: string;
  name: string;
  status: StationStatus;
  categoryId: string;
  groupId: string;
  /** Default operating schedule */
  operatingSchedule: OperatingSchedule;
  /** Schedule exceptions (holidays, special closures) */
  exceptions: ScheduleException[];
}

/** An external company that performs specific tasks */
export interface OutsourcedProvider {
  id: string;
  name: string;
  /** Types of work this provider can perform */
  supportedActionTypes: string[];
  /** Associated station group (always unlimited capacity) */
  groupId: string;
}
