# Client-Side Persistence

## When to use

Any app that stores user data in the browser — localStorage-backed tools with no server, offline-capable apps, or draft/preference caching alongside a real API. This skill covers choosing the storage layer, surviving schema change, and failing gracefully; pair it with `state-management` for the in-memory side and `validation` for the schemas.

## Guidelines

- **Pick storage by data shape, not habit.** `localStorage` for small (< ~1MB), synchronous-read state — settings, a personal list, a draft. `IndexedDB` for large collections, blobs, or anything queried by index. OPFS only for file-like data. If you're `JSON.parse`-ing multi-megabyte strings on boot, you're in the wrong tier.
- **Version every storage key** (`app.books.v1`). A shape change bumps the version and ships a migration that reads `v{n-1}` and writes `v{n}` — never mutate the meaning of an existing key in place.
- **Validate on every load.** Storage is user-editable, extension-editable, and survives old app versions; treat it as untrusted input. Parse with a Zod schema and degrade to a defined default (usually empty state) on failure — never crash the app on corrupt storage.
- **Writes are best-effort.** `setItem` throws on quota exceeded and in some private-browsing modes. Catch, keep the in-memory state authoritative, and (if the data matters) surface a "changes aren't being saved" notice — silent catch is fine only for genuinely disposable state.
- **One module owns the codec.** Centralize key, schema, load, and save in a single module; components talk to a hook/store, never to `localStorage` directly. This is what makes the migration and validation rules enforceable.
- **Inject the storage.** Give load/save an injectable `Pick<Storage, 'getItem'>`/`'setItem'` parameter (defaulting to `localStorage`) so tests can pass a fake without stubbing globals.
- **Sync across tabs when it matters.** Two tabs of the same app will clobber each other's writes. If that's a real scenario, subscribe to the `storage` event (fires in *other* tabs) via `useSyncExternalStore`; if it isn't, say so in a comment and skip the machinery.
- **Persist state, not derivations.** Store the source data; recompute filtered/sorted/aggregated views on load. Persisted derivations go stale and disagree with their inputs.

## Examples

```ts
// store/books.ts — one module owns key, schema, and codec
import { z } from 'zod';

export const STORAGE_KEY = 'shelfmark.books.v1';

const bookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['want', 'reading', 'finished']),
});
export type Book = z.infer<typeof bookSchema>;

export function loadBooks(storage: Pick<Storage, 'getItem'> = localStorage): Book[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = z.array(bookSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : []; // corrupt ⇒ defined default, not a crash
  } catch {
    return [];
  }
}

export function saveBooks(books: Book[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // quota / private mode: memory stays authoritative
  }
}
```

```ts
// Hook: reducer initialized from storage, persisted on change
export function useBooks() {
  const [books, dispatch] = useReducer(booksReducer, undefined, () => loadBooks());
  useEffect(() => saveBooks(books), [books]);
  return [books, dispatch] as const;
}
```

```ts
// Migration on version bump: v1 books gain an addedAt
const V1_KEY = 'shelfmark.books.v1';
export const STORAGE_KEY = 'shelfmark.books.v2';

export function loadBooks(storage: Pick<Storage, 'getItem'> = localStorage): Book[] {
  const v2 = readValidated(storage, STORAGE_KEY, v2Schema);
  if (v2 !== null) return v2;
  const v1 = readValidated(storage, V1_KEY, v1Schema);
  if (v1 !== null) return v1.map((b) => ({ ...b, addedAt: new Date(0).toISOString() }));
  return [];
}
```

```ts
// Test with an injected fake — no global stubbing
it('round-trips through storage', () => {
  const backing = new Map<string, string>();
  const storage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
  };
  saveBooks([book], storage);
  expect(loadBooks(storage)).toEqual([book]);
});
```

## Checklist

- [ ] Storage tier chosen deliberately (localStorage / IndexedDB / OPFS) and noted
- [ ] Every key is versioned; shape changes ship a migration, not an in-place mutation
- [ ] Loads validate with a schema and degrade to a defined default on corrupt data
- [ ] Saves catch quota/availability errors; user is warned if the data is non-disposable
- [ ] One module owns key + schema + codec; components go through a hook/store
- [ ] Load/save take an injectable storage for tests
- [ ] Cross-tab sync implemented or explicitly ruled out in a comment
- [ ] Tests cover: round-trip, corrupt JSON, schema-invalid data, migration (if any)
