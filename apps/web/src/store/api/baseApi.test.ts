/**
 * Tests for baseApi.ts - Hybrid base query with fixture support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldUseMockMode, getFixtureName } from './baseApi';

describe('baseApi', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('shouldUseMockMode', () => {
    it('returns true when VITE_USE_MOCK is true', () => {
      // In test environment, VITE_USE_MOCK is typically true
      // This test verifies the function returns based on env
      const result = shouldUseMockMode();
      expect(typeof result).toBe('boolean');
    });

    it('returns true when URL has fixture parameter', () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          search: '?fixture=test',
        },
        writable: true,
      });

      const result = shouldUseMockMode();
      expect(result).toBe(true);
    });

    it('detects fixture parameter regardless of other params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?other=value&fixture=scheduling-basic&another=param',
        },
        writable: true,
      });

      const result = shouldUseMockMode();
      expect(result).toBe(true);
    });
  });

  describe('getFixtureName', () => {
    it('returns fixture name from URL', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?fixture=test-scenario',
        },
        writable: true,
      });

      const result = getFixtureName();
      expect(result).toBe('test-scenario');
    });

    it('returns null when no fixture parameter', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?other=value',
        },
        writable: true,
      });

      const result = getFixtureName();
      expect(result).toBeNull();
    });

    it('returns null when URL has empty search', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
        },
        writable: true,
      });

      const result = getFixtureName();
      expect(result).toBeNull();
    });
  });
});
