## 1. Assessment

- [x] 1.1 Record the pilot finding (#478) and the delegated design choice with `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`; generate the full assessment and justify every security dimension.

## 2. Implementation

- [ ] 2.1 With storage configured, route every validated submission to the persist stage without consulting the in-memory ledger; map `written` to `persisted`, `duplicate` to the duplicate outcome acknowledged `persisted`, and keep every failure diagnostic; remove the ledger's release, persisted-flag, and acknowledgment plumbing.
- [ ] 2.2 Update the README and `compatibility.json` to state which authority decides duplicates in each mode.

## 3. Verification

- [ ] 3.1 Prove more than 32 distinct identities persist within one window with storage, while the ledger's capacity rejection still fires without it; prove a second sender's resubmission of a stored occurrence is a persisted duplicate and different content is a storage conflict; run `npm run validate --prefix packages/security-audit-collector`, strict OpenSpec validation, the governance phases, and `cs delta`.

## 4. Delivery

- [ ] 4.1 Merge the implementation PR when all ten required checks are green on the exact head.
- [ ] 4.2 Fold the delta in its own PR, then archive in its own PR; close #478 after the archive merges.
