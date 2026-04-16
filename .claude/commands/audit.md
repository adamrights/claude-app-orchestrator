Audit the React app in the current directory for performance issues.

Usage: `/audit`

You are executing the `/audit` slash command. Steps:

1. Read `~/.config/claude-app-orchestrator/path` for `$KB_PATH`. If missing, abort with: "claude-app-orchestrator not installed. Run `./install.sh` from the repo root, then retry."

2. Confirm the current working directory looks like a React app: `package.json` exists and lists `react` as a dependency. If not, abort with: "/audit must be run from a React app's root directory."

3. Read `$KB_PATH/agents/react-performance-auditor.md` and execute its workflow against the current working directory. Produce `PERFORMANCE_AUDIT.md` in cwd as that agent specifies.

4. After completion, summarize the top 5 issues from the audit report for the user.

No arguments.
