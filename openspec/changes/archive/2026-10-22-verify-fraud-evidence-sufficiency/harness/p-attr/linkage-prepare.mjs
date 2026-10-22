import { authenticationFailedInput, passwordResetInput, registrationInput } from "./baselines.mjs";
import { AF_CARRIERS } from "./af-inputs.mjs";
import { AF_CONTROLS } from "./af-controls.mjs";
import { AS_BUILDERS, prepareAs } from "./as-inputs.mjs";
import { REQUEST_BUILDERS } from "./request-inputs.mjs";
import { TARGETS } from "./linkage-cases.mjs";

const BUILDERS = new Map([["AF", new Map([...AF_CARRIERS, ...AF_CONTROLS])], ["AS", AS_BUILDERS], ["PR", REQUEST_BUILDERS], ["RA", REQUEST_BUILDERS]]);
const PLAIN_BUILDERS = [["AF", authenticationFailedInput], ["PR", passwordResetInput], ["RA", registrationInput]];
const PURPOSES = new Map([["AF", "authentication_failed"], ["AS", "authentication_succeeded"],
  ["PR", "password_reset_requested"], ["RA", "account_registration_attempted"]]);
// Copy only plain input containers; branded public contexts are immutable and
// MUST retain their identity (context.ts:387-392 at the pinned base).
function copyPrepared(prepared) {
  const input = { ...prepared.input };
  for (const field of ["event", "request", "correlation"]) {
    if (input[field] !== undefined) input[field] = structuredClone(input[field]);
  }
  return { input, origins: { ...prepared.origins }, contents: { ...prepared.contents }, keyedInputs: { ...prepared.keyedInputs } };
}
export function linkageBases({ state, keying }) {
  const bases = new Map();
  state.current = "linkage-setup";
  for (const [family, build] of PLAIN_BUILDERS) bases.set(family, { ...build(state), contents: {} });
  for (const target of TARGETS.filter((item) => item.target === "ex")) {
    const context = { state, keying, variant: { account_suffix: target.suffix } };
    prepareAs(context);
    bases.set(`AS-${target.suffix}`, context.prepared);
  }
  return bases;
}
export function linkageInput({ state, keying, bases, dataset, target }) {
  const variant = dataset.variants.find((item) => item.target === target.target);
  const base = dataset.family === "AS" ? `AS-${target.suffix}` : dataset.family;
  const context = { state, keying, entry: dataset.entry, variant, pid: target.pid,
    account: `acct-${target.suffix}`, plan: { family: dataset.family, purpose: PURPOSES.get(dataset.family) }, prepared: copyPrepared(bases.get(base)) };
  BUILDERS.get(dataset.family).get(dataset.entry.scenario)(context);
  return context.prepared;
}
