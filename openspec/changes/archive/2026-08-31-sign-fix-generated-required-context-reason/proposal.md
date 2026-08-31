## Why

`fix-generated-required-context-reason` (#217) merged as `c8c6e9f` and archived as `5387439` with tasks 4.3 and 4.4 unchecked. Those tasks made an exact-commit owner decision a precondition for merge and for archive; no such decision existed. The archived reconciliation note records that gap honestly and argues the tasks over-scoped the change, since `CONTRIBUTING.md` does not require owner attestation merely to land or archive work whose workspaces are unpublished and undeployed.

The project owner has now given that decision. The repository already has the mechanism for holding one — `governanceRecords` in `packages/security-audit-sdk-core/verification-lifecycle.json`, resolved by `check-governance-history.mjs` — and the archived note explicitly observes that this change declares no entry there. Storing the record puts the authorization in verifiable repository state instead of leaving it in conversation, and binds it to content objects rather than to a claim.

## What Changes

- Register `fix-generated-required-context-reason` in the independent record inventory in `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs` (`EXPECTED_RECORD_IDS` and `MINIMUM_REVIEWED_PATHS`). That inventory is deliberately not derived from the manifest, so a record cannot be stored without an explicit reviewed edit here first.
- Add the signed governance record to `governanceRecords`, binding technical commit `877d77f` and the four reviewed subtrees that commit's changed-path set covers, with the owner instruction recorded verbatim.
- Record what the binding does not establish: the decision followed the merge rather than gating it, the R15 freshness scan does not run for an archived change, and the merge carried one commit outside #217's scope.
- Leave the archived change untouched. Tasks 4.3 and 4.4 keep their original wording and stay unchecked: they were not satisfied as written, and this record does not retroactively satisfy them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Storing a governance record is an instance of the existing `change-governance` capability, not a change to what that capability requires; the inventory edit is reviewed test data. `.openspec.yaml` therefore declares `skip_specs: true`.

## Impact

- `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs`
- `packages/security-audit-sdk-core/verification-lifecycle.json`
- `openspec/changes/sign-fix-generated-required-context-reason/`
- Tracking issue: #217, closed only after the record is reachable from `main`

No contract source, catalog, schema, generated projection, runtime behavior, public API, compatibility policy, package metadata, dependency, transport, delivery, storage, production integration, or real-user processing changes. The archived change's artifacts are not modified.
