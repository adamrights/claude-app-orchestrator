import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Type-safe, Zod-validated environment variables for Vite.
 *
 * Vite exposes env vars via `import.meta.env.VITE_*` at build time. Import
 * `env` from `@/env` instead of reading `import.meta.env` directly so you
 * get validation + typing.
 *
 * Any var you want available in the browser must be prefixed `VITE_`.
 */
export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    // Optional so a serverless SPA (no API at all) scaffolds cleanly.
    // If your app requires an API, drop `.optional()` so a missing URL
    // fails at boot instead of at first fetch.
    VITE_API_URL: z.string().url().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
