# firehose — the performance reference app

A 50,000-event log explorer SPA whose *point* is the React performance skill set: every perf technique in the catalog is load-bearing here, test-enforced, and was verified in a live orchestrator build (issue #50, 2026-08-13).

```
/orchestrate examples/built/firehose/blueprint.yaml ./firehose
```

## What it demonstrates

| Technique | Where | Enforced by |
|-----------|-------|-------------|
| Windowed rendering (`@tanstack/react-virtual`) | `event-stream` | test: DOM holds ~31 rows against all 50k events (< 60 asserted) |
| Concurrent filtering (`useDeferredValue` + `useTransition`) | `event-filter` + stream consumption | test: typing never blocks; stale results render dimmed |
| Code splitting (`React.lazy`) | `inspector` | test parses `dist/` and asserts a separate chunk (1.02 kB gz) |
| Parallel build with declared `touches:` | all three Wave-0 features | git-verified manifest confinement |

## The build's headline lesson

The **React Performance Auditor** ran as the final phase (its first-ever dispatch) and caught a subtle real bug: `useDeferredValue` guarded only the result *count*, while the expensive 50k-row subtree still rendered in the urgent keystroke lane. Fixing that — plus stripping template baggage the app didn't use (TanStack Query, boot-time env validation, react-router for one static route) — cut the entry bundle **321 → 177 kB (−42% gzip)** and took Lighthouse perf from 0.99 to 1.00. Audit trail: one measured commit per finding, see `EXPECTED_OUTPUT.md`.

Moral: the skills got the architecture right, and the auditor still found money on the table. Run `/audit` even on apps built by the book.

## Verification (independent re-run)

26/26 vitest (including the production-chunk assertion) · typecheck clean · `vite build` 485 ms · preview server serves the app · Build Map `status: done` with 10 done units.
