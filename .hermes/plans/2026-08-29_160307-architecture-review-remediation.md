# Architecture Review Remediation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Correct the two verified SDK defects first, then independently deepen the verifier modules that have demonstrated duplicate infrastructure without changing the frozen contract, production scope, or governance meaning.

**Architecture:** Treat every independent behavioral change or verifier policy change as its own OpenSpec lifecycle and branch. The terminal-retry and generated-input defects are separate implementation changes because they have different public guarantees and regression seams. The later verifier work shares low-level infrastructure only; it must preserve each gate's existing policy, diagnostic IDs, fail-closed behavior, and mutation controls.

**Tech Stack:** Node.js 24/26, ESM TypeScript, TypeScript compiler API, Node test runner, OpenSpec, Git/GitHub, existing SDK 19-gate validation chain.

---

## Current Context and Non-Negotiable Constraints

- Planning baseline: `main...origin/main` was clean when this plan was written. The only active OpenSpec changes are `contract-reuse-assessment`, `distinguish-empty-governance-range`, and `retire-superseded-scope-regexes`; do not modify, fold, or archive any of them incidentally.
- No existing GitHub issue matched either the terminal-named-retry defect or the generated-`reason` requirement defect at planning time. Create a separate tracking issue for each only when implementation is authorized.
- The approved 1.0.0 contract is frozen. Do not change `contracts/security-audit/source/contract.source.json`, its generated contract artifacts, or `contract-provenance.json` for any work in this plan. `test:contract-immutability` must remain green.
- Generated SDK projection is derived. Never hand-edit `packages/security-audit-sdk-core/src/generated/contract.generated.ts`; update `scripts/generate-contract.mjs`, regenerate, and check drift.
- Preserve the authorization boundary: no transport, exporter, collector, queue, storage, SIEM, analytics, browser telemetry, production sink, real-user data processing, or delivery retry behavior. “Retry” here means caller-supplied event causality for a new named occurrence, not automatic sink retry.
- Use a new branch per change. Keep proposal, technical implementation, canonical-spec fold when required, signed governance record, and archive relocation as distinct commits/PR stages. Do not infer owner approval from test results, PR state, or AI review.
- Resolve the current duplicate OpenSpec skill discovery before executing this plan. The repository has both `.hermes/skills/` and `.agents/skills/` copies visible to Hermes; use the CLI-backed repository workflow after confirming the profile registers only the intended `.hermes/skills` directory. Do not hand-create `openspec/changes/<name>`.

## Finding Disposition

| Review finding | Plan disposition |
| --- | --- |
| Terminal named retry after a completed operation is rejected | Implement first as a behavior fix. |
| `reason` required-context omitted from generated named input types | Implement second as a generator/type projection fix. |
| Duplicate TypeScript parsing/walking | Implement only a package-local shared inspection primitive after the two fixes. |
| Duplicate quiet Git probe wrapper | Implement as a small, standalone verifier refactor. |
| Raw lifecycle metadata access | Start with an evidence-backed design/proposal; implement only if diagnostic compatibility can be proved. |
| Cross-tree diagnostic sink, generic verification-case fixture, context descriptor, gate registry | Deferred. No code change in this program. |
| Structured `tenant_rule` semantics | Deferred to a future canonical-contract decision and Contract Reuse Assessment; it is not a refactor. |

## Common Governed Change Protocol

Apply this protocol to every authorized change below. Do not combine changes merely because their files are near each other.

