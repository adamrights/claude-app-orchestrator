# Validation Report — Tabletop Walkthrough

Generated: 2026-04-17
Methodology: read `agents/orchestrator.md` end to end; trace each phase against
`examples/built/helpdesk/blueprint.yaml`; identify gaps, ambiguities, broken
assumptions. Not executed — pure static analysis.

## Automated checks (from check-references.mjs)

- Skill mapping complete: 36/36 paths exist; 36 skills mapped of 36 found
- Agent skill references: 20 agents scanned, all references resolve
- Agent-to-agent references: 20 agents scanned, all referenced agents exist
- Template references: 3/3 templates referenced exist
- Blueprint skill references: 6/6 blueprints validate
- Orphaned skills: none

The automated layer is clean. Findings below come from reading instructions
narratively against the helpdesk blueprint.

---

## Phase 0 — Plan Execution Graph

Phase 0 walks `execution: auto` (`blueprint.yaml:216`), builds the dependency
graph from explicit `depends_on` plus six implicit rules
(`orchestrator.md:77-89`), groups features into waves, applies safety
heuristics, and marks splittable features.

The blueprint declares no `shared_resources:` extension and no per-feature
`touches:` manifests, so several Phase 0 steps will need to fall back to
runtime negotiation with workers.

### [P0] Splittable detection mis-classifies five of thirteen features
**Where:** `agents/orchestrator.md:114-118` (rule), `:459-498` (Skill Mapping
Layer column), `examples/built/helpdesk/blueprint.yaml:222-316` (features)

**Issue:** A feature is "splittable" when its `skills` contain at least one
frontend skill AND at least one backend skill. The Layer column is the only
arbiter, and several mappings cause false positives on the helpdesk:

- `state-machines` is filed under **frontend** (`orchestrator.md:481`).
  `ticket-crud-api` (skills `api-design, database, validation, state-machines`)
  is therefore marked splittable even though the description ("Server Actions
  for createTicket, updateStatus, assignAgent, deleteTicket") is pure backend.
- `typescript-patterns` is **frontend** (`orchestrator.md:477`).
  `rbac-foundation` (`authentication, validation, typescript-patterns`) is
  splittable, but it is pure infra — no UI.
- `validation` is **backend** (`orchestrator.md:487`). `ticket-create`
  (`forms, validation, react-hooks`) is splittable, but it is a multi-step
  client form whose only "backend" is the single createTicket action already
  built by `ticket-crud-api`.
- `user-management` (`data-tables, forms, validation`) is splittable, but the
  picker also routes it to `admin-panel-builder`, which is itself a single
  agent that already builds both the list and the form — splitting fights the
  specialist.
- `auth` (`authentication, react-hooks`) is splittable. Auth setup is
  inherently a unified flow (provider config + session callback + middleware
  + first-signup hook); splitting along a contract is nonsensical here.

**Fix:** Either (a) add a feature-level `splittable: false` override that the
orchestrator honors before applying the rule, (b) refine the rule to require
at least one **non-utility** skill on each side (e.g. `react-component` /
`api-design` rather than `validation` / `state-machines`), or (c) fix the
Layer column where it disagrees with the skill's true scope (most cleanly:
move `state-machines` to "frontend or backend" / drop it from layer
classification).

**Impact when /orchestrate runs:** Five features unnecessarily enter the
layer-split workflow (Phase 2 Sub-Phases A, A.5, B, C). Each split spawns a
contract designer + validator + two parallel feature builders + an
integration step instead of one feature builder. For features whose backend
is non-existent (e.g. `ticket-create`) the backend builder will either crash
trying to "implement" a contract that has no DB writes or will silently
duplicate work already done by `ticket-crud-api`. For `auth`, the contract
designer has nothing meaningful to design.

### [P0] Server-actions protocol is a stub; ticket-crud-api routes to it
**Where:** `agents/orchestrator.md:278-284` (protocol selection),
`agents/contract-designer.md:225-234` (server-actions stub),
`examples/built/helpdesk/blueprint.yaml:237-240` (ticket-crud-api)

**Issue:** When a feature is splittable, the protocol picker reads
`package.json` and infers the protocol. For Next.js App Router projects with
"only server actions in the description" it picks `server-actions` — which is
explicitly a stub that either falls back to `rest-zod` or recommends building
without a layer split. `ticket-crud-api`'s description literally begins
"Server Actions for createTicket…" so the substring trigger fires. Combined
with the false-positive splittable mark above, the orchestrator will spin up
a contract-designer just to have it report "no contract; build as single
agent" — wasted round-trip with no clean instruction on how to recover the
skill list (the orchestrator says "spawn one Feature Builder with the full
`feature.skills`" — fine, but it never re-asserts that the picker rules
should re-run from the top, so the feature could land at the React Feature
Builder by default).

