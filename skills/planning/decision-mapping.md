# Decision Mapping

Guidelines for writing and maintaining a wayfinder map — a single markdown file of decision tickets that plans work too foggy or too large for one session. Used by the Wayfinder agent (`agents/wayfinder.md`); useful anywhere a plan must survive session boundaries.

## Core model

- **A decision lives in exactly one place: its ticket.** Every other artifact (the map's summary lists, the blueprint, the conversation) may gist it and link to it, never restate it. Restated decisions drift; drifted decisions get re-litigated.
- **The map is canonical; the conversation is scratch.** If a session ends without the map reflecting what was decided, the decision didn't happen.
- **Tickets are questions, not work items.** The output of a ticket is an answer, not an artifact. Artifacts produced along the way (spikes, research notes) are evidence, and evidence is disposable.
- **One ticket at a time.** Resolving in batches feels efficient and produces shallow answers that reopen later — the slowest possible path.

## Writing a good ticket

Every ticket needs four parts:

1. **A sharp question in the title.** Test: could two reasonable people give different answers? If not, it's not a decision — just record it. "Should we use Postgres?" when the user already said Postgres is ceremony.
2. **What it blocks.** A ticket that blocks nothing is scope creep in question form — drop it or move it to Not yet specified.
3. **The live options.** Two to four, each one line. If you can only think of one option, you haven't found the question yet.
4. **A resolution criterion.** How will we know it's answered? ("User picks one", "provider docs confirm/deny", "the mock makes the tradeoff visible.")

Choosing the type:

| Signal | Type |
|--------|------|
| Answer depends on preference, product judgment, or scope | `grilling` |
| Answer exists in the world and just needs finding | `research` |
| Answer requires *seeing or touching* something that doesn't exist yet | `prototype` |
| Answer is blocked on someone doing non-decision work first | `task` |

If a `task` ticket's checklist reads like a slice of the eventual implementation ("build the login page"), it is misclassified work — delete it. The build phase owns implementation; the map owns decisions.

## Writing a good resolution

- State the decision first, in one sentence, then the reasoning.
- Name the options that lost and the single strongest reason each lost — future readers will ask "did they consider X?"; answer them in advance.
- Date it.
- Note what it destabilizes: "reopens T4's assumption that…" is the most valuable line in the map.

## Map hygiene

- **Gist lines are one line.** If a Decisions-so-far entry needs a second line, the gist is doing the ticket's job.
- **Prune the fog.** Every time a ticket resolves, re-read Not yet specified: promote entries that became sharp questions, delete entries that dissolved. Fog that never shrinks means the destination is wrong — re-grill it.
- **Out of scope is load-bearing.** Writing down what you will NOT do is the cheapest way to stop it from being re-proposed every session.
- **Reopening is explicit.** New evidence against a resolved ticket → reopen it with a note, never edit the old resolution in place. The map is an audit trail, not a whiteboard.
- **Blocked tickets name their blocker** — `blocked(T3)`, `blocked(user)` — so any session can compute the frontier by scanning statuses.

## Anti-patterns

- **The implementation smuggle.** A ticket titled "Add Stripe billing" — that's a feature, not a question. The question hiding inside it is "usage-based or seat-based pricing?" Ticket that instead.
- **The omniscient map.** Fifty tickets seeded on day one. You cannot see that far; most will be misphrased. Seed only what is sharp today, keep the rest as fog.
- **The silent reversal.** A later resolution that contradicts an earlier one without reopening it. Now the map disagrees with itself and readers can't tell which end is current.
- **The session-sized batch.** "I resolved T2 through T9 today." Each resolution after the first got less scrutiny than a decision deserves.
- **Evidence hoarding.** Keeping prototype code "because it's a head start". Spikes answer questions; carrying them into the build imports their shortcuts.

## Checklist

- [ ] Every ticket title is a question two people could answer differently
- [ ] Every ticket names what it blocks
- [ ] Every resolved ticket has a dated resolution with losing options and their reasons
- [ ] Decisions-so-far entries are single-line gists linking to their tickets
- [ ] Frontier computable by status scan (`open` + unblocked)
- [ ] Not yet specified re-pruned after the latest resolution
- [ ] No ticket reads as "build/add/implement X"
- [ ] Map file is valid against `blueprints/maps/TEMPLATE.map.md` layout
