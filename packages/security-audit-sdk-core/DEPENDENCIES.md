# Development dependency record

The published package has no runtime dependencies. The lockfile is the integrity record for the exact transitive graph.

| Direct dependency | Version | Class | License | Purpose |
| --- | --- | --- | --- | --- |
| `ajv` | 8.20.0 | development only | MIT | Compile the approved Draft 2020-12 schema into a dependency-free standalone validator. |
| `ajv-formats` | 3.0.1 | development only | MIT | Supply standards-compatible URI and date-time format validation during standalone generation. |
| `typescript` | 5.9.2 | development only | Apache-2.0 | Strict compilation, declarations, and compile-time tests. |
| `@types/node` | 24.2.0 | development only | MIT | Type supported Node APIs without adding runtime code. |

Rules:

- Exact direct versions and all transitive versions/integrities are pinned by `package-lock.json`.
- `npm audit --audit-level=low` must pass; findings are not waived by this record.
- Runtime dependency count must remain zero while the generated standalone validator remains correct.
- Any dependency or license-policy change requires review under ADR-SDK-003 and ADR-SDK-009.
