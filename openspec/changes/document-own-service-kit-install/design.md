## Context

This proposal gives an evaluator performing M2 one checked way to add the non-production evaluation kit to an
**own service**: a standalone service outside the kit directory and outside npm or pnpm workspaces. The
candidate modifies two existing `security-audit-sdk-node` requirements. Its delta replaces each complete
canonical block and retains every existing scenario, adding only the own-service obligations and scenarios.
The future fold follows the implementation commit; the archive is a distinct pull request.

## Governance Metadata

```yaml
security_sensitive: false
capabilities: [security-audit-sdk-node]
modified_requirements: 2
```

## Design Pattern Assessment

### Classification, scope, and forces

This is a full, direct-implementation assessment against proposal baseline
`fb70f37204980a3723461f25ac7cf45e8d6d2518`. It declares only `security-audit-sdk-node`, is not
security-sensitive, and matches `integration` because it proves the evaluator's package-manager integration
outside the kit, and `canonical_capability_requirement` because it changes two complete canonical requirement
blocks. It does not match `public_api`, `lifecycle_or_state`, `concurrency`, `persistence`,
`security_sensitive_behavior`, or `governance_core_path`: no package interface, state transition, retained
state, concurrent behavior, security decision, or governance-core path changes. The two matched triggers make
this a material capability modification.

The selected direct approach responds to five coupled forces:

1. an evaluator doing M2 must be able to add the kit to their own service with any supported installer,
   without guessing;
2. the supported installers are those the kit gate proves, so a documented install the gate does not run is an
   unproven claim;
3. every SDK package must resolve to the kit's one core copy, and the Node binding is never installed on its
   own;
4. each kit-gate check must be shown to fail on a planted defect, at each installer it proves; and
5. the guide's snippets are the one source the gate installs from, so the guide cannot drift from what
   installs.

`assessment.source.json` is the authored assessment record and `assessment.json` is its generated form. The
owned paths are closed over the seven proposal files, the future canonical fold, three evaluator documents,
six gate and control scripts, and the two glossary/map documents. No package source, manifest, builder,
contract, workflow, or governance-core path is owned.

### Candidate approaches and selection

- **`approach-gate-installs-documented-own-service` (selected):** the guide owns the JSON and YAML snippets,
  and the gate reads and installs them verbatim in a copied kit and a sibling standalone own service with npm
  and each pinned pnpm release. It makes documentation, install evidence, npm-tree validity, and the one-core
  probe one bounded candidate.
- **`approach-generated-manifest-plus-guide-name-check` (rejected):** build the own service from the kit's
  generated manifest and merely check that guide text names the steps. It fails forces 2 and 5 because the
  guide snippets can drift from the install that the gate actually runs.
- **`approach-documentation-without-gate-proof` (rejected):** document the installer steps without an
  own-service gate check. It fails forces 1, 2, and 4 because a supported-installer claim would have no
  evidence and no planted-defect proof.
- **`approach-npm-runtime-probe-only` (rejected):** prove the npm leg solely with the runtime one-copy probe.
  It fails force 3 because npm links the Node binding's relative core dependency to the service-level core;
  the probe passes without the pin while `npm ls --all` reports the invalid dependency.
- **`approach-workspace-own-service` (rejected):** document an npm- or pnpm-workspace service as the M2
  layout. It fails force 1 because neither the guide nor the gate proves that layout; only a standalone service
  is within this candidate.

The selection adds no catalog-pattern claim, public API, production integration, storage, release,
publication, or delivery mechanism.

### Security and correctness consequences

- **Audit integrity:** the gate requires both SDK packages to resolve through one core copy and makes the npm
  dependency-tree diagnostic part of the evidence.
- **Authentication or authorization:** no authentication or authorization input, decision, or policy changes.
- **Authority provenance:** the package pins and probes inspect installed artifacts only and do not create,
  accept, or relay authority.
- **Concurrency:** the standalone installer legs are isolated disposable work and introduce no shared or
  concurrent runtime behavior.
- **Confidentiality:** the new guide uses synthetic paths and package names and handles no evaluator payload or
  credential.
- **Cryptography:** this change neither creates nor changes a cryptographic primitive, key, checksum, or
  signature.
- **Error disclosure:** failures identify installer and dependency conditions without adding application error
  responses or emitting evaluator data.
- **External security integration:** package-manager commands run only in the non-production gate and add no
  runtime integration with a security service.
- **Fail posture:** missing npm or pnpm pins and a missing core dependency are planted defects that must fail
  their named gate check.
- **Lifecycle:** disposable service directories are created and removed by the gate; no package or event
  lifecycle changes.
- **Mutation ownership:** the exact path list confines guide, gate, controls, vocabulary, delta, and fold work
  without acquiring unrelated implementation or governance files.
