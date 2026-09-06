## 1. Plan and assess the change

- [ ] 1.1 Propose change `retry-artifact-transport-in-ci` with design, tasks, and full design-pattern assessment.

## 2. Implement the coverage artifact upload retry

- [ ] 2.1 Split the `coverage` job's `actions/upload-artifact@v7` step into a first attempt (`id: upload`, `continue-on-error: true`) and a retry step gated on `steps.upload.outcome == 'failure'`, with a 10s wait step between them.
- [ ] 2.2 Keep `if-no-files-found: error`, the exact three-lcov `path:` list, and set `overwrite: true` on both upload attempts.

## 3. Implement the sonar artifact download retry

- [ ] 3.1 Split the `sonar` job's `actions/download-artifact@v8` step into a first attempt (`id: download`, `continue-on-error: true`) and a retry step gated on `steps.download.outcome == 'failure'`, with a 10s wait step between them.
- [ ] 3.2 Confirm the retry step carries no `continue-on-error`, so a second transport failure still reds the job.

## 4. Governance and verification

- [ ] 4.1 Generate the design-pattern assessment from the authored source and verify byte-identical regeneration with `node openspec/scripts/generate-assessment.mjs --change retry-artifact-transport-in-ci --check`.
- [ ] 4.2 Validate OpenSpec changes with `openspec validate --all --strict`.
- [ ] 4.3 Run the design-pattern governance checker (final phase), the dual check against the proposal baseline, and the contract reuse assessment.
- [ ] 4.4 Run `git diff --check` and verify the workflow diff carries the retry shape exactly as described in `design.md`, with no other workflow edit.
