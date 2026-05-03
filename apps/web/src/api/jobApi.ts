/**
 * Job API service (v0.4.33)
 *
 * Provides functions to interact with the Job API.
 * Supports both mock mode (development) and real API (production).
 */

import type { JcfElement } from '../components/JcfElementsTable/types';
import { store } from '../store';

// ============================================================================
// Types
// ============================================================================

/**
 * API request format for creating a job element
 */
export interface CreateJobElementRequest {
  name: string;
  sequence?: string;
  prerequisiteNames: string[];
  format?: string;
  papier?: string;
  pagination?: number;
  quantite?: number;
  imposition?: string;
  impression?: string;
  surfacage?: string;
  autres?: string;
  qteFeuilles?: number;
  commentaires?: string;
  /**
   * Per-element prerequisite "needed" flags set from JCF. Backend
   * translates them to initial xxxStatus enums on create, and to
   * status transitions on update (preserving status when the
   * boolean matches the current state).
   */
  needsBat?: boolean;
  needsPaper?: boolean;
  needsForme?: boolean;
  needsPlates?: boolean;
}

/**
 * API request format for creating a job
 */
export interface CreateJobRequest {
  reference: string;
  client: string;
  referent?: string;
  description: string;
  /**
   * Absolute workshop exit date (ISO datetime). Optional when
   * deadlineRelativeWorkingDays is provided — the backend enforces "at
   * least one of the two" via cross-field validation.
   */
  workshopExitDate?: string;
  /** Working-days delay (J+X) used to auto-fill workshopExitDate at last BAT OK. */
  deadlineRelativeWorkingDays?: number;
  batDeadline?: string | null;
  deadlinePriority?: number;
  quantity?: number;
  shipperId?: string;
  status: 'draft' | 'planned' | 'in_progress' | 'delayed' | 'completed' | 'cancelled';
  elements: CreateJobElementRequest[];
  /** Job references that this job depends on */
  requiredJobReferences?: string[];
}

/**
 * API response for created job
 */
export interface CreateJobResponse {
  id: string;
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string | null;
  deadlineRelativeWorkingDays?: number | null;
  status: string;
  elements: Array<{
    id: string;
    name: string;
    prerequisiteElementIds: string[];
    tasks: unknown[];
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  violations?: Array<{
    propertyPath: string;
    message: string;
  }>;
}

export class JobApiError extends Error {
  statusCode: number;
  violations?: Array<{ propertyPath: string; message: string }>;

