# Design — version-the-sanctioned-merge-gate

## Context

The merge path is the last gate before `main`. Everything the repository's governance rests on —
required checks, the review verdict, the reachability of a commit a record binds — is enforced at
that moment or not at all. It was the one piece of that machinery with no test and no check.

The header of the out-of-tree script explains why it was out of tree: root `scripts/` is unclassified
in `openspec/governance/design-pattern-policy.json`, and unclassified paths fail closed against
`design-pattern-governance`. That reasoning is sound but it drew the wrong conclusion. `scripts/` is
not the only home available, and it is not the right one: `.github/scripts/` is already classified
`governance_core`, which is exactly the class a merge gate belongs in.

## Decision

**Split judgment from collection.** `merge-gate.mjs` holds every decision as a pure function over a
plain JSON evidence object. `merge-pr.sh` gathers that evidence from `gh` and `hermes` and merges.
Nothing in the decision half opens a socket or spawns a process, so a fixture can assert both arms of
each gate in milliseconds.

This is the property the previous arrangement lacked, and the reason both defects were invisible: a
gate whose logic can only run against live GitHub state is only ever exercised on inputs that happen
to occur. Neither defect occurs on a healthy pull request. The missing-context defect needs a run
where an upstream job was evicted; the squash defect needs a pull request whose commit a governance
record later binds. Both are cheap to express as fixtures and expensive to wait for in the wild.

**Assert presence against branch protection, not against the reported set.** Gate 2 reads
`.required_status_checks.contexts` and requires every context to be present in the reported checks
*and* passing. The two failure modes are reported separately, because they call for different
actions: a context that never started means wait or re-run the job that should have produced it, and
a context that reported a failure means fix the change.

**One merge method.** Every pull request lands as a merge commit. Archive pull requests keep their
own recorded reason — archive-movement exactness is re-derived from history, which a squash makes
impossible — but the method no longer depends on detecting them, so misdetecting one cannot pick the
wrong method.

**Fail closed on unreadable evidence.** Unreadable branch protection, a non-array check list, and a
pull request reporting no changed paths all refuse. An empty evidence source and a healthy one are
indistinguishable to a gate that treats absence as consent.

## Alternatives considered

**Classify root `scripts/` and put the script there.** Rejected. It requires editing
`design-pattern-policy.json` — a `governance_core` path — to create a class that would hold exactly
one file, and it invents a weaker classification (`operator_tooling`) for an artifact that decides
what enters `main`. `.github/scripts/` already carries the correct class and needs no policy edit.

**Keep the script in bash and test it with a bash harness.** Rejected. The repository has no bash
test runner, `node --test` is already wired into the required `design-pattern-governance` job, and
the decision logic is data transformation, not shell.

**Rewrite the whole thing in Node.** Rejected for now. The operator entry point is mostly `gh` and
`hermes` invocations with argument parsing, where bash is at its best and a rewrite would be pure
behavioural risk in the one script that must not misbehave. The judgment — the part that had defects
— is the part that moved.

**Add a new required context for the merge-gate tests.** Rejected. Pinning a new context in branch
protection makes every currently open pull request unmergeable until it re-runs, and branch
protection is deliberately edited by hand. The arms belong inside the existing
`design-pattern-governance` context, which already runs `node --test` over two directories.

## Risks

- **The versioned script and the out-of-tree copy can drift.** Mitigated by making the versioned one
  canonical and reducing the out-of-tree copy to a delegating shim in the same change.
- **A glob picks up a future test file that is slow or flaky.** Accepted: that is the same trade the
  `openspec/tests/**` globs already make, and a test nobody runs is the failure this change exists to
  remove.
