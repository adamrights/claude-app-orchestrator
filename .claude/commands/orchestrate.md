Build an app from a blueprint YAML.

Usage: `/orchestrate <blueprint-path> [output-directory]`

You are executing the `/orchestrate` slash command for claude-app-orchestrator. Follow these steps in order — do not skip steps and do not improvise.

1. **Locate the knowledge base.** Read `~/.config/claude-app-orchestrator/path` (it contains a single absolute path on one line). Call this `$KB_PATH`. If the file does not exist, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry." — do not continue.

2. **Resolve arguments.**
   - `$1` is the blueprint path (required). Resolve it to an absolute path. If `$1` is empty, abort with: "Usage: /orchestrate <blueprint-path> [output-directory]".
   - `$2` is the output directory (optional). If empty, default to `./` followed by the blueprint's basename minus `.yaml` (e.g., `examples/built/helpdesk/blueprint.yaml` → `./helpdesk/`).
   - Both: report what you resolved before proceeding.

3. **Pre-flight validate.** Run `node $KB_PATH/scripts/validate-blueprint.mjs $1` via Bash. If exit code is non-zero, show the validator output and abort. Do not attempt to build a blueprint that didn't validate.

4. **Build.** Read `$KB_PATH/agents/orchestrator.md` and follow its instructions to build `$1` into the resolved output directory. The orchestrator handles scaffolding, feature dispatch, and integration phases on its own.

5. **Summarize.** When the orchestrator finishes, read `<output-directory>/BUILD_REPORT.md` (the orchestrator writes it incrementally). Show the user a 5-bullet summary: what was built, where, what to do next, what env vars are still needed, what wasn't done. Do not paste the full report — just the takeaways.

Arguments: `$1` = blueprint path (required); `$2` = output directory (optional).
