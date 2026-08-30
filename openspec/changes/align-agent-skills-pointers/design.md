## Context

See `proposal.md` — Why. Three constraints shape the approach.

`CLAUDE.md` and `AGENTS.md` match the `governance_core` path class in
`openspec/governance/design-pattern-policy.json`, and `governance_core_path` is a
`full_assessment_triggers` entry. Any edit to either file, however small,
therefore requires this change to own the path and to carry a full assessment.
That cost is per-change, not per-line, so the two files are corrected together
rather than in separate passes.

Both files are gitignored. Commit `54eb1a9` added them, and `git log --all` over
either path is empty: they have never been tracked. The policy classifies them
defensively, for a state the repository has never been in. Until the ignore rule
changes, `git status` does not report them, the perimeter never inspects them,
and any correction stays on one workstation.

Hermes Kanban is the canonical execution tracker but has no label vocabulary. The
CLI models task state as one of nine statuses — `triage`, `todo`, `ready`,
`scheduled`, `running`, `review`, `blocked`, `done`, `archived` — plus four typed
block kinds: `capability`, `dependency`, `needs_input`, `transient`. A role→label
mapping has nothing to bind to.

The five canonical triage roles are vocabulary the installed `triage` skill
speaks. They cannot be renamed here; only the right-hand column of the mapping is
ours to define.

## Goals / Non-Goals

**Goals:**

- Bring both operating documents into the repository, so a correction reaches
  every clone and every future revision passes through review.
- Make every `## Agent skills` pointer in both documents agree with the document
  it points at.
- Give the `triage` skill a right-hand column that names states an agent can
  actually set.
- Publish nothing false: every claim in a newly tracked document is verified
  before the commit that makes it normative.
- Keep the whole edit inside `governance_core` and `documentation_only` paths, so
  no normative source, test, or workflow is disturbed.

**Non-Goals:**

- Creating the four missing GitHub labels. GitHub Issues is an intake surface;
  its labels are not the triage vocabulary and are left as they are.
- Changing `docs/agents/issue-tracker.md` or `docs/agents/domain.md`. Both are
  already accurate.
- Changing `docs/agents/orchestration.md`, which describes dispatch, not triage.
- Any change to the Kanban board's contents, statuses, or assignees.

## Decisions

**Map roles to statuses and block kinds, not to labels.**

`needs-triage` → status `triage`; `ready-for-agent` → status `ready`;
`wontfix` → status `archived`. These three are direct: the status name and the
role name denote the same state.

The two waiting roles both land on status `blocked` and are separated by block
kind, which is what the kinds exist for. `needs-info` → `needs_input`, whose help
text reads "go to blocked for a human". `ready-for-human` → `capability`, which
records that the work exceeds what an agent may do rather than that information
is missing. Both route to `blocked`, so the block kind is the only thing carrying
the distinction — omitting it would collapse two roles into one state.

*Alternative considered:* map both waiting roles to a generic block with prose in
the reason string. Rejected because the reason is free text, so an agent reading
the board cannot distinguish the two roles programmatically, and
`hermes kanban ls --status blocked` would not separate them.

*Alternative considered:* map `wontfix` to `done` with a result note. Rejected
because `done` is the success terminal that the orchestration contract treats as
a completed task; overloading it would make a declined task indistinguishable
from a delivered one in every count and query.

**Track the two operating documents rather than leaving them ignored.**

The pointer defects are only the visible symptom; the cause is that the two
documents agents obey are outside the repository, so nothing reviews them and
nothing detects drift. Removing the two `.gitignore` entries makes them tracked,
which puts every future revision through the same review and governance perimeter
as the rest of the repository.

*Alternative considered:* respect commit `54eb1a9` and ship only the triage
mapping, keeping the pointer fixes local. Rejected because it leaves every clone
but this one with no agent-skills pointers, and preserves exactly the
outside-review condition that allowed the drift.

*Alternative considered:* add the pointers to `.hermes.md`, which is already
tracked. Rejected because it creates a third document carrying the same pointers
while the two documents agents actually load stay untracked and free to drift.

**Verify every claim in a document before tracking it.**

An error in an ignored file misleads one workstation; the same error in a tracked
governance-core file is a repository defect that agents inherit. The branch
protection paragraph in `CLAUDE.md` asserts a sole CODEOWNER and an approval that
an admin merge substitutes for. The live API says otherwise: no CODEOWNERS file
exists and `required_pull_request_reviews` is null, so `reviewDecision` is empty
on every PR. The paragraph is corrected in this change because the act of
committing is what would make it normative.

**Correct both operating documents in one change.**

*Alternative considered:* correct `CLAUDE.md` only, since it is the file this
repository's tooling loads by default. Rejected because `AGENTS.md` is read by
other agent runtimes and its block is not merely stale but truncated; leaving it
half-written reproduces the same class of defect this change exists to remove,
and a second `governance_core` change would cost a second full assessment.

**Record in `triage-labels.md` that the roles are not labels.**

The file's name and its prior contents both imply a label vocabulary. A reader
who finds statuses in a file called `triage-labels.md` needs to be told why. The
file is renamed in content, not in path: the `triage` skill and both operating
documents reference the path, and renaming it would widen the change to no
benefit.

## Risks / Trade-offs

**A future reader trusts the filename over the contents and looks for GitHub
labels** → The file states in its first paragraph that the roles map to Kanban
states and that no corresponding GitHub labels exist.

**Hermes Kanban adds a label facility later, making the mapping stale in the
opposite direction** → The mapping is a table in a `documentation_only` file;
updating it then costs nothing. The `governance_core` pointers name the file, not
the mapping, so they would not need to change again.

**The `triage` skill expects to apply a label and cannot set a Kanban status** →
Out of scope for this change and unchanged by it. The file documents the
correspondence; a skill that cannot act on it is no worse off than it is today,
when the labels it would apply do not exist either.

**A newly tracked document carries a claim that is wrong or becomes wrong** →
Every claim was checked against a live source before commit, and tracking is what
makes future drift reviewable rather than silent.

**Contributors who kept private notes in their local `CLAUDE.md` find it now
tracked** → The rule is removed, not the file: an existing local copy is
untouched until someone stages it, and `git status` surfaces it rather than
hiding it.

## Migration Plan

The change edits one ignore rule and three Markdown files, two of which enter the
tree for the first time. Rollback is `git revert` of the single commit, which
restores the ignore rule and removes both documents from the tree while leaving
each contributor's working copy in place. Nothing reads any of these files at
build or test time, so no artifact regenerates and no gate output changes.
