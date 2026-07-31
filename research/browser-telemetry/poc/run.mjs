import { execFileSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromeLaunchOptions } from '../lib/browser.mjs'
import { writeNewJson } from '../lib/evidence.mjs'
import { startResearchServer } from '../lib/server.mjs'
import { hasExactOrigin } from '../lib/url-origin.mjs'

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
}

function stats(values) {
  if (values.length === 0) return undefined
  return {
    n: values.length,
    min_ms: Math.min(...values),
    median_ms: percentile(values, 0.5),
    p95_ms: percentile(values, 0.95),
    max_ms: Math.max(...values),
  }
}

function observedOrigins(urls) {
  return [...new Set(urls.map((value) => new URL(value).origin))].sort()
}

function packageVersion(packageName) {
  return execFileSync(
    process.execPath,
    ['-e', `console.log(require(${JSON.stringify(`${packageName}/package.json`)}).version)`],
    { cwd: researchRoot, encoding: 'utf8' },
  ).trim()
}

function npmVersion() {
  return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
}

function osDescription() {
  if (process.platform !== 'darwin') return `${os.platform()} ${os.release()}`
  try {
    const product = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()
    const build = execFileSync('sw_vers', ['-buildVersion'], { encoding: 'utf8' }).trim()
    return `macOS ${product} (build ${build})`
  } catch {
    return `Darwin ${os.release()}`
  }
}

const scenarios = [
  { name: 'headless_chrome_baseline', headless: true, samples: 15 },
  { name: 'headless_chrome_cold_pages', headless: true, cold: true, samples: 10 },
  {
    name: 'headless_chrome_webdriver_patched',
    headless: true,
    samples: 15,
    init: () => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }),
  },
  {
    name: 'headless_chrome_patched_ua',
    headless: true,
    samples: 15,
    contextOptions: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    },
  },
  {
    name: 'headless_chrome_basic_stealth',
    headless: true,
    cold: true,
    samples: 10,
    contextOptions: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    },
    init: () => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }),
  },
  {
    name: 'headless_chrome_6x_cpu_cold_pages',
    headless: true,
    cold: true,
    samples: 10,
    cpuRate: 6,
  },
  {
    name: 'headless_chrome_different_screen',
    headless: true,
    samples: 15,
    contextOptions: {
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    init: () => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }),
  },
  {
    name: 'monitoring_enabled_negative_control',
    headless: true,
    samples: 1,
    monitoring: true,
  },
  { name: 'headed_chrome_playwright_cold_pages', headless: false, cold: true, samples: 5 },
  {
    name: 'headed_chrome_playwright_webdriver_patched_cold_pages',
    headless: false,
    cold: true,
    samples: 5,
    init: () => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }),
  },
]

