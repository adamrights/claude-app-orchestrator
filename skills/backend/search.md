---
tags: [search, full-text-search, postgres-fts, meilisearch, typo-tolerance, faceting]
---

# Search

## When to use
Any list endpoint where the user types a free-text query. Pick the engine based on scale and feature needs:

- **Postgres FTS** — small/medium apps (<1M rows), simple keyword search, no typo tolerance needed. Zero new infrastructure.
- **Meilisearch / Typesense** — self-hosted, typo tolerance, faceting, instant ranking out of the box.
- **Algolia** — hosted, largest scale, commercial pricing.

Don't reach for Elasticsearch unless you have a team to operate it.

## Guidelines

- **Postgres FTS setup:** add a generated `tsvector` column, index it with GIN. Query with `websearch_to_tsquery` (accepts Google-style syntax) — not `to_tsquery` which errors on unbalanced input.
- **Trigram fuzzy matching:** enable `pg_trgm` extension for `ILIKE`-style fuzzy with GIN indexes. Layer it as a fallback when FTS returns zero hits.
- **Meilisearch sync:** use the outbox pattern (write to DB + outbox table in one tx, drain outbox → Meili) or CDC (Debezium → Meili) for large volumes. Avoid dual-writes from app code — they drift on failure.
- **Ranking:** Postgres `ts_rank(tsvector, tsquery)` gives a relevance score. Always break ties with a stable secondary sort (usually `createdAt DESC` and `id DESC`) or pagination cursors will be unstable.
- **Faceting:** show counts per category alongside results. Postgres: separate `GROUP BY` query (or `GROUPING SETS`). Meilisearch: pass `facets: ['category', 'status']` and it returns them.
- **Pagination with search:** cursor on `(score, id)` tuple — offset pagination on ranked results is unstable and expensive. For Meilisearch, use its native pagination cursors.
- **Debounce input** at 300ms on the client. **Rate-limit the endpoint** server-side too (see `rate-limiting.md`) — search is typically expensive.
- **Empty query short-circuit:** if `q` is empty or <2 chars, return recent items (`ORDER BY createdAt DESC LIMIT N`). Don't run the full-text query.
- **Sanitize input** based on engine rules. For Postgres `to_tsquery`, escape `&|!():*`. `websearch_to_tsquery` handles this for you — prefer it.
- **Highlight matches** in results: Postgres `ts_headline`, Meilisearch `_formatted` field. Wrap in `<mark>` on the client.

## Examples

### Prisma schema with generated tsvector column

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  body      String
  createdAt DateTime @default(now())
  // Raw SQL migration adds:
  //   ALTER TABLE "Post" ADD COLUMN search_vector tsvector
  //     GENERATED ALWAYS AS (
  //       setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
  //       setweight(to_tsvector('english', coalesce(body,'')),  'B')
  //     ) STORED;
  //   CREATE INDEX post_search_idx ON "Post" USING GIN (search_vector);
}
```

### Full-text query with ranking and cursor pagination

```ts
async function searchPosts(q: string, cursor?: { score: number; id: string }, size = 25) {
  if (q.trim().length < 2) {
    return db.$queryRaw<Post[]>`
      SELECT * FROM "Post" ORDER BY "createdAt" DESC, id DESC LIMIT ${size}
    `;
  }
  return db.$queryRaw<(Post & { score: number })[]>`
    SELECT p.*,
           ts_rank(p.search_vector, websearch_to_tsquery('english', ${q})) AS score,
           ts_headline('english', p.body, websearch_to_tsquery('english', ${q})) AS headline
    FROM "Post" p
    WHERE p.search_vector @@ websearch_to_tsquery('english', ${q})
      ${cursor ? Prisma.sql`AND (score, id) < (${cursor.score}, ${cursor.id})` : Prisma.empty}
    ORDER BY score DESC, id DESC
    LIMIT ${size}
  `;
}
```

### Faceted counts (Postgres)

```ts
const facets = await db.$queryRaw<{ category: string; count: bigint }[]>`
  SELECT category, COUNT(*) AS count FROM "Post"
  WHERE search_vector @@ websearch_to_tsquery('english', ${q})
  GROUP BY category ORDER BY count DESC
`;
```

### Meilisearch setup + sync hook

```ts
import { MeiliSearch } from 'meilisearch';
const client = new MeiliSearch({ host: env.MEILI_URL, apiKey: env.MEILI_KEY });
const index = client.index('posts');

// One-time configuration
await index.updateSettings({
  searchableAttributes: ['title', 'body', 'tags'],
  filterableAttributes: ['category', 'status', 'authorId'],
  sortableAttributes: ['createdAt'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'exactness', 'createdAt:desc'],
});

// Sync via outbox drain
export async function syncPost(id: string) {
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return index.deleteDocument(id);
  await index.addDocuments([{ ...post, createdAt: post.createdAt.getTime() }]);
}

// Query
const results = await index.search(q, {
  limit: 25, facets: ['category'],
  filter: `status = "published"`,
  attributesToHighlight: ['title', 'body'],
});
```

## Checklist
- [ ] Engine chosen based on scale and typo-tolerance needs
- [ ] GIN index on `tsvector` column (Postgres) or sync pipeline (Meilisearch)
- [ ] `websearch_to_tsquery` or engine-safe input sanitization
- [ ] Empty/short query short-circuits to recent-items query
- [ ] Cursor pagination on `(score, id)`, not offset
- [ ] Secondary sort breaks ranking ties deterministically
- [ ] Search endpoint rate-limited server-side; client debounces at 300ms
- [ ] Facet counts returned alongside results
- [ ] Match highlights rendered with `<mark>`
