/**
 * Thin HTTP client for the Symfony PHP API.
 *
 * Forwards the user's JWT verbatim. The PHP API enforces auth and
 * permissions; this client trusts that.
 *
 * Errors from the PHP API (4xx/5xx) are wrapped in PhpClientError so
 * the LLM can read them and reformulate.
 */
export class PhpClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: string,
  ) {
    super(`PHP API ${endpoint} returned ${status}: ${body.slice(0, 200)}`);
    this.name = 'PhpClientError';
  }
}

export class PhpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly jwt: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.jwt}`,
    };
  }

  async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { method: 'GET', headers: this.headers() });
    return this.handleResponse<T>(res, path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res, path);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res, path);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res, path);
  }

  async delete<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { method: 'DELETE', headers: this.headers() });
    return this.handleResponse<T>(res, path);
  }

  private async handleResponse<T>(res: Response, path: string): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      throw new PhpClientError(res.status, path, text);
    }
    if (text.length === 0) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      // Body wasn't JSON — return the raw text
      return text as unknown as T;
    }
  }
}
