---
tags: [optimistic-updates, mutation, cache, undo, tanstack-query]
---

# Optimistic Updates

## When to use
When the UI should feel instant for user actions where the outcome is highly predictable — toggling a like, checking a todo, deleting an item from a list, reordering items, or updating a status. The pattern updates the UI immediately and rolls back if the server rejects the change.

## Guidelines

- **Use the snapshot-and-rollback pattern.** Before mutating, save the current cache state. Update the cache optimistically. If the mutation fails, restore the snapshot.
- **Cancel in-flight queries** in `onMutate` to prevent them from overwriting your optimistic update with stale data.
- **Always invalidate on settle.** In `onSettled`, re-fetch the data to ensure the cache matches the server, regardless of success or failure.
- **Show a rollback indicator on error.** If the mutation fails and you roll back, tell the user: "Could not save. Reverted." A silent rollback is confusing.
- **Do NOT use optimistic updates for:**
  - Payment or financial transactions
  - Destructive deletes that cannot be undone
  - Operations that depend on server-generated values (IDs, timestamps, computed fields)
  - Multi-resource mutations where partial failure is possible
- **Handle concurrent mutations carefully.** If two optimistic mutations fire before either settles, the second `onMutate` snapshot includes the first optimistic update. Rolling back the second mutation would also undo the first. Use query invalidation in `onSettled` to reconcile.
- **Keep optimistic data shaping simple.** The optimistic cache update should mirror the server response structure exactly. Do not compute derived values optimistically.

## TanStack Query Pattern

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (todo: Todo) =>
      fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !todo.completed }),
      }).then((res) => {
        if (!res.ok) throw new Error('Failed to update');
        return res.json();
      }),

    onMutate: async (todo) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot current cache
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Optimistically update the cache
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)),
      );

      // Return snapshot for rollback
      return { previousTodos };
    },

    onError: (_error, _todo, context) => {
      // Roll back to the snapshot
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
      toast.error('Could not update. Reverted.');
    },

    onSettled: () => {
      // Always re-fetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

## Usage

```tsx
function TodoItem({ todo }: { todo: Todo }) {
  const toggleTodo = useToggleTodo();

  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => toggleTodo.mutate(todo)}
        />
        {todo.title}
      </label>
    </li>
  );
}
```

## Checklist
- [ ] `onMutate` cancels in-flight queries and snapshots the cache
- [ ] `onError` rolls back to the snapshot and notifies the user
- [ ] `onSettled` invalidates the query to re-sync with the server
- [ ] Optimistic update is not used for payment, destructive, or server-ID-dependent operations
- [ ] Concurrent mutation edge cases are considered
