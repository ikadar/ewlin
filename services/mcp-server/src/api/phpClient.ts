/**
 * HTTP client for the Flux PHP API.
 * Wraps all API calls needed by the MCP server tools.
 */
export class PhpApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `PHP API error ${response.status}: ${response.statusText} - ${errorBody}`
      );
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  /** Consume an SSE stream and return all events. */
  private async consumeSSE(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `PHP API SSE error ${response.status}: ${response.statusText} - ${errorBody}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for SSE stream');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let lastEvent: Record<string, unknown> = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6).trim()) as Record<string, unknown>;
          lastEvent = event;
        } catch {
          // Skip malformed lines
        }
      }
    }

    return lastEvent;
  }

  // ===== Read Operations =====

  async getSnapshot(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/schedule/snapshot');
  }

  async lookupStations(query: string): Promise<string[]> {
    return this.request<string[]>('GET', `/stations/names?q=${encodeURIComponent(query)}`);
  }

  async searchJobsByReferences(
    references: string[]
  ): Promise<Record<string, unknown>> {
    const refs = references.join(',');
    return this.request<Record<string, unknown>>(
      'GET',
      `/jobs/search-by-references?refs=${encodeURIComponent(refs)}`
    );
  }

  // ===== Write Operations =====

  async updateTaskDuration(
    taskId: string,
    runMinutes: number
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/tasks/${taskId}/duration`,
      { runMinutes }
    );
  }

  async addStationException(
    stationId: string,
    data: {
      date: string;
      type: string;
      schedule?: Record<string, unknown>;
      reason?: string;
    }
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/stations/${stationId}/exceptions`,
      data
    );
  }

  async batchComplete(
    taskIds: string[]
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/tasks/batch-complete', {
      taskIds,
    });
  }

  async batchCompleteBefore(
    before: string,
    stationId?: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      '/tasks/batch-complete-before',
      { before, stationId }
    );
  }

  async unassignTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'DELETE',
      `/tasks/${taskId}/assign`
    );
  }

  async autoPlace(): Promise<Record<string, unknown>> {
    return this.consumeSSE('POST', '/schedule/auto-place-all');
  }

  async smartCompact(
    horizonHours?: number
  ): Promise<Record<string, unknown>> {
    return this.consumeSSE('POST', '/schedule/smart-compact', {
      horizonHours: horizonHours ?? 24,
    });
  }

  // ===== New Write Operations =====

  async deleteJob(jobId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('DELETE', `/jobs/${jobId}`);
  }

  async assignTask(
    taskId: string,
    targetId: string,
    scheduledStart: string,
    bypassPrecedence?: boolean
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/tasks/${taskId}/assign`,
      { targetId, scheduledStart, bypassPrecedence: bypassPrecedence ?? false }
    );
  }

  async rescheduleTask(
    taskId: string,
    targetId: string,
    scheduledStart: string,
    bypassPrecedence?: boolean
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/tasks/${taskId}/assign`,
      { targetId, scheduledStart, bypassPrecedence: bypassPrecedence ?? false }
    );
  }

  async splitTask(
    taskId: string,
    ratio: number
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/tasks/${taskId}/split`,
      { ratio }
    );
  }

  async fuseTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/tasks/${taskId}/fuse`
    );
  }

  async setJobDependencies(
    jobId: string,
    requiredJobIds: string[]
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/jobs/${jobId}/dependencies`,
      { requiredJobIds }
    );
  }

  async getJobDependencies(
    jobId: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/jobs/${jobId}/dependencies`
    );
  }

  async removeJobDependency(
    jobId: string,
    requiredJobId: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'DELETE',
      `/jobs/${jobId}/dependencies/${requiredJobId}`
    );
  }

  async updateElementPrerequisite(
    elementId: string,
    column: string,
    value: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/flux/elements/${elementId}`,
      { column, value }
    );
  }

  async updateJob(
    jobId: string,
    fields: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/jobs/${jobId}`,
      fields
    );
  }

  async updateOutsourcedTaskStatus(
    taskId: string,
    status: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/flux/tasks/${taskId}/status`,
      { status }
    );
  }

  async listSavedSchedules(): Promise<Record<string, unknown>[]> {
    return this.request<Record<string, unknown>[]>('GET', '/saved-schedules');
  }

  async saveSchedule(name: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/saved-schedules', {
      name,
    });
  }

  async loadSchedule(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/saved-schedules/${id}/load`
    );
  }

  async autoPlaceJobAsap(jobId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/jobs/${jobId}/auto-place`
    );
  }

  async autoPlaceJobAlap(jobId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/jobs/${jobId}/auto-place-alap`
    );
  }

  async extendAndReplan(
    taskId: string,
    runMinutes: number
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/tasks/${taskId}/extend-and-replan`,
      { runMinutes }
    );
  }
}
