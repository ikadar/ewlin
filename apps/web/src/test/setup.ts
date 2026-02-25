import '@testing-library/jest-dom';

// ResizeObserver mock — required by @headlessui/react Listbox in jsdom environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;
