#!/usr/bin/env bash
set -euo pipefail

COUNT=20
SINCE=""
OUTPUT=""

print_help() {
  cat <<'USAGE'
Generate a markdown progress summary from git commits.

Usage:
  ./scripts/release-note.sh [options]

Options:
  --count <n>       Number of latest commits to include (default: 20)
  --since <expr>    Use git --since filter instead of --count (e.g. "7 days ago")
  --output <file>   Write markdown to file (also prints to stdout)
  -h, --help        Show this help

Examples:
  ./scripts/release-note.sh --count 15
  ./scripts/release-note.sh --since "14 days ago" --output RELEASE_NOTES.md
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --count)
      COUNT="$2"
      shift 2
      ;;
    --since)
      SINCE="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
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

if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "--count must be a non-negative integer" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
GENERATED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"

LOG_ARGS=("--date=short" "--pretty=format:%h%x1f%ad%x1f%s%x1f%an")
if [[ -n "$SINCE" ]]; then
  LOG_ARGS+=("--since=$SINCE")
else
  LOG_ARGS+=("-n" "$COUNT")
fi

features=""
fixes=""
docs=""
refactors=""
chores=""
tests=""
ci_build=""
perf=""
others=""

append_line() {
  local current="$1"
  local line="$2"
  if [[ -z "$current" ]]; then
    printf "%s" "$line"
  else
    printf "%s\n%s" "$current" "$line"
  fi
}

FOUND=0
while IFS=$'\x1f' read -r sha cdate subject author; do
  [[ -z "${sha:-}" ]] && continue
  FOUND=$((FOUND + 1))
  lower_subject="$(printf '%s' "$subject" | tr '[:upper:]' '[:lower:]')"
  line="- \`$sha\` ($cdate, $author): $subject"

  case "$lower_subject" in
    feat:*|feature:*)
      features="$(append_line "$features" "$line")"
      ;;
    fix:*|hotfix:*)
      fixes="$(append_line "$fixes" "$line")"
      ;;
    docs:*|doc:*)
      docs="$(append_line "$docs" "$line")"
      ;;
    refactor:*)
      refactors="$(append_line "$refactors" "$line")"
      ;;
    chore:*)
      chores="$(append_line "$chores" "$line")"
      ;;
    test:*|tests:*)
      tests="$(append_line "$tests" "$line")"
      ;;
    ci:*|build:*)
      ci_build="$(append_line "$ci_build" "$line")"
      ;;
    perf:*)
      perf="$(append_line "$perf" "$line")"
      ;;
    *)
      others="$(append_line "$others" "$line")"
      ;;
  esac
done < <(git -C "$REPO_ROOT" log "${LOG_ARGS[@]}")

if [[ "$FOUND" -eq 0 ]]; then
  CONTENT="# Progress Summary\n\nNo commits found for the given filter.\n"
  if [[ -n "$OUTPUT" ]]; then
    printf "%b" "$CONTENT" > "$OUTPUT"
  fi
  printf "%b" "$CONTENT"
  exit 0
fi

CONTENT="# Progress Summary\n\n"
CONTENT+="- Generated: $GENERATED_AT\n"
CONTENT+="- Branch: \`$BRANCH\`\n"
if [[ -n "$SINCE" ]]; then
  CONTENT+="- Filter: since \`$SINCE\`\n\n"
else
  CONTENT+="- Filter: last \`$COUNT\` commits\n\n"
fi

emit_section() {
  local title="$1"
  local body="$2"
  if [[ -n "$body" ]]; then
    CONTENT+="## $title\n$body\n\n"
  fi
}

emit_section "Features" "$features"
emit_section "Fixes" "$fixes"
emit_section "Docs" "$docs"
emit_section "Refactors" "$refactors"
emit_section "Tests" "$tests"
emit_section "CI / Build" "$ci_build"
emit_section "Performance" "$perf"
emit_section "Chores" "$chores"
emit_section "Other" "$others"

if [[ -n "$OUTPUT" ]]; then
  printf "%b" "$CONTENT" > "$OUTPUT"
fi
printf "%b" "$CONTENT"
