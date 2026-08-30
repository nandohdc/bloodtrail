# Issue Tracker

The canonical engineering issue tracker for this repository is Hermes Kanban.

Board:

    bloodtrail

GitHub Issues are not the canonical execution tracker.
GitHub is used for pull requests, code review, CI, and merge history.

## Agent access

Workers running under Hermes Kanban MUST use the native kanban_* tools.

Use:

- kanban_show
- kanban_comment
- kanban_create
- kanban_link
- kanban_block
- kanban_request_review
- kanban_request_changes
- kanban_complete

Workers MUST NOT shell out to `hermes kanban ...`.

## Pull requests

Every implementation PR must reference its Hermes task ID.

Example:

    Hermes-Task: t_abcd1234

A PR does not mean a task is complete.

Completion requires the workflow defined in:

    docs/agents/orchestration.md

## GitHub Issues

GitHub Issues may be used as an external intake surface.

When imported, create a Hermes Kanban task and record the GitHub
issue number in the Kanban task metadata/comments.

Hermes Kanban then becomes the source of truth for execution state.
