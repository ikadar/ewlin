/**
 * Auth Slice
 *
 * Redux slice for authentication state management.
 * Persists token and user info to localStorage (shared across tabs).
 *
 * @see docs/architecture/authentication-plan.md
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ============================================================================
// Types
// ============================================================================

export interface AuthUserGroup {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
  groups: AuthUserGroup[];
  isActive?: boolean;
  lastLoginAt?: string | null;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

// ============================================================================
// LocalStorage Keys
// ============================================================================

const TOKEN_KEY = 'flux_auth_token';
const REFRESH_TOKEN_KEY = 'flux_refresh_token';
const USER_KEY = 'flux_auth_user';

// ============================================================================
// Initial State (hydrate from localStorage)
// ============================================================================

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, refreshToken: null, user: null };
  }

  const token = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  let user: AuthUser | null = null;

  if (userJson) {
    try {
      user = JSON.parse(userJson) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }

  return { token, refreshToken, user };
}

const initialState: AuthState = loadInitialState();

// ============================================================================
// Slice
// ============================================================================

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; refreshToken: string; user: AuthUser }>) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, action.payload.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },

    setTokens: (state, action: PayloadAction<{ token: string; refreshToken: string }>) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, action.payload.refreshToken);
    },

    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const { setCredentials, setTokens, logout } = authSlice.actions;

// ============================================================================
// Reducer
// ============================================================================

export const authReducer = authSlice.reducer;

// ============================================================================
// Selectors
// ============================================================================

export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectRefreshToken = (state: { auth: AuthState }) => state.auth.refreshToken;
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => !!state.auth.token;
