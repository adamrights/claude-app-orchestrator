#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RALPH_DIR="$SCRIPT_DIR/.ralph"
STATE_FILE="$RALPH_DIR/state.json"
LOG_DIR="$RALPH_DIR/logs"
PROMPT_TEMPLATE="$RALPH_DIR/prompt.md"

MAX_ITERATIONS=10
COOLDOWN=30
FOCUS=""
RESUME=false
DRY_RUN=false

usage() {
  cat <<'USAGE'
ralph.sh — Iterative codebase review & improvement loop using Claude Code

Usage: ./ralph.sh [options]

Options:
  --max N          Maximum iterations (default: 10)
  --cooldown N     Seconds between iterations (default: 30)
  --focus PATH     Focus on a specific directory or file pattern
  --resume         Resume from a previous interrupted run
  --dry-run        Print the prompt for iteration 1 and exit
  --help           Show this help message

Each iteration invokes `claude -p` with a fresh context, reviews the
codebase, fixes issues, and commits changes. State is tracked in
.ralph/state.json between iterations.

Stop conditions:
  - Reached max iterations
  - Claude reports no issues found
  - No files changed after an iteration
  - Non-zero exit code from claude
  - Ctrl+C (state is saved on interrupt)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) MAX_ITERATIONS="$2"; shift 2 ;;
    --cooldown) COOLDOWN="$2"; shift 2 ;;
    --focus) FOCUS="$2"; shift 2 ;;
    --resume) RESUME=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

for cmd in jq claude git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not found in PATH." >&2
    exit 1
  fi
done

mkdir -p "$LOG_DIR"

