## 1. Inventory and assessment

- [x] 1.1 Record the governed adapter inventory approving A1 only, with the candidates not approved and why, and the delegated `decision_source`.
- [x] 1.2 Generate the full assessment and justify every security dimension.

## 2. Implementation

- [x] 2.1 Implement `createFetchHttpExchange` with origin, deadline, and response-bound validation, no redirects, bounded reads, and the native-to-exchange mapping; export it with ADR-NODE-003, the frozen lists, and a `freezeRecord` amendment.
- [x] 2.2 Add the per-file `fetchExchange` coupling role and confinement arms for `fetch` outside the adapter and an extra built-in inside it.

## 3. Verification

- [x] 3.1 Parameterize the common per-class conformance suite by transport and run it through A1 over loopback; add the adapter-specific arms; run `npm run validate --prefix packages/security-audit-sdk-node`, strict OpenSpec validation, the governance phases, and `cs delta`.

## 4. Delivery

- [x] 4.1 Merge the implementation PR when all ten required checks are green on the exact head. — PR #483 merged as c8bf7e8 with all checks green on exact head a63668d.
- [ ] 4.2 Fold the delta in its own PR, archive in its own PR, and close #113 after the archive merges.
