# Security Audit SDK Core Context

## Glossary

- **Injected provider:** a host capability fixed at construction. These are identifiers (`AuditIdentifierProvider`), clock (`AuditClock`), context provider (`ContextProvider`), schema runtime (`AuditSchemaRuntime`) and timers (`AuditTimerProvider` with `AuditTimerHandle`). The sink and the transformation hooks keep their own existing failure contracts.
- **Provider fault:** an injected provider that throws or returns an unusable value. It is attributed to the provider, never to the caller's input, and the provider's own error never crosses the public boundary.
- **Transaction-bound event:** a cataloged event whose commit values include `committed`. Its commit state comes only from operation evidence, whatever its outcome. Not to be confused with the `transaction_critical` delivery class: some transaction-bound events are policy-critical.
- **Operation evidence:** an operation handle issued by `beginOperation()` on the same SDK instance and advanced only through its sanctioned transitions. Snapshots, copies, plain objects and handles from another instance are not operation evidence.
- **Self-contained packed artifact:** a packed artifact that references no module outside itself. ADR-SDK-011 owns this term and the generated-validator control already proves the property.
- **Complete packed artifact:** a packed artifact from which no module loaded by its declared entry points is absent. Package verification adds and proves this property.
- **Closure:** not a synonym for either property above. In this project it means lifecycle closure, as bound by `openspec/specs/security-audit-sdk-core/spec.md`. The filename `packed-consumer-closure.test.mjs` is legacy naming retained for continuity.
- **Platform coupling:** a dependence on a capability the host runtime provides that is not part of the ECMAScript language.
- **Declared coupling:** a platform coupling the policy names for that artifact's role, with a recorded reason.
- **Undeclared coupling:** any platform coupling or module reference not named in the declared policy for that role, which fails closed.
- **Scope vs. lexical scope:** "scope" in the gate name refers to the authorization boundary and production-integration isolation; the classifier also analyzes scope in the lexical sense. "Allowed" and "forbidden" remain bound to the production-integration surface, whereas coupling admission states are "declared" and "undeclared".
- **Exact-one package support:** the many-to-one compatibility relation in which each SDK package version supports exactly one canonical Security Audit Event Contract version, while several SDK package versions may support the same contract version.
- **Exact-version instance binding:** the construction invariant that a producer SDK instance can be created only for the contract version supported by its package version.
- **Default identifier provider:** `systemAuditIdentifiers`, used when `identifiers` is omitted.
- **Host cryptographic capability:** host Web Crypto `crypto.randomUUID`, a Declared coupling admitted only to `src/providers.ts` by the platform-coupling policy, never a `node:` import.
- **Collision resistance:** probabilistic resistance from 122 CSPRNG bits per UUID v4 across producers, processes, restarts and identifier kinds. It is not absolute uniqueness, not authentication, and not a fraud signal.
