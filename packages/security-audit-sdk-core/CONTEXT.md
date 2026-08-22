# Security Audit SDK Core Context

## Glossary

- **Self-contained packed artifact:** a packed artifact that references no module outside itself. ADR-SDK-011 owns this term and the generated-validator control already proves the property.
- **Complete packed artifact:** a packed artifact from which no module loaded by its declared entry points is absent. Package verification adds and proves this property.
- **Closure:** not a synonym for either property above. In this project it means lifecycle closure, as bound by `openspec/specs/security-audit-sdk-core/spec.md`. The filename `packed-consumer-closure.test.mjs` is legacy naming retained for continuity.
- **Platform coupling:** a dependence on a capability the host runtime provides that is not part of the ECMAScript language.
- **Declared coupling:** a platform coupling the policy names for that artifact's role, with a recorded reason.
- **Undeclared coupling:** any platform coupling or module reference not named in the declared policy for that role, which fails closed.
- **Scope vs. lexical scope:** "scope" in the gate name refers to the authorization boundary and production-integration isolation; the classifier also analyzes scope in the lexical sense. "Allowed" and "forbidden" remain bound to the production-integration surface, whereas coupling admission states are "declared" and "undeclared".
