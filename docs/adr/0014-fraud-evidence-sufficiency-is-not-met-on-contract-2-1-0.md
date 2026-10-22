# ADR 0014: Synthetic fraud-evidence sufficiency is not met on contract 2.1.0

- Status: Accepted
- Date: 2026-10-22
- Decision owners: Project owner
- Decision source: the owner's approval of this ADR, given as an approval comment on #805 naming the exact head
  commit (G6), and the decision log on #795 (G1–G40)

## Context

#795 asked whether Bloodtrail can supply an external fraud-evidence consumer with sufficiently complete,
correctly structured and appropriately trusted evidence for account takeover and credential stuffing.
Bloodtrail emits evidence. The consumer owns detection, scoring and fraud verdicts.

Stage P answered with five probes under the OpenSpec change `verify-fraud-evidence-sufficiency`. Each one
used the evaluation kit's packed public API as its only seam, ran once on the owner's workstation (G38) at an
exact approved head, and was judged against expectations committed and hashed before the run. Every value
was synthetic.

The verdict has two criteria, reproduced from #795 in the change's `design.md`:

1. **Target attribution.** The contract has a field that honestly carries the attempted identifier, and that
   field, used as the capability prescribes, is accepted by the SDK with zero provenance ambiguity.
2. **Signal fit.** No missing account-takeover signal is judged "misrepresents".

