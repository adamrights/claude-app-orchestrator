Plan an app with a wayfinder map: turn a foggy idea into a resolved blueprint through decision tickets. Plans only — never writes app code.

Usage: `/wayfind "<app idea>"` or `/wayfind <path-to-existing.map.md>` (resume)

You are executing the `/wayfind` slash command for claude-app-orchestrator. Follow these steps in order — do not skip steps and do not improvise.

1. **Locate the knowledge base.** Read `~/.config/claude-app-orchestrator/path` (a single absolute path on one line). Call this `$KB_PATH`. If the file does not exist, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry." — do not continue.

2. **Resolve arguments.**
   - If `$1` ends in `.map.md` and the file exists: this is a **resume**. Set `map_path = $1`.
   - Otherwise `$1` is the app idea (required, free text). Derive a slug from it (lowercase, hyphens) and set `map_path = ./{slug}.map.md`. If that file already exists, treat it as a resume instead and say so.
   - If `$1` is empty, abort with: `Usage: /wayfind "<app idea>" | /wayfind <existing.map.md>`.
   - Report what you resolved before proceeding.

3. **Check fit.** If the idea is already fully specified (the user could dictate models, pages, and features right now), say so and recommend skipping to blueprint authoring with `$KB_PATH/guides/blueprint-authoring.md` — offer to draft the blueprint directly instead. Only continue wayfinding if genuine fog remains and the user agrees.

4. **Wayfind.** Read `$KB_PATH/agents/wayfinder.md` and `$KB_PATH/skills/planning/decision-mapping.md`, then follow the Wayfinder workflow with:
   - `idea` = the resolved idea (or the resuming map's Destination)
   - `map_path` = the resolved map path
   - `knowledge_repo` = `$KB_PATH`
   Remember the prime directive: plan, don't build. One ticket at a time.

5. **Wrap up the session.** Whether the map resolved fully or the session stops mid-frontier, end by showing: map path, decisions made this session (gists), the current frontier, and the exact command to continue (`/wayfind {map_path}`) or to build (`/validate` then `/orchestrate {blueprint} {out}` once status is `ready`).

Arguments: `$1` = app idea in quotes, or path to an existing `.map.md` to resume.