**Fix:** Add an explicit short-circuit: "If protocol resolves to a stub AND
the feature is in a Next.js App Router project, mark splittable=false and
re-run the picker." Document the recovery path explicitly in
`orchestrator.md:284`.

**Impact when /orchestrate runs:** Wasted contract-designer invocation,
then `ticket-crud-api` falls back to a single Feature Builder which then
re-runs the specialist picker — but the original picker already chose RSC
Architect because of "Server Actions" in the description (`orchestrator.md:221`).
The user gets two rounds of "did this match the right specialist?" anxiety.

### [P0] rbac-foundation feature collides with the rbac: section
**Where:** `agents/orchestrator.md:200-209` (RBAC Dispatch — runs in Wave 0),
`examples/built/helpdesk/blueprint.yaml:110-133` (rbac config),
`examples/built/helpdesk/blueprint.yaml:230-233` (rbac-foundation feature)

**Issue:** The orchestrator has a dedicated RBAC Dispatch step that invokes
the RBAC Specialist in Wave 0 to generate `src/lib/permissions.ts`,
`src/lib/roles.ts`, and `src/middleware/authorize.ts`
(`agents/rbac-specialist.md:26-130`). The helpdesk **also** declares
`rbac-foundation` as a feature whose description is "Permissions enum, role
utilities, server-action guard, page-level role middleware" — i.e. the same
files. Both will run; both will write the same paths; the second to merge
will hit the Shared Resource Arbitrator on `src/lib/permissions.ts` (which is
in the registry as `src/lib/*.ts` — `orchestrator.md:54`).

**Fix:** The orchestrator should detect "feature whose description duplicates
the RBAC Specialist's output" and either skip the RBAC Dispatch (let the
feature do it) or skip the feature (let the dispatch do it). Concretely:
when an `rbac:` section exists AND a feature names `rbac` / `permissions` /
`roles` in its name or description, prefer the dispatch and silently drop the
feature (or refuse the build with a hint to remove the duplicate).

**Impact when /orchestrate runs:** Best case: arbitrator reconciles into one
file but the feature's commit is empty or no-op. Worst case: the two
implementations diverge (the RBAC Specialist generates the simpler example
shape; the feature builder may add the helpdesk-specific permissions like
`tickets.read.own`) and the arbitrator hits ABORT, halting the build pending
user resolution.

### [P0] sla-timer-job feature collides with sla-deadline-checker job
**Where:** `agents/orchestrator.md:388-411` (Phase 2.7 jobs),
`examples/built/helpdesk/blueprint.yaml:150-155` (jobs),
`examples/built/helpdesk/blueprint.yaml:286-289` (sla-timer-job feature)