Criteria 3 to 5 (chain reconstruction, counts and host-composed delivery) belong to Stage 2 (G22, #833) and
are not judged here.

## Evidence

The results files live under `openspec/changes/verify-fraud-evidence-sufficiency/harness/results/`, next to
the frozen expectations in `harness/expectations/`. In every run, the kit identity commit equals the approved
head, every executed case matched its frozen expectation, and no invalidation was recorded. The ledger,
`harness/run-ledger.md`, holds five of the ten authorized runs, all inside the window
2026-10-17T02:22:47Z to 2026-10-24T02:22:47Z, for 5,494 occurrences in total.

| Run | Probe | Ticket | Approved head | Cases | Occurrences |
|---|---|---|---|---|---|
| 1 | P-ids | #800 | `ec192a5977e079089cb76b3595631dcb7d62aca3` | 11 of 11 matched; P-ids-11 is analysis only | 1,393 |
| 2 | P-D | #801 | `09847df832a0691152db290920c151152780ac33` | 66 of 66 | 371 |
| 3 | P-attr | #802 | `03d9df47675b611f051ae0938f0eef1f8b4cbe78` | 73 of 73; 38 of 38 linkage rows | 2,305 |
| 4 | P-E | #803 | `9afdcb53bd8f73e5753bbd8daecb0f2f3ab63b03` | 32 of 32 | 802 |
| 5 | P-map | #804 | `18efa6d57756976c0973c7d28ecf91f68cce941b` | 39 of 39; 2 of 2 baselines | 623 |

| Results file | sha256 | Expectations file | sha256 |
|---|---|---|---|
| `p-ids-run-1.json` | `71d2b88ff59fe2b42ff75a6595cdc23dda16d2a2ade67d2140310a921a1db29c` | `p-ids.v1.json` | `77955d57d317c9f0a6b9c81dd727974f9eb87ee70c730d83bd685e6cd6144251` |
| `p-d-run-2.json` | `1e866fad2d60f3b30f11572003daee4b670790222975a0b75839c6398259fe39` | `p-d.v1.json` | `4c956f0fc52a684fed2f7747eb42be621aecd84284d4762720d5b65b648bb384` |
| `p-attr-run-3.json` | `c481726303809c205c251b8f069b86f55a671d188f4f6cdabac1f431665dc67a` | `p-attr.v1.json` | `2954363d03a7e321c0ca379963eb554deedc3a6489b71b4432b5166749777887` |
| `p-e-run-4.json` | `d9cd7dd634d2e91e75cb000ac114872aca5ad6b1a75807f61b024388afb95223` | `p-e.v1.json` | `63e746859f15276df09234688fb6661c42e04e4cc38e8961a9a5bcf894fd05a1` |
| `p-map-run-5.json` | `1a3c9e984c16d95f4f64c3c799f0695c6851a82e55e2b8dabd1735d5058edb64` | `p-map.v1.json` | `a63e26fb8f30b1cf4ed3419affee0564152f149d485529254470703e44caca27` |

Run 1 was approved by the owner's own comment. Runs 2 to 5 were approved by the orchestrator under the owner's
G39 delegation, and each results file records that delegation.

## Decision

### Verdict

**Synthetic evidence-sufficiency: not met on contract 2.1.0.** Criterion 1 fails, so sufficiency is not met
on 2.1.0 whatever Stage 2 finds.

| Criterion | Result | Gap owner | Evidence |
|---|---|---|---|
| 1. Target attribution | **Failed.** No existing field honestly carries a failed login's target. All 25 accepted candidate carriers fail at least one of the provenance-ambiguity, meaning-misuse, resource-rule, existence-disclosure, per-target-grouping and allowed-source checks, and 9 of them also lack full target coverage. None qualifies. | Bloodtrail contract | `p-attr-run-3.json`, `cases.verdict.criterion_1`: `status: "failed"`, `qualifying: []`, `gap_owner: "Bloodtrail contract"` |
| 2. Signal fit | **Passed.** No missing signal misrepresents. Logout and MFA challenge failure fit. Contact-detail change, lockout, lockout release and credential rotation are strained. No catalog addition is proposed (G10). | None | `p-map-run-5.json`, `cases.verdicts`, `S-CRIT2`: `verdict: "PASS"` |

Criterion 2 was conditional at run time on two implementer defaults, and the owner confirmed both (G40):

- **K2a:** an automatic threshold lock is a genuine authorization decision, so lockout stays strained (G40b).
- **R2:** the `password_reset` purpose covers an authenticated password change, so rotation stays strained
  (G40c).

Reversing either reading would make that signal misrepresent and fail criterion 2. The gap owner would then be
the Bloodtrail contract, through a catalog addition.

The verdict judges synthetic evidence only. It makes no claim that Bloodtrail is ready for production or that
it detects fraud.

### Decisions this record carries

The verbatim decisions and their statuses are in the change's `design.md` decision register and in #795.
Stage P bears on them as follows.

| Decision | What it says | What Stage P adds |
|---|---|---|
| G33 | If the carrier matrix proves the gap, a separate governed contract minor version adds a keyed presented-identifier reference. | The gap is proven. See the field requirement below. |
| G13, G36 | Failed authentication carries no target. Second-factor and per-account lockout reasons are allowed, still without a target. | No honest target exists on 2.1.0, so no-target is the only conforming option. `mfa_failed` and `rate_limited` were accepted without a target, so the SDK cannot attribute them to an account. |
| G27 | The `fraud-evidence-profile` capability constrains usage only and redefines no field. | The capability keeps that boundary. Reconciled with the evidence, it adds three requirements: no per-target grouping of failed logins, delivery results are not commit evidence, and host-composed audit atomicity. It also states that SDK acceptance does not establish resource-rule conformance. |
| G3, G29 | Exact observed addresses and stable post-authentication join identifiers are sent under recorded exceptions. | P-map found that per-path hook keying can break actor and subject equality, which supports sending account identifiers directly and never computing session fingerprints through a hook. Chain reconstruction itself is Stage 2 (#840). |
| G4, G5 | The host owns durability. The transaction-critical binding is later documented as not providing atomicity. | P-E measured the binding claiming more than it checks (#859, #860). |
| G10 | A catalog addition only for a real misfit. | None is nominated. |
| G22 | Stage 2 is proposed only after the owner reviews Stage P. | This ADR is that review's record. |
| G38, G39, G40 | Run environment, delegated completion, and this close-out's lane and merges. | All five runs followed G38; runs 2 to 5 followed G39. |

### The contract field requirement

Criterion 1 failed. As G33 requires, a **separate governed contract minor version**, sequenced after the active
normative-precedence change (`define-normative-precedence-lifecycle`), adds a keyed presented-identifier
reference with client-claim trust that never reveals whether an account exists. It is tracked as #863.
Nothing changes on 2.1.0. The capability keeps G13's no-target rule and presents no future field as an existing
one.

These are the open design inputs. None of them is an approved decision:

- login-surface key selection (G2, G11), since SDK transformation hooks receive the per-event purpose and the
  resolved tenant and so cannot select a login-surface key;
- purpose scope, with the authentication family as the candidate;
- the authentication authority's lookup-canonical form of the identifier (G12);
- key epochs in occurrences (G14), given the hook key-id drop below;
- reset requests and registration attempts carrying the same reference (G16);
- per-method credential typing, including the credential type of a first-factor passkey (G18);
- host-computed values (G17), since hooks cannot compute the reference;
- account attribution for second-factor and lockout failures (G36).

### Hook key ids do not reach occurrences

A transformation hook's key id is validated but never written to the occurrence. In P-attr case `AF-C2`, the
hook keyed `actor.id` under key id `k-run-01`, and the accepted occurrence carries the keyed value with no key
id. The only keyed-value marker that reaches an occurrence is a credential key id that the host sets itself (P-D
`PD-E3`, and item 6 of `harness/p-d/cannot-establish.md`). A consumer therefore cannot tell a keyed value from a
raw one, or one key epoch from another. The owner is the Bloodtrail contract, through the field change's
key-epoch input (#863). The consumer profile documents the limit (#806).

### Findings and their owners

| Finding | Evidence | Kind | Owner | Pointer |
|---|---|---|---|---|
| Core and Node default identifiers repeat nothing across fresh processes or within one, and the controls still refuse colliding identifiers. | `p-ids-run-1.json`, P-ids-00 to P-ids-10 | confirmed fix | Bloodtrail package | #796 |
| A transaction-bound event without an operation handle and with a non-success outcome is refused with `PREMATURE_SUCCESS` at `/operation/state`. | `p-d-run-2.json` PD-C9 (35 of 35); `p-e-run-4.json` P-E-1f; `p-map-run-5.json` L5a | confirmed fix | Bloodtrail package | #797 |
| The kit receiver's deduplication capacity was outside Stage P's seam. | none | not exercised | Bloodtrail package | #798; Stage 2 #839 |
| No existing field honestly carries a failed login's target. | `p-attr-run-3.json`, `cases.verdict.criterion_1` | gap | Bloodtrail contract | #863 |
| The SDK accepts carriers that misrepresent: 87 matrix steps across all four families, repeated in 612 linkage slots. A principal is refused only on an anonymous actor. | `p-attr-run-3.json`, `cases.verdict.findings.accepted_misrepresenting_carriers` and `anonymous_only_principal_enforcement` | limitation | Host now (the capability's prohibition and host conformance); Bloodtrail package later (resource-rule enforcement) | #862 |
| A claimed tenant that conflicts with the effective tenant is refused, while the contract retains it as an untrusted claim. | `p-attr-run-3.json`, `cases.verdict.findings.conflicting_tenant` | divergence | Bloodtrail package or contract, by governed decision | #861 |
| A hook key id never reaches the occurrence. | `p-attr-run-3.json` AF-C2; `p-d-run-2.json` PD-E3 | limitation | Bloodtrail contract | #863; #806 |
| The SDK cannot establish host truth, source origin, commit truth, occurrence time, the address hop, raw versus keyed values, event or retry provenance, the origin of unbranded fields, or the intended SDK instance. | `p-d-run-2.json`, the 9 cannot-establish cases; `harness/p-d/cannot-establish.md` | limitation | Host | #806 |
| The heuristic prohibited-data scan accepts some synthetic marker recipes: near-miss bearer values, an underscore form, a plural value, and a joined key in an open schema slot. | `p-d-run-2.json` PD-D3, PD-D7, PD-D10, PD-D13 (bypass) | limitation | Host, which never sends prohibited data; the scan is not a personal-data detector | #806 |
| The commit gate and durability probe fail open on values outside their types. | `p-e-run-4.json` P-E-x2 | defect | Bloodtrail package | #859 |
| The binding returns `committed_and_durable` for a `not_committed` occurrence, runs one transaction's gate twice for two occurrences, deduplicates per instance only, and declares fail-closed-before-commit for a failure after the gate ran. | `p-e-run-4.json` P-E-3a, P-E-6c, P-E-7, P-E-8 | defect | Bloodtrail package | #860 (G5) |
| A refusal after a committed business change establishes no atomicity. The binding has no retry scheduler, no backlog alert and no shutdown surface. | `p-e-run-4.json`, `cases.verdict.guarantees` (P-E-2b, P-E-5) | limitation | Host (G4) | Stage 2 #837, #838, #842 |
| A host outbox sink that defers its insert past a synchronous `ROLLBACK` leaves an orphan audit row. | `p-e-run-4.json` P-E-9c | host composition hazard | Host | #806; Stage 2 #842 |
| Second-factor and lockout failures carry no target, so they cannot be attributed to an account. The host-supplied request and correlation ids survive, so a host-side join is possible. | `p-map-run-5.json` S-MFA, S-LOCK | design input | Bloodtrail contract; whether a consumer may rely on the join is #806's decision | #863; #806 |
| Contact-detail change, lockout and lockout release fit only the generic `data.sensitive_resource.modified`. Rotation fits `password_reset.*`, whose purpose names reset. | `p-map-run-5.json` S-CONTACT, S-LOCK, S-UNLOCK, S-ROTATE | design input | Bloodtrail contract (catalog wording); no addition under G10 | #806 conventions |
| `resource.change_categories` is free-form: an unregistered item, a 4,000-character item and an object item are all accepted, as the schema allows. | `p-map-run-5.json` S-CONTACT | design input | Bloodtrail contract | #806 conventions |
| Logout and administrator revocation differ only in actor and subject equality and in authorization, with no logout reason code. Per-path hook keying can break that equality. | `p-map-run-5.json` S-LOGOUT | design input | Bloodtrail contract (reason code); host (no per-path keying) | #806 |
| A tenantless login is accepted, but logout, contact change, lockout, release and rotation require a tenant. | `p-map-run-5.json` S-LOGOUT, S-ROTATE | design input | Bloodtrail contract | #806 |
| `session.revoked` is transaction-critical, so a containment revocation that fails closed before the business commit can leave a compromised session alive. | `p-map-run-5.json` S-LOGOUT | design input | Bloodtrail contract (delivery class); host | #806 |
| Lazy lock expiry has no commit point; only an explicitly scheduled release commits. | `p-map-run-5.json` S-UNLOCK | host obligation | Host | #806 |

## Alternatives

- **Count a keyed or claimed value in an existing field as an honest carrier.** Rejected. The hook-keyed
  claimed actor, the keyed credential reference (the withdrawn G1) and every other candidate fail at least one
  check. Keying does not upgrade a client-presented value's origin.
- **Wait for Stage 2 before recording a verdict.** Rejected. #795 states that if criterion 1 fails,
  sufficiency is not met on 2.1.0 regardless of Stage 2, and G22 asks the owner to review Stage P first.
- **Propose catalog additions for lockout or rotation.** Rejected under G10 once the owner confirmed K2a and R2
  (G40). Both signals are strained, not misfits.
- **Fix the package defects inside this change.** Rejected. The change is usage-only (G27) and touches no
  package. Each defect needs its own governed change: #859, #860, #861 and #862.

## Consequences

- Stage 2 (#833, #835 to #846) may be proposed now that the owner has reviewed Stage P (G22). It measures
  criteria 3 to 5 and cannot change this verdict on 2.1.0.
- Criterion 1 and per-target counts are remeasured on the contract version that adds the field (#863), which
  waits for the normative-precedence change.
- The `fraud-evidence-profile` capability stays usage-only. #806 writes the consumer integration profile and
  glossary from these findings, #807 folds the capability into the canonical specs, and #808 archives the
  change.
- The capability now requires hosts never to treat the transaction-critical binding's result or declared
  guarantees as proof of a business commit, atomicity, persistent retry or cross-instance deduplication. A host
  that needs atomicity writes the audit record inside the business transaction. #859 and #860 correct what the
  binding claims; they do not make it atomic.
- Five authorized runs went unused. They lapse with the window at 2026-10-24T02:22:47Z, and no further Stage P
  run is planned.
