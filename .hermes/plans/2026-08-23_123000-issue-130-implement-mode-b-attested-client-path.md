# Issue #130 — Implement the Approved Mode B Attested Client Path — Plan

> **For Hermes:** `severity:high`, `P3_DEFERRED`, NOT AUTHORIZED, blocked on #129 and #124. This is the
> deepest issue in the entire backlog: eight gates upstream, and its own fifth acceptance criterion says
> implementation is not authorized **unless the decision is GO and all named privacy and owner gates are
> affirmative**. If #129 records NO-GO, this issue closes without implementation — and #129's plan names
> NO-GO as the leading option. Do not begin design work speculatively. The single non-negotiable
> invariant: **elevated trust fails closed on every ambiguity**, including unavailability, which is the
> most common state in the field.

**Goal:** The selected attestation mechanisms implemented and verified, with nonce, correlation, envelope,
app/device identity and freshness bound; verified outcomes mapped to the exact approved trust value; and
every failure preserved as baseline trust or rejection per policy.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED, and **conditional on a GO that may never come**.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #130, OPEN, labels `enhancement` `severity:high` `security-audit-sdk` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #129 (decision, likely NO-GO), #124 (browser package) — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-058 | defer Mode B producer-class / effective-trust-ceiling work behind a separate device-trust decision |
| Upstream chain | #117 → #118 → #119 → #120 → #121 → #122 → #123 → #124 → #128 → #129 → **#130** |
| Trust representation | `provenance.trust_level` pinned to `downstream_enrichment` by the generated schema — an elevated value may not exist (#129's F3) |
| Zero-dependency policy | SDK has zero runtime dependencies, enforced by three gates |
| Error discipline | bounded: code, category, path; logs and metrics exclude secrets and stable raw identifiers |
| Downstream | none |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The most likely correct outcome is that this issue never runs

#129's plan presents NO-GO as the leading option, on four grounds: it would require editing a frozen
contract to represent elevated trust, it would introduce the product's first vendor coupling against a
zero-dependency policy, it would likely require the privacy review to be redone, and the gain is a
platform statement about app/device state rather than claim truth.

**Plan for closure as the primary path.** That is not pessimism; it is the roadmap's own structure —
#130 exists to be ready if the decision goes the other way.

### F2 — "Unavailable" is the common case, not the edge case

Attestation is unavailable on unsupported platforms, in older OS versions, under network failure, on
rooted or emulated devices, and whenever the vendor service is degraded. So the **majority** of real
traffic takes the unavailable path. #130's third criterion — unsupported or unavailable platforms never
receive elevated trust — is therefore not an edge-case guard; it is the default behaviour.

Design consequence: the elevated path is the exception, and the code should read that way.

### F3 — Freshness binding is where replay defence lives, and it needs a server-issued nonce

An attestation that is not bound to a server-issued nonce and a bounded time window can be captured and
replayed. This is the same requirement #123's F6 and #126's F6 raise for the envelope. If the nonce
mechanism was not settled upstream, **#130 cannot implement replay defence** and must say so rather than
approximate it.

### F4 — The trust value must be a specific approved value, not "higher"

#130's first criterion: a canonical valid supported attestation produces **exactly the approved bounded
trust outcome**. If #129's decision did not name a value, this issue cannot begin — and if the contract
cannot represent the value, the contract change is a prerequisite nobody has scoped.

### F5 — Logs and metrics are a leak path for attestation material

#130's fourth criterion: logs and metrics exclude attestation secrets **and stable raw identifiers**. An
attestation object typically contains a device or installation identifier — precisely the stable raw
identifier that must not be logged. This is the SDK's existing error discipline applied to a payload class
that is unusually tempting to log for debugging.

### F6 — Vendor test vectors are the only credible positive fixture

#130's verification names "platform-approved test vectors for each supported mechanism". A hand-rolled
attestation fixture proves the parser works, not that verification is correct. If vendor vectors are not
obtainable for a candidate mechanism, that mechanism should not be supported.

### F7 — This is `severity:high` and its trust boundary is a third party

The verifier is a platform vendor's service. Its availability, its key rotation, and its correctness are
outside this project's control, and a verification error must fail closed for elevated trust — never
"assume valid on verifier timeout".

---

## Task 0: The gate — five rows, all must be true

- [ ] 0.1 **#129 recorded GO**, naming specific mechanisms and platforms. If NO-GO, **close #130** with the
      reasoning and stop (F1).
- [ ] 0.2 #129 named the **exact approved trust value**, and the contract can represent it (F4).
- [ ] 0.3 #119's privacy review covers device attestation data — redone if necessary (#129's F6).
- [ ] 0.4 #121's authorization covers Mode B implementation, or a new authorization exists.
- [ ] 0.5 #124's browser package is complete.

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change, or a dedicated change.
- [ ] 1.2 Full assessment — `security_sensitive_behavior`, `integration`, `public_api`.
- [ ] 1.3 The design states F2's inversion: the unavailable path is the default; elevated is the exception.
- [ ] 1.4 The design names the vendor test vectors it will use (F6).

## Task 2: RED then GREEN — ten arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| T1 | canonical valid supported attestation (vendor vector) | **exactly** the approved bounded trust value (F4) |
| T2 | replayed attestation | rejected (F3) |
| T3 | stale attestation, outside the freshness window | rejected |
| T4 | substituted attestation (another device's) | rejected |
| T5 | malformed attestation | rejected |
| T6 | invalid signature | rejected |
| T7 | unsupported platform | **baseline trust**, never elevated (F2) |
| T8 | attestation unavailable | baseline trust, never elevated (F2) |
| T9 | verifier timeout / verifier error | **fail closed** for elevated trust (F7) |
| T10 | logs and metrics inspected across T1–T9 | no secrets, **no stable raw identifiers** (F5) |
| N0 | **null control** — Mode A path, no attestation | unchanged Mode A behaviour |

## Task 3: Verify, commit, PR, close

- [ ] 3.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.2 Closing comment: the eleven arms, the approved trust value, and the statement that valid
      attestation proves **only the platform-defined statement** — not evidence truth, not user intent,
      not uncompromised application logic.
- [ ] 3.3 Tick #130 in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#130) | Arm |
| --- | --- |
| Canonical valid supported attestation produces exactly the approved bounded trust outcome | T1 |
| Replayed, stale, substituted, malformed, invalid attestations fail | T2–T6 |
| Unsupported/unavailable platforms never receive elevated trust | T7, T8 |
| Logs and metrics exclude attestation secrets and stable raw identifiers | T10 |
| NOT AUTHORIZED unless the decision is GO and all gates affirmative | Task 0 |

## Risks and open questions

- **Building speculatively before #129 answers** (F1) is the most likely waste in this backlog.
- **Treating unavailable as an edge case** (F2) inverts the real distribution.
- **Falling back to elevated trust on verifier error** (F7, T9) is the failure that matters.
- **Logging the device identifier for debugging** (F5) is the leak that happens during development, not in
  the final code.
- **Open question:** if attestation is unavailable for most traffic (F2), what fraction of coverage would
  make Mode B worthwhile? That is a #118 metric that should have been defined before #129 was answered —
  raise it there rather than discovering it here.

## What this does not authorize

Supporting unapproved platforms, using attestation as proof of user intent or claim truth, or falling back
to elevated trust under any condition.

## What this plan did not verify

Whether vendor test vectors are obtainable for any candidate mechanism (F6). If they are not, no mechanism
should be supported and #129's GO would be unimplementable.
