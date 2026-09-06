#!/usr/bin/env bash
#
# merge-pr — the only sanctioned merge path for this repository.
#
# This script collects evidence; `.github/scripts/merge-gate.mjs` decides from it.
# The split exists so the decision is testable: the gate arms are pure functions
# over plain JSON, exercised by `.github/scripts/merge-gate.test.mjs` behind the
# required `design-pattern-governance` check. Two defects shipped undetected while
# this logic lived in an unversioned script outside the repository (#246).
#
# Usage:
#   .github/scripts/merge-pr.sh --pr <number> --review-task <task_id> [options]
#
# Options:
#   --pr <number>           pull request to merge (required)
#   --review-task <t_id>    Kanban task whose review must have completed (required)
#   --repo <owner/name>     default: nandohdc/bloodtrail
#   --board <slug>          Kanban board, default: $HERMES_KANBAN_BOARD or bloodtrail
#   --reviewer <profile>    reviewing profile, default: $HERMES_REVIEWER_PROFILE or reviewer
#   --admin                 use admin privileges AFTER every gate has passed
#   --dry-run               run every gate, then stop short of merging
#
# Exit codes:
#   0  merged, or dry run passed every gate
#   1  a gate refused the merge
#   2  usage or environment error
#
# NOTE: `set -e` is deliberately NOT used. Under `set -e`, `X="$(gh pr checks ...)"`
# aborts on gh's non-zero exit — and exit code 8 means "checks pending", the single
# most common case this gate exists to report. Every command handles its own status.

set -uo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GATE="$HERE/merge-gate.mjs"

REPO="nandohdc/bloodtrail"
BOARD="${HERMES_KANBAN_BOARD:-bloodtrail}"
REVIEWER="${HERMES_REVIEWER_PROFILE:-reviewer}"
BASE="main"
PR=""
REVIEW_TASK=""
ADMIN=0
DRY_RUN=0

die()   { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
usage() { printf 'ERROR: %s\n\nusage: %s --pr <number> --review-task <task_id> [--admin] [--dry-run]\n' \
          "$*" "${0##*/}" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)          PR="${2:-}";          shift 2 ;;
    --review-task) REVIEW_TASK="${2:-}"; shift 2 ;;
    --repo)        REPO="${2:-}";        shift 2 ;;
    --board)       BOARD="${2:-}";       shift 2 ;;
    --reviewer)    REVIEWER="${2:-}";    shift 2 ;;
    --admin)       ADMIN=1;              shift   ;;
    --dry-run)     DRY_RUN=1;            shift   ;;
    -h|--help)     usage "help requested" ;;
    *)             usage "unknown argument: $1" ;;
  esac
done

[[ -n "$PR" ]]          || usage "--pr is required"
[[ "$PR" =~ ^[0-9]+$ ]] || usage "--pr must be a number, got: $PR"
[[ -n "$REVIEW_TASK" ]] || usage "--review-task is required (the Kanban task that was reviewed)"
[[ -f "$GATE" ]]        || die "gate module not found at $GATE"

for tool in gh jq node hermes; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not on PATH"
done
gh auth status >/dev/null 2>&1 || die "gh is not authenticated"

printf '\nGate check: %s PR #%s (review task %s)\n\n' "$REPO" "$PR" "$REVIEW_TASK"

# Reads one evidence source and asserts its JSON shape, failing closed rather than
# substituting a default: an unreadable source is indistinguishable from an empty
# one to the gate, and empty evidence must never be the reason a merge is allowed.
#
# `collect` runs inside a command substitution, so its own `exit` would leave only
# the subshell. It returns instead, and every call site propagates that with
# `|| exit 1` — the assignment carries the substitution's status.
collect() {
  local label="$1" shape="$2"; shift 2
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [[ $rc -ne 0 ]]; then
    printf 'ERROR: could not read %s (exit %s): %s\n' "$label" "$rc" "$out" >&2
    return 1
  fi
  if ! jq -e "type == \"$shape\"" >/dev/null 2>&1 <<<"$out"; then
    printf 'ERROR: %s is not a JSON %s: %s\n' "$label" "$shape" "$out" >&2
    return 1
  fi
  printf '%s' "$out"
}

