## Context

The collector ingress (`packages/security-audit-collector/src/ingress.ts`) already schema-validates and JSON-parses the submission body before the deduplication stage runs, so a parsed, schema-conforming object is available at the call site. `DeduplicationLedger` (`src/deduplication.ts`) is a generic, schema-agnostic exact-string comparator keyed by `(senderIdentity, eventId)`; it has no knowledge of the event contract's field structure. See proposal.md for why the current byte-exact comparison misclassifies genuine retries.

## Goals / Non-Goals

**Goals:**
- Make a genuine retry (same occurrence, only `correlation.retry_attempt` advanced) resolve as `duplicate`.
- Keep every other byte-level difference resolving as `conflict`, with no widening of what counts as "the same occurrence."
- Keep `DeduplicationLedger` schema-agnostic — it should not need to know about `correlation.retry_attempt` or any other contract field.

**Non-Goals:**
- Not changing the wire format, the delivery-conformance-contract, or the frozen event contract.
- Not introducing a hash or fingerprint for the comparison (already rejected in #108's assessment as a collision risk).
- Not addressing storage/retention policy (#114) or anything in the deferred client-evidence wave.

## Decisions

**Canonicalize at the ingress layer, not inside the ledger.** `ingress.ts` already has the parsed, schema-validated body (`parsed.value`) at the point it calls into the ledger. It computes a canonical deduplication key from that parsed value — a deep, key-sorted JSON projection with `correlation.retry_attempt` omitted — and passes that key to `DeduplicationLedger.decide` as an opaque string. The ledger's `decide(senderIdentity, eventId, body)` signature and its own tests are unchanged; it keeps comparing whatever string it is handed for exact equality. This keeps the schema-specific knowledge ("`correlation.retry_attempt` is attempt-scoped") at the layer that already owns schema validation, rather than teaching the generic ledger about contract fields.

Alternative considered: exclude the field inside the ledger itself (give `decide` a raw parsed body and an exclusion list). Rejected — it would couple the generic ledger to the event contract's shape and duplicate the parsing/navigation logic `ingress.ts` already has to do for `eventIdOf`.

**Exclude exactly `correlation.retry_attempt`, nothing else.** The delivery-conformance-contract (`openspec/specs/delivery-conformance-contract/spec.md`) names `correlation.retry_attempt` as the only field that legitimately varies across attempts of one occurrence ("Every attempt of the same occurrence SHALL carry the identical `event.id` ... and SHALL advance a zero-based attempt count expressed through `correlation.retry_attempt`"). The producer's wire-body projection (`packages/security-audit-sdk-node/src/http-handoff.ts`, `projectRequest`) confirms this empirically — it spreads `event.correlation` and overrides only `retry_attempt`. No other field is attempt-scoped today, so the exclusion set is exactly one field, not a heuristic or an open-ended allowlist.

**Deterministic canonical serialization, not raw re-stringification.** A small recursive `canonicalStringify` sorts object keys before serializing, so the key does not depend on incidental property insertion order. This keeps the comparison a true structural equality check (still no fingerprint/hash, still no collision risk) rather than relying on the parser's key order being stable.

## Risks / Trade-offs

- **[Risk]** A future wire-format change adds a second attempt-scoped field without updating the exclusion set, silently reintroducing false conflicts. → **Mitigation:** the exclusion set is a single named constant sourced from the one field the delivery-conformance-contract names as attempt-scoped; the design doc and code comment point back to that contract clause so a future contract change to attempt identity is the natural trigger to revisit this.
- **[Risk]** Canonicalizing before comparison could, in principle, widen what counts as "the same occurrence" if the exclusion set were ever loosened carelessly. → **Mitigation:** the delta spec's "Conflicting reuse fails closed" scenario and the existing D2 test are kept as an explicit null control proving a non-`retry_attempt` difference still conflicts; no other field is ever excluded.

## Open Questions

None — the fix is fully scoped by the one field the delivery-conformance-contract defines as attempt-varying, and by the existing rejection of a fingerprint-based approach in #108.
