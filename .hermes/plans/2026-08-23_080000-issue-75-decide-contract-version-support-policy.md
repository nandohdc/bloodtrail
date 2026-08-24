# Issue #75 — Decide sdk-core Contract-Version Support Policy — Decision Packet

> **For Hermes:** The owner selected **EXACT_ONE** on 2026-08-23; do not reopen the choice. This is now a
> bounded documentation and specification ratification. Capture the policy as a normative SDK capability
> requirement, align the authored compatibility documentation and glossary, and record the reasoning in
> the existing SDK compatibility ADR plus a root ADR. **Do not change runtime code, generated output, the
> frozen contract, the package version, or any collector surface.** Proposal, documentation implementation,
> canonical spec fold, and archive remain separate governed commits.

**Goal:** Ratify `EXACT_ONE` as a normative SDK capability policy, document the semver consequences of an
additive contract minor, and record collector multi-version migration support as deliberately asymmetric,
without changing runtime behavior or the frozen contract.

**Status at this baseline:** **DECIDED — EXACT_ONE**, adopted by the owner on 2026-08-23. Task 0 stands
as the read-only re-verification checklist (re-verified 2026-08-23, all four pins hold); Task 1 records the
completed owner-decision and design-refinement comments; Task 2 is the open governed documentation work.

**Blast radius until the binding artefacts land:** #76 cannot close. #83, #86 and #95 declare #76 as a
dependency; #102 and #122 declare #75 directly; #107 declares #76. **Six issues wait on the ratification.**

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `e49931cececf21770b0819799aa379d07ac179cd` |
| Issue | #75, OPEN, labels `enhancement` `question` `security-audit-sdk` `openspec-change-needed` `area:core` `ready-for-agent` |
| Native GitHub blockers | `blocked_by` is `0`; declared dependency #66 CLOSED |
| Owner decision | `EXACT_ONE`, recorded 2026-08-23; binding repository artefacts still outstanding |
| `compatibility.json` today | `contractVersion: "1.0.0"`, `supportedContractVersions: ["1.0.0"]`, `unsupportedContractVersions: ["0.9.0","2.0.0"]`, `contractVersionRange {min: "1.0.0", max: "1.0.0"}` |
| Generated-types mode | `generatedTypes.compatibility: "exact-contract-projection"` |
| Normative technical target | `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` |
| Gate 1 | `check-compatibility.mjs` — asserts the range |
| Gate 2 | `check-coherence.mjs:136` — `compat-contract`: `contractVersion === "1.0.0"` **and** `supportedContractVersions` is exactly `["1.0.0"]` |
| Drift control 1 | `check-contract-immutability.mjs` — throws unless `contractVersion` and `normativeTechnicalTarget` match pinned literals |
| Drift control 2 | `check:generated` — byte-for-byte drift against the contract |
| Existing SDK SemVer policy | ADR-SDK-009 makes support-baseline changes major; `compatibility.json.semverClassification.major` also includes "generated type incompatibility" |
| Contract state | frozen at `1.0.0`; 24 events; 4 delivery classes; 1 extension namespace |
| ADR sequence | SDK ADRs pinned at **exactly 11** by `check-coherence.mjs:190-191` — see F4 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — EXACT_ONE is the current implementation, with two cardinality gates and two drift controls

`supportedContractVersions` is a one-element array, the range has `min === max`, and the generated types
are an "exact-contract-projection". `check-compatibility.mjs` and `check-coherence.mjs` directly assert the
current exact support cardinality and range. `check-contract-immutability.mjs` separately pins the current
version and normative target; `check:generated` proves byte identity with the current canonical input.
Together those controls preserve current `1.0.0` behavior, but only the capability delta in F7 makes
one-version-per-package an enduring future requirement. Nothing in the SDK reads a version at runtime and
branches on it. **Ratifying EXACT_ONE changes no runtime code.**

### F2 — EXPLICIT_SET is not a configuration flip; it changes the generation model

`generatedTypes.compatibility` is `exact-contract-projection` — one contract in, one type set out. Supporting
two versions means either two type sets (and a discriminated public API) or a union projection (and a
weaker type). Both are generator changes, both change `src/generated/`, and `check:generated` compares
byte-for-byte, so both cascade into the whole generation pipeline. **Do not describe EXPLICIT_SET as
"loosening a range".**