async function configurePage(context, page, scenario, origin, externalNetworkAttempts) {
  page.on('request', (request) => {
    if (!hasExactOrigin(request.url(), origin)) externalNetworkAttempts.push(request.url())
  })
  await page.route('**/*', async (route) => {
    if (hasExactOrigin(route.request().url(), origin)) await route.continue()
    else await route.abort('blockedbyclient')
  })
  if (scenario.cpuRate) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpuRate })
  }
  await page.goto(`${origin}/poc/index.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.researchHarnessReady === true)
}

async function runScenario(browser, scenario, origin) {
  const context = await browser.newContext(scenario.contextOptions ?? {})
  await context.addInitScript(() => {
    Math.random = () => 0
  })
  if (scenario.init) await context.addInitScript(scenario.init)

  let reusablePage
  let reusableExternalAttempts
  const samples = []
  try {
    if (!scenario.cold) {
      reusableExternalAttempts = []
      reusablePage = await context.newPage()
      await configurePage(context, reusablePage, scenario, origin, reusableExternalAttempts)
    }

    for (let index = 0; index < scenario.samples; index += 1) {
      const externalNetworkAttempts = scenario.cold ? [] : reusableExternalAttempts
      const page = scenario.cold ? await context.newPage() : reusablePage
      if (scenario.cold) await configurePage(context, page, scenario, origin, externalNetworkAttempts)
      const result = await page.evaluate(
        (monitoring) => window.runResearchSensors({ monitoring }),
        scenario.monitoring === true,
      )
      samples.push({ result, externalNetworkAttempts: [...externalNetworkAttempts] })
      if (scenario.cold) await page.close()
    }
  } finally {
    await context.close()
  }

  const clusterValues = new Set(
    samples.map((sample) => sample.result.fingerprintjs.environment_cluster_value_for_in_memory_counting_only),
  )
  const fpComponents = samples[0].result.fingerprintjs.components
  const slowest = Object.entries(fpComponents)
    .map(([name, value]) => ({ name, duration_ms: value.duration_ms, status: value.status }))
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 8)
  const firstBotdComponents = samples[0].result.botd.components
  const firstDetections = samples[0].result.botd.detections
  const allAttemptedUrls = samples.flatMap((sample) => [
    ...sample.result.attempted_request_urls,
    ...sample.externalNetworkAttempts,
  ])

  return {
    name: scenario.name,
    sample_count: samples.length,
    browser_mode: scenario.headless ? 'headless' : 'headed',
    cold_pages: scenario.cold === true,
    cpu_throttling_rate: scenario.cpuRate ?? 1,
    monitoring: scenario.monitoring === true,
    webdriver_exposed: samples[0].result.webdriver_exposed,
    fingerprintjs_version: samples[0].result.fingerprintjs.version,
    environment_cluster_count: clusterValues.size,
    fingerprintjs_confidence_score: samples[0].result.fingerprintjs.confidence_score,
    fingerprintjs_load: stats(samples.map((sample) => sample.result.fingerprintjs.load_ms)),
    fingerprintjs_collect: stats(samples.map((sample) => sample.result.fingerprintjs.collect_ms)),
    fingerprintjs_component_error_names: Object.entries(fpComponents)
      .filter(([, value]) => value.status === 'error')
      .map(([name]) => name)
      .sort(),
    fingerprintjs_slowest_components: slowest,
    botd_result: samples[0].result.botd.result,
    botd_load: stats(samples.map((sample) => sample.result.botd.load_ms)),
    botd_detect: stats(samples.map((sample) => sample.result.botd.detect_ms)),
    botd_positive_detector_names: Object.entries(firstDetections)
      .filter(([, detection]) => detection.bot === true)
      .map(([name]) => name)
      .sort(),
    botd_component_error_names: Object.entries(firstBotdComponents)
      .filter(([, component]) => component.state < 0)
      .map(([name]) => name)
      .sort(),
    observed_request_origins: observedOrigins(allAttemptedUrls),
    approximate_heap_bytes_after_first_run: samples[0].result.approximate_heap_bytes,
  }
}

async function main() {
  const skipHeaded = process.argv.includes('--skip-headed')
  const only = argument('--only')
  const selected = scenarios.filter(
    (scenario) => (!skipHeaded || scenario.headless) && (!only || scenario.name === only),
  )
  if (selected.length === 0) throw new Error(`no matching scenarios${only ? ` for --only ${only}` : ''}`)

  const server = await startResearchServer({ allowExternalConnect: true })
  const outputArg = argument('--output')
  const timestamp = new Date().toISOString()
  const defaultName = `run-${timestamp.replace(/[:.]/g, '-')}.sanitized.json`
  const outputPath = path.resolve(outputArg ?? path.join(researchRoot, 'evidence', 'runs', defaultName))
  await mkdir(path.dirname(outputPath), { recursive: true })

  const results = []
  let browserVersion
  try {
    for (const headless of [true, false]) {
      const group = selected.filter((scenario) => scenario.headless === headless)
      if (group.length === 0) continue
      const browser = await chromium.launch(chromeLaunchOptions({ headless }))
      browserVersion ??= browser.version()
      try {
        for (const scenario of group) {
          console.log(`Running ${scenario.name} (${scenario.samples} sample${scenario.samples === 1 ? '' : 's'})`)
          results.push(await runScenario(browser, scenario, server.origin))
        }
      } finally {
        await browser.close()
      }
    }
  } finally {
    await server.close()
  }

  const evidence = {
    schema_version: 1,
    evidence_kind: 'sanitized_local_reproduction_run',
    measured_at: timestamp,
    environment: {
      os: osDescription(),
      browser: `Google Chrome ${browserVersion}`,
      browser_launch_configuration: process.env.CHROME_PATH
        ? 'CHROME_PATH supplied by operator (value not retained)'
        : `Playwright channel ${process.env.BROWSER_CHANNEL || 'chrome'}`,
      node: process.versions.node,
      npm: npmVersion(),
      playwright: packageVersion('playwright'),
    },
    packages: {
      fingerprintjs: packageVersion('@fingerprintjs/fingerprintjs'),
      botd: packageVersion('@fingerprintjs/botd'),
    },
    methodology: {
      origin: 'ephemeral local first-party HTTP server on 127.0.0.1',
      monitoring_sampling: 'Math.random forced to zero in every browser context',
      external_requests: 'recorded and aborted before completion',
      output_policy: 'raw environment-cluster values and component values are not written',
    },
    limitations: [
      'Single host and installed Chrome; not a representative customer population.',
      'Synthetic CPU throttling is not a physical-device benchmark.',
      'Approximate performance.memory values are diagnostic only.',
      'No production traffic, customer data, conversion measurement, or advanced stealth evaluation.',
    ],
    scenarios: results,
  }
  await writeNewJson(outputPath, evidence)
  console.log(`Wrote sanitized non-overwriting evidence: ${outputPath}`)
}

await main()
