# P-D: what the SDK cannot establish

Static hypotheses, not run evidence. All citations below refer to
`dbdd0936ba874d7b622403103644206c4a6fa56f`. Prefix `core` means
`packages/security-audit-sdk-core`; `node` means `packages/security-audit-sdk-node`.
These are trusted-producer limits, not statements that validation does nothing.

1. **Host truth.** Constructors normalize, enforce non-empty presence where
   required, freeze and register object identity; they do not authenticate facts.
   Evidence: core/src/context.ts:139-181, 226-297, 430-434, 459-461;
   core/SECURITY.md:7-11, 40. PD-B6 exercises false-origin authority;
   no dedicated non-empty-presence case is added.
2. **Source origin.** Routing a client-presented opaque id through an authoritative
   constructor gives it authoritative-server provenance. A brand identifies the
   constructor, not where its input originated. Evidence: core/src/context.ts:139-153,
   183-196; core/src/generated/contract.generated.ts:1703-1711. Case: PD-B6.
3. **Actual commit truth.** A handle records the application's report; it neither
   opens nor inspects a database transaction. Unlike the old draft, a transaction-bound
   event without a handle now refuses for every non-success outcome (#797).
   Evidence: core/src/operations.ts:82-95, 108-119; core/src/events.ts:199-224;
   core/SECURITY.md:52-60. Cases: PD-01, PD-C1–C10. None proves a business commit.
4. **Occurrence time.** Explicit timestamp and observed-at values bypass the clock;
   date-time syntax is not clock comparison or ordering evidence.
   Evidence: core/src/events.ts:446-455;
   contracts/security-audit/schema/security-audit-event.schema.json:184-195.
   Case: PD-E4.
5. **Address hop and transformation.** The host chooses the observed address.
   Transform-required policy gates hook eligibility, not mandatory registration.
   Evidence: core/src/context.ts:321-323; core/src/events.ts:288-300;
   core/src/internal.ts:63-73; core/src/generated/contract.generated.ts:2223-2231;
   core/API.md:116. Cases: PD-E1/PD-E2 (raw documentation-range addresses).
   No dedicated trusted-hop extractor case exists.
6. **Raw versus keyed value.** Hook key-id is validated but not written. Credential
   metadata is whatever the host supplies, not cryptographic proof.
   Evidence: core/src/events.ts:303-353; core/src/context.ts:252-254.
   Case: PD-E3.
7. **Complete-event provenance and retry provenance.** Structure and semantic
   validation cannot establish prior generation/delivery or truthful authority.
   Explicit bounded retry labels also do not prove the original event existed.
   Evidence: core/src/sdk.ts:78-84, 306-314, 476-500, 513-535;
   core/src/events.ts:56-70, 227-254; core/src/validation/semantic.ts:354-370;
   core/SECURITY.md:60-66. Cases: PD-F10 and PD-C13. This does not remove the
   same-instance exact-handle check on named construction.
8. **Fields with no brand check.** Request, correlation, environment, service,
   deployment and frame operation are cloned, not branded. Client-evidence and
   per-call event/retry fields are also not branded; structural/semantic checks
   still apply. Evidence: core/src/context.ts:111-130, 387-420;
   core/src/events.ts:98-124, 151-174, 227-254. Cases: PD-C8 (frame operation),
   PD-E4 (event times), PD-C13 (retry). No dedicated client-evidence,
   environment/service/deployment or request/correlation-origin case exists.
9. **Intended SDK instance.** Context brands belong to the module copy, and Node
   frames belong to the shared AsyncLocalStorage provider; handles instead belong
   to one SDK authority. Evidence: core/src/context.ts:42-55, 436-440;
   core/src/operations.ts:69-70, 122-129; node/src/context.ts:4-16;
   node/src/platform.ts:29-36, 51-56. Cases: PD-A11/PD-A13, contrasted with PD-C7.
10. **Absence of private data.** The key denylist and bounded value heuristic are
    not a general personal-data detector. Boundary, punctuation, plural and open
    schema slots limit it. All probe strings are runtime-built synthetic markers.
    Evidence: core/src/validation/prohibited.ts:11-12, 45-50, 74-87;
    core/src/validation/schema.ts:105-112, 155-159;
    contracts/security-audit/schema/security-audit-event.schema.json:946-955,
    1241-1244. Cases: PD-D1–D13. No real personal data is tested.
11. **Producer identity or durability.** Producer configuration is caller-supplied;
    sink acceptance is not durable delivery or truth attestation.
    Evidence: core/src/config.ts:115-124, 146-159;
    core/src/testing.ts:21-34; core/SECURITY.md:10-11, 27, 98-111.
    No dedicated producer-identity or durability case; all accepted sink outcomes
    illustrate only the capturing-sink boundary. Delivery is P-E's separate scope.

Implementer default: retain all eleven limits with these corrections, including
non-empty presence, the #797 refusal, and the extra unbranded per-call fields.
No claim of production readiness, fraud detection, host honesty or attestation.
