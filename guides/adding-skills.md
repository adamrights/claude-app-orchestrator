# Adding a New Skill

Skills are markdown files containing coding guidelines that the orchestrator loads into context when an agent builds a feature that references them. Adding a new skill is a four-step process.

## 1. Create the skill file

Pick the right subdirectory:

- `skills/frontend/` — React, hooks, styling, state, routing
- `skills/backend/` — APIs, databases, server frameworks, auth
- `skills/devops/` — Docker, CI/CD, deployment, infrastructure
- `skills/testing/` — Unit, integration, e2e, mocking

If your skill doesn't fit, create a new subdirectory.

## 2. Follow the skill structure

Existing skills follow a consistent format. Copy one (e.g., `skills/frontend/react-hooks.md`) and adapt it. The standard sections are:

```markdown
# {Skill Name}

## When to use
{One paragraph describing the context this skill applies to}

## Guidelines
- Bullet list of rules and conventions
- Each bullet should be actionable

## Examples
{Code blocks showing the patterns in practice}

## Checklist
- [ ] Verifiable items the agent can check before considering the work done
```

The orchestrator treats "Guidelines" and "Checklist" sections as requirements when building features.

## 3. Add a manifest entry and regenerate

The skill map has a single source of truth: `skills/manifest.yaml`. Add one entry:

```yaml
  - name: your-skill-name
    path: skills/{category}/your-skill-name.md
    layer: frontend        # frontend | backend | shared | devops | testing | planning
    description: One line for the browsable index
    triggers: when an agent should load this skill
```

The `name` is what users type in the `skills:` array of their blueprints — lowercase, hyphenated, concise. The `layer` matters: only `frontend` and `backend` count toward the orchestrator's splittable-feature detection.

Then regenerate the derived outputs (the orchestrator's Skill Mapping table and `skills/MAP.md`):

```bash
make skillmap        # or: node scripts/build-skill-map.mjs
make refs            # verifies everything is in sync
```

Never edit the generated table in `agents/orchestrator.md` by hand — `make refs` fails on drift.

## 4. Update the directory README

Add a link to your new skill in `skills/{category}/README.md`:

```markdown
- [Your Skill Name](your-skill-name.md) — One-line description
```

## Tips

- **One concern per file**. If a skill grows past ~200 lines, split it.
- **Lead with rules, not theory**. Agents need to know what to do, not why.
- **Include code examples**. Markdown without code blocks is hard for agents to apply.
- **Avoid duplication with other skills**. If two skills overlap, refactor — agents may load both for one feature, and conflicting guidance is worse than no guidance.
- **Update existing skills before creating new ones**. A new skill is only justified if it genuinely covers a new topic.
