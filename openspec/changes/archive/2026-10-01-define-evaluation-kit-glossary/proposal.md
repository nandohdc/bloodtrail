## Why

Evaluation kit v2 (#649, `deliver-sdk-evaluation-kit-v2`) brought a vocabulary into the Node binding's
documents and gate. It includes the evaluation kit, the evaluator, the evaluation facilitator, the
facilitator answer key, the example receiver and the evaluated path. None of these terms is defined in a
glossary. The binding's `CONTEXT.md` defines the delivery terms. It does not separate the HTTP audit sink,
which the SDK calls, from the delivery handoff, which only a caller's own code calls. Evaluator-facing
documents use both.

The kit v2 design lists the glossary among its Non-Goals and does not own the file, so the glossary needs a
change of its own.

## What Changes

- Add an evaluation section to `packages/security-audit-sdk-node/CONTEXT.md`. It defines evaluation kit,
  kit identity, evaluator, evaluation facilitator, facilitator answer key, seeded invalid call, example
  receiver, demonstrated event and evaluated path.
- Add a section that defines the HTTP audit sink and the delivery handoff, and the difference between them.
- Update the Node binding's line in `CONTEXT-MAP.md`, so that it names the new vocabulary.

## Capabilities

### New Capabilities

None. The change records vocabulary, so it opts out of spec deltas.

### Modified Capabilities

None. No requirement, public API, behaviour, document the kit ships or gate changes.

## Impact

- `packages/security-audit-sdk-node/CONTEXT.md` and `CONTEXT-MAP.md`. Neither is in the evaluation kit, and
  no gate reads either.
- No package source, test, script, kit document or OpenSpec spec changes.
