# Issue #75 — Decide sdk-core Contract-Version Support Policy — Decision Packet

> **For Hermes:** This is an **owner decision**, labelled `ready-for-human`, with a brief already posted on
> 2026-08-16 and unanswered for a week. **Do not implement anything.** Your job is to make the decision
> cheap to take: re-verify the evidence, present exactly two options with their measured consequences, and
> record the outcome in an ADR once the owner answers. The important finding the existing brief does not
> emphasise: **EXACT_ONE is already implemented in code and pinned by three separate gates**, so choosing
> it is a one-word ratification and #76 closes as already-implemented, while choosing EXPLICIT_SET is a
> multi-week code change touching generated types. That asymmetry should be the first thing the owner
> reads.

**Goal:** One recorded decision — EXACT_ONE or EXPLICIT_SET — with the semver consequences of an additive
contract minor documented and the collector's multi-version migration support recorded as deliberately
asymmetric.

**Status at this baseline:** **DECIDED — EXACT_ONE**, adopted by the owner on 2026-08-23. Task 0 stands
as the re-verification checklist (re-verified 2026-08-23, all four pins hold); Task 1 is superseded by the
decision comment; Task 2 is the open work.

**Blast radius if unanswered:** #76 cannot start. #83, #86 and #95 declare #76 as a dependency; #102 and
#122 declare #75 directly; #107 declares #76. **Six issues wait on this one word.**

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #75, OPEN, labels `enhancement` `question` `security-audit-sdk` `openspec-change-needed` `area:core` `ready-for-human` |
| Native GitHub blockers | `blocked_by` is `0`; declared dependency #66 CLOSED |
| Brief posted | 2026-08-16, unanswered |
| `compatibility.json` today | `contractVersion: "1.0.0"`, `supportedContractVersions: ["1.0.0"]`, `unsupportedContractVersions: ["0.9.0","2.0.0"]`, `contractVersionRange {min: "1.0.0", max: "1.0.0"}` |
| Generated-types mode | `generatedTypes.compatibility: "exact-contract-projection"` |
| Normative technical target | `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` |
| Gate 1 | `check-compatibility.mjs` — asserts the range |
| Gate 2 | `check-coherence.mjs:136` — `compat-contract`: `contractVersion === "1.0.0"` **and** `supportedContractVersions` is exactly `["1.0.0"]` |
| Gate 3 | `check-contract-immutability.mjs` — throws unless `contractVersion` and `normativeTechnicalTarget` match pinned literals |
| Gate 4 | `check:generated` — byte-for-byte drift against the contract |
| Existing semver policy | `compatibility.json.semverClassification` — `major` already includes "generated type incompatibility" |
| Contract state | frozen at `1.0.0`; 24 events; 4 delivery classes; 1 extension namespace |
| ADR sequence | SDK ADRs pinned at **exactly 11** by `check-coherence.mjs:190-191` — see F4 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — EXACT_ONE is not a proposal; it is the current implementation, enforced four times

`supportedContractVersions` is a one-element array, the range has `min === max`, the generated types are an
"exact-contract-projection", and four independent gates assert it. Nothing in the SDK reads a version at
runtime and branches on it. **Ratifying EXACT_ONE changes no code.**

### F2 — EXPLICIT_SET is not a configuration flip; it changes the generation model

`generatedTypes.compatibility` is `exact-contract-projection` — one contract in, one type set out. Supporting
two versions means either two type sets (and a discriminated public API) or a union projection (and a
weaker type). Both are generator changes, both change `src/generated/`, and `check:generated` compares
byte-for-byte, so both cascade into the whole generation pipeline. **Do not describe EXPLICIT_SET as
"loosening a range".**

### F3 — The semver consequence is already written down, and it is the real cost of EXACT_ONE

`semverClassification.major` includes "generated type incompatibility". Under EXACT_ONE, an *additive*
contract minor (say `1.1.0`, adding an optional field) produces new generated types and therefore an SDK
**major**. That is PLAN-021 stated exactly. The owner should decide knowing that: EXACT_ONE trades version
churn for absolute clarity about what a given SDK build accepts.

The package is `private`, `UNLICENSED`, `0.1.0` and never published, so today that churn costs nothing.
It starts costing the day the package is published — which is separately unauthorized.

### F4 — Recording the decision costs one ADR, and the ADR count is pinned

`check-coherence.mjs:190-191` asserts **exactly** ADR-SDK-001 … ADR-SDK-011 and rejects a twelfth. So a new
SDK ADR requires updating that pin in the same change. Two escapes: (a) record the decision in the
**root** `docs/adr/` sequence, which is unpinned (`0001`–`0005` today, `documentation_only`); or (b) fold
the ratification into an existing SDK ADR — `009-package-contract-compatibility.md` is the natural host.

**Recommend (b) for the substance and (a) for the reasoning**: extend ADR-SDK-009 with the ratified policy
(one sentence, no count change), and put the options analysis in a root ADR. That avoids the pin entirely.

### F5 — The collector asymmetry is a *note*, not a mechanism

PLAN-065 wants producers bound to one version while collector migration support is an explicit set. There
is no collector, and building one is unauthorized. So the asymmetry can only be **recorded as intent**
today. #75's acceptance criterion "Collector migration support is separate" is satisfied by a written
statement, and #107 will implement it when a collector is authorized. Say that plainly so the criterion is
not read as requiring code.

### F6 — This decision does not unfreeze anything

