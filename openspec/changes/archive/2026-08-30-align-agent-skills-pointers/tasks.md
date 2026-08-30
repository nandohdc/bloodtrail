## 1. Governance evidence and planning

- [x] 1.1 Record the full assessment for this change, including the `governance_core_path` trigger and all fifteen security-dimension justifications; verify `node openspec/scripts/check-design-pattern-governance.mjs --change align-agent-skills-pointers --phase assessment --base <proposal-baseline>` accepts it.
- [x] 1.2 Confirm the proposal, design, and task plan are coherent and that `.openspec.yaml` declares `skip_specs: true`; verify `openspec validate align-agent-skills-pointers --strict` passes before any operating document is edited.

## 2. Documentation alignment

- [x] 2.1 Rewrite the mapping table in `docs/agents/triage-labels.md` so the five canonical roles resolve to the `triage`, `ready`, and `archived` statuses and the `needs_input` and `capability` block kinds; verify every right-hand value appears in `hermes kanban list --help` and `hermes kanban block --help`.
- [x] 2.2 State in `docs/agents/triage-labels.md` that the roles are Hermes Kanban states rather than labels and that no matching GitHub labels exist; verify the file never presents a GitHub label as the triage vocabulary and names `wontfix` as the only role name that also exists in the repository label set.
- [x] 2.3 Correct the `### Issue tracker` sub-block in `CLAUDE.md` to name Hermes Kanban and the `bloodtrail` board; verify the file no longer claims issues are tracked in GitHub Issues via the `gh` CLI.
- [x] 2.4 Complete the `## Agent skills` block in `AGENTS.md` with the missing `### Triage labels` and `### Domain docs` sub-blocks; verify both operating documents carry the same three pointers and each names an existing file under `docs/agents/`.
- [x] 2.5 Remove the `CLAUDE.md` and `AGENTS.md` entries from `.gitignore` so both operating documents become tracked; verify `git check-ignore` no longer matches either path and both appear as untracked additions.
- [x] 2.6 Correct the branch-protection paragraph in `CLAUDE.md` before it is committed, since tracking the file makes its claims normative; verify against the live API that no CODEOWNERS file exists and that `required_pull_request_reviews` is null.

## 3. Verification

- [x] 3.1 Confirm every `docs/agents/` path referenced by either operating document resolves; verify each referenced file exists on disk.
- [x] 3.2 Inspect the final changed-path set; verify it contains only `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `docs/agents/triage-labels.md`, and this change's own directory, with no source, test, contract, generated artifact, or workflow file touched.
- [x] 3.3 Run the design-pattern-governance check in its final phase against the proposal baseline; verify enforcement is active, every inspected path is classified, and this change owns each governance-core path it modifies.
- [x] 3.4 Run `openspec validate --all --strict`; verify this change and every other active change validate with no new diagnostic.
- [x] 3.5 Confirm repository hygiene on every changed file, including the two newly tracked documents in full; verify each ends with a final newline and contains no trailing whitespace or CR byte.
- [x] 3.6 Confirm the two newly tracked documents are safe to publish; verify neither contains a credential, token, or absolute local path.

## 4. Review and delivery

- [x] 4.1 Complete read-only verification against the exact final commit without fabricating human approval; verify the recorded evidence binds that commit hash.
- [x] 4.2 Create a focused pull request after the approved commit is pushed; verify its head SHA, changed paths, and all required CI checks are green before any merge action.
- [x] 4.3 Archive only after an identity-preserving merge; verify the archive relocation is byte-preserving.
