## Why

#102's delivery-conformance-contract is ratified and #103–#108 (the producer delivery chain and the collector) are all implemented and merged, but only through component-level tests. Nothing yet exercises one producer-to-collector slice end to end, under injected failures, against the conformance contract's own vocabulary. #109 is the evidence gate #110 and #111 (the API freezes) need before freezing anything, and #112, #113, #116 sit behind those. This change produces that evidence without changing any implementation — a mismatch discovered here is a finding to record, not a bug to fix in this pass.

## What Changes

- A deterministic, re-runnable harness wires a real `security-audit-sdk-node` producer (HTTP handoff, bounded retry, bounded backpressure, deadline-bounded shutdown) to a real `security-audit-collector` ingress through an in-memory fake network peer, with injectable failure modes (timeout, retry exhaustion, overload, shutdown-at-deadline, invalid authentication, unsupported version, duplicate) plus the happy path and a null control — nine arms total.
- The harness runs all nine arms three times each (36 total runs across the required repeats, or as documented) to catch non-deterministic arms, and records the observed delivery-conformance-contract result class per arm, verbatim.
- An evidence document names the exact frozen commit of every participating package, the exact package versions, the exact re-run command, the nine-row PASS/FAIL matrix, and residual limitations — explicitly that the harness uses fakes for the network peer and dedupe store (proving the implementation's conformance, not any deployed system's behavior), that only the `security_significant` delivery class is exercised (the only implemented class today — `best_effort`, `transaction_critical`, `policy_critical` scenarios are recorded as **not exercised**, never as PASS), and that this pass was not independently actored (no separate-reviewer mechanism exists in this chain, unlike #60 in the remediation lifecycle).
- No source in `packages/security-audit-sdk-node` or `packages/security-audit-collector` is modified. This change is delta-less (`skip_specs: true`) — it changes no capability's normative requirements.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this change is verification/evidence only and declares `skip_specs: true`)

## Impact

- New harness and evidence live entirely inside this OpenSpec change's own directory (`openspec/changes/verify-delivery-vertical-slice/`), moving to `openspec/changes/archive/<date>-verify-delivery-vertical-slice/` on archive — consistent with this repository's convention that verification evidence documents live in the OpenSpec change, not in a plan file.
- No package's `dependencies`, `devDependencies`, `package.json`, or CI wiring changes — the harness imports each package's already-built `dist/` output via relative paths, so neither package gains a cross-package dependency.
- Consumers: #110 and #111 (API freezes) will bind to the exact commits this evidence names; #112, #113, #116 are noted that upstream evidence now exists but the freezes are still open.
