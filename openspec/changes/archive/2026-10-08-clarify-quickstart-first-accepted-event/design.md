## Context

The evaluation kit already contains an example receiver, an authentication-success quickstart block, and an offline `first-event.ts` example. Their ordering in the quickstart leaves the M1 path implicit: a reader sees the emit before the receiver instructions, is not told where or how to run a block, receives no local success line, and cannot tell what the shipped first-event example is for.

## Goals / Non-Goals

**Goals:**

- Give an evaluator one ordered receiver-first route to a first accepted event.
- Make the authentication-success outcome visible in both terminals while preserving its documented result value as only `{status}`.
- Describe the shipped first-event example as an offline package-and-emit check.

**Non-Goals:**

- Changing the example receiver, first-event example, kit gate, exports, API, or any capability requirement.
- Adding a receiver requirement to the kit gate's receiverless quickstart-block execution.
- Replacing the existing bottom receiver walkthrough.

## Decisions

### Put the complete ordered path before package responsibilities

A new section follows installation and precedes package responsibilities. It tells the evaluator to work from the kit directory, save each complete TypeScript block there, and run it with Node. Its ordered path starts the receiver before the authentication-success block, then identifies the program and receiver acceptance lines. This resolves the receiver-order and save-and-run gaps at the point a top-to-bottom reader needs them.

### Make successful authentication visible without changing its value

The existing successful branch retains its assertion that the named emit returns `{status}` and logs `quickstart:accepted` from that status. The receiver remains the independent observation of the accepted event. The failure branch stays useful to the gate's receiverless execution because it reports the failed emit and exits successfully.

### Keep first-event offline and identify it separately

The new section names `examples/first-event.ts` as an in-memory offline check. It confirms that installed packages load and emit before the evaluator starts the receiver, but it is not represented as the accepted-over-HTTP path. The existing bottom receiver section adds only a note for a receiver already running from the new path.

## Rejected

- **Make `examples/first-event.ts` deliver over HTTP.** This fails the offline-check force: the ratified kit gate runs that example without a receiver, so delivery would break its receiverless execution and erase the distinct offline check.
- **Add a kit-gate check for the path.** This fails the bounded-correction force: #756 explicitly rules out a new gate check, while the existing gate already runs every quickstart TypeScript block.
- **Move the existing bottom receiver section to the top unchanged.** This fails the ordered-path and visible-success forces because it neither explains saving and running a block nor exposes the program success line or the offline-check distinction.

## Risks / Trade-offs

The receiver-first instructions describe a second terminal and a fixed local port, which adds prose but removes the setup inference that blocked the dogfood walk. The quickstart retains both a receiver-backed accepted-event path and a receiverless offline path so the gate's execution model remains unchanged.

## Migration Plan

Merge the documentation correction. Evaluators following the revised page start the existing receiver before the existing authentication-success block. No migration, package change, or capability transition is needed.
