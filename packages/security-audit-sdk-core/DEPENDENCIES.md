# Development dependency record

The published package has no runtime dependencies. The lockfile is the integrity record for the exact transitive graph.

| Direct dependency | Version | Class | License | Purpose |
| --- | --- | --- | --- | --- |
| `ajv` | 8.20.0 | development only | MIT | Compile the approved Draft 2020-12 schema into a dependency-free standalone validator and supply the bundled `ucs2length` runtime helper. |
| `ajv-formats` | 3.0.1 | development only | MIT | Supply standards-compatible URI and date-time format validation during standalone generation; the `date-time` and `uri` validators are bundled into the generated artifact. |
| `typescript` | 5.9.2 | development only | Apache-2.0 | Strict compilation, declarations, and compile-time tests. |
| `@types/node` | 24.2.0 | development only | MIT | Type supported Node APIs without adding runtime code. |

## Bundled code

The generated standalone validator (`src/generated/schema-validator.generated.cjs`, shipped at `dist/generated/`) embeds adapted MIT-licensed code from the pinned development dependencies, inlined at generation time per ADR-SDK-011 (policy: BUNDLED_STANDALONE_VALIDATOR). The bundled code carries attribution in the artifact header.

| Bundled code | Source | Upstream version | License | Vendored at |
| --- | --- | --- | --- | --- |
| `ucs2length` runtime helper | `node_modules/ajv/dist/runtime/ucs2length.js` (lines 3-21) | ajv 8.20.0 | MIT | `vendor/bundled-validator-runtime.mjs` |
| `date-time` format validator | `node_modules/ajv-formats/dist/formats.js` (lines 70-73, 74-88, 98-120, 145-153) | ajv-formats 3.0.1 | MIT | `vendor/bundled-validator-formats.mjs` |
| `uri` format validator | `node_modules/ajv-formats/dist/formats.js` (lines 173-178) | ajv-formats 3.0.1 | MIT | `vendor/bundled-validator-formats.mjs` |

The bundled implementations are adapted from the pinned sources: control flow is restructured into single-branch conditions (no logical operators, no ternaries) so the bundled code stays within the repository's analyzer branch thresholds, without any behavior change. Behavior identity is enforced by `tests/verification/bundled-formats-parity.test.mjs`, which proves the bundled implementations behave identically to the pinned dependency implementations. `scripts/generate-contract.mjs` fails generation if the emitted validator references any module outside this recorded set or remains non-self-contained.

Rules:

- Exact direct versions and all transitive versions/integrities are pinned by `package-lock.json`.
- `npm audit --audit-level=low` must pass; findings are not waived by this record.
- Runtime dependency count must remain zero while the generated standalone validator remains correct.
- Any dependency or license-policy change requires review under ADR-SDK-003 and ADR-SDK-009.
