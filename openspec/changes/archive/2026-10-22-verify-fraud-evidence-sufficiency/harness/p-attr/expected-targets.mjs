import { AF_CARRIERS, prepareAf } from "./af-inputs.mjs";
import { AF_CONTROLS } from "./af-controls.mjs";
import { AS_BUILDERS, prepareAs } from "./as-inputs.mjs";
import { prepareRequest, REQUEST_BUILDERS } from "./request-inputs.mjs";
import { atPath, targetFacts } from "./comparison.mjs";
import { memoryKeying } from "./keying.mjs";

const PREPARERS = new Map([["AF", prepareAf], ["AS", prepareAs], ["PR", prepareRequest], ["RA", prepareRequest]]);
const BUILDERS = new Map([["AF", new Map([...AF_CARRIERS, ...AF_CONTROLS])], ["AS", AS_BUILDERS],
  ["PR", REQUEST_BUILDERS], ["RA", REQUEST_BUILDERS]]);
const PURPOSES = new Map([["AF", "authentication_failed"], ["AS", "authentication_succeeded"],
  ["PR", "password_reset_requested"], ["RA", "account_registration_attempted"]]);

// Preparation-only public-shape double: no SDK, sink, named call or hook runs.
// Constructors preserve carrier leaves; the human constructor renames displayName.
function constructor(name, value) {
  if (name !== "authenticatedHumanActor") return structuredClone(value);
  const { displayName, ...actor } = value;
  return displayName === undefined ? actor : { ...actor, display_name: displayName };
}

function frozenTarget({ target, keyedInputs }) {
  const spec = keyedInputs[target.path];
  if (spec === undefined) return target;
  return { path: target.path, kind: target.kind, keyed: {
    key_scope: spec.key_scope, input_origin: spec.input_origin,
    digest_format: spec.digest_format, matches_declared_input: true,
  } };
}

export function expectedTargets({ entry, variant }) {
  const family = entry.case_id.split("-")[0];
  const context = { entry, variant, state: { c: constructor }, keying: memoryKeying(),
    plan: { family, purpose: PURPOSES.get(family) } };
  PREPARERS.get(family)(context);
  BUILDERS.get(family).get(entry.scenario)(context);
  const { input, contents, keyedInputs } = context.prepared;
  // Event assembly echoes request.id to correlation.request_id; other target
  // paths are already present in the prepared input. Do not emulate validation.
  const event = { ...input, correlation: { ...input.correlation, request_id: atPath(input, "request.id") } };
  return targetFacts({ event, contents }).map((target) => frozenTarget({ target, keyedInputs }));
}
