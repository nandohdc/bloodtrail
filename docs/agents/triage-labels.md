# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the state each one takes in this repo's tracker.

**The roles are GitHub labels here.** The execution tracker is GitHub Issues (see
`docs/agents/issue-tracker.md`), and all five role names exist in this
repository's label set and are in active use.

## Role mapping

| Canonical role    | GitHub label      | Meaning                                           |
| ----------------- | ----------------- | ------------------------------------------------- |
| `needs-triage`    | `needs-triage`    | Not yet evaluated                                 |
| `needs-info`      | `needs-info`      | Waiting on a human for information                |
| `ready-for-agent` | `ready-for-agent` | Fully specified, dispatchable to a worker profile |
| `ready-for-human` | `ready-for-human` | Beyond what an agent may do; needs a human        |
| `wontfix`         | `wontfix`         | Will not be actioned, with the issue closed       |

When a skill mentions a role — for example, "apply the AFK-ready triage label" —
apply the label of the same name.

`needs-info` and `ready-for-human` are distinct labels, so nothing collapses them
the way a shared `blocked` status would: `needs-info` means the issue is
under-specified and a human must supply what is missing; `ready-for-human` means
the issue is well specified but exceeds what an agent may do.

Closure is carried by issue state rather than by a label. `wontfix` is applied
*and* the issue is closed with `state_reason: not_planned`, so a `wontfix` label
on an open issue is an unfinished triage rather than a decision.

## Why the previous mapping was withdrawn

This file previously mapped the five roles onto Hermes Kanban statuses and typed
block kinds, on the stated grounds that "of the five role names, only `wontfix`
exists in this repository's GitHub label set."

That is no longer true, and had stopped being true before this edit. Measured on
`2026-09-09`:

| Label | Issues carrying it |
| --- | --- |
| `needs-triage` | 41 |
| `wontfix` | 18 |
| `ready-for-agent` | 16 |
| `ready-for-human` | 5 |
| `needs-info` | 2 |

Four of the five labels the file told agents not to create already existed and
carried 64 applications between them. An agent following the old instruction
would have set state on a board nobody reads while leaving the labels that are
actually filtered on untouched.

`decision_source = "delegated to Claude by the owner, 2026-09-09; not a human
owner decision"`, recorded under #308.

## Other GitHub labels

The remaining labels classify rather than triage and are unrelated to this table:
`bug`, `enhancement`, `documentation`, `question`, `duplicate`, `invalid`,
`severity:{critical,high,medium,low}`, `openspec-change-needed`,
`security-audit-sdk`, `verification`, `area:{core,device,server}`, plus the
`autorelease: *` labels Release Please manages and the `dependencies` /
`javascript` labels Dependabot applies. Do not overload them with triage meaning.

## Hermes Kanban block kinds

Inside a fleet run the board still models blocking with typed kinds, and they do
not map onto labels one-to-one: `needs_input` and `capability` correspond to
`needs-info` and `ready-for-human` above, while `dependency` (waits in `todo`,
promoted automatically when parents finish, no human involved) and `transient` (a
maybe-flaky failure) are not triage roles at all and have no label.
