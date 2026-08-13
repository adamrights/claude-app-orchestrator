# Expected output

From the verified build (issue #50). `app/` is gitignored per `examples/built/.gitignore`.

## Commit sequence

```
chore: scaffold from vite-react-tailwind                 Phase 1
feat(shared): firehose-shell …                           Pre-Wave (dataset, store, stubs, react-virtual install)
feat: event-stream — windowed 50k list …                 Wave 0 ┐
feat: event-filter — deferred text + transition facets … Wave 0 ├ parallel worktrees, manifests git-verified
feat: inspector — lazy panel, separate chunk …           Wave 0 ┘
merge ×3 + feat(wave-0) commit
test: page-level perf-behavior tests …                   Wave 1 (orchestrator-direct)
chore: integration fixes and cleanup                     Phase 3
perf: defer the stream subtree, dim stale results        Audit #1 (P1 — the headline finding)
perf: remove unused TanStack Query from entry bundle     Audit #2 (−8.4 kB gz)
perf: stop importing env validator at boot               Audit #3 (−12.6 kB gz)
perf: drop react-router for the single static route      Audit #4 (−20.3 kB gz)
docs: performance audit report and build report finalization
```

## Numbers that must hold

- Entry bundle ≤ ~180 kB raw / ~57 kB gzip; `InspectorDetail-*.js` exists as a separate chunk
- DOM row count with 50k events: bounded (< 60; measured ~31)
- 26 vitest green, incl. the dist-parsing chunk assertion; Lighthouse perf ≈ 1.00, TBT 0, CLS 0

## Tree (top level)

```
app/
├── BUILD_REPORT.md + .claude-build/map.yaml   # incl. audit findings & before/after
├── src/data/events.ts                         # seeded deterministic 50k events
├── src/store/explorer.ts                      # useSyncExternalStore + memoized filter selector
├── src/features/{stream,filter,inspector}/    # one dir per wave-0 worker, per declared touches
└── src/pages/ + src/main.tsx                  # static shell (router removed by audit #4)
```