### F3 — Replacing the SDK support baseline is compatibility-major even when the contract change is minor

ADR-SDK-009 classifies a support-baseline change as SDK-major, and the public configuration type exposes
the supported contract as an exact literal. Under EXACT_ONE, moving from contract `1.0.0` to an additive
contract minor such as `1.1.0` replaces the package's sole support baseline and makes existing callers that
declare `1.0.0` incompatible. The contract change remains contract-minor; the coordinated SDK adaptation
is compatibility-major. `semverClassification.major` also lists "generated type incompatibility", but that
is an additional trigger when present—not the claim that every additive generated field is structurally
incompatible. This is PLAN-021 without conflating the two SemVer axes.

The package is `private`, `UNLICENSED`, `0.1.0` and never published, so today that churn costs nothing.
It starts costing the day the package is published — which is separately unauthorized.

### F4 — Recording the decision costs one ADR, and the ADR count is pinned

`check-coherence.mjs:190-191` asserts **exactly** ADR-SDK-001 … ADR-SDK-011 and rejects a twelfth. So a new
SDK ADR requires updating that pin in the same change. Two escapes: (a) record the decision in the
**root** `docs/adr/` sequence, which is unpinned (`0001`–`0006` today, `documentation_only`); or (b) fold
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

### F7 — ADR-only ratification leaves a normative gap and a contradictory migration instruction

The canonical SDK capability says the package must state which versions implement contract `1.0.0` and
reject unsupported versions, but it does not state the future-facing EXACT_ONE rule. More directly,
`MIGRATION.md:143-153` still tells every future contract adaptation to "decide whether one SDK version can
support both contract versions without ambiguity." Leaving that instruction in place reopens the choice
#75 just settled. The policy therefore needs an OpenSpec SDK capability delta and an authored
`MIGRATION.md` correction in addition to the two ADRs. Fold the delta into the canonical spec only through
the normal OpenSpec sync/fold lifecycle; never edit the canonical spec as an incidental implementation
step.

### F8 — EXACT_ONE covers the complete package compatibility surface, not only the manifest

For each SDK package version, exactly one canonical contract version owns the compatibility manifest,
generated public types, generated validator projection, construction-time version check, and event
validation semantics. The SDK does not negotiate, coerce, downgrade, fall back, or apply a best-effort
interpretation. This is a many-to-one relation: several SDK package versions may support the same contract
version, while one SDK package version may not support several contract versions.

### F9 — Exact-version instance binding is a construction invariant

`SecurityAuditSdkConfiguration.contractVersion` is the generated literal type, and runtime normalization
throws `SDK_UNSUPPORTED_CONTRACT_VERSION` before readiness when the requested version differs. The
canonical definition is therefore: a producer SDK instance can be created only for the contract version
supported by its SDK package version. Do not describe a live instance as negotiating, switching, or
accepting a version after construction.

### F10 — Collector migration support is optional future asymmetry, not present authorization

Use `MAY`, not `MUST`: a separately authorized collector may support an explicitly enumerated finite set
of contract versions for migration. That set never broadens producer package support or producer SDK
instance binding. The statement records the asymmetric design surface required by PLAN-065; it neither
creates nor authorizes a collector.

---

## The decision, as the owner should see it

| | **EXACT_ONE** (recommended) | **EXPLICIT_SET** |
| --- | --- | --- |
| Code change needed | **none** | generator, types, runtime validation, compatibility policy and gates |
| What #76 becomes | closes as already-implemented after re-verification | a multi-week implementation |
| Additive contract minor | SDK **major** (support-baseline and public literal replacement) | SDK minor, if the union projection holds |
| Producer binding | one version per instance | one version per instance (unchanged either way) |
| Type strength | exact | weaker — union or discriminated |
| Failure mode on unknown version | fail closed at construction | fail closed at construction |
| Cost today | zero | high, for a package that is private and unpublished |
| Cost deferred | version churn once published | none |

**Decision: EXACT_ONE.** Adopted by the owner on 2026-08-23.

