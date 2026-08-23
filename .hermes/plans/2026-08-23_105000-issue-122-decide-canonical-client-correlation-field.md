# Issue #122 — Decide the Canonical Client Correlation Field — Decision Packet

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #121 and #75. This is a naming and semantics
> decision with a privacy dimension, and its most important line is a prohibition: **correlation is not
> authentication and not authenticity.** A correlation identifier links claims under defined rules; it
> proves nothing about who or what produced them. The second prohibition is equally load-bearing: **no
> stable device fingerprinting unless explicitly approved** — and the 2026-07-31 owner decision already
> flagged that browser-derived identifiers "may increase privacy and correlation risks".

**Goal:** One canonical semantic and field name, with generation authority, lifetime, format, cardinality,
collision handling, cross-origin and cross-device behaviour, server mapping, redaction/hashing/tokenization
and retention all deterministic — plus the rejected alternatives and their reasons.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #121 (owner gate) and #75 (version
policy).

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #122, OPEN, labels `enhancement` `question` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #121 (owner gate), #75 (unanswered version policy) |
| Native GitHub blockers | `blocked_by` is `0` |
| Existing correlation fields in the contract | `correlation_id`, `causation_id`, `request_id`, `message_id`, `transaction_id` — all minted by `AuditIdentifierProvider` (`src/providers.ts`) |
| Existing trust registry | `registries.trust_levels`; `authority_matrix.claimed_identity` already covers `source.client_reported.*` (PLAN-042, ALREADY_SATISFIED) |
| Existing privacy machinery | `privacy_transformations` in the contract; transform SPI in `src/config.ts`; `prohibited_data` |
| Prior warning | 2026-07-31 outcome — browser-derived identifiers may increase privacy and correlation risks |
| Bounds | strings 256 B |
| Downstream | #123 declares #122 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Five correlation-shaped fields already exist, and reusing one may be the answer

The contract already carries `correlation_id`, `causation_id`, `request_id`, `message_id` and
`transaction_id`, all server-minted. The genuine question is whether client correlation is a **sixth**
concept or a client-supplied *claim* about one of the existing five.

**The second framing is stronger** and PLAN-042 supports it: `authority_matrix.claimed_identity` already
covers `source.client_reported.*`, meaning the contract already has a place for client-asserted values
that are visibly claims. A client-supplied `correlation_id` **claim**, mapped server-side after
validation, may need no new field at all.

That possibility should be the first option on the owner's list, because it is the one that changes the
contract least.

### F2 — Generation authority is the decision that determines everything else

If the **server** generates the correlation value and hands it to the client, then lifetime, collision and
cardinality are all server-controlled, cross-device leakage is bounded, and the value is not a
fingerprint. If the **client** generates it, all four become attacker-controlled.

This maps directly onto #128's Mode A ("the server issues or derives the authoritative evidence and client
input remains a bounded claim"). **Server-issued is consistent with Mode A and is the recommendation.**

### F3 — Cross-origin and cross-device behaviour is where a correlation id becomes a tracking id

#122's third criterion asks whether the value may cross origins or devices. A value scoped to one origin
and one session is a correlation id. The same value persisting across origins is a cross-site tracking
identifier, which is precisely the privacy risk the 2026-07-31 decision named.

**Recommend: single origin, single session, no persistence across devices** — and state that persistence
would change the artefact's privacy classification, requiring #119 to be redone.

### F4 — The privacy transformation should be chosen from what already exists

`privacy_transformations` exists in the contract and the SDK applies registered transforms. Whatever
redaction, hashing or tokenization #122 selects should be an existing transformation family, so #127's
mapping inherits a mechanism instead of inventing one. #122's own security note requires the treatment to
be deterministic.

### F5 — The #75 dependency is about version treatment only

#122 declares #75 because adding a field to a frozen contract has version consequences. If F1's
"existing-field claim" option is chosen, there may be **no contract change at all** and the #75 dependency
evaporates. Worth checking before treating #75 as blocking.

### F6 — Correlation must never be treated as a credential, and that must be stated in the field's own
documentation

Not only in the ADR. Whatever carries the field — envelope schema, contract docs — must say it is not
authentication. #127 later depends on that being unambiguous, because its job is to map claims without
promoting trust.

---

## The decision, as the owner should see it

| | **A — client-reported claim on an existing field** (recommended first) | **B — new canonical client correlation field** |
| --- | --- | --- |
| Contract change | possibly **none** (F1) | additive; version increment; #75 applies |
| Fits `authority_matrix.claimed_identity` | yes, already | needs new authority-matrix entries |
| Risk of becoming a tracking id | lower — no new persistent artefact | higher; depends on F3's scoping |
| Clarity for consumers | mixes server and claimed values on one field name | one field, one meaning |

Plus four sub-decisions under either option: **generation authority** (recommend server-issued, F2),
**scope and lifetime** (recommend single origin, single session, F3), **privacy transformation** (recommend
an existing family, F4), and **collision handling** (must be deterministic).

---

## Task 0: The gate

- [ ] 0.1 **Confirm #121 recorded AUTHORIZE** and that correlation work falls inside the authorized scope.
      If not, stop.
- [ ] 0.2 Read the five existing correlation fields and `authority_matrix.claimed_identity` (F1).
- [ ] 0.3 Read `privacy_transformations` and pick candidate families (F4).
- [ ] 0.4 Check whether option A avoids a contract change, and therefore whether #75 blocks at all (F5).

## Task 1: Post the decision surface

- [ ] 1.1 Present options A and B with the four sub-decisions and recommendations.
- [ ] 1.2 State F3's consequence: persistence across origins or devices reclassifies the artefact and
      requires #119 to be redone.
- [ ] 1.3 State F6: this value is never a credential.
- [ ] 1.4 Carry the AI-triage disclaimer. Move `needs-triage` → `ready-for-human`.

## Task 2: When the owner answers — record only

- [ ] 2.1 Root ADR recording: the selected semantic and name; **rejected alternatives and reasons**
      (#122's first criterion requires them); generation authority, scope, lifetime, format, cardinality,
      collision handling; cross-origin and cross-device behaviour and prohibited fingerprinting uses;
      server mapping, privacy transformation and retention; compatibility and version treatment.
- [ ] 2.2 State that implementation remains NOT AUTHORIZED until #121's scope covers it.
- [ ] 2.3 Comment on #123 with the selected field.

## Task 3: Close

- [ ] 3.1 Close #122 naming the ADR; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#122) | Where satisfied |
| --- | --- |
| One canonical semantic and name; rejected alternatives recorded | ADR, Task 2.1 |
| Generation authority, scope, lifetime, collision, transformation, retention deterministic | ADR |
| Cross-origin/device behaviour and prohibited fingerprinting explicit | ADR, F3 |
| Compatibility/version treatment approved | ADR, bound to #75 or moot under option A |
| NOT AUTHORIZED until the governed client proposal is authorized | Task 2.2 |

## Risks and open questions

- **A correlation id that persists across origins** (F3) is a tracking identifier under a different name.
- **Client-generated values** (F2) put lifetime, cardinality and collision under attacker control.
- **Inventing a new privacy transformation** (F4) instead of reusing a contract family.
- **Open question for the owner:** does option A (a claim on an existing field) actually satisfy the
  purpose #117 recorded? If it does, Wave 5's contract work (#123, #125) shrinks substantially. Test it
  against the purpose before choosing B.

## What this does not authorize

Adding the field to the contract, using stable device fingerprinting, or treating correlation as
authentication or authenticity.

## What this plan did not verify

Whether option A satisfies #117's purpose, because #117 has no record yet.
