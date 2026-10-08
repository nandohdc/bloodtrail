## Why

An evaluator who unpacks the evaluation kit and reads the quickstart from the top cannot yet reach a first accepted event without guessing. The owner's dogfood run of 2026-10-07, recorded in #756, found four gaps:

- The quickstart does not tell the evaluator to start the example receiver before the first emit; receiver instructions appear only in the last section, after the code.
- It does not explain how to run a code block: save it as a TypeScript file in the kit directory, then run it with Node.
- The authentication-success block prints nothing on success, so the receiver is the only indication that it worked.
- The shipped first-event example is not named in a kit document. It uses an in-memory sink and cannot produce the accepted-over-HTTP event that the M1 path measures.

## What Changes

- Add an ordered, receiver-first path near the top of the quickstart: install, start the receiver, save and run the authentication-success block, then observe both acceptance lines.
- State how to run each complete TypeScript block from the kit directory, add the authentication-success line, and name the shipped first-event example as an offline check that needs no receiver.
- Point the existing bottom receiver section back to the new path when its receiver is already running.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a bounded evaluator-document correction: it changes no capability requirement, public API, kit gate, or runtime behavior. The change therefore opts out of spec deltas.

## Impact

- `packages/security-audit-sdk-node/docs/quickstart.md` is the only file outside this change directory.
- The existing kit gate continues to run every quickstart TypeScript block. No gate check or reviewed exception is added.
- The receiver and first-event example remain unchanged; the quickstart distinguishes their accepted-event and offline-check roles.
