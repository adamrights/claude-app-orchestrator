Validate a blueprint YAML without building.

Usage: `/validate <blueprint-path>`

You are executing the `/validate` slash command. Steps:

1. Read `~/.config/claude-app-orchestrator/path` for `$KB_PATH`. If missing, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry."

2. If `$1` is empty, abort with: "Usage: /validate <blueprint-path>".

3. Run `node $KB_PATH/scripts/validate-blueprint.mjs $1` via Bash. Show the validator output verbatim. Exit with the validator's exit code.

Argument: `$1` = blueprint YAML path (required).