META="$(collect "PR #$PR" object gh pr view "$PR" --repo "$REPO" \
  --json state,isDraft,baseRefName,headRefOid,reviewDecision,title,url)" || exit 1
HEAD="$(jq -r '.headRefOid' <<<"$META")"
TITLE="$(jq -r '.title'     <<<"$META")"

FILES="$(collect "changed paths for PR #$PR" array \
  gh pr view "$PR" --repo "$REPO" --json files --jq '[.files[].path]')" || exit 1

CONTEXTS="$(collect "required contexts from $BASE branch protection" array \
  gh api "repos/$REPO/branches/$BASE/protection" --jq '[.required_status_checks.contexts[]]')" || exit 1

RUNS="$(collect "Kanban runs for $REVIEW_TASK on board $BOARD" array \
  hermes kanban --board "$BOARD" runs "$REVIEW_TASK" --json)" || exit 1

# `gh pr checks` exits 8 for "checks pending" and 1 for failures, and still prints
# JSON in both cases, so its status is judged from the buckets rather than its exit
# code — which is why this one source is not read through `collect`.
CHECKS="$(gh pr checks "$PR" --repo "$REPO" --required --json name,bucket 2>&1)"
jq -e 'type == "array"' >/dev/null 2>&1 <<<"$CHECKS" \
  || die "could not read required checks for PR #$PR: $CHECKS"

EVIDENCE="$(jq -n \
  --argjson pr "$META" --argjson checks "$CHECKS" --argjson contexts "$CONTEXTS" \
  --argjson runs "$RUNS" --argjson files "$FILES" --arg base "$BASE" --arg reviewer "$REVIEWER" \
  '{pullRequest: $pr, expectedBase: $base, requiredContexts: $contexts, reportedChecks: $checks,
    reviewerProfile: $reviewer, githubReviewDecision: ($pr.reviewDecision // ""),
    runs: $runs, changedPaths: $files}')"

node "$GATE" --evidence - <<<"$EVIDENCE"
GATE_RC=$?
if [[ $GATE_RC -ne 0 ]]; then
  printf '\nRefusing to merge PR #%s. Do NOT reach for --admin to get past a gate:\n' "$PR" >&2
  printf '  a context that never started is absent from the reported set, not pending in it —\n' >&2
  printf '  wait for it, or rerun the run that should have produced it.\n' >&2
  exit "$GATE_RC"
fi

printf '\nAll gates passed for PR #%s — %s\n' "$PR" "$TITLE"

if [[ $DRY_RUN -eq 1 ]]; then
  printf 'Dry run: stopping before merge.\n'
  exit 0
fi

MERGE_ARGS=(--merge --delete-branch --match-head-commit "$HEAD")
if [[ $ADMIN -eq 1 ]]; then
  printf 'Merging with --admin (permitted: every required check already passed).\n'
  MERGE_ARGS+=(--admin)
else
  printf 'Merging.\n'
fi

MERGE_OUT="$(gh pr merge "$PR" --repo "$REPO" "${MERGE_ARGS[@]}" 2>&1)"
MERGE_RC=$?
if [[ $MERGE_RC -ne 0 ]]; then
  printf 'ERROR: merge failed:\n%s\n' "$MERGE_OUT" >&2
  printf '\nIf this says the branch is out of date, rebase onto origin/main and let the\nrequired checks rerun. Do not reach for --admin to skip them.\n' >&2
  exit 1
fi

MERGE_SHA=""
for _ in 1 2 3; do
  MERGE_SHA="$(gh pr view "$PR" --repo "$REPO" --json mergeCommit --jq '.mergeCommit.oid // ""' 2>/dev/null)"
  [[ -n "$MERGE_SHA" ]] && break
  sleep 2
done

printf '\nMerged PR #%s\nMerge SHA: %s\n\n' "$PR" "${MERGE_SHA:-<unavailable>}"
printf 'Kanban completion metadata:\n'
jq -n --argjson pr "$PR" --arg sha "$MERGE_SHA" --arg task "$REVIEW_TASK" \
  --argjson admin "$([[ $ADMIN -eq 1 ]] && echo true || echo false)" \
  '{github_pr: $pr, required_ci_green: true, review_approved: true,
    review_task: $task, merge_sha: $sha, admin_merge_used: $admin}'
