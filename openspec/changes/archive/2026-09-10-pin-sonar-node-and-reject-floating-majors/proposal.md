## Why

`openspec/specs/ci-topology/spec.md` already ratifies the rule this change enforces: *"CI workflows
SHALL pin exact declared Node versions rather than floating major tags, preventing unverified
upstream runtime drift"*, with the scenario *"they request exact pinned versions (`26.5.0` and
`24.2.0`) matching `compatibility.json` rather than floating major tags"*.

The `sonar` job violates it. It pins `node-version: "22"`, a floating major that `setup-node`
resolves at run time, and it has drifted to `22.23.2` with no commit. The analyser now reports the
drift itself: *"Using Node.js version 22.23.2 to execute analysis is not recommended. Please upgrade
to a newer LTS version of Node.js: 24.0."* Because `sonar` is one of the ten required merge
contexts, the day SonarJS turns that recommendation into a requirement it reds every pull request in
the repository at once, with no code change to correlate against.

The same pin has a second effect. The job installs the SDK's dependencies for type-aware analysis,
and that package declares `engines: >=24 <25 || >=26 <27`, so `npm ci` emits `EBADENGINE` and the
analysis runs against a dependency tree installed under an engine the package explicitly excludes.
There is no `.npmrc`, so `engine-strict` is off and this warns rather than fails. The `coverage`
job's own comment already records the split — *"Runs on Node 26 because packages pin engines above
the Node 22 the sonar job uses"* — without resolving it.

The gate that should have caught the drift under-enforces the requirement it implements.
`check-coherence.mjs` has a floating-tag rule, but it names `26` and only `26`: it came from #305,
whose scope was the two versions that change audited. No rule reaches the `sonar` job, and a
floating major is precisely how a pin moves without a commit.

## What Changes

- Pin the `sonar` job to `24.2.0`, an already-declared CI Node release that `compatibility.json`
  lists in `node.ciVersions` and that `ci-node-24-executed` already asserts is present, and which is
  at or above the analyser's recommended `24.0`. This clears the analyser warning and the
  `EBADENGINE` warning together, and brings the job into conformance with the ratified requirement.
- Generalise the floating-tag coherence rule to reject **any** `node-version: "<major>"` anywhere in
  the workflow, renaming its diagnostic to match what it enforces. The six existing exact pins are
  unaffected: the pattern requires the closing quote to follow the digits, so a dotted release
  cannot match.
- Extend the Node-compatibility mutation controls to prove the widened rule, including an arm that
  plants a floating `"22"` — the drift shape the previous rule never named — so the widening is
  demonstrated rather than asserted.

This is a conformance correction to a requirement that already exists. No ratified behaviour is
added, removed, or reinterpreted, no workspace's declared Node support changes, and
`compatibility.json` is untouched: the `sonar` job moves onto a release the policy already declares.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `ci-topology` already states the requirement in force here, and this change makes the workflow
and its gate conform to it rather than altering it. Authoring a delta would restate a `SHALL` this
change does not modify and leave two copies of it to drift apart, so the change declares
`skip_specs: true`.

## Impact

- `.github/workflows/ci.yml` — `governance_core`; the `sonar` job's `node-version` only.
- `packages/security-audit-sdk-core/scripts/check-coherence.mjs` — the floating-tag rule.
- `packages/security-audit-sdk-core/tests/verification/node-compatibility-mutations.test.mjs` — the
  controls proving it.

No package, dependency, API, or contract artifact changes. The quality gate continues to report on
the same project key; the analysis moves to a supported runtime.
