/**
 * Tests for realBaseQuery.ts - Real API configuration
 */

import { describe, it, expect, afterEach } from 'vitest';
import { __testing__, resolveScenarioHeader } from './realBaseQuery';

const { getApiBaseUrl, prepareHeaders } = __testing__;

describe('realBaseQuery', () => {
  describe('getApiBaseUrl', () => {
    it('returns URL without trailing slash', () => {
      // In test environment, VITE_API_URL may or may not be set
      const url = getApiBaseUrl();
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      // Should not end with slash
      expect(url.endsWith('/')).toBe(false);
    });
  });

  describe('prepareHeaders', () => {
    const mockGetState = () => ({ auth: { token: null, user: null } });

    it('sets Content-Type to application/json', () => {
      const headers = new Headers();
      const result = prepareHeaders(headers, { getState: mockGetState });
      expect(result.get('Content-Type')).toBe('application/json');
    });

    it('sets Accept to application/json', () => {
      const headers = new Headers();
      const result = prepareHeaders(headers, { getState: mockGetState });
      expect(result.get('Accept')).toBe('application/json');
    });

    it('preserves existing headers', () => {
      const headers = new Headers();
      headers.set('X-Custom-Header', 'custom-value');
      const result = prepareHeaders(headers, { getState: mockGetState });
      expect(result.get('X-Custom-Header')).toBe('custom-value');
    });

    it('sets Authorization header when token exists', () => {
      const headers = new Headers();
      const getState = () => ({ auth: { token: 'test-jwt-token', user: null } });
      const result = prepareHeaders(headers, { getState });
      expect(result.get('Authorization')).toBe('Bearer test-jwt-token');
    });

    it('does not set Authorization header when no token', () => {
      const headers = new Headers();
      const result = prepareHeaders(headers, { getState: mockGetState });
      expect(result.get('Authorization')).toBeNull();
    });
  });

  describe('resolveScenarioHeader', () => {
    const originalLocation = window.location;

    function stubLocation(pathname: string, search = '') {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, pathname, search },
      });
    }

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });

    it('returns scenario UUID for /scenarios/:uuid path', () => {
      stubLocation('/scenarios/12345678-1234-1234-1234-123456789abc/stations');
      expect(resolveScenarioHeader()).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it('returns UUID even when path ends right after the segment', () => {
      stubLocation('/scenarios/12345678-1234-1234-1234-123456789abc');
      expect(resolveScenarioHeader()).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it("returns 'prod' when ?env=prod is set on a non-scenario path", () => {
      stubLocation('/', '?env=prod');
      expect(resolveScenarioHeader()).toBe('prod');
    });

    it("scenario path wins over ?env=prod when both are present", () => {
      stubLocation('/scenarios/12345678-1234-1234-1234-123456789abc/flux', '?env=prod');
      expect(resolveScenarioHeader()).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it('returns null on plain preprod path', () => {
      stubLocation('/');
      expect(resolveScenarioHeader()).toBeNull();
    });

    it('returns null when path mentions scenarios without a UUID', () => {
      stubLocation('/scenarios');
      expect(resolveScenarioHeader()).toBeNull();
    });
  });
});
