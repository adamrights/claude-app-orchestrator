# Using the Orchestrator

The orchestrator agent (`agents/orchestrator.md`) turns a blueprint YAML into a working app. This guide walks through the end-to-end workflow.

## 1. Pick or write a blueprint

Start from an example:

```bash
cp blueprints/examples/todo-app.yaml ~/projects/my-todo.yaml
```

Edit the file to describe your app. The minimum is `name`, `description`, and at least one entry under `features`. See [blueprint-authoring.md](blueprint-authoring.md) for guidance.

## 2. Invoke the orchestrator from Claude Code

Open Claude Code in any directory and ask:

> Read `/path/to/claude-code-knowledge/agents/orchestrator.md` and build `/path/to/my-todo.yaml` into `/path/to/my-todo/`.

The orchestrator will:

1. **Phase 1 — Scaffold**: Pick a template based on the blueprint's `stack.type`, copy the template files, generate the database schema from `models`, run `npm install`, and create an initial git commit.
2. **Phase 2 — Build features**: For each feature in order, load the relevant skill files, build the feature using the right specialist agent, run tests, and commit.
3. **Phase 3 — Integration**: Run the full test suite, run a code review pass, run `npm run build`, and make a final commit.

## 3. Review the output

Each feature is its own git commit, so you can `git log` and review them one at a time. If anything looks wrong, you can revert a single commit and ask Claude to redo just that feature.

## Troubleshooting

**Wrong template selected**: Set `template:` explicitly in the blueprint to override stack-based inference.

**`npm install` fails**: The orchestrator should retry after fixing version conflicts. If it doesn't, check the project's `package.json` and your local Node version (the templates target Node 20+).

**A feature builds the wrong thing**: The feature `description` field is the primary instruction the orchestrator follows — make it more specific. You can also add or remove items from the `skills` array to change which guidelines are loaded.

**Tests fail**: The orchestrator switches into the Fullstack Debugger workflow on test failure. If it's stuck in a loop, stop it and look at the test output yourself.

**Skill not found**: The skill short name in your feature's `skills` array doesn't match the orchestrator's mapping table. Either fix the name or add the skill to `skills/` and update the mapping in `agents/orchestrator.md`.

## Doing parts manually

You don't have to use the full orchestrator. You can:

- Run only Phase 1 by invoking `agents/project-initializer.md` directly
- Build a single feature by invoking `agents/react-feature-builder.md` or `agents/api-endpoint-builder.md` and pointing it at the relevant skills
- Use the orchestrator for scaffolding, then build features yourself