1. Create a clean branch from verified `origin/main`; record repository root, branch, `HEAD`, upstream, live remote tip, and empty index. Stop if main moved before the change is started.
2. Create one focused tracking issue if it does not already exist. Its description must state the exact finding, in-scope paths, explicit non-goals, and the separate human approval/merge/archive gates.
3. Run `openspec new change <change-name>`, then `openspec status --change <change-name> --json` and artifact instructions. Use the generated template and allowed roots; never hand-create the change directory.
4. Write proposal, assessment, design, task list, and the required delta spec before implementation. Keep every implementation/review/merge/archive task unchecked at proposal time. Commit only the proposal artifact allowlist as `docs(openspec): propose <change-name>` after strict validation.
5. Implement one red-green vertical slice at a time. Test behavior through the public SDK or verifier seam, not by asserting private implementation structure alone.
6. Before staging a technical candidate, perform read-only semantic verification with an empty index. Because `build`, `generate`, and the full validation chain write outputs, run write-mode commands while implementing and run final full-chain verification from an isolated disposable clone/overlay of the exact candidate. Preserve the verified candidate byte-for-byte afterward.
7. Stage an explicit allowlist only. Commit the technical candidate separately (`fix(sdk): ...` or `refactor(verification): ...`). Bind human review and any signed record to that exact technical commit; AI review is not approval.
8. If the change modifies a capability-bearing normative spec, fold its delta into the canonical spec while the change remains active, prove a second semantic fold is a no-op, and merge identity-preservingly before archiving. If `skip_specs: true` is justified by the generated OpenSpec metadata, record the reason and archive only with `--skip-specs`.
9. Archive only after the exact reviewed/approved implementation has identity-preservingly merged to `main`. Archive as a pure relocation commit/PR with no unrelated technical edits; verify archive attestations and changed paths.

## Task 1: Repair terminal named retry after accepted completion

**Objective:** Make an explicit caller-supplied named retry a re-execution after a completed terminal success, while preserving duplicate rejection for ordinary repeated terminal success and retaining all sink/operation safety rules.

**Change:** `fix-terminal-named-retry`

**Issue scope:** New issue, created only when authorized. Link the issue to the canonical retry requirement and ADR-SDK-007, not to a production-delivery capability.

**Files:**
- Create: OpenSpec artifacts resolved by `openspec new change fix-terminal-named-retry`.
- Modify: `packages/security-audit-sdk-core/tests/f11-delivery-intent.test.ts:330-399`.
- Modify: `packages/security-audit-sdk-core/src/sdk.ts:424-445`.
- Potentially modify: the matching delta section under `openspec/changes/fix-terminal-named-retry/specs/security-audit-sdk-core/spec.md` only if the OpenSpec template requires a clarification scenario.
- Do not modify: `contracts/security-audit/**`, `src/events.ts`, generated source, package metadata, sink interfaces, or lifecycle metadata unless a separate governance step explicitly requires it.

### Step 1.1: Create the proposal-only change

1. Start from an empty-index branch named `fix/terminal-named-retry` based on current `origin/main`.
2. Use `openspec new change fix-terminal-named-retry`; inspect status and instructions before writing artifacts.
3. In the assessment/proposal, record the proven symptom: a completed `authenticationSucceeded` operation followed by an input-level `retry` relationship returns `SDK_DUPLICATE_SUCCESS` before event construction.
4. Define the invariant precisely: a positive explicit `retry_attempt` represents a fresh named execution; it receives a new event ID and valid causality, does not redeliver identical bytes, and does not introduce automatic transport retry.
5. Record non-goals: no change to operation authority, sink lifecycle, retention model, pure/named redelivery, contract 1.0.0, or any production integration.
6. In the delta spec, reference the existing requirement at `openspec/specs/security-audit-sdk-core/spec.md:114-125`; add only a scenario clarifying completed-operation re-execution if strict OpenSpec capability coverage requires it.
7. Run `openspec validate fix-terminal-named-retry --strict` before the proposal commit.

### Step 1.2: Add the failing F-11 public-behavior regression test

Add one test next to the existing F-11 named retry and terminal-reservation tests. Use the current `createHarness`, `namedInput`, and `expectFailure` helpers; do not create a second harness abstraction.

The regression test should have this behavior:

