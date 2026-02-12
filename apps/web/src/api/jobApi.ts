/**
 * Job API service (v0.4.33)
 *
 * Provides functions to interact with the Job API.
 * Supports both mock mode (development) and real API (production).
 */

import type { JcfElement } from '../components/JcfElementsTable/types';

// ============================================================================
// Types
// ============================================================================

/**
 * API request format for creating a job element
 */
export interface CreateJobElementRequest {
  name: string;
  label?: string;
  sequence?: string;
  prerequisiteNames: string[];
  quantite?: number;
  imposition?: string;
  impression?: string;
  surfacage?: string;
  autres?: string;
  qteFeuilles?: number;
  commentaires?: string;
}

/**
 * API request format for creating a job
 */
export interface CreateJobRequest {
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string;
  quantity?: number;
  status: 'draft' | 'planned' | 'in_progress' | 'delayed' | 'completed' | 'cancelled';
  elements: CreateJobElementRequest[];
}

/**
 * API response for created job
 */
export interface CreateJobResponse {
  id: string;
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string;
  status: string;
  elements: Array<{
    id: string;
    name: string;
    label: string | null;
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
 * Transform JCF form element to API request format.
 *
 * Maps frontend field names to backend API field names:
 * - precedences (comma-separated string) → prerequisiteNames (array)
 * - Combines format, pagination, papier fields into label
 */
export function transformJcfElementToRequest(element: JcfElement): CreateJobElementRequest {
  // Parse precedences: "A, B, C" → ["A", "B", "C"]
  const prerequisiteNames = element.precedences
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  // Build label from format, pagination, and papier
  const labelParts = [element.format, element.pagination, element.papier].filter(
    (part) => part && part.trim().length > 0
  );
  const label = labelParts.length > 0 ? labelParts.join(' | ') : undefined;

  return {
    name: element.name,
    label,
    sequence: element.sequence || undefined,
    prerequisiteNames,
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
): CreateJobRequest {
  return {
    reference: jobId,
    client,
    description: intitule,
    workshopExitDate: deadline,
    status: 'planned',
    elements: elements.map(transformJcfElementToRequest),
    ...(quantity ? { quantity: parseInt(quantity, 10) } : {}),
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
      workshopExitDate: request.workshopExitDate,
      status: request.status,
      elements: request.elements.map((el, index) => ({
        id: `elem-${index}-${Date.now()}`,
        name: el.name,
        label: el.label || null,
        prerequisiteElementIds: [],
        tasks: [],
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Real API call
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
