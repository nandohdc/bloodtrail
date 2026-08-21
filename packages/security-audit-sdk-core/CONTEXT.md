# Security Audit SDK Core Context

## Glossary

- **Self-contained packed artifact:** a packed artifact that references no module outside itself. ADR-SDK-011 owns this term and the generated-validator control already proves the property.
- **Complete packed artifact:** a packed artifact from which no module loaded by its declared entry points is absent. Package verification adds and proves this property.
- **Closure:** not a synonym for either property above. In this project it means lifecycle closure, as bound by `openspec/specs/security-audit-sdk-core/spec.md`. The filename `packed-consumer-closure.test.mjs` is legacy naming retained for continuity.
