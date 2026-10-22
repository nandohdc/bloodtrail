import { familyWorkload } from "./family-workload.mjs";
import { BRAND_CASES, CONTACT_CASES } from "./contact-cases.mjs";
import { contactConfigurationInput, contactInput, factorInput } from "./contact-inputs.mjs";
import { contactFacts, replacementFacts } from "./contact-facts.mjs";
import { instance, requireDependency } from "./runtime.mjs";
import { beginOperation, emitOccurrence, markOperation } from "./workload-steps.mjs";

async function committedTarget(state, id) {
  const target = instance(state);
  const handle = await beginOperation(state, { target, id: `${id}-begin` });
  await markOperation(state, { target, handle, id: `${id}-mark`, method: "markCommitted" });
  return { target, handle };
}

async function modification(state, { id, options, build = contactInput, method = "sensitiveResourceModified", refusalExpected = false }) {
  const { target, handle } = await committedTarget(state, id);
  const input = { ...build(state, options), operation: handle };
  const record = await emitOccurrence(state, { target, handle, input, id, method, refusalExpected });
  contactFacts(record, input);
}

const CONTACT_VARIANTS = [
  { id: "email", options: { categories: ["contact_email"] } },
  { id: "phone", options: { categories: ["contact_phone"] } },
];
const CATEGORY_VARIANTS = [
  { id: "unregistered", options: { categories: ["zz-unregistered-0001"] } },
  { id: "object", options: { categories: [{}] } },
  { id: "object-kind", options: { categories: [{ kind: "contact_email" }] } },
  { id: "ascii-4000", options: { categories: ["a".repeat(4000)] } },
  { id: "bytes-8193", options: { categories: ["a".repeat(8193)] }, refusalExpected: true },
];

async function modifications(state, variant, plans) {
  for (const plan of plans) await variant(plan.id, () => modification(state, plan));
}

async function factorReplacement(state, variant) {
  let shared;
  let removed;
  await variant("removed", async () => {
    shared = await committedTarget(state, "factor");
    const input = { ...factorInput(state, { id: "pmap-mfa-fac-0001", operation_type: "delete" }), operation: shared.handle };
    removed = await emitOccurrence(state, { ...shared, input, id: "removed", method: "mfaRemoved" });
  });
  await variant("enrolled", async () => {
    requireDependency(shared, "C5 removed shared operation");
    requireDependency(shared.handle, "C5 removed handle");
    const input = { ...factorInput(state, { id: "pmap-mfa-fac-0002", operation_type: "create" }), operation: shared.handle };
    const enrolled = await emitOccurrence(state, { ...shared, input, id: "enrolled", method: "mfaEnrolled" });
    enrolled.replacement = replacementFacts(removed, enrolled);
  });
}

const CONTACT_RUNNERS = {
  C1: (state, variant) => modifications(state, variant, CONTACT_VARIANTS),
  C2a: (state, variant) => modifications(state, variant, CATEGORY_VARIANTS),
  C2b: (state) => modification(state, { id: "items-17", refusalExpected: true,
    options: { categories: Array.from({ length: 17 }, (_, index) => `cat-${String(index + 1).padStart(2, "0")}`) } }),
  C3: (state) => modification(state, { id: "after-value", options: { categories: ["contact_email", "after-val-0001"] } }),
  C4: (state) => modification(state, { id: "configuration", build: contactConfigurationInput, method: "securityConfigurationChanged" }),
  C5: factorReplacement,
  C6: (state) => modification(state, { id: "tenantless", options: { tenantless: true }, refusalExpected: true }),
};
const BRAND_RUNNERS = {
  X1: (state) => modification(state, { id: "spread", options: { spreadResource: true }, refusalExpected: true }),
};

export async function contactWorkload(state, cases = CONTACT_CASES) {
  await familyWorkload(state, { cases, runners: CONTACT_RUNNERS });
}

export async function brandWorkload(state, cases = BRAND_CASES) {
  await familyWorkload(state, { cases, runners: BRAND_RUNNERS });
}
