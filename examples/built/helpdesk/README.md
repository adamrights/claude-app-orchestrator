# Helpdesk reference build

A B2B customer support ticketing system — like Zendesk-lite. This is the
flagship reference build for claude-app-orchestrator: a real-world-shaped
app that exercises most of the skill catalog and almost the entire
specialist fleet.

## What it is

A multi-role support desk. **Customers** file tickets and reply to their own
threads. **Agents** triage the full queue, change status, post internal notes,
and watch SLA timers from a dashboard. **Admins** do everything an agent can
plus manage users and role assignments. The core workflow — file → triage →
assign → discuss → resolve — is real, audit-friendly, and surfaces the kinds
of cross-cutting concerns (RBAC, full-text search, scheduled jobs, email)
that toy demos never touch.

## What it demonstrates

| Aspect | Skill / Specialist exercised |
|--------|------------------------------|
| Server-rendered data pages | `server-components`, RSC Architect |
| Searchable / filterable list | `data-tables`, `pagination`, Data Table Builder |
| Metrics + charts | `web-vitals`, Dashboard Builder |
| Admin CRUD | Admin Panel Builder |
| Component primitives | `design-system`, `styling`, `accessibility`, Design System Builder |
| RBAC for 3 roles | `authentication`, RBAC Specialist |
| Background jobs (SLA cron) | `api-design`, Background Jobs Specialist |
| Third-party integrations (Resend) | Integration Specialist |
| Forms with validation | `forms`, `validation` |
| Search across text | `search` (Postgres full-text) |
| State machines (ticket status) | `state-machines` |
| Composition patterns (comment thread) | `composition-patterns` |
| Optimistic UX | `optimistic-updates` |
| Typed contracts | `typescript-patterns` |
| Data fetching | `data-fetching`, `react-hooks` |
| API design | `api-design`, Server Actions |
| Testing | `react-testing`, `e2e-testing` |

**Totals:** 17 distinct skills, 9 specialists invoked
(Project Initializer, Migration Specialist, Design System Builder, Data Table
Builder, RSC Architect, Dashboard Builder, Admin Panel Builder, Integration
Specialist, Background Jobs Specialist, RBAC Specialist).

## Build it yourself

From any directory, after running `./install.sh` to register the
`/orchestrate` slash command:

```bash
/orchestrate /path/to/claude-app-orchestrator/examples/built/helpdesk/blueprint.yaml ./helpdesk
```

Or manually, without the slash command:

```bash
node scripts/validate-blueprint.mjs examples/built/helpdesk/blueprint.yaml
# then in Claude Code:
# "Read agents/orchestrator.md and build examples/built/helpdesk/blueprint.yaml into ./helpdesk"
```

The orchestrator will produce a working app in roughly 14 commits (one per
feature, plus shared-primitive and scaffolding commits) inside `./helpdesk/`.
For the full file tree it will lay down, see [EXPECTED_OUTPUT.md](./EXPECTED_OUTPUT.md).

## Required environment

Before running the built app, you'll need:

- **PostgreSQL** (local Docker, Supabase, Neon, RDS, …) — set `DATABASE_URL`
- **GitHub OAuth app** for sign-in — set `GITHUB_ID`, `GITHUB_SECRET`
- **Resend API key** for transactional email — set `RESEND_API_KEY`
- A random `NEXTAUTH_SECRET` (`openssl rand -base64 32`)

The orchestrator's `BUILD_REPORT.md` (written into `app/`) lists every env
var the built app expects and where it's consumed.

## Why a helpdesk specifically

- **Recognizable.** Every reader has filed a support ticket; no domain
  ramp-up needed to evaluate the output.
- **B2B-shaped.** Multiple roles, audit trails, and SLA logic exercise the
  parts of the orchestrator that toy apps skip.
- **Justifies RBAC.** Three roles with overlapping-but-distinct permissions
  is the natural shape — not bolted on for the demo.
- **Real workflow logic.** Ticket status is a finite state machine
  (`open → in_progress → waiting_on_customer → resolved → closed`), so the
  `state-machines` skill earns its keep.
- **Wide skill coverage.** ~17 of the catalog's 36 skills, including the
  ones that rarely appear in framework demos (`search`, `state-machines`,
  `composition-patterns`, `optimistic-updates`).
- **Wide specialist coverage.** Dispatches 9 of the 10 build-time
  specialists — only the React Performance Auditor sits this one out
  (it runs ad-hoc, not from the blueprint).
- **Not a kanban.** Every framework demo is a kanban or a todo list; this
  intentionally is neither.

## Generated source

The actual generated source lives at `app/` — gitignored, since the
orchestrator produces it locally on each user's machine. To produce it,
run the build above. Future revisions of this README will include
screenshots of the running app.
