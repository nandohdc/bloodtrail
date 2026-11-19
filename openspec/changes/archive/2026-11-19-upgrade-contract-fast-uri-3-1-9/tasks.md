The completed tasks below record original replacement candidate `7dc8aed1bfda8324fbf8d691fe3e4340ad3ff1ca`. Its lockfile update is now present on main through owner-merged #888. They do not claim that this rebased PR applies or retroactively approves that implementation.

## 1. Planning and ownership

- [x] 1.1 Author proposal, design, tasks, full assessment and contract reuse record before the lockfile update; verify strict OpenSpec validation, generated assessment consistency and assessment-phase governance.

## 2. Dependency refresh

- [x] 2.1 Apply the exact contract lockfile bytes from #888; verify only fast-uri's version, resolved URL and integrity change to 3.1.9, with unchanged direct dependencies and all unrelated entries.

## 3. Integration verification

- [x] 3.1 Install with npm ci in the contract workspace, then run check:generated, validate and audits at low and high; verify installed fast-uri is 3.1.9 and generated content has no drift.
- [x] 3.2 Verify SDK frozen-contract and changed-path checks, final governance, independent baseline/candidate checker arms, contract reuse, merge-stage normative precedence and whitespace checks; record exact outcomes in the PR.

- [x] 3.3 Verify the record-only integration: current main, this candidate and #888 have identical contract lockfiles; installed fast-uri is 3.1.9; generation and contract validation remain current.

## Workflow follow-up

- Record two-axis and independent model reviews on the exact final candidate; require all declared CI contexts and DeepScan before merge.
- Record that #888 is already owner-merged and retain the original alternative's history under #893; no bot supersession action remains.
- Archive these historical skip-specs change records in a separate later PR; no canonical fold is needed.
  Done under #990. The dependency update merged in #888 as `2ae8c92`. This change's assessment, verification
  record and reconciliation merged in #894 as `dd7dbd2`, whose PR body also records the other two follow-ups:
  the two-axis and independent reviews on its exact head with all ten required contexts plus DeepScan green,
  and that #888 was already owner-merged with the original alternative retained under #893.
  Archived to `openspec/changes/archive/2026-11-19-upgrade-contract-fast-uri-3-1-9/`;
  `TZ=UTC date +%F` gave `2026-11-19`, the archive day. The change declares `skip_specs: true`, so the
  archive writes no canonical spec, and its contract reuse record moves with it.
