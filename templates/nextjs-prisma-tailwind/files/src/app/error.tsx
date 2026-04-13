'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-center text-gray-600">
        An unexpected error occurred while rendering this page. You can try again, or return to the
        home page.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400">
          Error ID: <code>{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Try again
      </button>
    </main>
  );
}
