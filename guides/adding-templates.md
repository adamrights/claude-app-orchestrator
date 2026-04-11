# Adding a New Template

Templates are the starting points the orchestrator scaffolds from. To add a new one (e.g., `astro-content`, `remix-prisma`, `sveltekit-drizzle`):

## 1. Create the directory

```
templates/{your-template-name}/
  scaffold.yaml
  files/
    ...starter files...
```

## 2. Write `scaffold.yaml`

This file is metadata only — the orchestrator reads it to know what the template provides and what to run after copying files.

```yaml
name: your-template-name
description: One-line summary
type: fullstack | spa | api    # Determines stack-based template inference

provides:
  framework: ...
  language: typescript
  # any other relevant facts

dependencies:
  production: { ... }
  dev: { ... }

post_scaffold:
  - npm install
  - any other setup commands
```

The `dependencies` field is documentation; the actual versions live in `files/package.json`. Keeping them in sync is up to you.

## 3. Add starter files under `files/`

The directory structure of `files/` mirrors the project layout. Whatever you put here is copied verbatim into the new project (with `{{name}}` substitution applied).

**Required files**:
- `package.json` — uses `"name": "{{name}}"`
- `CLAUDE.md` — project-level guide for Claude when working in the new project
- `.gitignore`
- `.env.example`

**Recommended**:
- `tsconfig.json` (if TypeScript)
- A minimal entry point (e.g., `src/index.ts` or `src/main.tsx`)
- Build/config files (`vite.config.ts`, `next.config.js`, etc.)
- An empty schema file if the template uses an ORM (the orchestrator regenerates it from the blueprint)

## 4. Write a project-level `CLAUDE.md`

This is the most important file in the template. It tells Claude Code how to work inside the scaffolded project. Include:

- Tech stack summary
- Available `npm run` commands
- Conventions (where files go, how to import, what NOT to do)
- Any project-specific patterns

Look at `templates/nextjs-prisma-tailwind/files/CLAUDE.md` for a complete example.

## 5. Update the orchestrator

If your template uses a new `stack.type` value (e.g., `static`), add an inference rule to `agents/orchestrator.md` under "Template Resolution Rules":

```
- `static` → `astro-content`
```

If it uses an existing `type`, no orchestrator change needed — but the explicit `template:` field in the blueprint will still let users pick it.

## 6. Update the schema generator (if using a new ORM)

If your template uses an ORM the project-initializer doesn't know about yet, add a translation table to `agents/project-initializer.md` showing how blueprint model syntax maps to the ORM's syntax.

## 7. Add a blueprint example

Create `blueprints/examples/{descriptive-name}.yaml` that uses the new template. This is how users discover it. Keep the example small and focused.

## 8. Update READMEs

- `CLAUDE.md` — list the new template under "Repository Structure"
- `blueprints/README.md` — link the new example
