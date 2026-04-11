# Routing

## When to use
When setting up client-side routing in a React application.

## Framework-Specific Routing

### Next.js (App Router)
- File-based routing in `app/` directory.
- `page.tsx` defines a route, `layout.tsx` wraps child routes.
- Use `loading.tsx` and `error.tsx` for built-in loading/error UI.
- Dynamic routes: `app/posts/[id]/page.tsx`.
- Route groups: `app/(marketing)/` for layout grouping without URL impact.

### React Router (v6+)
```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'posts/:id', element: <PostDetail /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

### TanStack Router
- Type-safe routing with full TypeScript inference.
- File-based or code-based route definitions.
- Built-in search param validation with Zod.

## Guidelines
- Lazy-load route components with `React.lazy()` or framework-native mechanisms.
- Keep route definitions in a single file or directory for easy discovery.
- Use typed route params — avoid `string` for known param shapes.
- Handle 404s with a catch-all route.
