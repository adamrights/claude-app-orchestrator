# End-to-End Testing

## When to use
When writing browser-based tests for critical user flows.

## Playwright Setup

```tsx
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Test Pattern

```tsx
import { test, expect } from '@playwright/test';

test('user can create a post', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.goto('/posts/new');
  await page.getByLabel('Title').fill('My Post');
  await page.getByLabel('Content').fill('Hello world');
  await page.getByRole('button', { name: 'Publish' }).click();

  await expect(page.getByText('My Post')).toBeVisible();
});
```

## Guidelines
- Test critical paths: signup, login, core CRUD, checkout.
- Use Page Object Model for shared page interactions.
- Run e2e tests in CI against preview deployments.
- Keep e2e suite small and focused — prefer integration tests for breadth.
