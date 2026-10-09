import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PNPM_RELEASES,
  PNPM_SETTINGS_FILE,
  supportedPnpmPhrase,
  verifyOwnServiceInstall,
  verifyOwnServiceInstalls,
  verifyPnpmInstall,
} from "./evaluation-kit-installers.mjs";
import { sha256Hex } from "./evaluation-kit-checksums.mjs";

export const INSTALLER_CONTROL_DEFINITIONS = Object.freeze([
  { label: "pnpm-only settings in the kit's npm settings file", identity: "npm-installation" },
  { label: "kit npm manifest without its core override", identity: "npm-dependency-tree" },
  { label: "pnpm override only in the manifest's pnpm field (pnpm 11 and 12 legs)", identity: "pnpm-installations" },
  { label: "ignored pnpm setting reported (pnpm 11 and 12 legs)", identity: "pnpm-installations" },
  { label: "installer docs missing the supported pnpm majors", identity: "installer-documentation" },
  { label: "own service guide without the npm core pin", identity: "own-service-installations" },
  { label: "own service guide without the pnpm core pin", identity: "own-service-installations" },
  { label: "own service guide without the core dependency", identity: "own-service-installations" },
]);

const [
  NPM_SETTINGS_CONTROL,
  KIT_NPM_TREE_CONTROL,
  PNPM_FIELD_CONTROL,
  IGNORED_PNPM_SETTING_CONTROL,
  INSTALLER_DOCS_CONTROL,
  OWN_SERVICE_NPM_PIN_CONTROL,
  OWN_SERVICE_PNPM_PIN_CONTROL,
  OWN_SERVICE_CORE_DEPENDENCY_CONTROL,
] = INSTALLER_CONTROL_DEFINITIONS;
const [PNPM_READING_MANIFEST_FIELD, ...PNPM_IGNORING_MANIFEST_FIELD] = PNPM_RELEASES;
const PNPM_SETTINGS_WITHOUT_OVERRIDE = "packages: []\noverrides: {}\n";
const NPM_SETTINGS_PLANT = "node-linker=hoisted\nshamefully-hoist=true\n";
const SHIPPED_SETTING_WARNING = "reported a shipped kit setting as unknown, ignored or no longer read";

function copyNpmOverrideIntoPnpmField(pkg) {
  pkg.pnpm = { overrides: { ...pkg.overrides } };
}

async function writeMeasuredNpmSettingsFile(kitCopy, measurements, helpers) {
  const path = ".npmrc";
  const filePath = resolve(kitCopy, path);
  await helpers.applyMeasuredPlant(measurements, async () => {
    const missing = await helpers.captureFailure(() => readFile(filePath, "utf8"));
    assert.ok(missing, `${path} must be absent before the installer settings plant`);
    await writeFile(filePath, NPM_SETTINGS_PLANT, "utf8");
    const after = sha256Hex(await readFile(filePath));
    return { path, before: null, after };
  });
}

function assertShippedSettingsFailure(failure, label, settings) {
  const message = failure.cause.message;
  assert.ok(message.includes(`${label} ${SHIPPED_SETTING_WARNING}`), `${label} must report its shipped settings: ${message}`);
  for (const setting of settings) {
    assert.ok(message.includes(setting), `${label} must name ${setting}: ${message}`);
  }
  assert.ok(message.includes(".npmrc"), `${label} must name .npmrc: ${message}`);
}

async function checkNpmSettingsControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(NPM_SETTINGS_CONTROL.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, "bloodtrail-ctrl-npm-settings-", async (kitCopy) => {
    await writeMeasuredNpmSettingsFile(kitCopy, measurements, helpers);
    await helpers.resealKit(kitCopy);
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    assertShippedSettingsFailure(failure, "npm", ["node-linker", "shamefully-hoist"]);
    for (const release of PNPM_RELEASES) {
      await helpers.assertPnpmLegFails(kitCopy, release, ["node-linker"]);
    }
    assert.equal(measurements.length, 1, "npm settings control must record one absent-to-present measured plant");
  });
  return helpers.completeControl(control, measurements);
}

function assertKitNpmTreeFailure(control, message) {
  assert.ok(
    message.includes("npm install left an invalid dependency tree") &&
      message.includes('invalid: "file:../security-audit-sdk-core"'),
    `${control.label} must report npm's invalid core dependency: ${message}`,
  );
}

