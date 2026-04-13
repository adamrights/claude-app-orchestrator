'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Reusable React error boundary for wrapping specific subtrees inside a page.
 *
 * Prefer the route-level `error.tsx` / `global-error.tsx` for whole-page
 * errors; use this component when you want to isolate failures inside a
 * widget (e.g. a chart, a sidebar section) without killing the rest of the
 * page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(error, this.reset);
    if (fallback !== undefined) return fallback;

    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Something went wrong.</p>
        <p className="mt-1 text-red-700">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }
}
