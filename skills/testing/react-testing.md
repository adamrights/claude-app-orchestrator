# React Testing

## When to use
When writing tests for React components and hooks.

## Testing Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test runner (fast, Vite-native) |
| React Testing Library | Component rendering and assertions |
| MSW (Mock Service Worker) | API mocking at the network level |
| Playwright | End-to-end browser testing |

## Component Test Pattern

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import Counter from './Counter';

describe('Counter', () => {
  it('increments when button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter initialCount={0} />);

    expect(screen.getByText('Count: 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

## API Mocking with MSW

```tsx
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () =>
    HttpResponse.json([{ id: '1', name: 'Alice' }])
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Guidelines
- Test behavior, not implementation — query by role, label, or text, not by class or test ID.
- Prefer `userEvent` over `fireEvent` for realistic interactions.
- Mock at the network boundary (MSW), not at the module level.
- Keep tests fast — avoid unnecessary `waitFor` or `act` wrappers.
- Write integration tests for critical user flows, unit tests for complex logic.
