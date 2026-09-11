# Design — enforce-derived-field-trust-floors

## Context

`derived-field-trust-semantics` ratified the rules and deferred enforcement to "a major canonical
contract version move", re-opening the decision when enforcement is authorized. `1.1.0` (#95) added
the optional carrier: `risk.model.provenance.derived_from`, accepted only beside a `derived_server`
trust level, with eight closed rejection outcomes. Two validators implement those outcomes from the
same generated block — the SDK's semantic kernel (`src/validation/semantic.ts`) and the contract's
fixture validator (`scripts/validate-contract.mjs`) — and #423 showed they must move together.

Re-opening leaves four questions the ratification did not have to answer.

## Decision 1 — where an input's trust comes from

The contract already declares a trust for every field (`fields[].trust`) and for every extension
namespace (`extension_namespaces[].trust`). An input's trust is that declaration, read from the
generated projection. The alternative — reading a trust level out of the event instance (for
example `actor.provenance.trust_level`) — lets the producer supply the number the check compares
against, which is the escalation the floor exists to stop.

## Decision 2 — what the closure contains

The risk model is the contract's only provenance carrier. An input under `risk` is therefore one of
the model's own outputs, and listing it is a derivation cycle, rejected with the existing
`DERIVED_FROM_CYCLE`. Every other input has no provenance of its own, so its closure is itself and it
contributes its declared trust. With self-reference excluded, the transitive-closure rule is
complete for this contract, not an approximation; a second carrier would re-open it, which the
ratified revisit conditions already say.

## Decision 3 — which declared levels are admissible

Maximum output trust is `min(floor, ceiling)`, and the producer's ceiling is `derived_server`. So
the admissible declarations are `derived_server` and every less trusted level — not only
`derived_server`, which is what `1.1.0` required. Keeping `1.1.0`'s equality would leave a model
whose floor is `client_claim` with no truthful representation: it could neither declare
`derived_server` (the floor rejects it) nor anything lower (the equality rejects it). A level above
the ceiling keeps `DERIVED_FROM_NON_DERIVED`, whose meaning — "the declared level is not a derived
level" — is unchanged.

## Decision 4 — when provenance is mandatory

Any event carrying `risk` must carry both `trust_level` and `derived_from`. The narrower trigger,
"when `trust_level` is present", would let a producer emit `risk.score` with no provenance at all and
stay valid — the omission the floor cannot see. Missing either field is `DERIVED_FROM_MISSING`,
pointed at the missing path.

## The floor diagnostic

The ratified rule says the diagnostic names the input that set the floor. SDK errors carry a code,
a category, and a bounded path, never caller data, so the pointer names the input by position —
`/risk/model/provenance/derived_from/<index>`, the first input in canonical order carrying the floor
level. The path string itself is caller-supplied and is not echoed.

## Alternatives rejected

- **Enforce the floor without the major move** (`1.1.0` semantics, floor checked when
  `derived_from` happens to be present). The ratified capability classifies enforcement as breaking;
  doing it as a patch would change what a valid `1.1.0` event is while its version says nothing did.
- **Read input trust from the event.** Rejected in Decision 1: the producer would supply the
  comparison value.
- **Encode the rules in the JSON Schema.** Conditional requirement is expressible, but the floor
  needs the field-policy trust of each listed path, and moving that into the structural validator
  would turn distinct semantic outcomes into one schema failure and diverge from the collector's
  byte-identical vendored validator contract.

## Version move

`2.0.0` touches every pin in `CLAUDE.md`'s inventory. The governed candidate record stays cumulative
(`rangeBase` `cdecd7f3`, the first governed `1.1.0` candidate) with its endpoint advanced to this
change's technical commit, exactly as #423 did; the canonical fold then rebinds it again, as #425 did.
The CRA pin moves in the fold, after the version is on `main`, because the checker reads the reviewed
baseline and would otherwise fail open once (#426).

## Provenance and reversal

`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. The
chain is a sequence of merge commits, so it reverts cleanly: revert the archive, fold, and
implementation merges in reverse order and the contract returns to `1.1.0`.