The contract is frozen at `1.0.0` and `check-contract-immutability.mjs` throws on any drift from the
pinned literals. Choosing either policy leaves the contract frozen. **A version policy is about what the
SDK would accept if a new version existed**, not about creating one.

---

## The decision, as the owner should see it

| | **EXACT_ONE** (recommended) | **EXPLICIT_SET** |
| --- | --- | --- |
| Code change needed | **none** | generator, types, runtime validation, four gates |
| What #76 becomes | closes as already-implemented after re-verification | a multi-week implementation |
| Additive contract minor | SDK **major** (generated type incompatibility) | SDK minor, if the union projection holds |
| Producer binding | one version per instance | one version per instance (unchanged either way) |
| Type strength | exact | weaker — union or discriminated |
| Failure mode on unknown version | fail closed at construction | fail closed at construction |
| Cost today | zero | high, for a package that is private and unpublished |
| Cost deferred | version churn once published | none |

**Decision: EXACT_ONE.** Adopted by the owner on 2026-08-23.

The package is unpublished, so the churn EXACT_ONE trades away is currently free, while EXPLICIT_SET's
cost is immediate and lands in the generation pipeline — the one part of this repository where a mistake
is hardest to detect. Four gates already enforce EXACT_ONE (F1), so the decision writes down what the
repository already guarantees rather than changing behaviour.

**Revisit condition:** a second contract version and a collector both exist. Neither does today. Record
that trigger in the ADR so a future reader knows what would reopen the choice.

**Consequence for #76:** it closes as already-implemented once its acceptance criteria are re-verified
against the ratified policy. The EXPLICIT_SET branch of this plan is now moot.

---

## Task 0: Re-verify the evidence (read-only)

- [ ] 0.1 Re-read `compatibility.json`'s five version fields and confirm F1.
- [ ] 0.2 Confirm the four gates still assert what F1 claims — read `check-compatibility.mjs`,
      `check-coherence.mjs:136`, `check-contract-immutability.mjs`, and the `check:generated` invocation.
- [ ] 0.3 Confirm `semverClassification.major` still contains "generated type incompatibility" (F3).
- [ ] 0.4 Confirm the ADR pin at `check-coherence.mjs:190-191` still reads `11` (F4).

## Task 1: Refresh the decision brief

- [ ] 1.1 Post an updated brief on #75 leading with the asymmetry (F1 vs F2) and the recommendation.
- [ ] 1.2 Include the comparison table above verbatim.
- [ ] 1.3 State that neither option unfreezes the contract (F6) and that the collector asymmetry is a
      recorded intent, not code (F5).
- [ ] 1.4 Carry `> *This was generated by AI during triage.*`. Keep `ready-for-human`.

## Task 2: When the owner answers — record it

- [ ] 2.1 Open an OpenSpec change `ratify-contract-version-support-policy`.
- [ ] 2.2 Extend `packages/security-audit-sdk-core/adr/009-package-contract-compatibility.md` with the
      ratified policy, the semver consequence of an additive minor, and the collector asymmetry note.
      **Do not add a twelfth SDK ADR** (F4).
- [ ] 2.3 Add `docs/adr/000N-contract-version-support-policy.md` with the options analysis. Root ADRs are
      unpinned and `documentation_only`.
- [ ] 2.4 If EXACT_ONE: no code change. Re-verify #76's acceptance criteria against the ratified policy and
      close #76 as already-implemented with evidence.
- [ ] 2.5 If EXPLICIT_SET: **stop**, and re-scope #76 with a fresh plan before writing anything.
- [ ] 2.6 `openspec validate --strict`; both `validate` chains; index empty; governance verified after the
      commit exists (#191).

## Task 3: Close

- [ ] 3.1 Close #75 naming the ratified policy and the ADR paths.
- [ ] 3.2 Tick #75 in #132's Wave 2 checklist and note the decision surface shrank by one.
- [ ] 3.3 Comment on #76, #102, #107, #122 that the version policy is settled.

---

## Validation matrix

| Acceptance criterion (#75) | Where satisfied |
| --- | --- |
| Exactly one policy selected | owner's recorded answer |
| Producer instances remain exact-version bound | true under both options; stated in the ADR |
| Collector migration support separate | recorded intent (F5) |
| Semver consequences of an additive minor documented | ADR-SDK-009 extension (F3) |

## Risks and open questions

- **A week of silence is the risk.** Six issues are frozen behind it. Escalate in each tracker sync rather
  than re-posting the same brief.
- **Ratifying the status quo can feel like a non-decision** and get deferred forever. Frame it as what it
  is: writing down what the gates already enforce, so the next person cannot change it by accident.
- **Resolved 2026-08-23 — the `0.x` question.** Ratification does **not** force a `1.0.0` release. While
  the package is `0.x`, private and unpublished, an additive contract minor is classified `major` in
  `semverClassification` terms but is expressed as a `0.x` minor bump, per the standard `0.x` exemption.
  The obligation the ADR must state is the *classification*, not a specific version number: the first
  published release inherits the major classification, and from `1.0.0` onward an additive contract minor
  is an SDK major. Write it that way so #76 does not inherit the ambiguity.

## What this does not authorize

Publishing, creating a contract version, building a collector, or changing the frozen contract.

## What this plan did not verify

What EXPLICIT_SET would actually cost in the generator. If the owner leans that way, measure it before
committing — the estimate here is structural, not empirical.
