Add a new feature to an already-built app.

Usage: `/extend <feature-description>`

You are executing the `/extend` slash command. Steps:

1. Read `~/.config/claude-app-orchestrator/path` for `$KB_PATH`. If missing, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry."

2. If `$ARGUMENTS` is empty, abort with: 'Usage: /extend "<feature-description>"'.

3. Detect the project stack in the current working directory: read `package.json`, check for `prisma/schema.prisma`, `next.config.*`, `vite.config.*`, etc. If the directory does not look like a project the orchestrator could have built (no `package.json`, or no recognizable framework), abort with: "/extend must be run from an orchestrator-built app's root directory."

3b. **Inherit the app's decision trail.** Look for `.claude-build/map.yaml`; if present, read its `decisions:` list and locate the wayfinder map (follow the recorded `blueprint:` path's `# wayfinder-map:` comment). Then classify the requested extension:
   - **Bounded** — the existing decisions + blueprint answer every one-way-door question the feature raises (it composes from settled choices). Proceed to step 4, pass the relevant decisions to the specialist as `build_decisions`, and after the feature ships append one gist line to the wayfinder map's Decisions so far (provenance `extend`, dated) plus a `decisions:` entry in `.claude-build/map.yaml`.
   - **Foggy** — the feature raises questions the map never settled (new data model territory, new integration, changed semantics). Say so, name the open questions, and offer to reopen the wayfinder map first (`agents/wayfinder.md`, "Reopening a built map") — ticket the questions, resolve them, then return here. Do not silently guess; do not force wayfinding on the user if they'd rather answer inline — inline answers get recorded to both maps exactly like `blocked-on-decision` resolutions.
   - No map anywhere → skip this step; blueprint-only apps extend as before.

4. Read `$KB_PATH/agents/orchestrator.md` — specifically the section "Phase 2: Build Features (Wave-Based) → Sequential Mode → Pick the specialist workflow". Apply its first-match-wins rules against `$ARGUMENTS` to choose the correct specialist agent.

5. Read the chosen specialist agent file from `$KB_PATH/agents/`. Synthesize a single-feature spec from `$ARGUMENTS` (kebab-case name, the description, inferred `skills:` based on the rules in the orchestrator's skill-keyword mapping).

6. Dispatch the specialist with the synthesized feature. Build, test, commit using the project's existing conventions (commit message format: `feat({feature-name}): <one-line summary>`).

7. Report what specialist was chosen, what files changed, and the commit SHA.

Argument: `$ARGUMENTS` = natural-language feature description (required).
