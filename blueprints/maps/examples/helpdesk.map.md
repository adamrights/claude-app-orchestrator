# Wayfinder Map: helpdesk

status: ready
blueprint: examples/built/helpdesk/blueprint.yaml
updated: 2026-08-10

> Worked example: the map that *would have produced* the helpdesk reference blueprint, reconstructed so you can see what a finished map looks like. Start your own from [`../TEMPLATE.map.md`](../TEMPLATE.map.md).

## Destination

A B2B support ticketing system where a customer submits a ticket, an agent triages and answers it inside an SLA window, and an admin sees whether the team is keeping up. The end-to-end workflow that must work: submit → assign → respond → resolve, with SLA breaches surfaced before customers notice them.

Done looks like:

- A customer can file a ticket and watch its status change without emailing anyone
- An agent works a queue ordered by SLA urgency, not arrival time
- An admin can add/remove agents and see breach counts per week

## Decisions so far

- D1 (given) — B2B: customers belong to companies, not individuals off the street
- D2 (given) — Web app, not email-in/email-out (email is notify-only)
- D3 (T1) — Fullstack Next.js + Prisma template; SPA rejected → [T1](#t1--grilling--resolved--one-deployable-or-spa--api)
- D4 (T2) — Three roles (customer/agent/admin) via RBAC section, org-scoped → [T2](#t2--grilling--resolved--how-many-roles-does-triage-actually-need)
- D5 (T3) — SLA = per-priority response deadlines checked by a cron job; no external SLA service → [T3](#t3--research--resolved--buy-or-build-the-sla-clock)
- D6 (T4) — Email via Resend snippet, notify-only (assignment + breach) → [T4](#t4--research--resolved--which-transactional-email-path-fits-notify-only-volume)
- D7 (T5) — Ticket thread = flat comments, no nesting → [T5](#t5--prototype--resolved--threaded-or-flat-conversation-on-a-ticket)
- D8 — Blueprint emitted and validated (2026-08-10)

## Open frontier

*(empty — map is resolved)*

## Not yet specified

*(empty)*

## Out of scope

- Email-in ticket creation (parse inbound mail) — v2 at the earliest
- Customer-facing knowledge base / deflection
- Billing of any kind
- Real-time presence ("agent is typing…")

---

## Tickets

### T1 · grilling · resolved — One deployable or SPA + API?

**Blocks:** template choice, and therefore every file-layout decision downstream
**Why it matters:** SPA + hono-api doubles deploy surface; fullstack Next.js couples frontend to backend releases.
**Options:** (a) fullstack Next.js template, (b) vite SPA + hono API
**Resolution:** Fullstack (a). One team, one deploy target, and SSR helps the agent queue load fast. (b) lost because nothing here needs an independent API consumer yet — the mobile-app argument is speculative and Out of scope catches it. (2026-08-10)

### T2 · grilling · resolved — How many roles does triage actually need?

**Blocks:** rbac section, page auth flags, admin feature scope
**Why it matters:** every extra role multiplies permission checks and test cases.
**Options:** (a) customer/agent/admin, (b) add team-lead with reassignment powers, (c) flat "staff"
**Resolution:** Three roles (a). Team-lead (b) lost — its only unique power (reassignment) can belong to admin until real usage proves otherwise. Flat staff (c) lost because customers must never see other companies' tickets, which already forces org-scoped RBAC. Destabilized nothing. (2026-08-10)

### T3 · research · resolved — Buy or build the SLA clock?

**Blocks:** jobs section, Ticket model fields (priority, deadlines)
**Why it matters:** SLA is the product's core promise; getting the mechanism wrong is expensive to unwind.
**Options:** (a) cron job checking deadlines, (b) delayed-job-per-ticket queue, (c) external SLA service
**Resolution:** Cron (a): a `sla-check` job scanning open tickets against per-priority response deadlines. Per-ticket delayed jobs (b) lost — reassignment/priority changes mean constantly cancelling and re-enqueueing. External service (c) lost — nothing on the market is cheap enough to beat a 20-line query. Research note: template's job support confirmed via `blueprints/snippets/` + jobs section of the schema. (2026-08-10)

### T4 · research · resolved — Which transactional email path fits notify-only volume?

**Blocks:** integrations section, env var list
**Why it matters:** notify-only means low volume; setup cost dominates the choice.
**Options:** (a) Resend, (b) SES, (c) SMTP via provider
**Resolution:** Resend (a) — the repo already ships a documented snippet (`blueprints/snippets/email-transactional.yaml`), making it the zero-research-cost option. SES (b) lost on setup friction for a reference app; raw SMTP (c) lost on deliverability babysitting. (2026-08-10)

### T5 · prototype · resolved — Threaded or flat conversation on a ticket?

**Blocks:** Comment model shape (parentId or not), ticket detail UI
**Why it matters:** threading is a one-way door in the data model; flat can migrate to threaded, not back.
**Options:** (a) flat chronological comments, (b) nested threads
**Resolution:** Flat (a). A disposable HTML mock of both (scratch dir, discarded) made it obvious: support conversations are two-party and sequential — threads added navigation cost with no signal. Nested (b) lost; revisit only if group tickets ever enter scope (currently Out of scope). (2026-08-10)
