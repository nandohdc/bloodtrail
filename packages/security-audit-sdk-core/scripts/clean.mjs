import { rm } from "node:fs/promises";
for (const path of [new URL("../dist", import.meta.url), new URL("../dist-tests", import.meta.url)]) {
  await rm(path, { recursive: true, force: true });
}
