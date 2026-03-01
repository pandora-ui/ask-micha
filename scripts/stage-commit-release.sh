#!/usr/bin/env bash
set -euo pipefail

MESSAGE=""
COUNT=20
PUSH=false
DRY_RUN=false

print_help() {
  cat <<'USAGE'
Stage relevant project files, create a commit, and generate release notes.

Usage:
  ./scripts/stage-commit-release.sh --message "fix: your message" [options]

Options:
  --message <msg>   Commit message (required)
  --count <n>       Release notes commit count (default: 20)
  --push            Push to current branch after commits
  --dry-run         Show actions only; do not modify git state
  -h, --help        Show this help

Behavior:
  1) Generates RELEASE_NOTES.md
  2) Stages relevant repo files
  3) Creates main commit with --message
  4) Commits RELEASE_NOTES.md separately if it changed
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --message)
      MESSAGE="${2:-}"
      shift 2
      ;;
    --count)
      COUNT="${2:-}"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

if [[ -z "$MESSAGE" ]]; then
  echo "--message is required" >&2
  exit 1
fi

if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "--count must be a non-negative integer" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

cd "$REPO_ROOT"

MAIN_TARGETS=(
  apps
  packages
  scripts
  README.md
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
  docker-compose.yml
  .env.example
)

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Generate release notes: ./scripts/release-note.sh --count $COUNT --output RELEASE_NOTES.md"
  echo "[dry-run] Stage targets: ${MAIN_TARGETS[*]}"
  echo "[dry-run] Main commit message: $MESSAGE"
  echo "[dry-run] Optional notes commit: docs: update release notes"
  if [[ "$PUSH" == "true" ]]; then
    echo "[dry-run] Push branch: $BRANCH"
  fi
  exit 0
fi

./scripts/release-note.sh --count "$COUNT" --output RELEASE_NOTES.md

git add -- "${MAIN_TARGETS[@]}"
git reset -- RELEASE_NOTES.md

if git diff --cached --quiet; then
  echo "No relevant staged changes found. Nothing to commit."
  exit 0
fi

git commit -m "$MESSAGE"

if ! git diff --quiet -- RELEASE_NOTES.md; then
  git add RELEASE_NOTES.md
  git commit -m "docs: update release notes"
fi

if [[ "$PUSH" == "true" ]]; then
  git push origin "$BRANCH"
fi

echo "Done. Branch: $BRANCH"