The package is unpublished, so the churn EXACT_ONE trades away is currently free, while EXPLICIT_SET's
cost is immediate and lands in the generation pipeline — the one part of this repository where a mistake
is hardest to detect. The direct cardinality gates and supporting drift controls already preserve current
EXACT_ONE behavior (F1), so the decision makes that behavior an enduring policy rather than changing it.

The policy is one outgoing compatibility edge per SDK package version:

```text
SDK package version --supports exactly one--> canonical contract version
```

Several SDK package versions may point to the same canonical contract version. "Support" covers the
manifest, exact generated projection, construction, and event validation together; it is not merely the
shape of `supportedContractVersions`.

**Revisit condition:** a second contract version and a collector both exist. Neither does today. Record
that trigger in the ADR so a future reader knows what would reopen the choice.

**Consequence for #76:** it closes as already-implemented once its acceptance criteria are re-verified
against the ratified policy. The EXPLICIT_SET branch of this plan is now moot.

---

## Task 0: Re-verify the evidence (read-only)

- [ ] 0.1 Re-read `compatibility.json`'s five version fields and confirm F1.
- [ ] 0.2 Confirm the two direct cardinality gates and two supporting drift controls still have the distinct
      roles stated in F1 — read `check-compatibility.mjs`, `check-coherence.mjs:136`,
      `check-contract-immutability.mjs`, and the `check:generated` invocation.
- [ ] 0.3 Confirm ADR-SDK-009 still makes a support-baseline change major and
      `semverClassification.major` still contains "generated type incompatibility" as an additional trigger
      (F3).
- [ ] 0.4 Confirm the ADR pin at `check-coherence.mjs:190-191` still reads `11` (F4).

## Task 1: Record the completed decision refinement

- [x] 1.1 Owner decision comment records `EXACT_ONE`, its four existing pins, the additive-minor semver
      consequence, the `0.x` clarification, the revisit condition, and the no-collector/no-unfreeze bounds.
- [x] 1.2 Post the follow-up recommendation comment: normative rather than ADR-only authority (F7),
      complete-surface and many-to-one semantics (F8), construction-time instance binding (F9), and the
      collector `MAY` asymmetry (F10). Carry `> *This was generated by AI during triage.*`.
- [x] 1.3 GitHub readback confirmed the exact follow-up body at
      `https://github.com/nandohdc/bloodtrail/issues/75#issuecomment-5389791638`.
- [x] 1.4 Post and read back a precision addendum distinguishing direct cardinality gates from supporting
      drift controls, support-baseline replacement from optional-field incompatibility, and the full/material
      governance classification of a canonical capability requirement. GitHub readback confirmed the exact
      body at `https://github.com/nandohdc/bloodtrail/issues/75#issuecomment-5389808195`.

## Task 2: Record EXACT_ONE through the governed documentation lifecycle

- [ ] 2.1 Create the OpenSpec change `ratify-contract-version-support-policy` through the OpenSpec CLI.
      Classify it as a Full-assessment change and Material capability modification because it adds a
      normative canonical capability requirement. `openspec/changes/`, `openspec/specs/`, and `packages/`
      are `governed_implementation`; only the root `docs/` ADR and this plan are `documentation_only`.
- [ ] 2.2 Add an SDK capability delta requiring exactly one contract version across the complete package
      compatibility surface (F8), exact-version construction binding with fail-closed unsupported-version
      behavior (F9), and collector migration support as separately authorized intent only (F10).
- [ ] 2.3 Sharpen `packages/security-audit-sdk-core/CONTEXT.md` definitions: "exact-one package support" is
      the many-to-one package-version relation; "exact-version instance binding" is a construction
      invariant. Keep implementation mechanics out of the glossary.
- [ ] 2.4 Extend `packages/security-audit-sdk-core/adr/009-package-contract-compatibility.md` with the
      ratified policy, complete support surface, additive-contract-minor semver consequence, `0.x`
      clarification, construction binding, and collector `MAY` asymmetry. **Do not add a twelfth SDK ADR**
      (F4).
