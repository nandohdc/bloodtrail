import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PNPM_RELEASES,
  PNPM_SETTINGS_FILE,
  supportedPnpmPhrase,
  verifyPnpmInstall,
} from "./evaluation-kit-installers.mjs";
import { sha256Hex } from "./evaluation-kit-checksums.mjs";

export const INSTALLER_CONTROL_DEFINITIONS = Object.freeze([
  { label: "pnpm-only settings in the kit's npm settings file", identity: "npm-installation" },
  { label: "pnpm override only in the manifest's pnpm field (pnpm 11 and 12 legs)", identity: "pnpm-installations" },
  { label: "ignored pnpm setting reported (pnpm 11 and 12 legs)", identity: "pnpm-installations" },
  { label: "installer docs missing the supported pnpm majors", identity: "installer-documentation" },
]);

const [NPM_SETTINGS_CONTROL, PNPM_FIELD_CONTROL, IGNORED_PNPM_SETTING_CONTROL, INSTALLER_DOCS_CONTROL] = INSTALLER_CONTROL_DEFINITIONS;
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

export function createInstallerControlRunners(helpers) {
  return Object.freeze([
    [NPM_SETTINGS_CONTROL.label, ({ kitDir, _disabledChecks }) => checkNpmSettingsControl(kitDir, _disabledChecks, helpers)],
    [PNPM_FIELD_CONTROL.label, ({ kitDir, _disabledChecks }) => checkPnpmFieldOnlyOverrideControl(kitDir, _disabledChecks, helpers)],
    [IGNORED_PNPM_SETTING_CONTROL.label, ({ kitDir, _disabledChecks }) => checkIgnoredPnpmSettingControl(kitDir, _disabledChecks, helpers)],
    [INSTALLER_DOCS_CONTROL.label, ({ kitDir, _disabledChecks }) => checkInstallerDocsControl(kitDir, _disabledChecks, helpers)],
  ]);
}
