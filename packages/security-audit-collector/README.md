# @bloodtrail/security-audit-collector

Bounded, **non-production** collector ingress for Bloodtrail security audit events.

> **AUTHORIZATION BOUNDARY (issue #343, owner decision 2026-09-06):** this package
> exists under strict scope — synthetic/isolated development and CI environments only,
> synthetic non-sensitive adversarial fixtures only, a non-production authentication
> interface with mock/synthetic credential verification, and no production
> deployment, production collection, real-user data processing, storage, or
> infrastructure. Production authorization: **none**.

## Overview

The ingress enforces the fixed stage order, each stage failing closed:

```
authenticate → size → parse → schema → version → deduplicate → accept
```

- **authenticate** — the configured `Authenticator` verifies the submission before
  any body byte is read, sized, or parsed. Missing, malformed, and invalid
  authentication are rejected before the parse stage runs. Authentication
  **identifies a sender**; it does not prove evidence truth, trust, or integrity.
- **size** — the raw body must not exceed `event_max_bytes` (65536), derived from
  the frozen contract bounds block, never configured locally.
- **parse** — JSON deserialization only; all semantic and structural judgment
  belongs to the generated validator and the version stage.
- **schema** — structural validation runs the **exact generated validator** the
  SDK core produces (`schema-validator.generated.cjs`), carried as a
  byte-identical vendored copy with a drift gate, so producer and collector
  cannot disagree about what is valid.
- **version** — the explicitly enumerated finite supported set
  `["1.0.0"]` per the ratified asymmetric version policy (#75/#76). An
  unsupported version is rejected distinctly from a schema rejection.
- **deduplicate** — after every existing validation stage, each collector
  instance retains at most 32 authenticated-sender/validated-event pairs for
  five minutes. A byte-identical retry is a distinct `duplicate` outcome and
  is not admitted again; different bytes under a live pair are rejected as a
  conflict. Full live capacity rejects rather than evicting a live pair.
- **accept** — acceptance is **admission only**: the occurrence enters
  `admitted` with its event identity. No durability, delivery, retry, storage,
  or downstream claim is made (delivery conformance contract, #102).

Rejection diagnostics are bounded triples `{ code, category, path }` from a
closed vocabulary; counters are plain increments keyed by stable labels.
No diagnostic or metric carries payload content, credentials, or secrets, and
no failure emits an audit event.

Duplicate recognition is an in-memory, instance-local synthetic control. It
uses lazy expiry (no timer), is not durable or shared between collectors, and
makes **no exactly-once, delivery, retry, storage, or production-retention
claim**.

## Package boundaries

- Standalone workspace: own `package.json` and `package-lock.json` (ADR 0009 topology).
- Private, unlicensed (`private: true`, `license: "UNLICENSED"`), unpublished.
- **Zero runtime dependencies** — the vendored generated validator is the only
  non-authored runtime artifact and is byte-drift-gated against the canonical
  generated artifact.
- Engines: Node `>=24 <25 || >=26 <27`.
- `packages/security-audit-sdk-core`, the frozen contract, and `research/` are
  never modified by this package.

## Usage

```ts
import {
  CollectorIngress,
  SyntheticFixtureAuthenticator,
} from "@bloodtrail/security-audit-collector";

// NON-PRODUCTION: synthetic fixture credentials only.
const ingress = new CollectorIngress({
  authenticator: new SyntheticFixtureAuthenticator(["fixture-token-a"]),
});

const result = ingress.submit({
  credentials: { credential: "fixture-token-a" },
  body: JSON.stringify(canonicalEvent),
});

if (result.kind === "admitted") {
  console.log("admitted", result.eventId, "from", result.senderIdentity);
} else if (result.kind === "duplicate") {
  console.log("duplicate", result.eventId);
} else {
  console.log("rejected", result.diagnostic.code);
}

const counters = ingress.metrics();
```

## Verification

```sh
npm run validate              # check:generated → typecheck → build → runtime → scope → dependencies → package
npm run test:scope            # zero approved runtime couplings; fail-closed mutations
npm run check:generated       # bounds regeneration check + validator byte-identity drift gate
```
