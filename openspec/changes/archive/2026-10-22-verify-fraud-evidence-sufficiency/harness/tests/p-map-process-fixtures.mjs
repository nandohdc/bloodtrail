import { runtimeFixture, ACCEPTED, REFUSED } from "./p-map-runtime-fixtures.mjs";
import { lmFixture } from "./p-map-lm-fixtures.mjs";
import { cxFixture } from "./p-map-cx-fixtures.mjs";
import { kuFixture } from "./p-map-ku-fixtures.mjs";
import { rotationFixture } from "./p-map-r-fixtures.mjs";
import { P_MAP_BUDGET } from "../p-map/budget.mjs";

const FAMILY = { L: "lm", M: "lm", C: "cx", X: "cx", K: "ku", U: "ku", R: "r" };
const BASELINE_OWNERS = { "B-LOGOUT": "L1", "B-MFA": "M1" };
const FAULTS = {
  throw: () => { throw new Error("fixture named-method fault"); },
  refuse: () => REFUSED,
  "no-capture": () => ACCEPTED,
};

function select(fixtures, owner) {
  if (Object.hasOwn(BASELINE_OWNERS, owner)) return fixtures.baseline;
  return fixtures[FAMILY[owner[0]]];
}

function factory(context, config) {
  const owner = context.state.current;
  if (context.abort === owner) throw new Error(`fixture factory abort ${owner}`);
  const sdk = select(context.fixtures, owner).state.node.createNodeSecurityAuditSdk(config);
  if (context.extra === owner) context.state.c("authoritativeTenant", { scope: "tenantless" });
  if (context.fault?.case_id !== owner) return sdk;
  return { ...sdk, [context.fault.method]: FAULTS[context.fault.kind] };
}

// Compose independently scripted family doubles, not SDK validation. Exactly
// one counted outer runtime/ledger owns all calls and the live K2a/U2 SDK.
// Private fixture ledgers never run; only their injected public-shape modules
// are delegated to. Baseline scripts have fresh offsets, never L1/M1 offsets.
export function processFixture({ budget = P_MAP_BUDGET.total, abort, fault, extra } = {}) {
  const fixtures = { baseline: lmFixture(), lm: lmFixture(), cx: cxFixture(), ku: kuFixture(), r: rotationFixture() };
  const context = { fixtures, abort, fault, extra };
  const constructors = new Set(Object.values(fixtures).flatMap(({ state }) => Object.keys(state.core)));
  const core = Object.fromEntries([...constructors].filter((name) => name !== "CONTRACT_VERSION")
    .map((name) => [name, (...args) => select(fixtures, context.state.current).state.core[name](...args)]));
  const fixture = runtimeFixture({ budget, core, factory: (config) => factory(context, config) });
  context.state = fixture.state;
  for (const [name, entry] of Object.entries(fixtures)) Object.defineProperty(entry.state, "current", {
    get: () => name === "baseline" ? BASELINE_OWNERS[context.state.current] : context.state.current,
  });
  return fixture;
}
