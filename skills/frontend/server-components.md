---
tags: [react, rsc, server-components, nextjs, app-router, server-actions, suspense, streaming, caching]
---

# React Server Components (Next.js App Router)

## When to use
Any Next.js App Router project (Next 13.4+). RSC is the default rendering model: every file under `app/` is a server component unless marked otherwise. Use this skill when deciding what runs on the server vs the client, designing the data flow between them, and wiring up Server Actions, Suspense streaming, and the App Router caching layers.

## Guidelines

- **Default to server components.** Server components ship zero JS to the client, can `await` directly, and can hit a database, secrets, or internal services without an API hop. Make a component a client component only when it genuinely needs interactivity, browser APIs, or React state/effects.
- **`'use client'` is a boundary, not a per-component opt-in.** Once a file has `'use client'` at the top, every component imported *from that file* and (transitively) every module it imports becomes part of the client bundle. Push the directive as far down the tree as possible — typically on the smallest interactive leaf.
- **Server components cannot:** use `useState`/`useEffect`/`useReducer`/context, attach event handlers (`onClick`, `onChange`), use refs, use browser-only APIs (`window`, `document`, `localStorage`), or be imported into a client component file. Trying to do any of these is a build error or runtime error.
- **Server components can:** be `async`, `await` data, read environment variables (including secret ones — they never reach the client), import server-only modules, and render client components as children.
- **Pass data server → client via serializable props only.** Functions, class instances, `Date` (becomes string), `Map`/`Set`, and React elements with closures don't cross the boundary cleanly. If you need to pass a callback, use a Server Action instead.
- **Pass data client → server via Server Actions.** Mark a function with `'use server'` (top of file or top of function). Call it from a form's `action`, from `useActionState`, or imperatively from a client event handler. Server Actions are POST endpoints under the hood — never put non-revocable secrets in arguments.
- **Use `<Suspense>` to stream slow data.** The shell renders instantly; the slow subtree streams in when its `await` resolves. This is the App Router's killer feature — use it instead of blocking the whole route on the slowest query.
- **Use the App Router file conventions.** `loading.tsx` wraps the route in `<Suspense>` automatically. `error.tsx` is the error boundary (must be a client component). `not-found.tsx` renders for `notFound()` calls. `default.tsx` is for parallel routes.
- **Caching has multiple layers.** In Next 15+, `fetch` is uncached by default — opt in with `{ cache: 'force-cache' }` or `next: { revalidate: N, tags: [...] }`. Use `revalidatePath()` or `revalidateTag()` from a Server Action after a mutation. Use `unstable_cache` (or React's `cache()`) to memoize non-`fetch` data access (DB queries) within a request or across requests.
- **`cache()` is request-scoped memoization.** Wrap a server-side data accessor so multiple components in the same render can call it without re-querying. It does not persist across requests.
- **Composition gotcha: client components cannot import server components.** They can only *render* server components passed as `children` or other props. This means a `<ClientLayout>` that wraps server content does so via `<ClientLayout>{serverChildren}</ClientLayout>`, not by importing.
- **Forms work without JS.** A `<form action={serverAction}>` submits via standard HTML POST when JS hasn't loaded. Pair with `useActionState` (React 19) for typed return values and pending state — that's the progressive enhancement story.

### When NOT to use server components

- **Pure interactive widgets** (a draggable canvas, a real-time collaborative editor, a Three.js scene). The server has nothing to contribute; everything is client state.
- **SPA-style apps where every interaction is client-side** and there's no SEO or first-paint benefit. Use Vite + TanStack Query instead — RSC adds infrastructure overhead with no payoff.
- **You need persistent client state across navigations** (e.g., a complex multi-step wizard, an audio player that survives route changes). Either use the App Router with a client-component shell holding the state, or pick a different architecture.
- **Tight latency budgets where you cannot tolerate a server roundtrip per navigation.** RSC payloads are smaller than HTML but still require the server to render. A pre-cached SPA with a CDN can feel snappier for app-shell-style UIs.

## Examples

### Server component fetching from Prisma

```tsx
// app/posts/page.tsx — server component by default
import { prisma } from '@/lib/prisma';
import { PostCard } from './post-card';

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <ul>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </ul>
  );
}
```

### Client component receiving server children (composition pattern)

```tsx
// app/components/collapsible-panel.tsx
'use client';
import { useState, type ReactNode } from 'react';

export function CollapsiblePanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)}>{title}</button>
      {open && <div>{children}</div>}
    </section>
  );
}

// app/dashboard/page.tsx — server component
import { CollapsiblePanel } from '@/components/collapsible-panel';
import { RecentOrders } from './recent-orders'; // also a server component

export default function Dashboard() {
  return (
    <CollapsiblePanel title="Recent orders">
      {/* RecentOrders renders on the server; CollapsiblePanel hydrates on the client */}
      <RecentOrders />
    </CollapsiblePanel>
  );
}
```

### Server Action with `useActionState` and progressive enhancement

```tsx
// app/posts/actions.ts
'use server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CreatePost = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

export type CreatePostState = { error?: string; ok?: boolean };

export async function createPost(
  _prev: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const parsed = CreatePost.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid' };

  await prisma.post.create({ data: parsed.data });
  revalidateTag('posts');
  return { ok: true };
}
```

```tsx
// app/posts/new/page.tsx — server component renders the form
import { CreatePostForm } from './form';
export default function NewPostPage() {
  return <CreatePostForm />;
}

// app/posts/new/form.tsx
'use client';
import { useActionState } from 'react';
import { createPost, type CreatePostState } from '../actions';

const initial: CreatePostState = {};

export function CreatePostForm() {
  const [state, action, pending] = useActionState(createPost, initial);
  return (
    <form action={action}>
      <input name="title" required />
      <textarea name="body" required />
      <button disabled={pending}>{pending ? 'Saving…' : 'Create'}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p>Created.</p>}
    </form>
  );
}
```

### Streaming a slow widget inside Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { RevenueChart } from './revenue-chart';
import { RecentSignups } from './recent-signups';
import { Skeleton } from '@/components/skeleton';

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      {/* Shell streams immediately */}
      <Suspense fallback={<Skeleton h={200} />}>
        <RevenueChart /> {/* awaits a slow analytics query */}
      </Suspense>
      <Suspense fallback={<Skeleton h={120} />}>
        <RecentSignups /> {/* awaits a separate query — independent stream */}
      </Suspense>
    </>
  );
}
```

### Request-scoped memoization with `cache()`

```ts
// lib/users.ts
import { cache } from 'react';
import { prisma } from './prisma';