```ts
test("F-11 terminal named retry re-executes after accepted completion", async () => {
  const harness = createHarness({ start: 70_000 });
  const operation = harness.sdk.beginOperation({
    operationId: "operation-f11-retry",
    transactionId: "transaction-f11-retry",
    correlationId: "correlation-f11-retry",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(operation.ok, true);
  if (!operation.ok) return;

  assert.equal((await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never)).ok, true);
  const original = harness.events.at(-1);
  assert.ok(original);

  const retry = await harness.sdk.authenticationSucceeded({
    ...namedInput(),
    operation: operation.value,
    retry: { retry_attempt: 1, original_event_id: original.event.id, causation_id: original.event.id },
  } as never);

  assert.equal(retry.ok, true);
  const retryEvent = harness.events.at(-1);
  assert.ok(retryEvent);
  assert.notEqual(retryEvent.event.id, original.event.id);
  assert.equal(retryEvent.correlation.retry_attempt, 1);
  assert.equal(retryEvent.correlation.original_event_id, original.event.id);
  assert.equal(retryEvent.correlation.operation_id, operation.value.operationId);
  expectFailure(await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never), "SDK_DUPLICATE_SUCCESS", "/operation/state");
});
```

Run the focused compiled test after rebuilding:

```bash
npm run build --prefix packages/security-audit-sdk-core
node --test packages/security-audit-sdk-core/dist-tests/f11-delivery-intent.test.js
```

Expected before implementation: the new test fails specifically because the retry result is `SDK_DUPLICATE_SUCCESS` at `/operation/state`, not because fixture setup or compilation fails.

### Step 1.3: Implement the minimal pre-construction retry recognition

Update only `terminalSuccessAttemptEvent` in `src/sdk.ts`:

1. Extend its untrusted input shape with an optional `retry` relationship containing `retry_attempt`.
2. Resolve the retry attempt in this precedence order:
   - `input.retry.retry_attempt`;
   - `input.correlation.retry_attempt`;
   - active context correlation retry attempt;
   - authoritative context correlation retry attempt.
3. Preserve the existing positive-attempt check: only a truthy/positive attempt bypasses terminal completion reservation. A missing, zero, malformed, or non-positive retry remains an ordinary terminal attempt and must still be rejected after completion.
4. Do not build canonical events early, mutate operation state, weaken handle identity validation, or add automatic retries.

The intended seam is equivalent to:

```ts
const candidate = input as {
  readonly redelivery?: { readonly event?: unknown };
  readonly event?: { readonly lifecycle_phase?: string; readonly outcome?: string };
  readonly retry?: { readonly retry_attempt?: number };
  readonly correlation?: { readonly retry_attempt?: number };
};
const retryAttempt = candidate.retry?.retry_attempt
  ?? candidate.correlation?.retry_attempt
  ?? activeContext?.correlation?.retry_attempt
  ?? authoritativeContext.correlation?.retry_attempt;
```

Run the focused F-11 test again. Expected: the new test passes; the existing non-retry terminal duplicate assertion remains green.

### Step 1.4: Verify, freeze, review, and land the fix

Before staging, run:

```bash
npm run test:runtime --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
npm run check:generated --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate fix-terminal-named-retry --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase implementation --change fix-terminal-named-retry
```

Then reconstruct the exact candidate in a disposable clone and run the full SDK chain there:

```bash
npm run validate --prefix packages/security-audit-sdk-core
```

Also run the repository's required CodeScene CI check at the exact technical head; do not substitute a missing local token or treat AI review as approval. After successful read-only verification, do not regenerate, reformat, or re-run tests on the frozen candidate. Stage the explicit proposal/implementation allowlists in their separate lifecycle stages.

## Task 2: Generate a required named input for `reason`

**Objective:** Make the generated TypeScript input for every event whose catalog `required_context` includes `reason` require `event.outcome_reason`, matching the existing runtime semantic validation.

**Change:** `fix-generated-required-context-reason`

**Files:**
- Create: OpenSpec artifacts resolved by `openspec new change fix-generated-required-context-reason`.
- Modify: `packages/security-audit-sdk-core/tests/types/index.ts:80-128`.
- Modify: `packages/security-audit-sdk-core/scripts/generate-contract.mjs:283-305`.
- Regenerate: `packages/security-audit-sdk-core/src/generated/contract.generated.ts` via `npm run generate` only.
- Potentially modify: the generated OpenSpec delta spec for `security-audit-sdk-core` to clarify compile-time/runtime responsibility alignment.
- Do not modify: contract source, contract schemas/catalogs, `src/validation/semantic.ts`, compatibility manifest, package version, or runtime event behavior.

### Step 2.1: Create a separate proposal and define the narrow scope

