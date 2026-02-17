/**
 * Validation Service client for E2E tests.
 * Communicates with the validation service running on Docker (default: localhost:3001).
 */

import type { Snapshot, Conflict } from './api.js';

export interface ProposedAssignment {
  taskId: string;
  targetId: string;
  isOutsourced: boolean;
  scheduledStart: string;
  bypassPrecedence?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  conflicts: Conflict[];
  suggestedStart: string | null;
  validationTimeMs: number;
}

export class ValidatorAPI {
  constructor(private baseUrl = 'http://localhost:3001') {}

  async validate(
    proposed: ProposedAssignment,
    snapshot: Snapshot,
  ): Promise<ValidationResult> {
    const res = await fetch(`${this.baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposed, snapshot }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Validation failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<any>;
  }

  async healthCheck(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Validator health check failed: ${res.status}`);
    }
  }
}
