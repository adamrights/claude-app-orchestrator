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

## Testing Routes (jsdom pitfall)

Do **not** test routing with `createMemoryRouter`/`createBrowserRouter` under jsdom: react-router's data routers build a fetch `Request` per navigation, and jsdom's `AbortSignal` isn't accepted by Node's undici — navigations hang silently and `findBy*` queries time out with no error. Test routes with the classic router instead:

```tsx
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { routes } from '@/router'; // export your RouteObject[] separately from the router instance

function RoutedApp() {
  return useRoutes(routes);
}

render(
  <MemoryRouter initialEntries={['/habits']}>
    <RoutedApp />
  </MemoryRouter>,
);
```

`<Navigate>` redirects and `<NavLink>` clicks resolve synchronously in this setup — no `findBy*` needed for navigation. Reserve data-router testing (loaders/actions) for Playwright, where a real browser provides a real `AbortSignal`.

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
