# Archive evidence: run-non-production-delivery-pilot

## Completion record

The authorization, harness, and both runs landed through PR #494: authorization and run 1 in
`ed52313`, run 2 in `02ab4bbb5e`, merged as the two-parent merge commit
`20af795de1288efe1e04cd6bf579ebc97a175d19`. All ten required contexts were green on that exact head
before the administrative merge. The change declares `skip_specs: true` and modifies no requirement.

## Closure report

| Run | Commit | Outcome |
| --- | --- | --- |
| 1 | `d4bd9b6` | Stopped on `SC4-deadline`: the collector's in-memory ledger capped persisted throughput at 32 identities per 300 s. Rolled back. Filed as #478 |
| 2 | `93e4f49` | No stop criterion fired. 600 of 600 valid deliveries acknowledged; 616 persisted and read back under their own tenant only; 0 capacity rejections; no credential or payload marker in any output. Rolled back |

Both runs proved all six stop criteria and the rollback before sending traffic, and both ended with the
pilot directory absent. **The pilot authorizes nothing further**: not production, not a longer or larger
pilot, not real data, and not publication. Each needs its own authorization.

## Reproducing a run

Reproduce a run at the commit its evidence names, where the harness lived at
`openspec/changes/run-non-production-delivery-pilot/harness/pilot.mjs`. The harness resolves the
packages by a path relative to that location, so it does not run from this archive directory. The
relocated copy is kept byte-for-byte as the record of what ran.

## Provenance

The pilot authorization, the owner roles it names, and the operation of both runs were done by Claude
under delegation: `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner
decision"`, renewed by the owner's 2026-09-11 instruction. The owner has not reviewed the
authorization or either run, and no human reviewed any PR in this lifecycle.

## Relocation integrity

Every active-change artifact is relocated byte-for-byte except `tasks.md`, which is reconciled only by
checking closure tasks 3.1 and 3.2. This evidence file is new.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `92723c398bd209ab45fd67c297e9a3fb22553369` |
| `assessment.json` | `174a0fbafa73d70624a9ad77cb886f5011ca96b6` |
| `assessment.source.json` | `9897c087d5b8ffe062633f5d86bbc1b12adc3952` |
| `harness/evidence.md` | `87bb2e62919f225c6e3590275983ba6933ad9a9f` |
| `harness/pilot.mjs` | `f867d38f321cc71286ab21003863cb2ec6d9a142` |
| `harness/run-1-output.json` | `ba55d268b5a94619a9cd886d441a3824cdac52eb` |
| `harness/run-2-output.json` | `330db63ffe43c4f9f88c8769cff6d03f7effe755` |
| `pilot-authorization.md` | `c461e8700ac446ec907ff1c69b348305eec2988b` |
| `proposal.md` | `d8622e1650e7e75358b8316b3c9346cbec9c77d3` |
| `tasks.md` | `5e28d74c12f08d0ca4877cb1fa56a56e8736d3ec` (before reconciliation) |

The change declares `skip_specs: true`; this archive writes no canonical specification.