- **Privacy transformation:** no audit value, field transformation, privacy rule, or data-processing path is
  changed.
- **Resource retention:** installations occur in fresh temporary directories removed after verification and
  retain no service data.
- **Retry or redelivery:** installer retries and event redelivery behavior are unchanged; only a verification
  installation is added.
- **Trust boundary:** the guide defines the standalone own-service boundary, while the gate operates on copied
  kit artifacts without granting service or release authority.

### Implementation invariants and evidence

| Invariant | Ticket tasks | Planned evidence |
| --- | --- | --- |
| `implementation-own-service-install-documented` | 2.1, 2.2, 3.3 | The integration guide supplies the exact JSON, YAML, npm, and pnpm snippets, references from the other evaluator documents, and a recorded evaluator walk runs them. |
| `implementation-own-service-install-proven-per-installer` | 2.3, 2.4, 3.1 | npm and each pinned pnpm leg install guide snippets verbatim, verify the package conditions and one core copy, and three controls prove missing pins or dependencies fail. |
| `implementation-kit-installs-unchanged` | 3.1, 3.2 | Validation proves the kit's existing npm and pnpm legs, their probe, and their verification clauses remain unchanged while the own-service check is additional. |
| `implementation-folds-two-complete-requirements` | 4.1 | The canonical fold replaces only the two complete delta blocks, including retained scenarios and the prescribed additions. |

The assessment's `verification_task_ids` names 1.1, 2.1 through 2.5, 3.1 through 3.3, and 4.1. It must be
re-evaluated if the implementation needs another capability, a package interface, a package source or manifest
change, a workspace layout, a production integration, or a governance-core path.

## Goals / Non-Goals

**Goals:**

- Let an evaluator add both SDK packages and the core pin to a standalone own service with npm or each proven
  pnpm major.
- Make the guide snippets the gate's install input, with valid npm dependencies and exactly one loaded core
  copy for every installer.
- Prove each missing-pin or missing-dependency failure with a measured planted defect.
- Preserve complete requirement replacements, ordered fold, and separate archive.

**Non-Goals:**

- Supporting services inside npm or pnpm workspaces, yarn, or Node-binding-only installation.
- Changing package source, exports, constructors, validation, manifests, the kit builder, contract, release,
  publication, storage, or deployment.
- Adding `npm ls` to the kit's existing npm-install leg.

## Decisions

### D1. A guide-owned standalone service is the gate input

The gate locates exactly one own-service guide section, extracts exactly one JSON fence and one YAML fence, and
installs their contents without regenerating their dependencies or pins. It copies the kit to a fresh root next
to a fresh `my-service` directory, so the service is outside the kit directory and every workspace root. The
JSON must list both SDK packages; the installers, rather than another text rule, judge its pins.

### D2. npm and pnpm require their distinct pins

The JSON contains both tarballs and npm's `overrides` core pin. npm installs offline and must pass `npm ls
--all`, because a runtime one-copy probe alone cannot observe npm's invalid relative dependency. The YAML
contains pnpm's `overrides` pin in the service's own `pnpm-workspace.yaml`; pnpm does not read npm's
`overrides`, and pnpm 11 and later do not read the `pnpm` field in `package.json`. The supported pnpm releases
are 10.17.0, 11.28.2, and 12.8.1.

### D3. Every installer leg proves all package entry points

Each own-service leg loads `@bloodtrail/security-audit-sdk-node`,
`@bloodtrail/security-audit-sdk-core`, and `@bloodtrail/security-audit-sdk-core/testing` through the existing
core-copy probe channel. The new check runs last in both build and existing-kit modes. The fence allowlist gains
`yaml`; the document-reference list gains only required integration-guide exceptions, if the reference checker
demands them.

### D4. Controls alter the source the installer reads

Each control changes exactly one uniquely anchored part of a copied guide through the existing measured-file
helper and runs the direct own-service check. The missing npm-pin control requires the invalid dependency-tree
message. The missing pnpm-pin control proves all three pnpm releases fail independently. The missing-core
control requires the dependency-list diagnostic. The bookkeeping records the new final check identity, clause,
and 79 controls.

## Risks / Trade-offs

- A version change in either tarball name requires the guide and its gate evidence to move together, which is
  intentional drift detection.
- The own-service checks add four installations to the kit gate, so the implementation records measured
  validation evidence rather than treating runtime as a threshold.
- The guide uses a sibling-path example because a kit archive unpacks to the destination basename and cannot
  know the evaluator's chosen kit directory name.

## Migration Plan

There is no deployment, release, or data migration. Implementation changes the guide and verifier, records the
external evaluator walk, folds the two complete requirement blocks, and archives the active change only in a
later pull request.

## Open Questions

None.
