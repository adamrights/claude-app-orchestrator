import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">404 — Page not found</h1>
      <p className="text-gray-600">The page you were looking for does not exist.</p>
      <Link
        href="/"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Back to home
      </Link>
    </main>
  );
}
