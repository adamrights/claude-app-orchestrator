import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Type-safe, Zod-validated environment variables.
 *
 * Import `env` from `@/env` anywhere you need an env var. Never read
 * `process.env.*` directly — that bypasses validation and typing.
 *
 * Validation runs on module load, so missing or malformed vars fail the
 * process fast at startup instead of surfacing as runtime errors deep in
 * request handlers.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
    NEXTAUTH_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    // Add NEXT_PUBLIC_* client-visible vars here.
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
});