// Deleting the manifest's overrides removes npm's core pin while the binding's file: dependency still
// links the top-level core, so the whole gate fails only at npm-dependency-tree; the disabled-check
// sweep then proves the gate passes without that one check.
async function checkKitNpmTreeControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(KIT_NPM_TREE_CONTROL.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, "bloodtrail-ctrl-kit-npm-tree-", async (kitCopy) => {
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "package.json",
      (text) => helpers.rewriteManifest(text, (pkg) => delete pkg.overrides),
    );
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    assertKitNpmTreeFailure(control, failure.cause.message);
    assert.equal(measurements.length, 1, "kit npm tree control must record one measured plant");
  });
  return helpers.completeControl(control, measurements);
}

// pnpm 10 reads the manifest field; pnpm 11 and 12 ignore it. Keep a valid settings file without
// overrides so only the pnpm-installations check can reject the manifest-only override.
async function checkPnpmFieldOnlyOverrideControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(PNPM_FIELD_CONTROL.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, "bloodtrail-ctrl-pnpm-field-only-", async (kitCopy) => {
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "package.json",
      (text) => helpers.rewriteManifest(text, copyNpmOverrideIntoPnpmField),
      { reseal: false },
    );
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      PNPM_SETTINGS_FILE,
      () => PNPM_SETTINGS_WITHOUT_OVERRIDE,
      { reseal: false },
    );
    await helpers.resealKit(kitCopy);
    await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    await verifyPnpmInstall(kitCopy, PNPM_READING_MANIFEST_FIELD);
    for (const release of PNPM_IGNORING_MANIFEST_FIELD) {
      await helpers.assertPnpmLegFails(kitCopy, release, ["no longer read", "pnpm.overrides"]);
    }
    assert.equal(measurements.length, 2, "manifest-only pnpm override control must record both measured plants");
  });
  return helpers.completeControl(control, measurements);
}

// With a valid settings override, pnpm 11 and 12 install successfully and only warn about the manifest
// field, so the shipped-setting warning condition is the one that fails.
async function checkIgnoredPnpmSettingControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(IGNORED_PNPM_SETTING_CONTROL.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, "bloodtrail-ctrl-ignored-pnpm-setting-", async (kitCopy) => {
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "package.json",
      (text) => helpers.rewriteManifest(text, copyNpmOverrideIntoPnpmField),
    );
    const [firstIgnoring, ...laterIgnoring] = PNPM_IGNORING_MANIFEST_FIELD;
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    const firstMessage = failure.cause.message;
    assert.ok(
      firstMessage.includes(`pnpm ${firstIgnoring} ${SHIPPED_SETTING_WARNING}`),
      `pnpm ${firstIgnoring} must report its shipped setting: ${firstMessage}`,
    );
    const expectedSetting = "pnpm.overrides from package.json:";
    assert.ok(firstMessage.includes(expectedSetting), `pnpm ${firstIgnoring} must name pnpm.overrides: ${firstMessage}`);
    for (const release of laterIgnoring) {
      await helpers.assertPnpmLegFails(kitCopy, release, [SHIPPED_SETTING_WARNING, expectedSetting]);
    }
    assert.equal(measurements.length, 1, "ignored pnpm setting control must record one measured plant");
  });
  return helpers.completeControl(control, measurements);
}

async function checkInstallerDocsControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(INSTALLER_DOCS_CONTROL.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, "bloodtrail-ctrl-installer-docs-", async (kitCopy) => {
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "docs/quickstart.md",
      (text) => text.replaceAll(supportedPnpmPhrase(), "pnpm (v10+)"),
    );
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes("docs/quickstart.md"),
      `installer documentation must name the changed document: ${failure.cause.message}`,
    );
    assert.equal(measurements.length, 1, "installer documentation control must record one measured plant");
  });
  return helpers.completeControl(control, measurements);
}

const OWN_SERVICE_DOCUMENT = "docs/integration-and-testing.md";
const OWN_SERVICE_CORE_TARBALL = "file:../evaluation-kit/bloodtrail-security-audit-sdk-core-0.4.0.tgz";
const OWN_SERVICE_NPM_OVERRIDE_ANCHOR = `,
  "overrides": {
    "@bloodtrail/security-audit-sdk-core": "${OWN_SERVICE_CORE_TARBALL}"
  }`;
const OWN_SERVICE_PNPM_OVERRIDE_ANCHOR = `overrides:
  "@bloodtrail/security-audit-sdk-core": "${OWN_SERVICE_CORE_TARBALL}"`;
const OWN_SERVICE_CORE_DEPENDENCY_ANCHOR =
  `    "@bloodtrail/security-audit-sdk-core": "${OWN_SERVICE_CORE_TARBALL}",\n`;

function replaceUnique(text, anchor, replacement, label) {
  assert.equal(text.split(anchor).length - 1, 1, `${label} anchor must occur exactly once`);
  return text.replace(anchor, replacement);
}

