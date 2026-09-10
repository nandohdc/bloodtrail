## Context

Seven `node-version` pins exist in `.github/workflows/ci.yml`. Six are exact — `26.5.0` five times
and `24.2.0` once — and one, the `sonar` job's `"22"`, is a floating major. `compatibility.json`
declares `node.ciVersions` as `["24.2.0", "26.5.0"]`, and `check-coherence.mjs` already asserts both
literals are present in the workflow.

The floating-tag rule that exists today is written against a literal:

```js
rule("ci-node-no-floating-26", ".github/workflows/ci.yml",
  !/node-version:\s*["']26["']/.test(ciWorkflow), "CI workflow uses floating Node 26 tag");
```

It enforces the ratified requirement for exactly one major and is silent about every other, which is
how the `sonar` job's pin drifted unobserved.

## Goals / Non-Goals

**Goals:**

- Bring the `sonar` job into conformance with the ratified `ci-topology` requirement.
- Close the gap that let the violation persist, so the next carried-over pin fails the gate rather
  than drifting.
- Prove the widened rule with a control that fails when the drift shape is planted.

**Non-Goals:**

- Changing any workspace's declared Node support, `compatibility.json`, or the `nodeCiVersions`
  policy. The `sonar` job moves onto a release already declared.
- Resolving the unrelated coverage-path warning seen in the same log
  (`Could not resolve 2 file paths in [...lcov.info]`, first unresolved
  `packages/security-audit-sdk-core/dist/generated/schema-validator.generated.cjs`). Different root
  cause — the report carries `dist/` entries that `sonar.exclusions` excludes — and it belongs in
  its own issue.
- Adding `.npmrc` or `engine-strict`. Pinning the job removes the `EBADENGINE` condition at its
  source; turning warnings into hard failures repository-wide is a separate decision with its own
  blast radius.

## Decisions

### D1 — Pin to `24.2.0` rather than `26.5.0`

`24.2.0` is at or above the analyser's stated recommended minimum of `24.0`, satisfies the SDK's
`>=24 <25 || >=26 <27` engines range, and is already declared in `node.ciVersions` and already
asserted present by `ci-node-24-executed`.

`26.5.0` would also satisfy both, and is the version five other jobs use. It is rejected because it
would leave `24.2.0` asserted by exactly one job: the SDK matrix leg. Keeping a second consumer of
the Node 24 pin means the declared-but-unused case cannot quietly appear, and it keeps the analyser
running on the lower of the two supported majors, which is the stricter of the two for type-aware
analysis.

### D2 — Widen the rule to any bare major, rather than naming `22` as well

Adding `22` to the rule would repeat the original defect: the rule would then name two majors and
stay silent about the rest. The whole failure mode is *a pin nobody enumerated*.

```js
!/node-version:\s*["']\d+["']/.test(ciWorkflow)
```

The closing quote must follow the digits directly, so `"26.5.0"` and `"24.2.0"` cannot match. The
rule is renamed to `ci-node-no-floating-major` because a diagnostic that says `26` while rejecting
any major would misdirect whoever hits it.

A stricter alternative — require every `node-version` to match `\d+\.\d+\.\d+` — was rejected: it
would fail closed on any legitimate future form (a `.nvmrc` reference, a matrix expression) and
turns a narrow anti-drift rule into a formatting mandate the ratified requirement does not make.

### D3 — Extend the existing control file rather than adding one

`tests/verification/node-compatibility-mutations.test.mjs` is 101 lines, already snapshots
`ci.yml` into a disposable clone, and already plants a floating `"26"`. It is not a CodeScene
hotspot, so the reasoning that forces new controls into their own file — which applies to
`mutations.test.mjs` — does not apply here. Adding an arm beside the existing one keeps the two
floating-tag cases readable side by side.

The new arm plants `"22"` specifically. Retargeting only the existing `"26"` arm would leave the
widening unproven: `"26"` was already rejected by the old rule, so that arm passes either way and
would be vacuous as evidence for this change.

## Risks / Trade-offs

- **The analyser's recommended minimum will rise again.** Pinning to `24.2.0` buys conformance now,
  not permanently. The widened rule does not detect "pinned but below the analyser's minimum" — no
  gate can, since the minimum lives in the analyser's release notes. The mitigation is that the
  warning is visible in the job log and this change documents where to look, not that it is
  mechanically enforced. Claiming otherwise would overstate what the gate does.
- **Moving the analyser's runtime could change findings.** Type-aware analysis on a different Node
  major can surface or drop rules. The quality gate reports on the same project key either way, and
  a changed finding set would appear as a normal `sonar` result on this change's own PR — which is
  the right place for it to be seen rather than hidden.
- **The rule now fails closed on a shape that may one day be legitimate.** If a future job wants a
  floating tag deliberately, the gate blocks it. That is the intended posture, and the ratified
  requirement says so; the escape is a governed change to the requirement, not a quiet exception.
