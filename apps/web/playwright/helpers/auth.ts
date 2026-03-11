import type { Page } from '@playwright/test';
import { request } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'admin@flux.local';
const TEST_USER_PASSWORD = 'YourPassword123';

/**
 * Perform a real login against the PHP API and inject the JWT token
 * into sessionStorage before the app loads.
 *
 * Must be called BEFORE page.goto().
 *
 * 1. POST /auth/login to get a real JWT token
 * 2. addInitScript injects token + user into sessionStorage so
 *    authSlice.loadInitialState() hydrates Redux with valid auth state
 */
export async function injectTestAuth(page: Page): Promise<void> {
  // Login against the real PHP API
  const apiContext = await request.newContext();
  const response = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });

  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }

  const { token, user } = await response.json();
  await apiContext.dispose();

  // Inject real credentials — loadInitialState() hydrates Redux from these
  await page.addInitScript(({ token, user }) => {
    sessionStorage.setItem('flux_auth_token', token);
    sessionStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, user });
}