init_state() {
  local start_iter=1
  if [[ "$RESUME" == true ]] && [[ -f "$STATE_FILE" ]]; then
    start_iter=$(jq '.iteration' "$STATE_FILE")
    echo "Resuming from iteration $start_iter"
  else
    cat > "$STATE_FILE" <<EOF
{
  "iteration": 1,
  "max_iterations": $MAX_ITERATIONS,
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "history": [],
  "status": "running"
}
EOF
  fi
  jq --argjson max "$MAX_ITERATIONS" '.max_iterations = $max' "$STATE_FILE" > "$STATE_FILE.tmp" \
    && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

get_iteration() {
  jq -r '.iteration' "$STATE_FILE"
}

set_status() {
  jq --arg s "$1" '.status = $s' "$STATE_FILE" > "$STATE_FILE.tmp" \
    && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

record_iteration() {
  local summary="$1"
  local files_changed="$2"
  local exit_code="$3"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  jq --arg summary "$summary" \
     --argjson files "$files_changed" \
     --argjson exit_code "$exit_code" \
     --arg ts "$ts" \
     --argjson iter "$(get_iteration)" \
     '.history += [{"iteration": $iter, "timestamp": $ts, "summary": $summary, "files_changed": $files, "exit_code": $exit_code}] | .iteration += 1' \
     "$STATE_FILE" > "$STATE_FILE.tmp" \
    && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

build_prompt() {
  local template iter max_iter claude_md git_log history focus_text
  template="$(cat "$PROMPT_TEMPLATE")"
  iter="$(get_iteration)"
  max_iter="$MAX_ITERATIONS"

  claude_md=""
  if [[ -f "$SCRIPT_DIR/CLAUDE.md" ]]; then
    claude_md="$(cat "$SCRIPT_DIR/CLAUDE.md")"
  fi

  git_log="$(git -C "$SCRIPT_DIR" log --oneline -10 2>/dev/null || echo '(no git history)')"

  history="(none yet)"
  local hist_count
  hist_count=$(jq '.history | length' "$STATE_FILE")
  if [[ "$hist_count" -gt 0 ]]; then
    history="$(jq -r '.history[] | "- Iteration \(.iteration): \(.summary) (\(.files_changed) files changed)"' "$STATE_FILE")"
  fi

  if [[ -n "$FOCUS" ]]; then
    focus_text="Focus on: $FOCUS"
  else
    focus_text="Review the entire codebase."
  fi

  local prompt="$template"
  prompt="${prompt//\{\{ITERATION\}\}/$iter}"
  prompt="${prompt//\{\{MAX_ITERATIONS\}\}/$max_iter}"
  prompt="${prompt//\{\{CLAUDE_MD\}\}/$claude_md}"
  prompt="${prompt//\{\{GIT_LOG\}\}/$git_log}"
  prompt="${prompt//\{\{HISTORY\}\}/$history}"
  prompt="${prompt//\{\{FOCUS\}\}/$focus_text}"

  echo "$prompt"
}

cleanup() {
  echo ""
  echo "Interrupted. Saving state..."
  set_status "interrupted"
  print_summary
  exit 130
}

trap cleanup SIGINT SIGTERM

print_summary() {
  local total_iters files_total
  total_iters=$(jq '.history | length' "$STATE_FILE")
  files_total=$(jq '[.history[].files_changed] | add // 0' "$STATE_FILE")
  echo ""
  echo "=== Ralph Loop Summary ==="
  echo "Iterations completed: $total_iters"
  echo "Total files changed:  $files_total"
  echo "Status:               $(jq -r '.status' "$STATE_FILE")"
  echo "State file:           $STATE_FILE"
  echo "Logs:                 $LOG_DIR/"
  if [[ "$total_iters" -gt 0 ]]; then
    echo ""
    echo "History:"
    jq -r '.history[] | "  [\(.iteration)] \(.summary)"' "$STATE_FILE"
  fi
  echo "========================="
}

run_loop() {
  init_state
  set_status "running"

  while true; do
    local iter
    iter="$(get_iteration)"

    if [[ "$iter" -gt "$MAX_ITERATIONS" ]]; then
      echo "Reached max iterations ($MAX_ITERATIONS). Stopping."
      set_status "completed"
      break
    fi

    echo ""
    echo "--- Iteration $iter / $MAX_ITERATIONS ---"

    local prompt
    prompt="$(build_prompt)"
    local log_file="$LOG_DIR/iteration-${iter}.log"

    if [[ "$DRY_RUN" == true ]]; then
      echo "$prompt"
      echo ""
      echo "(dry run — not invoking claude)"
      exit 0
    fi

    local git_before
    git_before="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo 'none')"

    local exit_code=0
    claude -p "$prompt" \
      --allowedTools "Edit,Write,Read,Glob,Grep,Bash(git *),Bash(npm *),Bash(npx *)" \
      > "$log_file" 2>&1 || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
      echo "claude exited with code $exit_code. Check $log_file"
      record_iteration "error (exit code $exit_code)" 0 "$exit_code"
      set_status "error"
      break
    fi

    local last_line
    last_line="$(tail -1 "$log_file")"

    if echo "$last_line" | grep -q "RALPH_DONE:"; then
      echo "Claude reports: no issues found. Stopping."
      record_iteration "no issues found" 0 0
      set_status "completed"
      break
    fi

    local summary="(no summary captured)"
    if echo "$last_line" | grep -q "RALPH_SUMMARY:"; then
      summary="$(echo "$last_line" | sed 's/RALPH_SUMMARY: *//')"
    fi

    local git_after files_changed=0
    git_after="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo 'none')"
    if [[ "$git_before" != "$git_after" ]]; then
      files_changed="$(git -C "$SCRIPT_DIR" diff --stat "${git_before}..${git_after}" | tail -1 | grep -oE '[0-9]+' | head -1 || echo 0)"
    fi

    if [[ "$files_changed" -eq 0 ]] && [[ "$git_before" == "$git_after" ]]; then
      echo "No files changed this iteration. Stopping."
      record_iteration "$summary (no changes)" 0 0
      set_status "completed"
      break
    fi

    echo "  Summary: $summary"
    echo "  Files changed: $files_changed"

    record_iteration "$summary" "$files_changed" 0

    if [[ "$(get_iteration)" -le "$MAX_ITERATIONS" ]]; then
      echo "  Cooling down for ${COOLDOWN}s..."
      sleep "$COOLDOWN"
    fi
  done

  print_summary
}

run_loop
