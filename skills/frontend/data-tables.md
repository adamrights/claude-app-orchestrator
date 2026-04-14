---
tags: [data-tables, tanstack-table, server-pagination, sort, filter, search, column-visibility, row-selection]
---

# Data Tables

## When to use
Any list of records with more than ~20 rows: admin panels, search results, reports, CRM list views, inbox-style interfaces, audit logs. If the dataset could ever grow past a single screen, build a real data table — don't fake it with a loop over `<div>`s.

## Guidelines

- **Use TanStack Table v8** (headless) for row/column logic. Pair with **TanStack Query** for server data fetching. Don't reach for ag-Grid or MUI DataGrid unless you specifically need their heavy features.
- **All table state lives in URL search params** — page, pageSize, sort, filters, search. This makes deep-linking work, the back button do the right thing, and state survives reload. Use `useSearchParams` (Next.js) or `useSearch` (TanStack Router).
- **Server-side sort / filter / paginate.** Never ship the full result set to the browser. The API owns the query; the client renders the current page.
- **Debounce search input at 300ms** before hitting the URL — otherwise every keystroke is a navigation + fetch.
- **Persist column visibility and column ordering to localStorage** under a stable key (e.g., `table:users:columns`). Don't put view preferences in the URL — they're user-level, not link-level.
- **Use `placeholderData: keepPreviousData`** from TanStack Query so the old page stays visible during pagination instead of flashing a spinner.
- **Empty, loading, error, and zero-results are four distinct states.** Design each explicitly: empty = no data exists yet ("Create your first..."), zero-results = filters eliminated everything ("Try clearing filters"), loading = first fetch, error = fetch failed.
- **Row selection:** checkbox column, support select-all-on-page and select-all-across-pages. The latter is a boolean flag, not an array of every id — the server interprets it (`selectAll: true, excludeIds: [...]`).
- **Keyboard accessibility**: arrow keys navigate rows, Enter opens detail, Space toggles selection. Announce sort changes via `aria-live`.

## Examples

### API endpoint shape

```ts
// GET /api/users?page=2&pageSize=25&sort=name.asc&q=foo&role=admin
type ListResponse<T> = {
  data: T[];
  pageInfo: { total: number; page: number; pageSize: number };
};
```

### Query hook with URL search param sync

```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

export function useUsersTable() {
  const params = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '25');
  const sort = params.get('sort') ?? 'createdAt.desc';
  const q = params.get('q') ?? '';

  return useQuery({
    queryKey: ['users', { page, pageSize, sort, q }],
    queryFn: () =>
      fetch(`/api/users?${new URLSearchParams({
        page: String(page), pageSize: String(pageSize), sort, q,
      })}`).then((r) => r.json() as Promise<ListResponse<User>>),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
```

### Full table component

```tsx
import {
  flexRender, getCoreRowModel, useReactTable, type ColumnDef,
} from '@tanstack/react-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';

const columns: ColumnDef<User>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()} />
    ),
    cell: ({ row }) => (
      <input type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()} />
    ),
  },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
];

export function UsersTable() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, isLoading, isError } = useUsersTable();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const deferred = useDeferredValue(search);

  // Debounced push to URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (deferred) next.set('q', deferred); else next.delete('q');
      next.set('page', '1');
      router.replace(`?${next}`);
    }, 300);
    return () => clearTimeout(t);
  }, [deferred]);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    rowCount: data?.pageInfo.total ?? 0,
  });

  if (isError) return <ErrorState onRetry={() => location.reload()} />;
  if (isLoading) return <TableSkeleton rows={10} />;
  if (data && data.data.length === 0) {
    return params.get('q')
      ? <ZeroResultsState onClear={() => router.replace('?')} />
      : <EmptyState />;
  }

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users..." aria-label="Search users" />
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} onClick={() => toggleSort(h.id)}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} data-selected={row.getIsSelected()}>
              {row.getVisibleCells().map((c) => (
                <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination total={data!.pageInfo.total} page={data!.pageInfo.page} pageSize={data!.pageInfo.pageSize} />
    </>
  );
}
```

## Checklist
- [ ] URL reflects current state (paste URL produces identical view)
- [ ] Previous page data stays visible during page change (no empty flash)
- [ ] Empty / loading / error / zero-results are four distinct UIs
- [ ] Search input debounced at 300ms before triggering fetch
- [ ] Column visibility and order persist to localStorage
- [ ] Row selection supports select-all-on-page and select-all-across-pages
- [ ] Keyboard accessible: arrow keys between rows, Enter opens detail
- [ ] Screen reader announces sort and page changes via aria-live
