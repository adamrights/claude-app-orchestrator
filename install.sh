#!/usr/bin/env bash
# install.sh — install or uninstall claude-app-orchestrator slash commands.
#
# Install:   ./install.sh
# Uninstall: ./install.sh --uninstall
#
# Symlinks each .claude/commands/*.md into ~/.claude/commands/ and writes the
# repo's absolute path to ~/.config/claude-app-orchestrator/path so slash
# commands can find this knowledge base from any working directory.

set -euo pipefail

# Resolve the directory this script lives in (the repo root).
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$REPO_DIR/.claude/commands"
DEST_DIR="$HOME/.claude/commands"
CONFIG_DIR="$HOME/.config/claude-app-orchestrator"
CONFIG_FILE="$CONFIG_DIR/path"

# Color helpers — only when stdout is a TTY.
if [[ -t 1 ]]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; RESET=''
fi

err()  { printf '%serror:%s %s\n' "$RED$BOLD" "$RESET" "$1" >&2; }
ok()   { printf '%s✓%s %s\n'      "$GREEN"    "$RESET" "$1"; }
warn() { printf '%s!%s %s\n'      "$YELLOW"   "$RESET" "$1"; }

confirm_repo_root() {
  if [[ ! -f "$REPO_DIR/agents/orchestrator.md" ]]; then
    err "install.sh must be run from the claude-app-orchestrator repo root."
    err "Expected to find: $REPO_DIR/agents/orchestrator.md"
    exit 1
  fi
}

install_commands() {
  confirm_repo_root

  if [[ ! -d "$SRC_DIR" ]]; then
    err "no commands found at $SRC_DIR"
    exit 1
  fi

  mkdir -p "$DEST_DIR"
  mkdir -p "$CONFIG_DIR"

  # Write the path config (one line, no extra newline).
  printf '%s' "$REPO_DIR" > "$CONFIG_FILE"
  ok "wrote config: $CONFIG_FILE → $REPO_DIR"

  local count=0
  shopt -s nullglob
  for src in "$SRC_DIR"/*.md; do
    local name; name="$(basename "$src")"
    local dest="$DEST_DIR/$name"

    if [[ -L "$dest" ]]; then
      # Existing symlink: only replace if it points to ours (idempotent).
      local target; target="$(readlink "$dest")"
      if [[ "$target" == "$src" ]]; then
        ok "already linked: /$name (no change)"
        ((count++))
        continue
      else
        err "$dest is a symlink to $target — refusing to clobber. Remove it manually if you want to install."
        exit 1
      fi
    elif [[ -e "$dest" ]]; then
      err "$dest exists and is not a symlink — refusing to clobber a real file. Move it aside if you want to install."
      exit 1
    fi

    ln -s "$src" "$dest"
    ok "linked: /$name → $src"
    ((count++))
  done
  shopt -u nullglob

  printf '\n'
  ok "installed $count slash command(s)."
  printf '%sTry:%s /orchestrate examples/built/helpdesk/blueprint.yaml\n' "$BOLD" "$RESET"
}

uninstall_commands() {
  confirm_repo_root

  local removed=0
  shopt -s nullglob
  for src in "$SRC_DIR"/*.md; do
    local name; name="$(basename "$src")"
    local dest="$DEST_DIR/$name"

    if [[ -L "$dest" ]]; then
      local target; target="$(readlink "$dest")"
      if [[ "$target" == "$src" ]]; then
        rm -- "$dest"
        ok "removed: /$name"
        ((removed++))
      else
        warn "skipped: $dest points to $target (not ours)"
      fi
    fi
  done
  shopt -u nullglob

  if [[ -f "$CONFIG_FILE" ]]; then
    rm -- "$CONFIG_FILE"
    ok "removed: $CONFIG_FILE"
  fi
  if [[ -d "$CONFIG_DIR" ]] && [[ -z "$(ls -A "$CONFIG_DIR" 2>/dev/null)" ]]; then
    rmdir -- "$CONFIG_DIR"
    ok "removed empty config dir: $CONFIG_DIR"
  fi

  printf '\n'
  ok "uninstalled $removed slash command(s)."
}

main() {
  case "${1:-install}" in
    install|"")    install_commands ;;
    --uninstall)   uninstall_commands ;;
    -h|--help)
      printf 'Usage: %s [--uninstall]\n' "$(basename "$0")"
      exit 0
      ;;
    *)
      err "unknown argument: $1"
      printf 'Usage: %s [--uninstall]\n' "$(basename "$0")" >&2
      exit 2
      ;;
  esac
}

main "$@"
