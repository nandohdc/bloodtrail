## 1. Coverage

- [x] 1.1 Record the coverage basis, the reproduced failure, and why the correction cannot carry its own assessment. — `proposal.md` records all three. Reproduced at `72a39e54001079434f3b7ad9f518287d59369ff0` with the correction applied: the final governance phase fails closed with `openspec-association-unrelated` on `packages/security-audit-sdk-core/tests/verification/local-instruction-classification.test.mjs` and `.../mutations.test.mjs`. Giving the correction its own assessment instead fails with `grandfathered-scope-expanded`, because an honest assessment declares `canonical_capability_requirement`, which the provenance schema lists under `scope_expansion_triggers`. With this change present the same phase passes: `enforcement active; inspected 1 commit(s) and 8 path(s)`.
- [ ] 1.2 Remain active, declaring `security-audit-sdk-core` and owning the two control paths, until the correction merges and its archive folds its spec delta.

## 2. Landing (human-owned)

- [ ] 2.1 Owner identity-preserving merge of this keeper change.
- [ ] 2.2 After the correction's archive merges, archive this change as a pure relocation with no spec fold.
