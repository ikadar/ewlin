import { z } from 'zod';

// ============================================================================
// Sub-schemas (duplicated from validation-service — both validate @flux/types)
// ============================================================================

const TimeSlotSchema = z.object({ start: z.string(), end: z.string() });
const DayScheduleSchema = z.object({ isOperating: z.boolean(), slots: z.array(TimeSlotSchema) });
const OperatingScheduleSchema = z.object({
  monday: DayScheduleSchema, tuesday: DayScheduleSchema, wednesday: DayScheduleSchema,
  thursday: DayScheduleSchema, friday: DayScheduleSchema, saturday: DayScheduleSchema,
  sunday: DayScheduleSchema,
});
const ScheduleExceptionSchema = z.object({
  id: z.string(), date: z.string(), schedule: DayScheduleSchema, reason: z.string().nullish(),
});
const SimilarityCriterionSchema = z.object({ name: z.string(), fieldPath: z.string() });
const StationCategorySchema = z.object({
  id: z.string(), name: z.string(), description: z.string().nullish(),
  similarityCriteria: z.array(SimilarityCriterionSchema),
});
const StationGroupSchema = z.object({
  id: z.string(), name: z.string(), maxConcurrent: z.number().nullable(),
  isOutsourcedProviderGroup: z.boolean(),
});
const StationSchema = z.object({
  id: z.string(), name: z.string(),
  status: z.enum(['Available', 'InUse', 'Maintenance', 'OutOfService']),
  categoryId: z.string(), groupId: z.string(), capacity: z.number(),
  operatingSchedule: OperatingScheduleSchema, exceptions: z.array(ScheduleExceptionSchema),
});
const OutsourcedProviderSchema = z.object({
  id: z.string(), name: z.string(), status: z.enum(['Active', 'Inactive']),
  supportedActionTypes: z.array(z.string()), latestDepartureTime: z.string(),
  receptionTime: z.string(), transitDays: z.number(), groupId: z.string(),
});
const JobCommentSchema = z.object({
  id: z.string(), author: z.string(), timestamp: z.string(), content: z.string(),
});
const JobSchema = z.object({
  id: z.string(), reference: z.string(), client: z.string(), description: z.string(),
  status: z.enum(['Draft', 'Planned', 'InProgress', 'Delayed', 'Completed', 'Cancelled']),
  workshopExitDate: z.string(), fullyScheduled: z.boolean(), color: z.string(),
  paperType: z.string().nullish(), paperFormat: z.string().nullish(),
  paperWeight: z.number().nullish(), inking: z.string().nullish(),
  comments: z.array(JobCommentSchema), notes: z.string().nullish(),
  elementIds: z.array(z.string()), taskIds: z.array(z.string()),
  createdAt: z.string(), updatedAt: z.string(),
});
const InternalDurationSchema = z.object({ setupMinutes: z.number(), runMinutes: z.number() });
const OutsourcedDurationSchema = z.object({
  openDays: z.number(), latestDepartureTime: z.string(), receptionTime: z.string(),
});
const ElementSpecSchema = z.object({
  format: z.string().optional(), papier: z.string().optional(),
  pagination: z.number().optional(), imposition: z.string().optional(),
  impression: z.string().optional(), surfacage: z.string().optional(),
  quantite: z.number().optional(), qteFeuilles: z.number().optional(),
  autres: z.string().optional(), commentaires: z.string().optional(),
});
const ElementSchema = z.object({
  id: z.string(), jobId: z.string(), name: z.string(), label: z.string().nullish(),
  prerequisiteElementIds: z.array(z.string()), taskIds: z.array(z.string()),
  spec: ElementSpecSchema.nullish(),
  paperStatus: z.enum(['none', 'in_stock', 'to_order', 'ordered', 'delivered']),
  batStatus: z.enum(['none', 'waiting_files', 'files_received', 'bat_sent', 'bat_approved']),
  plateStatus: z.enum(['none', 'to_make', 'ready']),
  formeStatus: z.enum(['none', 'in_stock', 'to_order', 'ordered', 'delivered']),
  paperOrderedAt: z.string().nullish(), paperDeliveredAt: z.string().nullish(),
  filesReceivedAt: z.string().nullish(), batSentAt: z.string().nullish(),
  batApprovedAt: z.string().nullish(), formeOrderedAt: z.string().nullish(),
  formeDeliveredAt: z.string().nullish(), createdAt: z.string(), updatedAt: z.string(),
});
const InternalTaskSchema = z.object({
  id: z.string(), elementId: z.string(), sequenceOrder: z.number(),
  status: z.enum(['Defined', 'Ready', 'Assigned', 'Executing', 'Completed', 'Failed', 'Cancelled']),
  comment: z.string().nullish(), createdAt: z.string(), updatedAt: z.string(),
  type: z.literal('Internal'), stationId: z.string(), duration: InternalDurationSchema,
  splitGroupId: z.string().nullish(), splitIndex: z.number().nullish(),
  splitTotal: z.number().nullish(), originalRunMinutes: z.number().nullish(),
});
const OutsourcedTaskSchema = z.object({
  id: z.string(), elementId: z.string(), sequenceOrder: z.number(),
  status: z.enum(['Defined', 'Ready', 'Assigned', 'Executing', 'Completed', 'Failed', 'Cancelled']),
  comment: z.string().nullish(), createdAt: z.string(), updatedAt: z.string(),
  type: z.literal('Outsourced'), providerId: z.string(), actionType: z.string(),
  duration: OutsourcedDurationSchema,
  manualDeparture: z.string().nullish(), manualReturn: z.string().nullish(),
});
const TaskSchema = z.discriminatedUnion('type', [InternalTaskSchema, OutsourcedTaskSchema]);
const TaskAssignmentSchema = z.object({
  id: z.string(), taskId: z.string(), targetId: z.string(), isOutsourced: z.boolean(),
  scheduledStart: z.string(), scheduledEnd: z.string(),
  isCompleted: z.boolean(), completedAt: z.string().nullable(),
  createdAt: z.string(), updatedAt: z.string(),
});
const ScheduleConflictSchema = z.object({
  type: z.enum([
    'StationMismatchConflict', 'StationConflict', 'GroupCapacityConflict',
    'PrecedenceConflict', 'ApprovalGateConflict', 'AvailabilityConflict', 'DeadlineConflict',
  ]),
  message: z.string(), taskId: z.string(),
  relatedTaskId: z.string().nullish(), targetId: z.string().nullish(),
  details: z.record(z.unknown()).nullish(),
});
const LateJobSchema = z.object({
  jobId: z.string(), deadline: z.string(), expectedCompletion: z.string(), delayDays: z.number(),
});

// ============================================================================
// ScheduleSnapshot schema
// ============================================================================

export const ScheduleSnapshotSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  stations: z.array(StationSchema),
  categories: z.array(StationCategorySchema),
  groups: z.array(StationGroupSchema),
  providers: z.array(OutsourcedProviderSchema),
  jobs: z.array(JobSchema),
  elements: z.array(ElementSchema),
  tasks: z.array(TaskSchema),
  assignments: z.array(TaskAssignmentSchema),
  conflicts: z.array(ScheduleConflictSchema),
  lateJobs: z.array(LateJobSchema),
});

// ============================================================================
// Compact request schema
// ============================================================================

export const CompactRequestSchema = z.object({
  snapshot: ScheduleSnapshotSchema,
  horizonHours: z.number().int().positive().default(24),
});

export type CompactRequest = z.infer<typeof CompactRequestSchema>;
