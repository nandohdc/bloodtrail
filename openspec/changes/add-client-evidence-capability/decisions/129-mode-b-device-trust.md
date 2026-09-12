# Mode B Device-Trust Decision (#129)

Status: **NO-GO for P1, taken under delegation**.

- **Decision taken by:** Claude, under delegation from the project owner Fernando Homem da Costa
  (`nandohdc`), who on 2026-09-11 instructed: *"I want you to keep going and implement ONLY the
  issues between #96 to #132 … you full authorization to implement them"*.
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-11; not a human
  owner decision"`. The owner has not reviewed this record. It is not an exact-commit owner
  authorization and must not be cited as one.
- **Bound to:** `117-client-evidence-purpose.md` (purpose P1), `118-success-and-stop-criteria.md`,
  `119-privacy-and-threat-review.md`, and the #128 outcome in `../harness/mode-a-evidence.md`.
- **Consequence:** **#130 closes without implementation.** No Mode B code exists or is authorized.
  Until a GO exists, an unavailable, invalid, stale, or replayed attestation SHALL NOT receive
  elevated trust, which is what the capability already requires.

## The question

Whether a direct device-origin claim may carry trust above `client_claim`, and if so by what
mechanism, verifier, key lifecycle, and failure behaviour.

## Mechanism inventory

Each candidate was assessed against P1's purpose, #117's prohibited-data inventory, and #119's
threat model. None was implemented or contacted; this is a documentary assessment of published
platform behaviour, not a measurement.

| Mechanism | What it can establish | What it cannot | Verifier and key lifecycle | P1 fit |
|---|---|---|---|---|
| WebAuthn / passkey assertion | that a credential the server registered signed a server challenge | that a browser produced the interaction being annotated, or that the claim is true | relying party verifies with the registered public key; credential lifecycle is the user's | **None.** P1 annotates unauthenticated and authenticated interactions alike; requiring a credential per interaction changes the purpose |
| Apple App Attest / DeviceCheck | that a genuine app instance on genuine hardware produced a key | truth of any claim the app makes with it | Apple-issued attestation, app-scoped key, server-held receipt; per-install key with its own rotation | **None**, and it is iOS-only |
| Google Play Integrity | a verdict about app, device, and account state | truth of any claim, or the interaction | Google verifies, token bound to a server nonce, quota-metered | **None**, and it is Android-only |
| Android Key Attestation | that a key lives in verified hardware | truth of any claim | vendor certificate chain the server must pin and rotate | **None**, and it is Android-only |

## Why NO-GO

1. **P1 does not need it.** The purpose is interaction-scoped audit correlation. #128 measured
   grouping accuracy of 1.0000 with an unverified identifier, against 0.6448 for the best
   server-side alternative. Device attestation cannot raise grouping accuracy above 1.0; it would
   buy a property P1 has no use for.
2. **It buys the wrong property.** Every mechanism above attests platform or app state. None
   attests that the annotated interaction happened, and #119 already records spoofing as
   unpreventable within Mode A. A verified attestation beside a spoofed `interaction_id` is a
   verified envelope around an untrue claim, which is a worse artefact than an honestly
   `client_claim` one, because it invites a reader to trust it.
3. **Its artefacts are the data P1 is forbidden to collect.** Attestation carries app-install keys,
   device verdicts, and vendor identifiers. #117's inventory admits a per-interaction random
   identifier and a closed interaction kind, and the 2026-07-31 owner outcome forbids device
   fingerprinting and hardware identifiers outright. Mode B could not be implemented without
   collecting exactly what that outcome refuses.
4. **The trust it would produce has nowhere to go.** The contract fixes `client_evidence.provenance`
   at `client_claim`, and #96's derived-field trust floor bounds every result that reads it.
   Admitting a higher level would need a further governed contract move whose only consumer would be
   a purpose P1 does not have.
5. **It would widen the support boundary to platforms this repository does not build or test.**
   Two of the four mechanisms are single-vendor mobile paths with no target in this repository's CI.

## What a GO would have required

Recorded so a future reconsideration starts from the same bar rather than a fresh argument: a
purpose that needs device-origin assurance and is written as a #117-format record; a privacy and
legal review of the attestation artefacts against the 2026-07-31 outcome; a named verifier owner and
key-rotation procedure per mechanism; a nonce and freshness binding at least as strong as Mode A's;
a supported platform and version matrix with real CI targets; a fail-closed fallback that never
elevates trust when attestation is unavailable, stale, or invalid; and a contract move that gives
the elevated level a meaning downstream.

## Consequences recorded here

- **#130 — Mode B attested client path:** closed without implementation, as task 10.2 provides for.
- **#131 — React Native adapter:** not implemented in this wave. With Mode B closed, an adapter
  would emit Mode A envelopes on a platform the audit contract does not admit: `react_native` is in
  the envelope registry but not in the contract's `client_evidence_platforms`, so #127's mapping
  refuses it as `unsupported_platform` by design, and a mapped reference could not be produced.
  Making it useful needs its own contract move, a supported React Native version matrix, and mobile
  CI targets this repository does not have. Its disposition is recorded on #132.
- **Mode A itself is unchanged:** it remains the only mode, at `client_claim`, in the
  non-production scope #121 authorizes.

## Assurance limitation

A NO-GO is a decision not to add a mechanism. It proves nothing about the mechanisms assessed, and it
does not make Mode A's claims any more trustworthy than #119 already records them to be.
