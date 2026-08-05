import { writeFile } from 'node:fs/promises'
import { byCodePoint } from './sort.mjs'

const forbiddenExactKeys = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'auth_token',
  'api_key',
  'apikey',
  'private_key',
  'client_secret',
  'secret',
  'password',
  'passwd',
  'credential',
  'credentials',
  'authorization',
  'cookie',
  'set_cookie',
])
const forbiddenKeySegments = new Set([
  'token',
  'secret',
  'password',
  'passwd',
  'credential',
  'credentials',
  'authorization',
  'cookie',
  'raw',
])
const forbiddenSegmentPairs = new Set(['visitor_id', 'visitor_ids', 'component_value', 'component_values'])
const forbiddenStringPatterns = [
  /Mozilla\/5\.0/i,
  /\/Users\//,
  /\/home\/[A-Za-z0-9._-]+\//,
  /[A-Za-z]:\\Users\\/i,
  /(?<![A-Fa-f0-9])[A-Fa-f0-9]{32}(?![A-Fa-f0-9])/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
]
const monitoringOrigin = 'https://m1.openfpcdn.io'

function normalizeEvidenceKey(key) {
  return key
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
}

function isForbiddenEvidenceKey(key) {
  const normalized = normalizeEvidenceKey(key)
  if (forbiddenExactKeys.has(normalized)) return true

  const segments = normalized.split('_').filter(Boolean)
  if (segments.some((segment) => forbiddenKeySegments.has(segment))) return true
  return segments.some((segment, index) => forbiddenSegmentPairs.has(`${segment}_${segments[index + 1] ?? ''}`))
}

function assertSafeValue(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeValue(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      for (const pattern of forbiddenStringPatterns) {
        if (pattern.test(value)) throw new Error(`unsafe evidence string at ${path}: ${pattern}`)
      }
    }
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenEvidenceKey(key)) throw new Error(`forbidden evidence key at ${path}.${key}`)
    assertSafeValue(child, `${path}.${key}`)
  }
}

export function assertSafeEvidence(evidence) {
  assertSafeValue(evidence)
  if (!Array.isArray(evidence.scenarios)) throw new Error('evidence.scenarios must be an array')

  for (const scenario of evidence.scenarios) {
    const origins = scenario.observed_request_origins ?? []
    if (!Array.isArray(origins)) throw new Error(`observed_request_origins must be an array: ${scenario.name}`)
    const isNegativeControl = scenario.name === 'monitoring_enabled_negative_control'
    if (isNegativeControl) {
      if (origins.length !== 1 || origins[0] !== monitoringOrigin) {
        throw new Error(`negative control must contain only ${monitoringOrigin}`)
      }
    } else if (origins.length !== 0) {
      throw new Error(`unexpected external origin in ${scenario.name}: ${origins.join(', ')}`)
    }
  }
  return evidence
}

function origins(urls = []) {
  return [...new Set(urls.map((value) => new URL(value).origin))].sort(byCodePoint)
}

function stats(value) {
  if (!value) return undefined
  return {
    n: value.n,
    min_ms: value.min,
    median_ms: value.median,
    p95_ms: value.p95,
    max_ms: value.max,
  }
}

export function sanitizeLegacyEvidence(raw, metadata) {
  if (!Array.isArray(raw.summaries)) throw new Error('legacy evidence must contain summaries')

  const scenarios = raw.summaries.map((summary) => ({
    name:
      summary.name === 'headless_chrome_monitoring_enabled_deterministic'
        ? 'monitoring_enabled_negative_control'
        : summary.name,
    sample_count: summary.fp_load_ms?.n ?? 0,
    webdriver_exposed: summary.webdriver === true,
    fingerprintjs_version: summary.fp_version,
    environment_cluster_count: Array.isArray(summary.fp_visitor_ids) ? summary.fp_visitor_ids.length : undefined,
    fingerprintjs_confidence_score: summary.fp_confidence?.score,
    fingerprintjs_load: stats(summary.fp_load_ms),
    fingerprintjs_collect: stats(summary.fp_get_ms),
    fingerprintjs_component_error_names: Object.keys(summary.fp_component_errors ?? {}).sort(byCodePoint),
    fingerprintjs_slowest_components: (summary.fp_slowest_components ?? []).map((component) => ({
      name: component.component,
      duration_ms: component.duration_ms,
      status: component.status,
    })),
    botd_result: summary.botd_result,
    botd_load: stats(summary.botd_load_ms),
    botd_detect: stats(summary.botd_detect_ms),
    botd_positive_detector_names: Object.keys(summary.botd_positive_detectors ?? {}).sort(byCodePoint),
    botd_component_error_names: Object.keys(summary.botd_component_errors ?? {}).sort(byCodePoint),
    observed_request_origins: origins(summary.observed_request_urls),
    approximate_heap_bytes_after_first_run: summary.js_heap_bytes_after_first_run ?? null,
  }))

  const evidence = {
    schema_version: 1,
    evidence_kind: 'sanitized_local_baseline',
    measured_at: raw.measured_at,
    sanitized_at: metadata.sanitized_at,
    environment: metadata.environment,
    packages: metadata.packages,
    methodology: metadata.methodology,
    limitations: metadata.limitations,
    scenarios,
  }
  return assertSafeEvidence(evidence)
}

export async function writeNewJson(path, value) {
  assertSafeEvidence(value)
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
}
