/**
 * Auth Slice
 *
 * Redux slice for authentication state management.
 * Persists token and user info to sessionStorage (tab-scoped).
 *
 * @see docs/architecture/authentication-plan.md
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
  groups: string[];
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

// ============================================================================
// SessionStorage Keys
// ============================================================================

const TOKEN_KEY = 'flux_auth_token';
const USER_KEY = 'flux_auth_user';

// ============================================================================
// Initial State (hydrate from sessionStorage)
// ============================================================================

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  const token = sessionStorage.getItem(TOKEN_KEY);
  const userJson = sessionStorage.getItem(USER_KEY);
  let user: AuthUser | null = null;

  if (userJson) {
    try {
      user = JSON.parse(userJson) as AuthUser;
    } catch {
      sessionStorage.removeItem(USER_KEY);
    }
  }

  return { token, user };
}

const initialState: AuthState = loadInitialState();

// ============================================================================
// Slice
// ============================================================================

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; user: AuthUser }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      sessionStorage.setItem(TOKEN_KEY, action.payload.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },

    logout: (state) => {
      state.token = null;
      state.user = null;
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const { setCredentials, logout } = authSlice.actions;

// ============================================================================
// Reducer
// ============================================================================

export const authReducer = authSlice.reducer;

// ============================================================================
// Selectors
// ============================================================================

export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => !!state.auth.token;
