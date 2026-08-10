Resume an interrupted orchestrator build from its Build Map journal.

Usage: `/resume [output-directory]`

You are executing the `/resume` slash command for claude-app-orchestrator. Follow these steps in order — do not skip steps and do not improvise.

1. **Locate the knowledge base.** Read `~/.config/claude-app-orchestrator/path` (a single absolute path on one line). Call this `$KB_PATH`. If the file does not exist, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry." — do not continue.

2. **Resolve the output directory.** `$1` is the app's output directory (optional; default `.`). Call it `$OUT`. Report what you resolved.

3. **Find the Build Map.** Look for `$OUT/.claude-build/map.yaml`.
   - **Found**: read it and report a one-screen status — blueprint, mode, units done/in-progress/pending (✓/⏳/○), decisions recorded, and where the build stopped.
   - **Not found but `$OUT/BUILD_REPORT.md` exists**: this is a pre-Build-Map build. Say so; the orchestrator's legacy fallback will reconstruct the map before continuing.
   - **Neither exists**: abort with "No build to resume in $OUT — start one with /orchestrate <blueprint> $OUT."

4. **Resume.** Read `$KB_PATH/agents/orchestrator.md` and follow its **Resume protocol** (Build Map section): verify the blueprint hash, cross-check `done` units against git, reconcile stale `in-progress` units, then continue the build from the first pending unit. All the orchestrator's normal phase rules apply.

5. **Summarize.** When the build finishes (or blocks again), show: units completed this session, any new decisions recorded, and what remains.

Arguments: `$1` = output directory of the interrupted build (optional, default `.`).
