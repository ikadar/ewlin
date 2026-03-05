import '@testing-library/jest-dom';

// ResizeObserver mock — required by @headlessui/react Listbox in jsdom environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
