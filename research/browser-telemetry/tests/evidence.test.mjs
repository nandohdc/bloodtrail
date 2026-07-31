import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { assertSafeEvidence, sanitizeLegacyEvidence } from '../lib/evidence.mjs'

const metadata = {
  sanitized_at: '2026-07-30T18:00:00.000Z',
  environment: { browser: 'Chrome research fixture' },
  packages: { fingerprintjs: '5.2.0', botd: '2.0.0' },
  methodology: {},
  limitations: [],
}
const syntheticEnvironmentValue = 'a'.repeat(32)

function legacyFixture() {
  return {
    measured_at: '2026-07-30T16:49:58.299Z',
    chrome_path: '/Users/example/Applications/Chrome',
    summaries: [
      {
        name: 'headless_chrome_cold_pages',
        user_agent: 'Mozilla/5.0 private high entropy value',
        webdriver: true,
        fp_version: '5.2.0',
        fp_visitor_ids: [syntheticEnvironmentValue],
        fp_confidence: { score: 0.5 },
        fp_load_ms: { n: 1, min: 1, median: 1, p95: 1, max: 1 },
        fp_get_ms: { n: 1, min: 2, median: 2, p95: 2, max: 2 },
        fp_component_errors: {},
        fp_slowest_components: [{ component: 'fonts', duration_ms: 2, status: 'ok' }],
        botd_result: { bot: true, botKind: 'headless_chrome' },
        botd_load_ms: { n: 1, min: 1, median: 1, p95: 1, max: 1 },
        botd_detect_ms: { n: 1, min: 0, median: 0, p95: 0, max: 0 },
        botd_positive_detectors: { detectWebDriver: { bot: true } },
        botd_component_errors: { process: 'private raw error' },
        observed_request_urls: [],
      },
    ],
  }
}

test('legacy sanitizer removes raw identifiers, full UA, host paths, and error values', () => {
  const output = sanitizeLegacyEvidence(legacyFixture(), metadata)
  const serialized = JSON.stringify(output)
  assert.doesNotMatch(serialized, new RegExp(syntheticEnvironmentValue))
  assert.doesNotMatch(serialized, /Mozilla\/5\.0/)
  assert.doesNotMatch(serialized, /\/Users\//)
  assert.doesNotMatch(serialized, /private raw error/)
  assert.equal(output.scenarios[0].environment_cluster_count, 1)
  assertSafeEvidence(output)
})

test('validator rejects raw identifier keys and values', () => {
  assert.throws(
    () => assertSafeEvidence({ scenarios: [], visitorId: syntheticEnvironmentValue }),
    /forbidden evidence key/,
  )
})

test('validator rejects explicit credential and token key classes after normalization', () => {
  const forbiddenKeys = [
    'token',
    'api_key',
    'private_key',
    'AccessToken',
    'REFRESH-TOKEN',
    'id token',
    'authToken',
    'APIKey',
    'private-key',
    'clientSecret',
    'PASSWORD',
    'passwd',
    'Credential',
    'credentials',
    'Authorization',
    'Cookie',
    'setCookie',
  ]

  for (const key of forbiddenKeys) {
    assert.throws(() => assertSafeEvidence({ scenarios: [], [key]: 'opaque-value' }), /forbidden evidence key/, key)
  }
})

test('validator rejects nested and array-contained credential fields recursively', () => {
  assert.throws(
    () => assertSafeEvidence({ scenarios: [], metadata: { collection: { client_secret: 'opaque-value' } } }),
    /forbidden evidence key/,
  )
  assert.throws(
    () => assertSafeEvidence({ scenarios: [], records: [{ status: 'ok' }, { auth_token: 'opaque-value' }] }),
    /forbidden evidence key/,
  )
})

test('validator allows approved evidence fields without treating generic key text as secret', () => {
  const approved = {
    schema_version: 1,
    evidence_kind: 'sanitized_test_fixture',
    methodology: {
      key_id: 'rotating-version-one',
      keyboard_layout_status: 'not collected',
      tokenization_method: 'not applicable',
      component_error_names: ['process'],
    },
    scenarios: [{ name: 'normal', observed_request_origins: [] }],
  }
  assert.doesNotThrow(() => assertSafeEvidence(approved))
})

test('committed sanitized baseline remains valid', async () => {
  const baseline = JSON.parse(
    await readFile(new URL('../evidence/baseline-2026-07-30.sanitized.json', import.meta.url), 'utf8'),
  )
  assert.doesNotThrow(() => assertSafeEvidence(baseline))
})

test('validator rejects full user agents and developer paths', () => {
  assert.throws(() => assertSafeEvidence({ scenarios: [], value: 'Mozilla/5.0 test' }), /unsafe evidence string/)
  assert.throws(() => assertSafeEvidence({ scenarios: [], value: '/Users/example/file' }), /unsafe evidence string/)
})

test('validator rejects external origins outside the isolated negative control', () => {
  assert.throws(
    () =>
      assertSafeEvidence({
        scenarios: [{ name: 'normal', observed_request_origins: ['https://m1.openfpcdn.io'] }],
      }),
    /unexpected external origin/,
  )
})
