# Design — add-client-evidence-capability

## Context

Three delegated records under `decisions/` bound this change: the purpose (P1, #117), the criteria
(#118), and the privacy and threat review (#119). The design below is the architecture those records
permit. Where a record leaves a choice to a later issue, the choice is named here as open and is
decided in that issue's own record.

## Shape

```
host page ──(its own request, header or body field)──► application server ──► producer SDK (Node)
   │                                                        │
   └─ @bloodtrail/client-evidence-browser                   ├─ security-audit event (2.x),
      Web APIs only · no Core · no transport ·              │  carrying a bounded client-evidence
      no storage · no credentials                           │  reference at client_claim trust (#125)
                                                            └─► collector ingress: envelope stage (#126)
```

- **The browser package builds an envelope and hands it to the host.** It never sends anything, so
  it holds no endpoint, credential, or collector secret.
- **The envelope is its own contract** (#123). It is not a projection of the audit contract, so a
  change to one cannot silently move the other.
- **The audit contract gains a reference, not the envelope** (#125). The reference is an additive,
  bounded field at `client_claim` trust, which makes it a contract minor move with the full pin
  inventory.
- **Ingress validates the envelope before mapping** (#126) and counts rejections by class. The
  counts are never audit evidence.

## Decisions taken here

1. **One capability, sequenced.** Browser and React Native share P1, the inventory, and the envelope.
   React Native follows the Mode B decision (#129), because its attestation path depends on it.
2. **Every claim is `client_claim`.** Nothing in P1 needs more, and #96's floor makes it mechanical:
   a risk model that lists a client-evidence input cannot claim more than `client_claim`.
3. **Reject, never truncate.** An oversized envelope is an invalid envelope. Truncation would turn an
   attacker's input into a different valid one.
4. **Mode A before Mode B.** Server-issued nonces bind a claim to an interaction the server started,
   and Mode A's proof of concept decides whether the wave continues at all.

## Decisions left to their issues

- **#122:** the canonical correlation field's name, generation authority, lifetime, collision
  handling, cross-origin behaviour, and server mapping.
- **#123:** the closed interaction-kind vocabulary (at most eight values) and the exact bounds.
- **#125:** the reference's field path and whether the contract move is `2.0.0` → `2.1.0` or rides
  a later move.
- **#129:** whether any attestation mechanism earns trust above `client_claim`. NO-GO is a
  legitimate outcome and closes #130 without implementation.

## Alternatives rejected

- **Rely on trace context alone.** It carries the same random identifier and labels it
  `observed_transport`, which overstates a client-chosen value. #118's utility stop keeps this
  alternative alive: if it performs as well, the wave ends.
- **Embed the envelope in the audit event.** It couples a low-assurance, attacker-controlled
  structure to the canonical contract's version line. Plan PLAN-086 and #124's correction both
  require independence.
- **A browser package that transmits.** It would need an endpoint and credentials in an
  attacker-controlled page. Letting the host send the envelope keeps the package credential-free.

## Provenance

`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.