function assertNpmPinFailure(control, message) {
  assert.ok(
    message.includes("own service npm install left an invalid dependency tree") &&
      message.includes("file:../security-audit-sdk-core"),
    `${control.label} must report npm's invalid core dependency: ${message}`,
  );
}

// The check stops at the first pnpm release, so each later release is shown to fail on its own.
async function assertPnpmPinFailure(control, message, kitCopy, helpers) {
  const [firstRelease, ...laterReleases] = PNPM_RELEASES;
  assert.ok(message.includes(`own service pnpm ${firstRelease}`), `${control.label} must fail at pnpm ${firstRelease}: ${message}`);
  for (const release of laterReleases) {
    const releaseFailure = await helpers.captureFailure(() => verifyOwnServiceInstall(kitCopy, release));
    assert.ok(releaseFailure, `${control.label} must fail at pnpm ${release}`);
    assert.ok(
      releaseFailure.message.includes(`own service pnpm ${release}`),
      `${control.label} must name pnpm ${release}: ${releaseFailure.message}`,
    );
  }
}

function assertCoreDependencyFailure(control, message) {
  assert.ok(
    message.includes("the documented own-service install must list both") &&
      message.includes("@bloodtrail/security-audit-sdk-core") &&
      message.includes("@bloodtrail/security-audit-sdk-node"),
    `${control.label} must report the documented dependency requirement: ${message}`,
  );
}

const OWN_SERVICE_GUIDE_PLANTS = Object.freeze([
  {
    definition: OWN_SERVICE_NPM_PIN_CONTROL,
    tempPrefix: "bloodtrail-ctrl-own-service-npm-pin-",
    anchor: OWN_SERVICE_NPM_OVERRIDE_ANCHOR,
    replacement: "",
    assertFailure: assertNpmPinFailure,
  },
  {
    definition: OWN_SERVICE_PNPM_PIN_CONTROL,
    tempPrefix: "bloodtrail-ctrl-own-service-pnpm-pin-",
    anchor: OWN_SERVICE_PNPM_OVERRIDE_ANCHOR,
    replacement: "overrides: {}",
    assertFailure: assertPnpmPinFailure,
  },
  {
    definition: OWN_SERVICE_CORE_DEPENDENCY_CONTROL,
    tempPrefix: "bloodtrail-ctrl-own-service-core-dependency-",
    anchor: OWN_SERVICE_CORE_DEPENDENCY_ANCHOR,
    replacement: "",
    assertFailure: assertCoreDependencyFailure,
  },
]);

// Each own-service control plants one defect in a copied guide's documented install, then runs only the
// own-service check against that copy.
async function checkOwnServiceGuideControl(plant, kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(plant.definition.label);
  const measurements = [];
  await helpers.withKitCopy(kitDir, plant.tempPrefix, async (kitCopy) => {
    await helpers.rewriteMeasuredKitFile(
      { kitCopy, measurements },
      OWN_SERVICE_DOCUMENT,
      (text) => replaceUnique(text, plant.anchor, plant.replacement, control.label),
    );
    const failure = await helpers.captureDirectCheckFailure(
      control,
      () => verifyOwnServiceInstalls(kitCopy),
      _disabledChecks,
    );
    await plant.assertFailure(control, failure.cause.message, kitCopy, helpers);
    assert.equal(measurements.length, 1, `${control.label} must record one measured plant`);
  });
  return helpers.completeControl(control, measurements);
}

export function createInstallerControlRunners(helpers) {
  return Object.freeze([
    [NPM_SETTINGS_CONTROL.label, ({ kitDir, _disabledChecks }) => checkNpmSettingsControl(kitDir, _disabledChecks, helpers)],
    [KIT_NPM_TREE_CONTROL.label, ({ kitDir, _disabledChecks }) => checkKitNpmTreeControl(kitDir, _disabledChecks, helpers)],
    [PNPM_FIELD_CONTROL.label, ({ kitDir, _disabledChecks }) => checkPnpmFieldOnlyOverrideControl(kitDir, _disabledChecks, helpers)],
    [IGNORED_PNPM_SETTING_CONTROL.label, ({ kitDir, _disabledChecks }) => checkIgnoredPnpmSettingControl(kitDir, _disabledChecks, helpers)],
    [INSTALLER_DOCS_CONTROL.label, ({ kitDir, _disabledChecks }) => checkInstallerDocsControl(kitDir, _disabledChecks, helpers)],
    ...OWN_SERVICE_GUIDE_PLANTS.map((plant) => [
      plant.definition.label,
      ({ kitDir, _disabledChecks }) => checkOwnServiceGuideControl(plant, kitDir, _disabledChecks, helpers),
    ]),
  ]);
}
