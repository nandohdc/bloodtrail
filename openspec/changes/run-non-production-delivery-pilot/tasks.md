## 1. Authorization and harness

- [x] 1.1 Write the pilot authorization naming environment, exact versions, data classification, duration and volume, owners, stop criteria, rollback, and closure, with the delegated `decision_source`.
- [x] 1.2 Write the harness over the real producer delivery stack, the real collector with `SqliteStorage`, a loopback HTTP socket, and `fetch`, with a preflight that proves every stop criterion and the rollback before traffic, and unconditional rollback.
- [x] 1.3 Generate the full assessment and validate strictly.

## 2. Runs

- [x] 2.1 Run 1 at `main` `d4bd9b6`: record the result. It terminated on `SC4-deadline` after the deduplication ledger capped persisted throughput at 32 identities, and it was rolled back. File the finding (#478).
- [x] 2.2 After #478's fix merges, run 2 at the exact `main` commit, record every metric and the rollback check in `harness/evidence.md`, and confirm no stop criterion fired. — Run 2 at `main` `93e4f49`: no stop criterion fired; 600/600 valid deliveries acknowledged, 616 persisted and read back, 0 capacity rejections; rolled back.

## 3. Closure

- [ ] 3.1 Merge each PR with all ten required checks green on the exact head.
- [ ] 3.2 Archive the change in its own PR; close #116 with the closure report, stating that it authorizes nothing further.
