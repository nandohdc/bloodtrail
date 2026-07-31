import { copyFile, mkdir } from "node:fs/promises";
const source = new URL("../src/generated/schema-validator.generated.cjs", import.meta.url);
const targetDir = new URL("../dist/generated/", import.meta.url);
await mkdir(targetDir, { recursive: true });
await copyFile(source, new URL("schema-validator.generated.cjs", targetDir));
