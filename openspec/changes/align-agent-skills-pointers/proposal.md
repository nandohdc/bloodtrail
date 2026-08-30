## Why

`CLAUDE.md` and `AGENTS.md` are loaded as authoritative operating instructions by
the agent runtimes that work in this repository, and both currently misdirect.
`CLAUDE.md` states that issues are tracked in GitHub Issues via the `gh` CLI,
which contradicts `docs/agents/issue-tracker.md` — the file it points at — where
Hermes Kanban was made canonical. `AGENTS.md` carries only the first of the three
`## Agent skills` sub-blocks, so its readers get no pointer to the triage or
domain-doc conventions at all.

Neither file is in the repository. Commit `54eb1a9` added both to `.gitignore`,
and `git log --all` shows they have never been tracked. Correcting them in place
therefore fixes one workstation and reaches no other clone, machine, or agent
runtime — and leaves them outside review and outside the governance perimeter,
which is the condition that let both drift undetected in the first place.

`docs/agents/triage-labels.md` compounds this: it maps the five canonical triage
roles onto GitHub label strings, but only `wontfix` exists in the repository's
label set, and Hermes Kanban has no label vocabulary whatsoever. The table
describes neither tracker, so an agent following it cannot act.

## What Changes

- Remove the `CLAUDE.md` and `AGENTS.md` entries from `.gitignore` so both
  operating documents become tracked, reviewable, and shared across clones.
- Correct the `### Issue tracker` sub-block in `CLAUDE.md` to name Hermes Kanban
  and the `bloodtrail` board, and to record that GitHub Issues remain an external
  intake surface only.
- Correct the branch-protection paragraph in `CLAUDE.md`, which claims
  `@nandohdc` is the sole CODEOWNER and that an admin merge substitutes for an
  approval. No CODEOWNERS file exists and `required_pull_request_reviews` is
  null, so there is no approval to substitute for. Committing the file is what
  would make that claim normative.
- Complete the `## Agent skills` block in `AGENTS.md` with the missing
  `### Triage labels` and `### Domain docs` sub-blocks, so both operating
  documents carry the same three pointers.
- Rewrite `docs/agents/triage-labels.md` to map the five canonical triage roles
  onto the states Hermes Kanban actually models — the `triage`, `ready`, and
  `archived` statuses, and the `needs_input` and `capability` block kinds — and
  to state explicitly that the roles are not GitHub labels.

No behavior of the security audit contract, the SDK, or any governance checker
changes. This is a documentation-accuracy repair plus the ignore-rule change that
lets the repaired documents reach the repository.

## Capabilities

### New Capabilities

None. No capability is introduced.

### Modified Capabilities

None. No capability requirement changes; `.openspec.yaml` sets `skip_specs: true`
because the change alters operating documentation and one ignore rule, not
specified behavior.

The assessment declares `change-governance` as the capability this change
concerns, with `material_capability_modification: false`. The change conforms to
that capability's existing requirement that repository-state claims be
gate-enforced rather than narrated — the branch-protection paragraph asserted a
CODEOWNER and an approval gate that no gate enforces and that do not exist — but
it modifies no requirement, so there is no delta.

## Impact

- `.gitignore`, `CLAUDE.md`, and `AGENTS.md` are `governance_core` paths, so this
  change matches the `governance_core_path` full-assessment trigger and carries a
  full assessment with all fifteen security dimensions justified.
- `docs/agents/triage-labels.md` is `documentation_only`.
- Two documents that agents already obey enter reviewable history for the first
  time. Every future revision to them becomes subject to review and to the
  governance perimeter.
- Agents reading either operating document will be directed to Hermes Kanban for
  execution state rather than to GitHub Issues.
- No source, test, contract, generated artifact, or CI workflow is touched.
