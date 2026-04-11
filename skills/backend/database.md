# Database Patterns

## When to use
When setting up or querying databases in a fullstack application.

## ORM: Prisma

### Schema Definition
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}
```

### Common Queries
```tsx
// Find with relations
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: { where: { published: true } } },
});

// Transaction
const [post, user] = await prisma.$transaction([
  prisma.post.create({ data: postData }),
  prisma.user.update({ where: { id: authorId }, data: { postCount: { increment: 1 } } }),
]);
```

## ORM: Drizzle

```tsx
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## Guidelines
- Always use migrations — never modify production schemas manually.
- Index columns used in WHERE, JOIN, and ORDER BY clauses.
- Use connection pooling in serverless environments (e.g., Prisma Accelerate, pgBouncer).
- Soft-delete when data retention matters: add `deletedAt` column.
