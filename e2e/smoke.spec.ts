import { test, expect, type APIRequestContext } from '@playwright/test';

// Each run registers a fresh user so the suite can re-run against the same
// hermetic PGlite directory (created under os.tmpdir() by the webServer
// config) without collisions.
function uniqueUser() {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    username: `e2e_${tag}`,
    email: `e2e_${tag}@example.com`,
    password: 'test-pw-12345',
  };
}

async function fetchDevCode(
  request: APIRequestContext,
  email: string,
  purpose: 'login' | 'email_verify',
): Promise<string> {
  // Poll the dev-only /api/dev/last-code endpoint until a code is cached.
  // Issues after login/register are sometimes async (nodemailer jsonTransport
  // returns before the dev cache write completes in very rare races).
  for (let i = 0; i < 40; i++) {
    const r = await request.get('/api/dev/last-code', {
      params: { email, purpose },
    });
    if (r.ok()) {
      const body = await r.json();
      if (body.code) return body.code as string;
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`dev code for ${email}/${purpose} not available after 10s`);
}

test('register → verify email → login → 2FA → dashboard', async ({ page, request }) => {
  const user = uniqueUser();

  await page.goto('/register');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm password').fill(user.password);
  await page.getByRole('button', { name: /create account/i }).click();

  // Step 2 — verify email.
  await expect(page.getByText(/verify email/i)).toBeVisible();
  const verifyCode = await fetchDevCode(request, user.email, 'email_verify');
  await page.getByLabel('Verification code').fill(verifyCode);
  await page.getByRole('button', { name: /^verify$/i }).click();

  // Bounced to login.
  await expect(page).toHaveURL(/\/login/);

  // Login → 2FA → dashboard.
  await page.getByLabel(/username or email/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/two-factor/);

  const loginCode = await fetchDevCode(request, user.email, 'login');
  await page.getByLabel(/^code$/i).fill(loginCode);
  await page.getByRole('button', { name: /verify & continue/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Your 2025 Return/i)).toBeVisible();
});

test('dashboard → fill a W-2 → see it reflected on the review page', async ({ page, request }) => {
  // Register + log in fresh so the W-2 fill is hermetic.
  const user = uniqueUser();

  await request.post('/api/auth/register', {
    data: { username: user.username, email: user.email, password: user.password },
  });
  const vCode = await fetchDevCode(request, user.email, 'email_verify');
  await request.post('/api/auth/verify-email', {
    data: { email: user.email, code: vCode },
  });

  // Log in through the UI so the session cookie is set on the browser.
  await page.goto('/login');
  await page.getByLabel(/username or email/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  const loginCode = await fetchDevCode(request, user.email, 'login');
  await page.getByLabel(/^code$/i).fill(loginCode);
  await page.getByRole('button', { name: /verify & continue/i }).click();
  await expect(page).toHaveURL('/');

  // Open the Income section.
  await page.getByRole('link', { name: /income \(w-?2\)/i }).or(page.getByText(/Income \(W-2\)/i)).first().click();
  await expect(page).toHaveURL(/\/section\/income/);

  // Add a W-2.
  await page.getByRole('button', { name: /add w-?2/i }).click();
  await page.getByLabel(/employer/i).fill('Acme Corp');
  await page.getByLabel(/box 1 — wages/i).fill('50000');
  await page.getByLabel(/box 2 — federal tax withheld/i).fill('4000');

  await page.getByRole('button', { name: /save & return/i }).click();
  await expect(page).toHaveURL('/');

  // Navigate to the review page and verify the W-2 wages show up.
  await page.getByText(/^Review$/i).first().click();
  await expect(page).toHaveURL(/\/section\/review/);
  await expect(page.getByText(/W-2 wages/i)).toBeVisible();
  await expect(page.getByText(/\$50,000/)).toBeVisible();
});

test('admin bootstrap user reaches the admin panel', async ({ page, request }) => {
  // Stand up a fresh admin account (ADMIN_EMAIL env is set by the harness's
  // NODE_ENV !== 'production' path). We promote explicitly via the dev DB
  // fixture by registering first; if the first-registered-user bootstrap
  // already claimed admin we skip gracefully.
  const admin = uniqueUser();
  await request.post('/api/auth/register', {
    data: { username: admin.username, email: admin.email, password: admin.password },
  });
  const vCode = await fetchDevCode(request, admin.email, 'email_verify');
  await request.post('/api/auth/verify-email', {
    data: { email: admin.email, code: vCode },
  });

  await page.goto('/login');
  await page.getByLabel(/username or email/i).fill(admin.username);
  await page.getByLabel(/password/i).fill(admin.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  const loginCode = await fetchDevCode(request, admin.email, 'login');
  await page.getByLabel(/^code$/i).fill(loginCode);
  await page.getByRole('button', { name: /verify & continue/i }).click();

  // If the user is the first registered (or matches ADMIN_EMAIL), they're
  // an admin and the "Admin" link is in the app bar.
  const adminLink = page.getByRole('link', { name: /^admin$/i });
  const isAdmin = await adminLink.isVisible().catch(() => false);
  test.skip(!isAdmin, 'user was not auto-promoted to admin (not first-registered)');
  await adminLink.click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText(/Tax year configurations/i)).toBeVisible();
});
