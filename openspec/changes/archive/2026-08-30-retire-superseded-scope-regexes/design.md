## Context

See `proposal.md` for the motivation. `check-scope.mjs` currently walks the complete SDK source tree, narrows one local `files` list to `.ts` artifacts, skips generated paths, and applies raw source-content patterns plus a text import scan before calling the AST-based platform-coupling inspector on the complete tree. The AST inspector already classifies authored and generated artifacts, reports undeclared globals and static or dynamic specifiers with stable diagnostics, and fails closed on unreadable artifacts.

The current canonical SDK requirement specifies forbidden production-integration filenames and differential mutation evidence; it does not specify raw token matching. This change is therefore configured with `skip_specs: true` and must not change policy terms, approved Node imports, manifest rules, or public SDK behavior.

## Goals / Non-Goals

**Goals:**

- Retire only the redundant raw source-content and text-specifier stages while preserving the retained filename, manifest, export, and AST platform-coupling checks.
- Make the retained filename guard inspect every artifact returned by the source-tree walk, including generated and non-`.ts` artifacts.
- Demonstrate the replacement's behavior with deterministic positive, negative, null, and filename-widening controls.
- Keep the #169 dead `command()` helper removal as a separately identified rider in the implementation commit that already modifies its sole host file.

**Non-Goals:**

- Do not change the platform-coupling policy, allowed globals, approved specifiers, forbidden filename vocabulary, package manifest rules, canonical contract, generated artifacts, or public SDK API.
- Do not add runtime dependencies, network transport, exporter, collector, storage, telemetry, browser, production integration, or any production authorization surface.
- Do not attempt to detect host-object member access; that residual remains an explicit limitation of the AST policy.

## Decisions

### Use the complete source-tree inventory for the retained filename check

`check-scope.mjs` will retain `sourceTree.files` rather than a `.ts`-filtered derivative for its filename loop. The existing AST stage already receives the same complete tree. This removes the filter and generated-path skip that served only the deleted raw-content stage, and causes a generated `transport.generated.cjs` filename to fail through the retained filename diagnostic.

**Alternative considered: retain the `.ts` filter or the generated-path skip.** That would leave a filename enforcement blind spot with no semantic purpose after source-text scanning is removed.

### Remove the raw matchers rather than tune them

The five `forbiddenSource` patterns cannot distinguish executable references from comments, string literals, lexical bindings, or TypeScript syntax, and the text import matcher omits dynamic import forms. The AST platform-coupling inspector is the replacement authority because it resolves the relevant language structures and emits stable `platform-coupling` diagnostic classes.

**Alternative considered: refine or add source regexes.** More patterns would preserve the same unsound model, maintain a second rejection authority, and still fail to classify syntax semantically.

### Prove retirement by differential mutation controls

`platform-coupling-mutations.test.mjs` will own one positive arm for each retired rejection class: `fetch`, `node:fs/promises`, `redis`, `window`, `console`, and dynamic `node:child_process`; plus a generated filename arm. It will also own comment and string-literal negative controls and an unmutated null control. Each positive arm must assert the AST or filename diagnostic class, artifact, and detail, not merely a failing exit status.

The existing `mutations.test.mjs` `fetch()` arm will be renamed to state the surviving filename and platform-coupling controls, and will assert the `platform-coupling` diagnostic prefix. This prevents a green regression from crediting the deleted matcher.

**Alternative considered: rely on the existing scope mutations alone.** Their current substring assertion allows the `fetch()` arm to pass for a changed reason and does not independently cover every retired pattern or the widened filename boundary.

### Keep the #169 rider minimal and traceable

The unused `command()` declaration in `mutations.test.mjs` will be removed only because this change already edits that exact governed file. The PR description will identify it as a #169 folded cleanup rather than adding it to #201's acceptance criteria.

**Alternative considered: a standalone #169 cleanup change.** The retirement plan explicitly rejects a separate governed cycle for this non-behavioral deletion.

## Risks / Trade-offs

- [The source-tree filename scan observes additional artifacts] → A generated `.cjs` forbidden-filename mutation proves the intentional widening; the unmutated null control proves ordinary package contents still pass.
- [A retired pattern is not fully covered by the AST stage] → Every mutation must fail under the current AST stage before the legacy code is deleted; any uncovered pattern stays out of the retirement.
- [The pass-line file count changes from 17 to the complete tree count] → The baseline consumer sweep establishes that no exact count is asserted; retain only the stable `scope passed:` and coupling-inventory assertions.
- [CodeScene cannot run locally without a token] → Do not interpret that environment failure as a pass; require the exact PR's mandatory CodeScene CI result before merge.
- [The hotspot test file fails an analyzer for a small deletion] → Keep the #169 rider to the one dead declaration and use the required CI diagnostic if the CodeScene gate fails.

## Migration Plan

1. Establish the baseline scope output and AST diagnostic behavior in disposable package copies.
2. Add regression controls and observe the required RED outcomes against the current checker.
3. Delete the redundant scan path, rerun the differential controls, then run the package, contract, OpenSpec, and governance verification matrix from an isolated candidate.
4. Commit the proposal and implementation separately, preserve the verified implementation candidate for exact-commit review, and require all mandatory PR checks before any owner merge.
5. Reverting the bounded implementation commit restores the previous redundant source-text scan; no data or API migration is involved.