1. Start branch `fix/generated-required-context-reason` from current `origin/main` after Task 1 is merged; do not stack it on an unmerged retry branch.
2. Generate the OpenSpec change through the CLI and verify its allowed roots.
3. Record the measured fact: the contract and runtime semantic switch each cover 41 required-context tokens, but the `RequiredContextProperty` generator maps only 40; `reason` falls to `{}`.
4. State that this fixes compile-time guidance only. Runtime still rejects missing `event.outcome_reason.code`, and contract semantics stay unchanged.
5. Include explicit non-goals: no new `required_context` token, no source-contract change, no weakening of runtime validation, no event API expansion.

### Step 2.2: Add a type-level RED assertion

Use the existing one-file type test suite rather than creating a second compiler configuration.

1. Identify a generated named input with a contract-required `reason` relationship (the existing `roleAssigned`/`roleRemoved` examples are candidates; verify the catalog entry before choosing).
2. Add a compile-time negative case omitting `event.outcome_reason`, with a descriptive `@ts-expect-error` directly above the invalid invocation or assignment.
3. Keep one adjacent positive input containing `event: { outcome_reason: { code: ... } }` so the test asserts the narrowest required shape.

Example target shape:

```ts
// @ts-expect-error role assignment requires the cataloged reason context
sdk.roleAssigned({ actor, subject, tenant, resource, authorization, operation });

sdk.roleAssigned({
  actor,
  subject,
  tenant,
  resource,
  authorization,
  operation,
  event: { outcome_reason: { code: "accepted" } },
});
```

Run:

```bash
npm run test:types --prefix packages/security-audit-sdk-core
```

Expected before the generator change: failure due to an unused `@ts-expect-error`, proving generated inputs currently accept the missing reason.

### Step 2.3: Add the generator mapping and regenerate

Add the missing `reason` branch to `RequiredContextProperty` in `scripts/generate-contract.mjs`. It must require the minimal event subshape needed by runtime:

```ts
C extends "reason"
  ? { readonly event: { readonly outcome_reason: NonNullable<SecurityAuditEvent["event"]["outcome_reason"]> } }
  :
```

Keep the property readonly and intersect it with the existing generated base input. Do not alter the emitted `EVENT_CATALOG` or hand-edit the generated file.

Run in order:

```bash
npm run generate --prefix packages/security-audit-sdk-core
npm run test:types --prefix packages/security-audit-sdk-core
npm run check:generated --prefix packages/security-audit-sdk-core
```

Expected after implementation: type tests pass, generated drift is clean, and the generated diff is limited to the type projection implied by the generator edit.

### Step 2.4: Run the generator/runtime proof set and govern the candidate

Run:

```bash
npm run test:runtime --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
npm run test:matrix --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate fix-generated-required-context-reason --strict
```

Use the same frozen-candidate/disposable-clone/full-validation process as Task 1. Inspect that `test:contract-immutability` remains green and that the only generated file change is `src/generated/contract.generated.ts` produced by the updated generator.

## Task 3: Extract a package-local TypeScript source-inspection primitive

**Objective:** Remove duplicate TypeScript source-file creation and recursive traversal while retaining two independently enforced policies: platform coupling and shipped import declarations.

**Change:** `extract-typescript-source-inspection`

**Files:**
- Create: OpenSpec artifacts resolved by `openspec new change extract-typescript-source-inspection`.
- Create: `packages/security-audit-sdk-core/scripts/typescript-source-inspection.mjs`.
- Modify: `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`.
- Modify: `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs`.
- Create or modify: `packages/security-audit-sdk-core/tests/verification/typescript-source-inspection.test.mjs`.
- Modify as needed: `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` and `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs`.

### Step 3.1: Propose a non-policy-bearing seam

The proposal/design must define the module as parsing and traversal infrastructure only. It must not merge the two policies, broaden accepted syntax, change a diagnostic, or make a policy depend on the other policy's artifact roles.

Specify a minimal interface similar to:

```js
function parseTypeScriptSource(path, source) {
  // Select ScriptKind from the path and create one SourceFile.
}

function walkTypeScriptAst(node, visit) {
  visit(node);
  node.forEachChild((child) => walkTypeScriptAst(child, visit));
}
```

