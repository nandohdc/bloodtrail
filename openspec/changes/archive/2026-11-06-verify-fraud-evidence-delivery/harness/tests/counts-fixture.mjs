import { rehearsal } from "./counts-rehearsal.mjs";

let produced;
export async function producerFixture() {
  if (!produced) produced = rehearsal();
  return structuredClone(await produced);
}
