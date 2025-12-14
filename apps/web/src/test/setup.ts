import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Mock scrollIntoView since jsdom doesn't support it
Element.prototype.scrollIntoView = () => {};

// Cleanup after each test
afterEach(() => {
  cleanup();
});
