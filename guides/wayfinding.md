# Wayfinding: from foggy idea to blueprint

The orchestrator builds whatever a blueprint describes — but someone has to write the blueprint, and for any app bigger than a todo list, the blocking problem isn't YAML syntax. It's the twenty unmade decisions hiding inside "something like a helpdesk, but for facilities requests."

`/wayfind` is the phase before the blueprint: a planning loop that surfaces those decisions as **tickets** on a **map**, resolves them one at a time, and emits a validated blueprint when the route is clear. It is adapted from Matt Pocock's [Wayfinder skill](https://github.com/mattpocock/skills/blob/main/docs/engineering/wayfinder.md); this repo's version is specialized to end at a blueprint YAML.

**The one rule:** wayfinding plans; it never builds. No scaffolding, no app code, no "head start" prototypes that sneak into the project. The build belongs to `/orchestrate`.

## The lifecycle

```
/wayfind "idea"          ──►  {slug}.map.md   (status: mapping)
   │  grill destination
   │  seed decision tickets
   │  resolve tickets, one per pass       ◄── /wayfind {slug}.map.md  (resume, any session)
   ▼
map resolved             ──►  blueprint.yaml  (status: ready)
   │
   ▼
/validate blueprint.yaml ──►  /orchestrate blueprint.yaml ./out
```

## The map

One markdown file, canonical for the whole plan. Sections: **Destination** (the end state bounding every decision), **Decisions so far** (one-line gists linking to tickets), **Open frontier** (unblocked tickets — where the next session starts), **Not yet specified** (fog you can't phrase sharply yet), **Out of scope**, and the **Tickets** themselves.

Start from [`blueprints/maps/TEMPLATE.map.md`](../blueprints/maps/TEMPLATE.map.md); see a finished one at [`blueprints/maps/examples/helpdesk.map.md`](../blueprints/maps/examples/helpdesk.map.md).

Because the map is a file (not chat history), wayfinding survives session boundaries: any session — today's or next month's — reads the frontier and continues. If your project lives on GitHub, the Wayfinder can optionally mirror the map to issues (`wayfinder:map` / `wayfinder:ticket` labels), but the file stays canonical.

## Tickets in one minute

A ticket is a **question that blocks the blueprint** — never a work item. Four types, by how they get answered:

- **grilling** — talking with you settles it ("three roles or four?")
- **research** — facts settle it; subagents go find them ("does Resend's free tier cover this volume?")
- **prototype** — a disposable spike settles it ("threaded or flat comments? mock both, look, decide")
- **task** — someone must do non-decision work first ("create the Stripe account so we can check if metered billing exists on the starter plan")

One ticket resolves at a time. The resolution — decision, reasoning, losing options, date — lives in the ticket forever; the map's summary list only gists it. Full quality rules: [`skills/planning/decision-mapping.md`](../skills/planning/decision-mapping.md).

## When to skip wayfinding

If you can already dictate the models, pages, and features, you don't have a fog problem — write the blueprint directly ([`guides/blueprint-authoring.md`](blueprint-authoring.md)), `/validate`, `/orchestrate`. `/wayfind` even checks for this and will point you there rather than ceremonially interviewing you about a todo app.

Rule of thumb: wayfind when you'd otherwise start the build to *find out* what you want. That's the expensive way to make decisions — the map is the cheap way.

## FAQ

**Can I edit the map by hand?** Yes — it's yours. Keep the format (statuses, gist lines) so a resuming session can compute the frontier.

**Do the map's decisions reach the build?** Yes. The emitted blueprint carries a `# wayfinder-map:` comment; `/orchestrate` follows it and imports every resolved ticket into the build's decision log (`.claude-build/map.yaml`), so Feature Builders see wayfinding answers in `build_decisions` instead of re-asking them. After a successful build the map's status flips to `built`.

**What if a decision turns out wrong mid-build?** The build phase treats the blueprint as source of truth and stops when it's wrong. Reopen the relevant ticket on the map, re-resolve, update the blueprint, and re-run. Never edit the blueprint mid-build.

**What about features added after the build?** `/extend` reads the app's decision trail. Extensions the map already bounds proceed directly (and leave a one-line decision gist behind); genuinely foggy extensions reopen the map — new tickets on the frontier, resolved the normal way, then built with those decisions inherited. A `built` map is the app's decision memory, not a dead artifact.

**Do small apps need a map?** No. See "When to skip wayfinding."
