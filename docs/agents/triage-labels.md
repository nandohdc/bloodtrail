# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the state each one takes in this repo's issue tracker.

**The roles are not labels here.** The canonical tracker is Hermes Kanban (see
`docs/agents/issue-tracker.md`), which has no label facility at all: it models
task state as a status plus, when a task is blocked, a typed block kind. Nor are
they GitHub labels — of the five role names, only `wontfix` exists in this
repository's GitHub label set, and it is not used for triage.

## Role mapping

| Canonical role    | Hermes Kanban state                   | Meaning                                          |
| ----------------- | ------------------------------------- | ------------------------------------------------ |
| `needs-triage`    | status `triage`                       | Not yet evaluated                                |
| `needs-info`      | status `blocked`, block `needs_input` | Waiting on a human for information               |
| `ready-for-agent` | status `ready`                        | Fully specified, dispatchable to a worker profile |
| `ready-for-human` | status `blocked`, block `capability`  | Beyond what an agent may do; needs a human       |
| `wontfix`         | status `archived`                     | Will not be actioned                             |

When a skill mentions a role — for example, "apply the AFK-ready triage label" —
set the corresponding state from this table instead.

## Why the two waiting roles need a block kind

`needs-info` and `ready-for-human` both put a task in `blocked`, so the status
alone cannot tell them apart. The block kind carries the distinction:

- `needs_input` means the task is under-specified and a human must supply the
  missing information before anyone can proceed.
- `capability` means the task is well specified but exceeds what an agent may
  do, so a human must carry it out.

Both route to `blocked` for a human. Omitting the kind collapses two distinct
roles into one indistinguishable state, and `hermes kanban ls --status blocked`
would no longer separate them.

The remaining two kinds are not triage roles. `dependency` waits in `todo` and is
promoted automatically when parents finish, with no human involved; `transient`
marks a maybe-flaky failure.

## GitHub Issues

GitHub Issues is an external intake surface, not the execution tracker. Its own
labels — `bug`, `enhancement`, `severity:*`, `openspec-change-needed`, `area:*`
and the rest — classify inbound reports and are unrelated to this table. Do not
create `needs-triage`, `needs-info`, `ready-for-agent`, or `ready-for-human` as
GitHub labels; triage state belongs on the Kanban task.
