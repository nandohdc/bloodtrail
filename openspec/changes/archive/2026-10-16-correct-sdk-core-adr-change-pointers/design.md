## Context

Five SDK-core ADRs retain active-directory pointers to owning changes that have since been archived. Their archived directories exist at baseline `6252e55abe49d760d61fc8b01a34e413783713d5`. A new active change must own this correction because the archived changes cannot supply final-phase OpenSpec association for the governed implementation paths.

Decision source: owner request, 2026-10-16: "fix the stale \"Owning change\" pointers in ADR-013 to ADR-017" (via /plan in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E).

This is a request, not a review or an approval. AI review is not approval.

## Goals / Non-Goals

**Goals:**

- Make the five owning-change pointers resolve to their archived directories.
- Preserve every other ADR byte, including decision text, whitespace and final newlines.

**Non-Goals:**

- Changing requirements, APIs, runtime behaviour, contracts or gates.
- Editing archived changes or archiving this change in this pull request.
- Changing the archive convention.

## Decisions

### Replace only the five directory pointers

Use the existing archived directory for each owning change, preserving the line-6 label and backticks. Verify each target with `git cat-file -e` at the pinned baseline, then reverse only the replacement and compare each ADR byte-for-byte with its baseline blob. Existing gates verify the bounded change without adding tests or scripts.

### Reject deleting or abbreviating provenance

- **Delete the Owning change line**: rejected because it loses the decision's provenance.
- **Name only the change id**: rejected because the existing ADRs name directories, and a bare id is less directly resolvable.

### Keep archive mechanics out of scope

Every later archive will leave a fresh ADR pointer stale, because an archive must be a pure `git mv`. Changing that convention is out of scope. After this implementation merges, archive this change in a separate pull request.