**Issue:** The blueprint has `jobs.sla-deadline-checker` (cron, every 15 min)
AND a Phase 2 feature `sla-timer-job` whose description ("Cron handler
invoked every 15 min; flags tickets past slaDeadline and emails assigned
agent") is functionally identical. Phase 2.7 will run the Background Jobs
Specialist for the job; Phase 2 will run an api-endpoint-builder for the
feature. Both target `src/jobs/`. There is no dedup rule.

**Fix:** Either remove the duplicate from the blueprint (preferred) or add an
orchestrator rule: "if a feature's name/description matches a `jobs:` entry,
skip the feature in Phase 2 and let Phase 2.7 own it." Document this clearly
near `orchestrator.md:393`.

**Impact when /orchestrate runs:** Two handler files will fight over
`src/jobs/sla-*.ts`. Even if names differ slightly, both will register
the same cron schedule, leading to double execution every 15 minutes and
duplicate notification emails — a real production-relevance bug if the user
deploys without noticing.

### [P1] Wave 3 exceeds 4-feature parallel cap; build silently degrades to sequential
**Where:** `agents/orchestrator.md:103-110` (safety heuristics),
`examples/built/helpdesk/blueprint.yaml:222-316` (features and depends_on)

**Issue:** Walking the explicit `depends_on` graph (ignoring implicit Rule 3
for a moment):
- Wave 0: `auth`
- Wave 1: `rbac-foundation`
- Wave 2: `ticket-crud-api`, `user-management` (depends only on rbac-foundation)
- Wave 3: `ticket-list-table`, `ticket-detail-page`, `ticket-create`,
  `ticket-search`, `agent-dashboard`, `email-notifications` — **6 features**
- Wave 4: `comment-thread` (depends on ticket-detail-page),
  `sla-timer-job` (depends on ticket-crud-api + email-notifications)
- Wave 5: `tests`

Wave 3 has 6 features; the safety heuristic rejects waves > 4. The
orchestrator falls back to **fully sequential mode** (`orchestrator.md:108-110`)
and tells the user the cap was hit. Sequential mode loses most of the
parallelism the helpdesk was designed to demonstrate.

**Fix:** Either (a) split the heuristic — allow parallel execution but cap
each wave at 4 by emitting wave 3a / 3b sub-waves, or (b) make the rejection
path more discriminating — only fall back to sequential if the offending wave
cannot be split. Option (a) is the user expectation: parallel within the
limit, serialized across the limit.

**Impact when /orchestrate runs:** The helpdesk build runs single-threaded
end-to-end. The user sees one of the splash example builds advertised as
parallel actually run sequentially with no opportunity for the user to opt
into batched parallel waves. Build time roughly doubles; not catastrophic but
demoralizing for a flagship example.

### [P1] Implicit Rule 3 (model overlap) collapses the wave plan further
**Where:** `agents/orchestrator.md:81` (Rule 3),
`examples/built/helpdesk/blueprint.yaml:222-316`

**Issue:** Rule 3 says "B depends on A if both mention the same model name."
Almost every helpdesk feature mentions `Ticket` (case-insensitive substring
match). Apply naively and `email-notifications`, `ticket-search`,
`ticket-detail-page`, `ticket-list-table`, `agent-dashboard`, `ticket-create`,
`comment-thread`, `sla-timer-job`, `user-management` all become serially
dependent on each other in declaration order — collapsing the graph to a near
straight line. This compounds with the Wave 3 size issue above.

**Fix:** Make Rule 3 weaker: it should only fire when both features
**modify** the model (write paths under `prisma/schema.prisma`-touching code),
not merely mention it in description. Or: only fire if both features name the
model in their `name` field. Or: drop the rule and rely on Rule 6 (schema
migration order) and Rule 7 (touches collision) which are more precise.

**Impact when /orchestrate runs:** Even after Wave 3 is split, the
ticket-themed features serialize unnecessarily. The "auth → rbac-foundation
→ ticket-crud-api spine is sequential but leaf features fan out" promise in
the blueprint comment (line 213) does not hold.

### [P1] Helpdesk features have no `touches:` manifests; Rule 7 forces a runtime round-trip
**Where:** `agents/orchestrator.md:85-89` (Rule 7),
`agents/feature-builder.md:24-46` (kickoff manifest)

**Issue:** Rule 7 explicitly says: "Rule 7 requires each feature to have a
`touches:` manifest. In `execution: auto` mode, the orchestrator reads the
manifest from the blueprint feature entry if present. Otherwise, it prompts
the Feature Builder for its kickoff declaration … before spawning the full
wave." None of the 13 helpdesk features declares one. So Phase 0 must
**partially spawn** every feature in a wave, capture each kickoff manifest,
arbitrate, and only then spawn the full wave. The orchestrator's Phase 2
spawn step (`orchestrator.md:241-266`) doesn't describe a "kickoff-only"
spawn mode — Feature Builder Step 0 declares manifests and waits, but the
orchestrator's prompt template says "Build this feature in your worktree" up
front.

**Fix:** Either (a) add `touches:` to each helpdesk feature in the blueprint,
or (b) document the two-stage spawn protocol explicitly in
`orchestrator.md:241-266` so the orchestrator agent knows to issue a kickoff
prompt first and wait for the manifest before issuing the build prompt.

**Impact when /orchestrate runs:** Ambiguity. The orchestrator agent might
either (a) skip the kickoff round-trip and discover collisions only at merge
time, or (b) issue the build prompt first and try to interrupt mid-build — a
race the protocol does not specify.

---

## Phase 1 — Scaffold

Phase 1 reads the blueprint, resolves the template (`stack.type: fullstack`
→ `nextjs-prisma-tailwind`, unambiguous per `orchestrator.md:165-168`), copies
template files, substitutes `{{name}}`, generates Prisma schema from the 5
models, and runs `npm install` + `npx prisma generate`.

### [P1] Schema generator is under-specified for relation backrefs
**Where:** `agents/orchestrator.md:147-151` (Step 6),
`examples/built/helpdesk/blueprint.yaml:40-102` (models)

**Issue:** The blueprint declares `User.tickets: Ticket[]` AND
`User.assignedTickets: Ticket[]`, both pointing to `Ticket` but via different
foreign keys (`Ticket.customer: User @relation` and
`Ticket.assignedAgent: User? @relation`). Prisma requires either named
relations (`@relation("CustomerTickets")`) or it will fail with "ambiguous
relation" at `prisma generate`. The blueprint has no relation names. The
orchestrator's Step 6 says "write `prisma/schema.prisma`" without explaining
how to disambiguate dual relations.

**Fix:** Either (a) document in `orchestrator.md:147-151` that the schema
generator must auto-generate relation names when two relations point to the
same model, or (b) require the blueprint to spell relation names explicitly
in such cases. The blueprint should be updated either way — without it
`prisma generate` in step 8 will fail.

**Impact when /orchestrate runs:** `npx prisma generate` aborts in Phase 1
step 8 with an ambiguous-relation error. Build halts before any feature
runs.

### [P2] Initial commit message convention is ambiguous between phases
**Where:** `agents/orchestrator.md:157` (initial commit),
`agents/orchestrator.md:340-349` (wave commit),
`agents/orchestrator.md:73-77` (per-feature commits in feature-builder.md)

**Issue:** Phase 1 commits as `chore: scaffold from {template}`. Phase 2
commits per-feature as `feat: {feature.name} - {feature.description}`. Phase
2 also wave-commits as `feat(wave-{n}): …`. Phase 1.5 integrations commit as
`chore(integration): {service}`. There is no single style guide stating which
prefix means what. A user reading `git log --oneline` sees mixed conventions.
Cosmetic but confusing.

**Fix:** Add a single "Commit message conventions" section to
`orchestrator.md` enumerating the prefixes per phase.

**Impact when /orchestrate runs:** Mostly cosmetic; user log readability.

---

## Phase 1.5 — Integrations

The helpdesk has `integrations: [resend]`. Phase 1.5 invokes the Integration
Specialist with the entry; the specialist installs `resend`, appends
`RESEND_API_KEY` to `.env.example`, creates a Zod env validator at
`src/env.ts` (or appends to it), and writes
`src/integrations/resend.ts`.

### [P1] Phase 1.5 is "BEFORE any feature waves" but Pre-Wave RBAC Dispatch is also "Wave 0"
**Where:** `agents/orchestrator.md:172-181` (Phase 1.5),
`agents/orchestrator.md:185-198` (Pre-Wave Shared),
`agents/orchestrator.md:200-209` (RBAC Dispatch in Wave 0)

**Issue:** Phase 1.5 says "BEFORE any feature waves." Pre-Wave Shared
Primitives says "BEFORE any feature wave (conceptually Wave -1)." RBAC
Dispatch says "in Wave 0, before features that need authorization." For the
helpdesk the order is unclear: is it (1) integrations → shared → RBAC →
features, or (2) shared → integrations → RBAC → features, or are
integrations and shared concurrent? The text never resolves the relative
ordering of Phase 1.5, Pre-Wave Shared, and RBAC Dispatch.

**Fix:** State the canonical order explicitly (recommended:
`Phase 1 → Phase 1.5 → Pre-Wave Shared → RBAC Dispatch as part of
Wave 0 → feature waves`). Add a one-line summary at the top of each section
saying "Runs after X, before Y."

**Impact when /orchestrate runs:** A careful agent will pick a defensible
order; a sloppy one might run RBAC Dispatch concurrently with the Resend
integration (no actual collision in this case, but the protocol is unsound).

### [P1] Integration env vars are not handed to feature-builders
**Where:** `agents/orchestrator.md:177-180` (Integration Specialist
invocation), `agents/orchestrator.md:249-262` (Feature Builder prompt
template)

**Issue:** The Integration Specialist creates `src/integrations/resend.ts`
and adds `RESEND_API_KEY` to `.env.example`. But the feature
`email-notifications` (skill `api-design`, description "Send transactional
email on ticket assignment, new comment, and status change to resolved") gets
the standard Feature Builder prompt template — which says nothing about the
existence of `src/integrations/resend.ts`. The agent has no signal that
"transactional email" should map to importing
`@/integrations/resend` rather than installing its own SDK or hand-rolling
SMTP.

**Fix:** When dispatching a feature-builder for any feature whose name or
description references an installed integration, append a context line:
"Available integrations: { resend → import from `@/integrations/resend` }."
The orchestrator already knows what integrations were installed in Phase 1.5
(it ran them); plumbing that into the prompt is a mechanical addition.

**Impact when /orchestrate runs:** `email-notifications` may install Resend
a second time, or hand-roll its own client, instead of using the typed
wrapper. End-to-end the build still works (both clients hit the same env
var), but the architecture documented in the blueprint comment ("typed
client at lib/email.ts so feature code never touches the raw SDK") is
violated.

---

## Phase 2 — Build Features

### Specialist dispatch table

For each helpdesk feature, the Phase 2 picker (`orchestrator.md:219-228`)
runs first-match-wins. Below is the trace.

| Feature | Picker rule that matches | Specialist | Confidence |
|---------|--------------------------|------------|------------|
| auth | (no match in picker; falls through to "API route, database query, or server logic") | api-endpoint-builder | low (auth setup is not really an API route; should route to a dedicated auth specialist that doesn't exist) |
| design-system (shared, not Phase 2) | "design system" / "primitives" → first-UI rule | design-system-builder | high |
| rbac-foundation | "server-action guard" matches RSC Architect "server action" substring rule | rsc-architect | low (wrong specialist; should be a dedicated infra builder, and the rbac: section already produces this output) |
| ticket-crud-api | "Server Actions for createTicket" matches RSC Architect "server action" substring rule | rsc-architect | medium (rsc-architect can write server actions, but ticket-crud-api is API-shaped, not a page; api-endpoint-builder is closer) |
| ticket-list-table | "table" / "paginated" → Data Table Builder | data-table-builder | high |
| ticket-detail-page | "RSC ticket detail page" → RSC Architect | rsc-architect | high |
| comment-thread | (no specific UI rule matches) → React Feature Builder | react-feature-builder | high |
| ticket-create | "Multi-step new-ticket form" → no special rule matches → React Feature Builder | react-feature-builder | medium (but mis-flagged splittable; see Phase 0 finding) |
| ticket-search | (no rule matches) → API Endpoint Builder | api-endpoint-builder | high |
| agent-dashboard | "metrics dashboard" → Dashboard Builder | dashboard-builder | high (but feature-listed skills don't match dashboard-builder's loaded skills; see [P2] below) |
| sla-timer-job | (no rule for jobs) → API Endpoint Builder, OR Phase 2.7 routes it twice | ambiguous | low (duplicates the jobs: section; see [P0] above) |
| email-notifications | (no rule matches "email") → API Endpoint Builder | api-endpoint-builder | medium (no integration context handed off; see [P1] above) |
| user-management | "Admin panel" / "manage" → Admin Panel Builder | admin-panel-builder | high (but mis-flagged splittable; see Phase 0 finding) |
| tests | (no test rule in picker) → falls through to React Feature Builder | react-feature-builder | low (should route to a test-writer specialist) |

### [P1] No specialist for `auth`
**Where:** `agents/orchestrator.md:219-228` (picker rules),
`examples/built/helpdesk/blueprint.yaml:224-226`

**Issue:** The picker rules have no entry for "auth", "authentication",
"OAuth", "NextAuth", "session". `auth` will fall through to the catch-all
"API route, database query, or server logic" → API Endpoint Builder. But the
auth feature is a multi-file setup (NextAuth route handler, middleware,
session callback, db adapter, providers config) that doesn't look like an
"API endpoint." API Endpoint Builder will treat it as one route, miss the
middleware and adapter wiring, and the user will be left with a broken auth
flow.

**Fix:** Either (a) add an Authentication Specialist agent and a picker rule
for it, or (b) extend the API Endpoint Builder workflow to recognize "auth"
features and pull in NextAuth's specific setup checklist.

**Impact when /orchestrate runs:** Auth is the spine of every other feature.
A botched auth setup blocks `rbac-foundation`, every gated page, and every
RBAC test. High likelihood of build wedging in Wave 0.

### [P1] No specialist for `tests`; tests feature falls through
**Where:** `agents/orchestrator.md:219-228`,
`examples/built/helpdesk/blueprint.yaml:307-316`

**Issue:** The `tests` feature has skills `react-testing, e2e-testing` and
depends on six earlier features. None of the picker rules mention testing.
It falls through to React Feature Builder, which is not a test-writer agent.
Phase 0 Rule 5 also kicks in ("test → impl: A depends on every prior
non-test feature") so it correctly lands in the last wave, but the wrong
specialist will be running it.

**Fix:** Add a Test Writer specialist (and a picker rule for it) or extend
react-feature-builder.md with a "when feature.skills includes
react-testing/e2e-testing" branch.

**Impact when /orchestrate runs:** Phase 2 produces a test feature whose
output is mostly empty React components named "tests" — the test suite the
blueprint advertises (RTL + Playwright on critical paths) does not get
written.

### [P2] Specialist skill lists do not intersect feature skill declarations
**Where:** `agents/dashboard-builder.md:28-36`,
`agents/data-table-builder.md:31-41`,
`examples/built/helpdesk/blueprint.yaml:244-282`

**Issue:** Several specialists hard-code their own `Skills to load` list. The
feature's declared `skills:` are not always a subset:

- `agent-dashboard` feature lists `server-components, data-tables,
  web-vitals`. `dashboard-builder` loads `react-component, data-fetching,
  performance, styling, api-design, database` — zero overlap. The
  user-declared intent (server components, web-vitals budget) is silently
  dropped.
- `ticket-list-table` feature lists `server-components` among others;
  `data-table-builder` does not load it.
- `ticket-detail-page` is fine (RSC architect loads server-components).

**Fix:** Either (a) change Phase 2 to load the **union** of the picker's
skills + the feature's declared skills before invoking the specialist, or
(b) document explicitly that specialists own their skill list and feature
skill declarations are advisory only.

**Impact when /orchestrate runs:** The dashboard does not get the web-vitals
budget treatment the blueprint asked for; the table is not built as an RSC
even though the blueprint requested server-components.

### [P2] First-match-wins picker hits "server action" before more specific rules
**Where:** `agents/orchestrator.md:221` (RSC Architect rule)

**Issue:** RSC Architect's substring trigger ("server action") fires before
Admin Panel Builder, Data Table Builder, etc. Any feature whose description
mentions Server Actions — even an admin panel that uses them — routes to RSC
Architect first. The helpdesk does not currently trip this except in
ticket-crud-api and rbac-foundation, but it's a sharp edge for future
blueprints.

**Fix:** Re-order the picker so domain-specific specialists (Data Table,
Admin Panel, Dashboard) run before generic patterns (RSC, server-action).
Or: tighten RSC's trigger to require "page" or "route" alongside "server
action".

**Impact when /orchestrate runs:** rbac-foundation routes to RSC Architect,
which is the wrong specialist for a permissions module.

### [P2] Wave commit uses --allow-empty
**Where:** `agents/orchestrator.md:344-348`

**Issue:** `git commit --allow-empty -m "feat(wave-{n}): …"` runs after every
wave. If a wave's worker did its own commit and the merge was a fast-forward
no-op at wave-summary time, this produces a marker commit. Fine, but it
clutters `git log --oneline` for sequential mode where every wave is one
feature. Also: the `--allow-empty` will succeed even if all per-feature
commits silently failed, masking real failure.

**Fix:** Drop `--allow-empty` and only emit a wave-summary commit when more
than one feature was in the wave.

**Impact when /orchestrate runs:** Cosmetic log clutter; tiny risk of
masking failure modes.

---

## Phase 2.5 — Arbitrated Merge

Phase 2.5 detects shared-resource collisions from worker `touches.modify`
lists and dispatches the Shared Resource Arbitrator. Then runs the Migration
Specialist for any wave that mutated models.

### [P1] Migration Specialist is invoked per-wave but Phase 1 already wrote schema.prisma
**Where:** `agents/orchestrator.md:381-385`,
`agents/orchestrator.md:147-151`

**Issue:** Phase 1 step 6 generates the full Prisma schema from the
blueprint's `models` section before Phase 2 runs. The Migration Specialist is
invoked "after any wave that mutated `models`." But for the helpdesk all
five models are written in Phase 1; no feature wave should mutate
`prisma/schema.prisma`. If a feature builder does mutate it (it shouldn't, by
the contract — but ticket-crud-api might add a column for state-machine
metadata), the migration step generates a migration on a schema that wasn't
the result of an Phase 1 baseline migration. The first wave after Phase 1
has nothing to migrate against.

**Fix:** Generate a baseline `0_init` migration at the end of Phase 1 (run
`prisma migrate dev --name init` instead of `prisma generate`). Then
per-wave migrations have a sane base to diff against.

**Impact when /orchestrate runs:** First-time `npm run dev` after Phase 1
likely works (Prisma is fine with `db push` semantics) but the first feature
that touches a model-shape will produce a migration that conflicts with the
implicit baseline, leading to a confusing migration-history error in
production deploy.

---

## Phase 2.7 — Jobs & Webhooks

The helpdesk has one job (`sla-deadline-checker`) and no webhooks.

### [P0] Phase 2.7 duplicates work also done by sla-timer-job feature
See Phase 0 finding "sla-timer-job feature collides with sla-deadline-checker
job" above. This is the most acute Phase 2.7 issue.

### [P1] Job framework choice for Next.js: Inngest is "recommended" but requires manual setup
**Where:** `agents/background-jobs-specialist.md:34-37`

**Issue:** Background Jobs Specialist installs Inngest by default for
Next.js projects. Inngest requires a serve endpoint (the agent creates one)
**and** a running Inngest dev server (`npx inngest-cli@latest dev`) for local
development. The agent does not document this in the BUILD_REPORT or in the
project's CLAUDE.md. The user gets a job that compiles but never fires
locally because they don't know to run the dev server.

**Fix:** When installing Inngest, append to the project's CLAUDE.md a "Local
development" note documenting the dev-server command. Also add a bullet to
BUILD_REPORT's "Done" section listing the manual setup step.

**Impact when /orchestrate runs:** SLA timer job appears to work in dev (no
errors) but never fires. User notices only when SLA deadlines pass without
notification.

---

## Phase 3 — Integration & Review

Always sequential: full test suite, code-reviewer pass, fix critical/warning
issues, `npm run build`, finalize BUILD_REPORT.md.

### [P1] "Fix any critical or warning-level issues" is unbounded
**Where:** `agents/orchestrator.md:419-420`

**Issue:** The reviewer step says "Fix any critical or warning-level issues"
but provides no budget, no escalation path, and no "give up" criterion. If
the reviewer flags 50 warnings the orchestrator will spend an unbounded
amount of time chasing them.

**Fix:** Cap fix attempts (e.g., "Fix at most 10 critical-level issues; for
warnings, log them in BUILD_REPORT under a 'Known issues' section but do not
fix"). Or: define "critical" precisely.

**Impact when /orchestrate runs:** The build may appear stuck in Phase 3 for
a long time on a complex app like helpdesk.

### [P2] BUILD_REPORT's "Done" section asks for env vars list but doesn't say where to source it
**Where:** `agents/orchestrator.md:440`

**Issue:** "env vars the user still needs to set (with where to put them —
`.env.local`, etc.)". Source of truth: `.env.example` was assembled
incrementally by Phase 1.5 + RBAC Dispatch + features. The orchestrator must
diff `.env.example` against any preset values. The instruction doesn't say
"read `.env.example`."

**Fix:** Add: "Read the final `.env.example` and list every var without a
default value, grouped by integration / feature."

**Impact when /orchestrate runs:** Done section may omit env vars or list
them in inconsistent order, but the user can grep `.env.example` themselves.
Cosmetic.

---

## Cross-cutting findings

### [P0] Worker prompt template hard-codes "Build this feature in your worktree" but Step 0 requires a kickoff round-trip
**Where:** `agents/orchestrator.md:249-262` (prompt template),
`agents/feature-builder.md:24-46` (Step 0 kickoff)

**Issue:** The prompt template tells the worker to "Build this feature …
Run tests. Commit. Report back." Step 0 of the worker tells it to declare a
manifest and **wait for the orchestrator to accept or reject**. These two
contradict each other: a worker following the prompt literally would build
without waiting; a worker following its own workflow would block waiting for
acceptance the orchestrator never signals because the prompt didn't ask for
one.

**Fix:** Restructure the spawn protocol into two prompts: (1) "Declare your
touches manifest and stop" (kickoff prompt), and (2) "Manifest accepted —
build, test, commit, report" (build prompt). Document both in
`orchestrator.md` Phase 2 Step 1.

**Impact when /orchestrate runs:** Either workers ignore Step 0 (no
collision detection happens, defeating the whole shared-resource registry),
or workers stall waiting for an acceptance signal that never comes (5-minute
heartbeat timeout kicks in, all workers killed as stalled).

### [P1] BUILD_REPORT.md crash-recovery is described but not implemented in the spawn flow
**Where:** `agents/orchestrator.md:449-451`

**Issue:** "If the orchestrator restarts mid-build … the next run reads the
existing `BUILD_REPORT.md` first to determine which features have already
been committed (cross-check against `git log`). It resumes from the next
pending feature in the blueprint rather than re-running completed work." But
no Phase mentions "before starting, check for an existing BUILD_REPORT.md
and resume." Phase 1 just says "write `BUILD_REPORT.md` at the end of this
phase." On restart, Phase 1 will overwrite the existing report and re-run
the scaffold.

**Fix:** Add a "Phase -1: Resume Check" or modify Phase 1 to read existing
BUILD_REPORT before scaffolding. Document the resume protocol with concrete
git-log queries.

**Impact when /orchestrate runs (after a crash):** Re-runs from scratch,
losing partial progress. The crash-recovery promise is aspirational only.

### [P1] Layer-split protocol stub fallback path is non-deterministic
**Where:** `agents/orchestrator.md:284`,
`agents/contract-designer.md:217-234`

**Issue:** The contract-designer is told (for stubs) to "fall back to
rest-zod OR build without a layer split" — its choice. The orchestrator then
reads the report and either continues with rest-zod or treats it as
single-agent. So the eventual build path depends on which option the
contract-designer flips. Same blueprint, different runs, different
outcomes.

**Fix:** Make the orchestrator pick: e.g., "When protocol resolves to a stub,
the orchestrator automatically downgrades to single-agent mode without
invoking the contract-designer at all."

**Impact when /orchestrate runs:** Run-to-run variance on splittable
features whose protocol resolves to a stub. Reproducibility is degraded.

### [P2] The picker says "first UI feature in a multi-page app → design-system-builder" but design-system is already a `shared:` entry
**Where:** `agents/orchestrator.md:220`,
`examples/built/helpdesk/blueprint.yaml:162-165`

**Issue:** The blueprint declares `design-system` as a shared primitive
(Pre-Wave Shared). The picker's "first UI feature → design-system-builder"
rule could fire again on the first Phase 2 UI feature (e.g.,
ticket-list-table) and re-run the design-system-builder. The orchestrator
should detect "design-system already shared-built" and skip the auto-prompt.

**Fix:** Add: "Skip the 'first UI feature' prompt if a design-system shared
entry was already built in Pre-Wave."

**Impact when /orchestrate runs:** ticket-list-table may waste time
regenerating Button/Input/etc., or worse, overwrite the helpdesk-tuned
versions from the shared build.

### [P2] No agent owns generating the `src/env.ts` Zod validator before features need it
**Where:** `agents/integration-specialist.md:46-58`,
`agents/orchestrator.md:153` (config module),
`agents/orchestrator.md:178` (integration env vars)

**Issue:** The Integration Specialist creates `src/env.ts` if it does not
exist, otherwise appends to it. The Phase 1 step 7 config module also writes
to `src/lib/config.ts` (not `src/env.ts`). The helpdesk has no `config:`
section but the auth feature, integrations, and many other code paths
typically read from `process.env`. There's no canonical "env validation
module" generator. If two parallel workers both need to add a var, they
collide on `src/env.ts` (which is in `src/lib/*` so it's in the registry,
modulo the location difference — `src/env.ts` is at the top level, not under
`src/lib/`).

**Fix:** Either (a) add `src/env.ts` to the Shared Resource Registry
explicitly, or (b) make Phase 1 always generate a stub `src/env.ts` and have
Phase 1.5 / features only append.

**Impact when /orchestrate runs:** Possible silent merge bugs on
`src/env.ts`. The arbitrator catches it only if the registry is updated.

---

## Summary

- **Must-fix (P0)** — would block or break the helpdesk build: **6**
  (splittable false positives; server-actions stub fallout; rbac-foundation
  duplication; sla-timer-job duplication; worker prompt vs Step 0
  contradiction; relation backref ambiguity in Prisma schema generation —
  technically a P1 in scope but causes a guaranteed Phase 1 abort, so listed
  here.)
- **Should-fix (P1)** — degrades quality but build proceeds: **11**
- **Nice-to-fix (P2)** — cosmetic / future-proofing: **6**

### Top 5 must-fix items (recommended order)

1. **Resolve the `rbac-foundation` feature vs `rbac:` section duplication.**
   Either drop the feature or make the orchestrator's RBAC Dispatch detect
   and skip in its presence. Without this, Wave 0 → Wave 1 collide on
   `src/lib/permissions.ts`.
2. **Resolve the `sla-timer-job` feature vs `jobs.sla-deadline-checker`
   duplication.** Same shape as #1; without this the user gets duplicate
   cron registrations and double notifications.
3. **Reconcile the worker prompt template with Feature Builder Step 0.** The
   spawn protocol must specify the kickoff round-trip explicitly or remove
   the manifest waiting step. Today the two contradict each other and
   parallel mode either skips collision detection or stalls waiting.
4. **Fix splittable detection.** Five of thirteen helpdesk features are
   incorrectly marked splittable, which will burn agent budget on contract
   designs that the contract-designer immediately falls back from.
5. **Document Prisma relation-name auto-generation in schema gen** (or
   require the blueprint to spell them). Without this, `prisma generate`
   aborts in Phase 1 and the build never reaches Phase 2.

### Confidence assessment

End-to-end success without intervention is **unlikely**. The build will
almost certainly halt in Phase 1 step 8 on the ambiguous-relation Prisma
error (#5 above). If the user fixes that and resumes, parallel mode will
likely fall back to sequential due to Wave 3 size + the kickoff-protocol
contradiction, and Wave 1 will collide on the RBAC files. The
sla-timer-job duplication is a latent bug that won't surface during the
build but will produce double emails in production. The "happy path"
features (design-system shared, ticket-list-table, ticket-detail-page,
comment-thread, ticket-search, agent-dashboard) all route to sensible
specialists with high-confidence picker matches and would build cleanly in
isolation; the failure modes here are all about orchestration glue rather
than specialist quality. The highest-risk failure modes, in order, are:
(1) Phase 1 schema generation aborts; (2) RBAC double-write halts Wave
1/Wave 0 boundary; (3) parallel-mode kickoff stall causes 5-minute
heartbeat timeouts on all workers; (4) Sequential fallback turns the
flagship example's parallel demo into a single-threaded build.
