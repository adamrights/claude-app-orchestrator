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

## 3. Update the orchestrator's skill mapping

Open `agents/orchestrator.md` and add a row to the "Skill Mapping" table:

```
| `your-skill-name` | `skills/{category}/your-skill-name.md` |
```

The short name (left column) is what users type in the `skills:` array of their blueprints. Keep it lowercase, hyphenated, and concise.

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
