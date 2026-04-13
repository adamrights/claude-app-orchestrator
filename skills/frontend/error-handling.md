---
tags: [error-handling, error-boundary, try-catch, error-state]
---

# Error Handling

## When to use
When building any React application that makes API calls, handles user interactions, or renders dynamic content. Error handling prevents blank screens, silent failures, and confused users. Every component tree should have at least one error boundary, and every async operation should handle failure explicitly.

## Guidelines

- **Never silently swallow errors.** Every `catch` block must either display feedback to the user, log the error, or re-throw. An empty `catch {}` is always wrong.
- **Use React Error Boundaries for render errors.** They catch errors in the component tree during rendering, lifecycle methods, and constructors. They do NOT catch errors in event handlers or async code.
- **Place error boundaries at two levels:** route-level (catches full page crashes, shows a "something went wrong" page) and component-level (wraps risky widgets so the rest of the page still works).
- **Provide a reset mechanism.** Error boundaries should offer a "Try again" button that resets state and re-renders the subtree.
- **Use try-catch in event handlers and async code.** Error boundaries don't catch these — handle them explicitly.
- **Follow the loading/error/success pattern** for any component that fetches data. Never render only the success case.
- **Distinguish user-facing messages from developer logs.** Show the user a helpful message ("Could not save your changes"). Log the full error with stack trace for debugging.
- **Use TanStack Query error handling** via `onError` callbacks or the `error` state returned from `useQuery` / `useMutation`.
- **Report errors to a monitoring service** (Sentry, LogRocket) in production. `console.error` is not enough.

## Error Boundary Pattern

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback?: ReactNode;
  onReset?: () => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    // Report to monitoring service here
  }

  reset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert">
          <p>Something went wrong.</p>
          <button onClick={this.reset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Try-Catch in Event Handlers

```tsx
const handleSubmit = async (data: FormData) => {
  try {
    setIsSubmitting(true);
    await createPost(data);
    toast.success('Post created');
  } catch (error) {
    console.error('Failed to create post:', error);
    toast.error('Could not create post. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
```

## TanStack Query Error Handling

```tsx
const { data, error, isLoading } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
});

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage message="Failed to load posts." />;
return <PostList posts={data} />;
```

```tsx
const mutation = useMutation({
  mutationFn: updatePost,
  onError: (error) => {
    console.error('Mutation failed:', error);
    toast.error('Could not update post.');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  },
});
```

## Checklist
- [ ] Route-level error boundary wraps the page layout
- [ ] Component-level boundaries wrap risky widgets (third-party embeds, dynamic content)
- [ ] Every async operation has explicit error handling
- [ ] User sees a helpful message on failure, not a blank screen or raw error
- [ ] Errors are logged or reported, not silently caught
- [ ] Loading and error states are handled alongside success state
