#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  changesRoot,
  discoverManagedChanges,
  generateAssessment,
  scaffoldSource,
  stableJson
} from "./design-pattern-governance/assessment-generation.mjs";

function parseCliArgs(args) {
  const options = { changeName: null, isCheck: false, isScaffold: false, showHelp: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--change") options.changeName = args[++i];
    else if (arg === "--check") options.isCheck = true;
    else if (arg === "--scaffold" || arg === "--init") options.isScaffold = true;
    else if (arg === "--help" || arg === "-h") options.showHelp = true;
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node openspec/scripts/generate-assessment.mjs [options]
Options:
  --change <name>  Operate on a specific change under openspec/changes/<name>
  --scaffold       Generate an authored assessment.source.json template
  --check          Verify that assessment.json matches generator output byte-for-byte
  --help           Show this message`);
}

function handleScaffold(changeName) {
  if (!changeName || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(changeName)) {
    console.error("Error: --scaffold requires a valid --change <name>");
    return 1;
  }
  const safeName = basename(changeName);
  const changeDir = resolve(changesRoot, safeName);
  const created = scaffoldSource(changeDir);
  console.log(`Scaffolded ${created}`);
  return 0;
}

function verifyAssessment(changeId, expectedContent) {
  const assessmentFile = resolve(changesRoot, basename(changeId), "assessment.json");
  try {
    const existingContent = readFileSync(assessmentFile, "utf8");
    assert.equal(existingContent, expectedContent);
    return 0;
  } catch (err) {
    const msg = err.code === "ENOENT"
      ? `Error: ${assessmentFile} does not exist. Run node openspec/scripts/generate-assessment.mjs --change ${changeId}`
      : `${assessmentFile} has diverged from assessment.source.json; run node openspec/scripts/generate-assessment.mjs --change ${changeId}`;
    console.error(msg);
    return 1;
  }
}

function writeAssessment(changeDir, expectedContent) {
  const changeId = basename(changeDir);
  const assessmentFile = resolve(changesRoot, changeId, "assessment.json");
  writeFileSync(assessmentFile, expectedContent, "utf8");
  console.log(`Generated ${assessmentFile}`);
  return 0;
}

function processChange(changeDir, isCheck) {
  const changeId = basename(changeDir);
  const generated = generateAssessment(changeDir);
  const expectedContent = stableJson(generated);
  return isCheck
    ? verifyAssessment(changeId, expectedContent)
    : writeAssessment(changeDir, expectedContent);
}

/**
 * CLI runner.
 */
export function main() {
  const { changeName, isCheck, isScaffold, showHelp } = parseCliArgs(process.argv.slice(2));

  if (showHelp) {
    printUsage();
    process.exit(0);
  }

  if (isScaffold) {
    process.exit(handleScaffold(changeName));
  }

  const targets = discoverManagedChanges(changesRoot, changeName);
  if (targets.length === 0) {
    const msg = changeName
      ? `No assessment.source.json found for change "${changeName}".`
      : "No active changes with assessment.source.json found.";
    console.log(msg);
    process.exit(0);
  }

  let failures = 0;
  for (const changeDir of targets) {
    failures += processChange(changeDir, isCheck);
  }

  if (failures > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
