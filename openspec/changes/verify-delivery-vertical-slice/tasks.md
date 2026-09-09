## 1. Gate and freeze

- [x] 1.1 Confirm #103–#108 are all closed and #102's delivery-conformance-contract is folded into `openspec/specs/delivery-conformance-contract/spec.md`; record the exact `main` commit and both packages' built versions as the frozen baseline for this evidence. — All closed; frozen at `2833852489e162954bdd495a4c466cbdc75fee84` (both packages `0.1.0`).
- [x] 1.2 Post the independence-mechanism limitation on #109 (this repository's chain has no separate-reviewer mechanism, unlike #60 in the remediation lifecycle) rather than claim an independence that doesn't exist. — Posted.

## 2. Build the harness

- [x] 2.1 Build both `packages/security-audit-sdk-node` and `packages/security-audit-collector` and write a harness script (inside this change's own directory) that imports each package's built `dist/` output via relative paths — no new package.json, no cross-package dependency in either package.
- [x] 2.2 Implement a fake HTTP exchange that routes a producer's request directly into a real, in-process `CollectorIngress`, translating its `IngressResult` into the handoff's expected response shape (the same pattern #391's own reproduction used).
- [x] 2.3 Implement the nine arms from the repository's prior plan (F3): happy path, timeout, retry exhaustion, overload, shutdown-at-deadline, invalid authentication, unsupported version, duplicate, and the null control — each an injection switch on the fake exchange/clock/backpressure, never a change to production code.

## 3. Run the matrix

- [x] 3.1 Run all nine arms three times each; record the observed delivery-conformance-contract result class verbatim for every run. — See `harness/run-output.txt`.
- [x] 3.2 Do not fix anything a mismatch reveals — record it as a finding and stop that arm. — No mismatch found; all nine arms PASS.
- [x] 3.3 Confirm every arm is deterministic across its three runs; a varying result is itself a recorded failure of that arm. — All nine deterministic.

## 4. Publish the evidence

- [x] 4.1 Write `evidence.md` inside this change's directory naming: the exact frozen commit and package versions, the exact re-run command, the nine-row PASS/FAIL matrix (scoring only `security_significant` scenarios; `best_effort`/`transaction_critical`/`policy_critical` scenarios recorded as **not exercised**), and residual limitations. — Also includes a full 21-scenario coverage table, per the acceptance criterion "every delivery conformance scenario."
- [x] 4.2 Review the evidence's language for any exactly-once or durability claim and remove it if found — none should survive. — Reviewed; none present.
- [x] 4.3 State the fakes-not-a-deployed-system limitation and the non-independent-pass limitation explicitly in `evidence.md`, not only in the issue thread. — Done.

## 5. Deliver and archive

- [x] 5.1 Open the proposal PR (planning artifacts only); merge only when every required branch-protection context is green on the exact head. — PR #397, merged `2833852`.
- [ ] 5.2 Open the harness-and-evidence PR (section 2–4 changes, entirely inside this change's own directory); merge only when every required branch-protection context is green on the exact head.
- [ ] 5.3 Archive the completed change with byte-preserving relocation and `archive-evidence.md`; verify strict OpenSpec validation and the repository's governance-gate chain, then merge as a merge commit.

## 6. Hand off and close

- [ ] 6.1 Comment on #110 and #111 with the evidence path and the exact commits they must bind to.
- [ ] 6.2 Comment on #112, #113, #116 that upstream evidence now exists but the freezes are still open.
- [ ] 6.3 Close #109 with the evidence path, and tick it in #132's Wave 4 checklist.