- [ ] 2.5 Add `docs/adr/0007-contract-version-support-policy.md` with the EXACT_ONE versus EXPLICIT_SET
      options analysis, many-to-one cardinality, consequences, no-authorization boundaries, and the
      conjunctive revisit condition: a second contract version **and** an authorized collector exist.
- [ ] 2.6 Update `packages/security-audit-sdk-core/MIGRATION.md:143-153` so a future contract adaptation
      applies EXACT_ONE rather than deciding again whether one SDK package version supports both contract
      versions. State the compatibility-major classification without creating a release or version bump.
- [ ] 2.7 Keep the authored/specification allowlist bounded to OpenSpec artifacts, `CONTEXT.md`, ADR-SDK-009,
      root ADR 0007, and `MIGRATION.md`. The capability and package paths remain governed implementation
      even though behavior is unchanged. No runtime source, generated artifact, contract source, package
      manifest/version, collector, transport, or publication path changes.
- [ ] 2.8 Verify the proposal and documentation candidate read-only, commit each governed phase separately,
      and fold the SDK delta into `openspec/specs/security-audit-sdk-core/spec.md` in a later dedicated
      canonical-fold commit while the change remains active. Archive only after that fold lands.
- [ ] 2.9 Run the applicable strict OpenSpec validation, both repository validation chains, diff checks,
      explicit-allowlist/index inspection, and post-commit governance verification. Freeze verified bytes;
      do not regenerate or tidy them afterward.
- [ ] 2.10 After the ratified policy and canonical fold land, re-verify #76's acceptance criteria and close
      it as already implemented with exact evidence. EXPLICIT_SET implementation is no longer in scope.

## Task 3: Close

- [ ] 3.1 Close #75 only after the ADRs, glossary, migration correction, and canonical SDK spec fold land;
      name the ratified policy, exact commit(s), ADR paths, and canonical requirement.
- [ ] 3.2 Tick #75 in #132's Wave 2 checklist and note the decision surface shrank by one.
- [ ] 3.3 Comment on #76, #102, #107, #122 that the version policy is settled.

---

## Validation matrix

| Acceptance criterion (#75) | Where satisfied |
| --- | --- |
| Exactly one policy selected | owner's recorded answer |
| Producer instances remain exact-version bound | SDK capability delta/fold, glossary, ADR-SDK-009 (F9) |
| Collector migration support separate | collector `MAY` intent plus explicit nonauthorization (F10) |
| Semver consequences of an additive minor documented | ADR-SDK-009, root ADR 0007, `MIGRATION.md` (F3) |
| Policy is normative rather than ADR-only | SDK capability delta and canonical fold (F7) |
| Upgrade instructions do not reopen #75 | corrected `MIGRATION.md:143-153` (F7) |

## Risks and open questions

- **ADR-only ratification would remain advisory.** The canonical capability and migration workflow must
  carry the rule so a later adaptation cannot silently reopen EXPLICIT_SET (F7).
- **"One version" can be misread as a bijection.** State that multiple SDK package versions may support the
  same contract version; only each package version's outgoing support set has cardinality one (F8).
- **Collector `MAY` can be misread as authorization.** Co-locate it with the no-collector/no-production
  boundary and require separate authorization before any collector design or implementation (F10).
- **Control and SemVer rationales can be overstated.** Preserve the distinction between two direct
  cardinality gates and two supporting drift controls, and ground SDK-major classification in replacement
  of the sole support baseline/public literal rather than assuming every additive field is type-incompatible.
- **Resolved 2026-08-23 — the `0.x` question.** Ratification does **not** force a `1.0.0` release. While
  the package is `0.x`, private and unpublished, an additive contract minor is classified `major` in
  `semverClassification` terms but is expressed as a `0.x` minor bump, per the standard `0.x` exemption.
  The obligation the ADR must state is the *classification*, not a specific version number: the first
  published release inherits the major classification, and from `1.0.0` onward an additive contract minor
  is an SDK major. Write it that way so #76 does not inherit the ambiguity.

## What this does not authorize

Publishing, creating a contract version, building a collector, or changing the frozen contract.

## What this plan did not verify

What EXPLICIT_SET would actually cost in the generator. The estimate here is structural, not empirical; if
the conjunctive revisit condition ever fires, a fresh change must measure that cost before selecting a new
policy.
