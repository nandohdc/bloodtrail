## Why

The Node binding's evaluation-kit gate currently makes several claims that a run cannot prove, and its
controls do not always isolate the check they name. The kit identity does not bind all of the material that
identifies a distributable kit. The example receiver can continue consuming a request after deciding to
reject it. Document checks leave fence, reference, planned-feature, answer-key, and synthetic-value gaps.
A response-body read failure in the governed fetch delivery adapter is not classified so the existing delivery
retry can retry it.

Those gaps concern the non-production evaluation path, but they affect whether its evidence fails closed.
This is therefore security-sensitive proposal content. It defines a bounded candidate change; it neither
authorizes nor implements a fix.

## Governance Metadata

```yaml
security_sensitive: true
capabilities: [security-audit-sdk-node]
modified_requirements: 5
```

## What Changes

- Make the kit gate identify only checks that ran, make planted-defect controls isolate and measure their
  named check, and run the kit controls through the Node binding's `test` script on every supported Node
  version.
- Require format 3 kit identity: the identity file joins the checksum list, `kit-digest.sha256` records the
  SHA-256 of `checksums.sha256` in `shasum -c` format outside that list, and the gate rejects format 2 by
  name. Artifact-entry order retains npm's measured-stable order.
- Make the gate inspect the 13 kit documents, including copied READMEs, and every text entry in the
  artifacts for answer-key material. It will check fenced-language and runnable-block rules, API references,
  planned-feature wording, and synthetic values.
- State that demonstrated bytes are the bytes the SDK handed to the HTTP audit sink. A named emit returns
  only `{status}`.
- Make the example receiver bound its reading before every answer: it reads a body within the bound before
  answering, and after the bound it answers, closes, and reads nothing more. This includes authentication,
  size, and wrong-path outcomes, with 404 for a POST to another path and 405 plus `Allow: POST` for every
  other method.
- Classify every non-deadline response-body read error in the fetch delivery adapter as
  `transport_failure`, so the existing delivery retry retries it, while retaining the deadline and malformed
  acknowledgment cases.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`:
  - MODIFIED *The evaluation kit installs and runs outside any workspace and its gate fails closed*;
  - MODIFIED *The evaluation kit has a reproducible identity and authorizes no release*;
  - MODIFIED *Evaluator documentation states the alpha's boundaries and is checked*;
  - MODIFIED *The example receiver models a careful ingress*;
  - MODIFIED *The governed fetch delivery adapter maps native outcomes onto the handoff's closed outcome
    set*.

These are exactly five modified existing requirements. The candidate declares only the
`security-audit-sdk-node` capability.

## Impact

- The future implementation changes only the Node binding's kit builder, gate, controls, document checks,
  example receiver, documented kit material, package test script, and governed fetch adapter with their
  focused verification.
- The future fold updates the existing Node binding specification; the archive follows the fold.
- No contract, Core source, collector source, CI workflow, governance-core document, release, publication,
  production integration, storage, or deployment is in scope.
- `design.md` assigns each issue from #702 through #719 one bounded path, check, and control plan and records
  the amendment boundary for that future work.