  constructor(
    message: string,
    statusCode: number,
    violations?: Array<{ propertyPath: string; message: string }>
  ) {
    super(message);
    this.name = 'JobApiError';
    this.statusCode = statusCode;
    this.violations = violations;
  }
}

// ============================================================================
// Configuration
// ============================================================================

function getApiBaseUrl(): string {
  // In Vite, environment variables are accessed via import.meta.env
  return import.meta.env.VITE_API_URL || '';
}

function isUseMock(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Parse a duration string with optional time units to minutes.
 * Supports: "180", "180m", "3h", "3h30", "3h30m"
 */
function parseDurationToMinutes(s: string): number {
  const trimmed = s.trim();
  // "3h30m" or "3h30"
  const hm = trimmed.match(/^(\d+)h(\d+)m?$/i);
  if (hm) return parseInt(hm[1]!, 10) * 60 + parseInt(hm[2]!, 10);
  // "3h"
  const h = trimmed.match(/^(\d+)h$/i);
  if (h) return parseInt(h[1]!, 10) * 60;
  // "180m" or "180"
  const m = trimmed.match(/^(\d+)m?$/i);
  if (m) return parseInt(m[1]!, 10);
  return 0;
}

/**
 * Normalize a sequence DSL line's durations from human-friendly units to raw minutes.
 * "G37(20m+3h)" → "G37(20+180)"
 * "ST:Reliure_Martin(3j):dos carré collé" → unchanged (outsourced syntax)
 */
function normalizeSequenceLine(line: string): string {
  // Match: StationName(setup+run) pattern
  return line.replace(/\(([^)]+)\)/, (_, inner: string) => {
    const parts = inner.split('+');
    if (parts.length === 2) {
      const setup = parseDurationToMinutes(parts[0]!);
      const run = parseDurationToMinutes(parts[1]!);
      return `(${setup}+${run})`;
    }
    // Single value like (3j) for outsourced — leave as-is
    return `(${inner})`;
  });
}

/**
 * Normalize all lines of a sequence DSL to raw minutes.
 */
function normalizeSequenceDsl(dsl: string): string {
  if (!dsl) return dsl;
  return dsl.split('\n').map(normalizeSequenceLine).join('\n');
}

/**
 * Detect whether an element's sequence contains at least one
 * "Presse offset" station. Drives the auto-default for needsPlates
 * — only offset jobs need plates.
 *
 * Tokenises the multi-line DSL on the usual delimiters and tests
 * each token against the offset-press names known to the catalogue
 * passed in.
 */
export function hasOffsetPressInSequence(
  sequence: string,
  postePresets: ReadonlyArray<{ name: string; category: string }>,
): boolean {
  if (!sequence) return false;
  const offsetNames = new Set(
    postePresets
      .filter((p) => p.category === 'Presse offset')
      .map((p) => p.name),
  );
  if (offsetNames.size === 0) return false;
  const tokens = sequence.split(/[\s,()\n;|]+/).filter((t) => t.length > 0);
  return tokens.some((t) => offsetNames.has(t));
}

/**
 * Transform JCF form element to API request format.
 *
 * Maps frontend field names to backend API field names:
 * - precedences (comma-separated string) → prerequisiteNames (array)
 * - format, papier, pagination sent as spec fields (not combined into label)
 * - needs* booleans surface the chef's per-element prerequisite
 *   choices. Backend translates them to initial status enums.
 */
export function transformJcfElementToRequest(element: JcfElement): CreateJobElementRequest {
  // Parse precedences: "A, B, C" → ["A", "B", "C"]
  const prerequisiteNames = element.precedences
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return {
    name: element.name,
    sequence: element.sequence ? normalizeSequenceDsl(element.sequence) : undefined,
    prerequisiteNames,
    needsBat: element.needsBat,
    needsPaper: element.needsPaper,
    needsForme: element.needsForme,
    needsPlates: element.needsPlates,
    ...(element.format ? { format: element.format } : {}),
    ...(element.papier ? { papier: element.papier } : {}),
    ...(element.pagination ? { pagination: parseInt(element.pagination, 10) } : {}),
    ...(element.quantite ? { quantite: parseInt(element.quantite, 10) } : {}),
    ...(element.imposition ? { imposition: element.imposition } : {}),
    ...(element.impression ? { impression: element.impression } : {}),
    ...(element.surfacage ? { surfacage: element.surfacage } : {}),
    ...(element.autres ? { autres: element.autres } : {}),
    ...(element.qteFeuilles ? { qteFeuilles: parseInt(element.qteFeuilles, 10) } : {}),
    ...(element.commentaires ? { commentaires: element.commentaires } : {}),
  };
}

/**
 * Transform JCF form data to API request format.
 */
export function transformJcfToRequest(
  jobId: string,
  client: string,
  intitule: string,
  deadline: string,
  elements: JcfElement[],
  quantity?: string,
  shipperId?: string,
  requiredJobs?: string,
  batDeadline?: string,
  referent?: string,
  deadlinePriority?: number,
  deadlineRelativeWorkingDays?: number | null,
): CreateJobRequest {
  // Parse required jobs: "JOB-001, JOB-002" → ["JOB-001", "JOB-002"]
  const requiredJobReferences = requiredJobs
    ? requiredJobs.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    reference: jobId,
    client,
    description: intitule,
    status: 'planned',
    elements: elements.map(transformJcfElementToRequest),
    ...(deadline ? { workshopExitDate: deadline } : {}),
    ...(deadlineRelativeWorkingDays != null
      ? { deadlineRelativeWorkingDays }
      : {}),
    ...(quantity ? { quantity: parseInt(quantity, 10) } : {}),
    ...(shipperId ? { shipperId } : {}),
    ...(requiredJobReferences && requiredJobReferences.length > 0 ? { requiredJobReferences } : {}),
    ...(batDeadline ? { batDeadline } : {}),
    ...(referent ? { referent } : {}),
    ...(deadlinePriority !== undefined && deadlinePriority !== 2 ? { deadlinePriority } : {}),
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new job via the API.
 *
 * In mock mode, simulates a successful response with a delay.
 * In production mode, calls the real API endpoint.
 */
export async function createJob(request: CreateJobRequest): Promise<CreateJobResponse> {
  if (isUseMock()) {
    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return mock response
    const mockId = `job-${Date.now()}`;
    return {
      id: mockId,
      reference: request.reference,
      client: request.client,
      description: request.description,
      workshopExitDate: request.workshopExitDate ?? null,
      deadlineRelativeWorkingDays: request.deadlineRelativeWorkingDays ?? null,
      status: request.status,
      elements: request.elements.map((el, index) => ({
        id: `elem-${index}-${Date.now()}`,
        name: el.name,
        prerequisiteElementIds: [],
        tasks: [],
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Real API call
  const baseUrl = getApiBaseUrl();
  const token = store.getState().auth?.token;
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ApiErrorResponse;
    throw new JobApiError(
      errorData.detail || errorData.title || 'Failed to create job',
      response.status,
      errorData.violations
    );
  }

  return response.json() as Promise<CreateJobResponse>;
}
