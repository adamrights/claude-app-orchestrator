# Authentication

## When to use
When implementing auth in a fullstack application.

## Recommended Libraries

| Library | Best for |
|---------|----------|
| NextAuth.js (Auth.js) | Next.js apps with OAuth providers |
| Lucia | Lightweight, framework-agnostic session auth |
| Clerk / Auth0 | Managed auth with UI components |
| Supabase Auth | Supabase-based projects |

## NextAuth.js (App Router)

```tsx
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
});

export { handler as GET, handler as POST };
```

## Protecting Routes

```tsx
// middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
```

## Guidelines
- Never store plaintext passwords — use bcrypt or argon2 for password hashing.
- Store secrets in environment variables, never in code.
- Use HTTP-only, secure, SameSite cookies for session tokens.
- Implement CSRF protection for cookie-based auth.
- Set short token expiry with refresh token rotation.