The final interface may differ only if the direct module test proves it is smaller. The deletion test is decisive: deleting this module must force both policies to recreate parsing/traversal behavior; otherwise do not add it.

### Step 3.2: Add direct parser/traversal controls before moving code

Create a direct verifier test using source strings that cover the shared infrastructure without duplicating policy assertions:

- `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, and generated `.cjs` script-kind handling used by the existing policies;
- a nested AST control proving every node is visited exactly once in stable source order;
- syntactically invalid source produces the same caller-visible parse failure classification as before;
- comment and string literals are traversed as syntax but do not manufacture module/free-identifier findings.

Run the new test and both existing policy suites. The new test must fail before extraction because the common module does not exist; the existing policy tests must be green before any move, establishing the baseline.

### Step 3.3: Move only common mechanics

1. Implement the small module.
2. Replace each policy's local `ts.createSourceFile` and recursive `forEachChild` plumbing with the new primitive.
3. Keep platform-coupling's free-identifier, role, and allowlist decisions in `platform-coupling-policy.mjs`.
4. Keep shipped-import's module-reference extraction, artifact role classification, manifest declaration checks, and bounded diagnostics in `shipped-import-policy.mjs`.
5. Do not create an OpenSpec-to-package import, a runtime dependency, or a generic source-text regex fallback.

Run:

```bash
node --test packages/security-audit-sdk-core/tests/verification/typescript-source-inspection.test.mjs
node --test packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs
node --test packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs
npm run test:scope --prefix packages/security-audit-sdk-core
npm run test:dependencies --prefix packages/security-audit-sdk-core
```

Expected: all existing mutation arms retain their same rejection codes and precision controls; all packaged import fixtures retain their inspected/specifier counts and deterministic ordering.

### Step 3.4: Verify the refactor as a verifier-policy change

This work is not a production capability, but it changes security verification machinery. Determine from `openspec status` whether `skip_specs: true` is allowed; if so, justify it in the assessment. Run full SDK validation, the verifier mutation suite, strict OpenSpec validation, implementation-phase governance, and the exact CodeScene CI check. Treat any changed diagnostic ID, false positive, false negative, parser-error behavior, or scope/dependency-gate result as a design failure, not an acceptable refactor cost.

## Task 4: Centralize non-throwing Git probes

**Objective:** Eliminate the duplicated `quietGit` wrapper while preserving the difference between an expected negative Git predicate and a command failure that must surface to a gate.

**Change:** `extract-verification-git-probe`

**Files:**
- Create: OpenSpec artifacts resolved by `openspec new change extract-verification-git-probe`.
- Modify: `packages/security-audit-sdk-core/scripts/verification-helpers.mjs`.
- Modify: `packages/security-audit-sdk-core/scripts/check-governance-history.mjs:368-378`.
- Modify: `packages/security-audit-sdk-core/scripts/check-archive-attestations.mjs:249-258`.
- Create or modify: direct verifier tests for the helper plus `governance-history-mutations.test.mjs` and `archive-attestation-anchor.test.mjs` as needed.

### Step 4.1: Capture existing null/throw semantics in tests

Before extracting, add controls that demonstrate:

- a Git predicate such as `merge-base --is-ancestor` yields the existing negative sentinel when false;
- an absent object/path yields the existing negative sentinel where the gate expects it;
- a valid Git command still returns text;
- invalid helper invocation or an unexpected execution failure is not silently converted into a pass.

Do not make the tests assert helper implementation details such as a function name or `try/catch` location. Assert gate behavior and diagnostic outcomes.

### Step 4.2: Add the smallest helper and migrate both consumers

Add one explicitly named helper to `verification-helpers.mjs`, for example `probeGit`, whose interface makes the non-throwing predicate semantics obvious. Do not export a broad command framework, change `git()`/`runChecked()` behavior, or move policy-specific output formatting.

Replace each local `quietGit` with that helper. Preserve all callers' current `null`/missing-object branches and exact diagnostics.

### Step 4.3: Run differential mutation evidence

Run the targeted gate and mutation controls, then the full verification chain:

```bash
node --test packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs
node --test packages/security-audit-sdk-core/tests/verification/archive-attestation-anchor.test.mjs
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run test:archive-attestations --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
```

The candidate is unacceptable if a mutation previously rejected now passes, if a historical binding no longer resolves, or if an expected-negative probe becomes a silent success.

## Task 5: Assess and, only if justified, harden lifecycle-policy accessors

**Objective:** Decide whether `lifecycle-policy.mjs` can provide validated, narrow accessors for shared lifecycle metadata without changing gate-specific diagnostics or collapsing independent policy checks.

**Change:** `assess-lifecycle-policy-accessors` initially proposal-only; implementation requires a separate explicit owner authorization after the design gate below.

**Files during proposal-only phase:**
- Create: OpenSpec artifacts resolved by `openspec new change assess-lifecycle-policy-accessors`.
- Do not modify verifier implementation or `verification-lifecycle.json` in the proposal-only commit.

**Likely implementation files only after authorization:**
- `packages/security-audit-sdk-core/scripts/lifecycle-policy.mjs`.
- Consumers currently reading `lifecycleMetadata`, including `check-changed-paths.mjs`, `check-governance-history.mjs`, `check-archive-attestations.mjs`, `check-git-state.mjs`, `check-coherence.mjs`, relevant tests, and any other reader discovered by a fresh repository search.
- Existing mutation suites for each affected gate.

### Step 5.1: Build a reader-to-field-to-diagnostic matrix

In the proposal/design, inventory every `lifecycleMetadata` reader and record:

- field(s) read;
- expected shape and semantic rule;
- owning gate and its existing diagnostic IDs;
- whether the gate needs raw metadata for a deliberate history comparison;
- existing mutation test proving a malformed or stale value fails.

The proposal must distinguish common mechanical validation from gate-specific policy. A globally thrown “invalid metadata” error is not acceptable if it erases stable gate diagnostics.

### Step 5.2: Apply the acceptance decision

Proceed to an implementation authorization only if all are true:

1. The accessor interface reduces direct raw-field reads across at least two real consumers.
2. The accessors can return structured validation facts that allow each gate to retain its own diagnostic IDs and bounded messages.
3. No consumer loses a required fail-closed control, history-derived comparison, or mutation arm.
4. The change does not require changing signed lifecycle records merely to fit a convenience type.
5. The design does not import OpenSpec code into the SDK package or add runtime/package dependencies.

If any condition fails, close/archive the proposal as a documented non-change or defer it; do not force an abstraction to justify the review finding.

### Step 5.3: If authorized, implement through gate-specific RED/GREEN slices

For each accessor, first add a mutation that proves the caller still emits its current gate-specific diagnostic. Then add only the common extraction/normalization logic to `lifecycle-policy.mjs`, migrate one consumer, run that consumer's direct gate and mutation suite, and continue one gate at a time.

Final verification must include:

```bash
npm run test:changed-paths --prefix packages/security-audit-sdk-core
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run test:archive-attestations --prefix packages/security-audit-sdk-core
npm run test:coherence --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
```

This is governance-core work. Require design-pattern governance implementation/final phases, dual baseline/candidate checking, exact-commit owner review, and a record-only signing commit where the repository workflow requires it.

## Task 6: Explicitly defer the non-actionable findings

**Objective:** Prevent speculative abstractions and canonical-contract work from being smuggled into the five focused changes.

1. Do not share `openspec/scripts/design-pattern-governance/diagnostics.mjs` with package scripts. If SDK-local diagnostics later show concrete repeated formatting that cannot remain local, evaluate a package-local helper in a separate change.
2. Do not introduce a generic disposable verification-case framework. Extract only neutral infrastructure when at least two suites prove the same lifecycle; retain suite-specific attack protocols and assertions.
3. Do not introduce a universal context-field descriptor. `AuditContextFrame` has 24 fields while `FRAME_BRAND_FIELDS` has 18 because correlation, operation, request, environment, service, and deployment are intentionally unbranded. Revisit only with a concrete behavior change and a field-by-field authority model.
4. Do not centralize `validate`, `test:matrix`, `verify`, and CI into a gate registry. Their deliberately different preconditions and scopes are independent defense layers; revisit only after evidence of a real drift defect.
5. Do not encode free-text `tenant_rule` values, revise action-to-operation mappings, or change prohibited-data semantics under this program. Any structured semantic change requires a separate future contract-version decision and Contract Reuse Assessment disposition before contract source or generated projections can change.

## Files Likely to Change by Authorized Change

| Change | Repository paths |
| --- | --- |
| `fix-terminal-named-retry` | `openspec/changes/fix-terminal-named-retry/**`, `packages/security-audit-sdk-core/src/sdk.ts`, `packages/security-audit-sdk-core/tests/f11-delivery-intent.test.ts` |
| `fix-generated-required-context-reason` | `openspec/changes/fix-generated-required-context-reason/**`, `packages/security-audit-sdk-core/scripts/generate-contract.mjs`, `packages/security-audit-sdk-core/src/generated/contract.generated.ts`, `packages/security-audit-sdk-core/tests/types/index.ts` |
| `extract-typescript-source-inspection` | `openspec/changes/extract-typescript-source-inspection/**`, package-local script module, the two policy scripts, their verifier tests |
| `extract-verification-git-probe` | `openspec/changes/extract-verification-git-probe/**`, `verification-helpers.mjs`, the two affected gates, their mutation/direct tests |
| `assess-lifecycle-policy-accessors` | proposal artifacts first; implementation paths only after the design-gate authorization described above |

## Verification Matrix and Candidate Freeze

For every technical candidate, record exact command output and commit identity before staging. At minimum, use the relevant focused tests plus:

```bash
npm run check:generated --prefix packages/security-audit-sdk-core
npm run typecheck --prefix packages/security-audit-sdk-core
npm run test:runtime --prefix packages/security-audit-sdk-core
npm run test:types --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
npm run test:scope --prefix packages/security-audit-sdk-core
npm run test:dependencies --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate <change> --strict
openspec validate --all --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase implementation --change <change>
```

Run `npm run validate --prefix packages/security-audit-sdk-core` in an isolated clone/overlay of the exact candidate because it writes through build/generate steps. Include the required exact-head CodeScene CI result. Before staging, check clean index and changed paths. After the verified candidate is frozen, do not rerun generators, formatters, tests, or tidy commands.

## Risks, Tradeoffs, and Open Questions

- **Retry fix risk:** A broad “retry bypasses duplicate detection” change could weaken non-retry terminal completion protection. The F-11 regression must prove the bypass is limited to a positive explicit retry relationship and that a third ordinary terminal success remains rejected.
- **Generator fix risk:** Requiring the whole `event` object too broadly could make unrelated named inputs unusable. Type tests must prove only cataloged `reason` events require `event.outcome_reason`; positive typed calls must remain valid.
- **Parser extraction risk:** Sharing policy decisions instead of only parsing/traversal would couple scope and dependency enforcement. Preserve their independent diagnostics and mutation suites.
- **Git helper risk:** Catch-all command failures can convert damaged repository evidence into a false negative predicate. The helper must retain an explicit, tested contract for expected nonzero probes.
- **Lifecycle accessor risk:** Central validation may erase important gate-specific diagnostics or make historical binding checks less strict. The design gate is intentionally allowed to reject the implementation.
- **Governance risk:** A signed record is not approval, and review becomes stale if later normative files change. Bind decisions to exact technical commits, use identity-preserving merge, and keep archives separate.
- **Open question:** Confirm the repository's OpenSpec CLI instructions for each new change before choosing `skip_specs: true`; never infer it from the fact that a change looks internal.
- **Open question:** Decide whether each new issue should be linked to a single architecture-review umbrella issue. The current repository has no matching issue, and creating the umbrella is a project-management decision rather than a code prerequisite.

## Completion Criteria

The program is complete only when each authorized change has separately met its own OpenSpec tasks, exact-commit review/decision requirements, required CI, identity-preserving merge, and archive checks. The deferred items remain explicitly deferred unless a new contract decision or independently reproduced drift defect authorizes a new proposal.
