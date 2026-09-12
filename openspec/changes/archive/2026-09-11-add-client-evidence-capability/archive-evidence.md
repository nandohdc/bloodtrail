# Archive evidence: add-client-evidence-capability

## Completion record

The proposal landed through PR #488 (head `e73b2cb9d784dfd08c5820bb1b483e5a32506e76`), merged as the two-parent merge commit `34eb95edec107a6ec491ff29a1b18d23ca79461d`. All required contexts were green on that exact head before administrative merge.

The implementation and decision chain landed through:
- **ClientEvidenceEnvelope v1 contract (#123)**: PR #491 (head `502120e3adfaec03e13d9bb60b13cf0cf1d670ee`), merged as `d6efba6a2b8e3a51f8a846f481e37bc7dff75ae9`.
- **Browser Client Evidence SDK package (#124)**: PR #493 (head `c4fe7ef7f4fa11603ba0cf9b5b27eeadfdcb189d`), merged as `83a7c6f05fc08595460a80e14a2432e659223788`.
- **Security Audit Event Contract 2.1.0 reference (#125)**: PR #494 (head `5cf9703d1eeed823d15f935d1af1e31c8caec8c5`), merged as `456aeaa4f6da64b58e74737f19ca03eec0034a7e`. Technical commit `342711fc284a3c1a94e0e1197c9bda0775e7fec0`.
- **Backend ingress stage (#126, #495)**: PR #499 (head `ff85223c31878ec71be9b165b45a64ce140c82f2`), merged as `a4b22dc221b72055cfdcc09a7d53b2012d34dc75`.
- **Claim mapping, Mode A PoC, Mode B decision, and wave resolutions (#127, #128, #129, #130, #131)**: PR #500 (head `6fceb6feda9478bb4b04e359f4fe6883df94a2b1`), merged as `7816e85f73e4b28b3b537772684a7e8a9887af7c`.
  - #127: `InteractionClaimMapper` in collector mapping admitted claims to audit records.
  - #128: Synthetic Mode A proof of concept evaluated over 1,112 interactions; outcome REVISE due to L1 envelope byte bound; follow-up recorded in issue #498.
  - #129: Mode B device-trust evaluated and recorded as NO-GO for P1 in `decisions/129-mode-b-device-trust.md`.
  - #130: Closed without implementation per NO-GO decision.
  - #131: React Native adapter disposition recorded as not implemented in this wave.
- **Canonical spec fold (#132, Task 12.1)**: PR #501 (head `b787a4c0078e6423ed8373c49c55ae9ecf9350df`), merged as `59e84ed57f0eb9894e63bb1da69d71c4314c44f1`.

All remaining wave issues #117 through #131 are resolved and closed. Issue #132 closes after this archive merges, with the final roadmap lifecycle audit report recorded.

## Provenance

The owner's 2026-09-10 instruction authorized implementing issues in the range #96–#132. Every enforcement choice, rule boundary, and version transition carries `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. No human reviewed any PR in this lifecycle, and nothing here authorizes production, publication, deployment, or real-user collection.

## Relocation integrity

Every active-change artifact is relocated byte-for-byte except `tasks.md`, which is reconciled only by checking delivery tasks 12.1 and 12.2. This evidence file is new.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `e8cda9e50ea0cab62490e3e8f3e824b831aca6f0` |
| `assessment.json` | `581be77cae4d73dd3c2cb1cc40a88087965aac7a` |
| `assessment.source.json` | `8cf1ec66c70a8e9122290f7edc2e1fcfee5e6bee` |
| `contract-reuse.json` | `0d501ca1afe87f675025ec5a2cefadc409bec596` |
| `decisions/117-client-evidence-purpose.md` | `d2f4b9d199d74feaec81d6b1d4727b2031d033a2` |
| `decisions/118-success-and-stop-criteria.md` | `739e5db81fd8415c2ea18e13067eae9dcc1e3709` |
| `decisions/119-privacy-and-threat-review.md` | `f27e4a577841747567db7bb4b45e7fb8fa135ed4` |
| `decisions/121-implementation-authorization.md` | `6a2b54ef5490de908810590dbb100ed311272e27` |
| `decisions/122-correlation-field.md` | `d39e07241834c1c1b0b07669f00ec820452f5d0e` |
| `decisions/129-mode-b-device-trust.md` | `bcd48c89f41f3a7508c1c6e8012503159229396c` |
| `design.md` | `49c30f665ee03f39de55d67fc3ba2d68a3e3c494` |
| `harness/mode-a-evidence.md` | `8640c8cfb13208f5c04227bad789557e57026734` |
| `harness/mode-a-poc.mjs` | `ecb4fb26b824a3651b45783124ed8486468f19e0` |
| `harness/mode-a-run-1.json` | `3e7113b20c6147600a2e29374100355dfb98641e` |
| `proposal.md` | `416eb75d702b89576297eab81313259ae1d179ae` |
| `specs/client-evidence/spec.md` | `e3d6e041b536ee9e1b41db21f6ef6d286651b1c3` |
| `specs/security-audit-event-contract/spec.md` | `cbceb6ab7a521751aad2d971bef3c4326fec5881` |
| `tasks.md` | `2ccb4991e7851d3680163622d09ce2111ee817b5` (before reconciliation) |

Canonical specification for `client-evidence` is already folded on `main` at `openspec/specs/client-evidence/spec.md`.
