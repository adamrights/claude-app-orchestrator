'use client';

import { useEffect } from 'react';

/**
 * Catches errors thrown inside the root layout. Must render its own
 * <html> and <body> because the root layout did not mount.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
          <h1 className="text-2xl font-semibold">Application error</h1>
          <p className="max-w-md text-center text-gray-600">
            The app failed to load. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
