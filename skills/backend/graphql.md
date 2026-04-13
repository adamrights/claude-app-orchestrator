# GraphQL

## When to use

When clients need flexible queries over a data graph — requesting exactly the fields they need. GraphQL works well when:
- Multiple clients (web, mobile, third-party) consume different shapes of the same data.
- You have a federated schema across multiple services.
- The API surface is large and REST would require too many endpoints or overfetch.

Prefer REST or tRPC instead when:
- The API is consumed by a single frontend in the same repo (tRPC is simpler).
- The API surface is small and CRUD-shaped.

## Schema-First vs Code-First

- **Code-first (recommended for TypeScript)**: Use Pothos or Nexus. Types are defined in TypeScript and the schema is derived — you get full type inference without maintaining a separate SDL file.
- **Schema-first**: Write `.graphql` SDL files and generate types with GraphQL Code Generator. Better for multi-language teams or when the schema is a shared contract.

## Defining Types and Queries with Pothos

```ts
// src/schema/todo.ts
import { builder } from '../builder';
import { db } from '../db';

const Todo = builder.prismaObject('Todo', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    completed: t.exposeBoolean('completed'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

builder.queryField('todos', (t) =>
  t.prismaField({
    type: [Todo],
    args: {
      status: t.arg.string({ required: false }),
    },
    resolve: async (query, _root, args) => {
      const where = args.status === 'completed' ? { completed: true }
        : args.status === 'active' ? { completed: false }
        : {};
      return db.todo.findMany({ ...query, where });
    },
  })
);
```

## Mutations with Input Validation

```ts
// src/schema/todo.ts (continued)
const CreateTodoInput = builder.inputType('CreateTodoInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
  }),
});

builder.mutationField('createTodo', (t) =>
  t.prismaField({
    type: Todo,
    args: { input: t.arg({ type: CreateTodoInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.session?.user) throw new GraphQLError('Not authenticated');
      if (args.input.title.length === 0) throw new GraphQLError('Title is required');
      return db.todo.create({
        ...query,
        data: { title: args.input.title, userId: ctx.session.user.id },
      });
    },
  })
);
```

## Resolver Patterns

- **Keep resolvers thin** — business logic belongs in a service layer, not in resolver functions.
- **Use DataLoader for N+1 prevention** — batch related lookups instead of querying inside field resolvers.
- **Pagination** — Use cursor-based pagination (Relay connection pattern) for large lists.

## Auth

Pass the session into the GraphQL context and check it in resolvers or with field-level auth:

```ts
// Context creation
export function createContext(req: Request) {
  const session = await getSession(req);
  return { session, db };
}
```

For field-level auth, use Pothos auth plugins or custom directives rather than manual checks in every resolver.

## Error Handling

Use `GraphQLError` with `extensions` for machine-readable error codes:

```ts
import { GraphQLError } from 'graphql';

throw new GraphQLError('Todo not found', {
  extensions: { code: 'NOT_FOUND', todoId: id },
});
```

Don't expose internal error details to clients. Use a format error function to sanitize unexpected errors in production.

## Client

- **urql** — Lightweight, good defaults, easier to learn. Prefer for most projects.
- **Apollo Client** — More features (normalized cache, local state). Use when you need fine-grained cache control.

### Client query example (urql)

```tsx
import { useQuery, useMutation } from 'urql';

const TodosQuery = graphql(`
  query Todos($status: String) {
    todos(status: $status) { id title completed }
  }
`);

function TodoList() {
  const [{ data, fetching }] = useQuery({ query: TodosQuery, variables: { status: 'all' } });

  if (fetching) return <Spinner />;
  return data?.todos.map(todo => <TodoItem key={todo.id} todo={todo} />);
}
```

## Guidelines

- Use code-first schema (Pothos/Nexus) in TypeScript projects for type safety.
- Keep resolvers thin — delegate to services.
- Always use DataLoader for related-entity fetching to prevent N+1 queries.
- Paginate list queries with cursors, not offsets.
- Validate mutation inputs explicitly — GraphQL's type system alone is not sufficient for business rules.
- Use `extensions.code` in errors for client-side error handling.

## Checklist

- [ ] Schema defined code-first (Pothos/Nexus) or SDL with codegen.
- [ ] Resolvers delegate to service layer.
- [ ] DataLoader used for batched field resolution.
- [ ] Auth checked via context, not per-resolver boilerplate.
- [ ] Errors use `GraphQLError` with `extensions.code`.
- [ ] List queries support pagination.