export const getUser = cache(async (id: string) => {
  return prisma.user.findUniqueOrThrow({ where: { id } });
});
// Multiple components in the same render call getUser('abc') → one query.
```

## Antipatterns

- **`'use client'` at the top of `app/layout.tsx` or `app/page.tsx`.** This forces the entire route subtree into the client bundle. The directive belongs on small interactive leaves.
- **Importing a server component from inside a client component.** Pass it as `children` instead. The bundler will reject the import otherwise.
- **Calling a Server Action with non-serializable arguments** (e.g., a class instance, a `File` outside `FormData`). Stick to plain objects, primitives, `FormData`, `Date`, and `Uint8Array`.
- **Reading `process.env.SECRET_KEY` in a client component.** It will be `undefined` at runtime; the secret was stripped from the client bundle. Move the access to a server component or Server Action.
- **Forgetting to `revalidatePath`/`revalidateTag` after a mutation.** The user sees stale data until the cache TTL expires. Tag your fetches and revalidate the tag in the action.
- **Wrapping the entire page in a single `<Suspense>`.** Defeats streaming — you wait for the slowest child instead of streaming each independently. One Suspense per slow boundary.
- **Using `useEffect` to fetch in a client component when the data could have been fetched on the server and passed as a prop.** Higher TTI, worse SEO, an extra roundtrip.

## Checklist

- [ ] Components are server components by default; `'use client'` is on the smallest interactive leaf
- [ ] No client component imports a server component (children/props pattern used instead)
- [ ] Server Actions validate input with Zod and call `revalidatePath`/`revalidateTag` after mutations
- [ ] Slow data is wrapped in independent `<Suspense>` boundaries with skeleton fallbacks
- [ ] `loading.tsx` and `error.tsx` exist for routes with non-trivial loading/error states
- [ ] `fetch` calls have an explicit caching strategy (`force-cache` + tags, or `revalidate: N`, or `no-store`)
- [ ] Cross-component data accessors are wrapped in `cache()` to dedupe within a request
- [ ] Forms use `<form action={...}>` + `useActionState` so they work without JS
- [ ] No secrets are referenced in client component files
