import { mockApi } from './mockApi';

// In the future, realApi will be imported here
// import { realApi } from './realApi';

// API selection based on environment variable
// Default to mock mode for development
const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

export const api = useMock ? mockApi : mockApi; // TODO: Replace with realApi when available
