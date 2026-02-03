/// <reference types="vite/client" />

/**
 * Environment Variables Type Definitions
 *
 * @see docs/releases/v0.5.0-api-client-configuration.md
 */

interface ImportMetaEnv {
  /**
   * Base URL for the backend API.
   * Used in production mode when VITE_USE_MOCK is false.
   *
   * @example 'https://api.flux.example.com/api/v1'
   */
  readonly VITE_API_URL: string;

  /**
   * Enable mock mode.
   * When 'true', the app uses mock data instead of real API calls.
   * This is typically 'true' in development and 'false' in production.
   */
  readonly VITE_USE_MOCK: string;

  /**
   * Development mode flag (built-in Vite variable)
   */
  readonly DEV: boolean;

  /**
   * Production mode flag (built-in Vite variable)
   */
  readonly PROD: boolean;

  /**
   * Server-side rendering flag (built-in Vite variable)
   */
  readonly SSR: boolean;

  /**
   * Current mode (built-in Vite variable)
   */
  readonly MODE: string;

  /**
   * Base URL (built-in Vite variable)
   */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
