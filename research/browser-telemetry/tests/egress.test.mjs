import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { chromeLaunchOptions } from '../lib/browser.mjs'
import { startResearchServer } from '../lib/server.mjs'
import { hasExactOrigin } from '../lib/url-origin.mjs'

let browser
let server

before(async () => {
  server = await startResearchServer({ allowExternalConnect: true })
  browser = await chromium.launch(chromeLaunchOptions({ headless: true }))
})

after(async () => {
  await browser?.close()
  await server?.close()
})

async function probe(monitoring) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    Math.random = () => 0
  })
  const page = await context.newPage()
  const externalNetworkAttempts = []
  const externalNetworkResponses = []
  page.on('request', (request) => {
    if (!hasExactOrigin(request.url(), server.origin)) externalNetworkAttempts.push(request.url())
  })
  page.on('response', (response) => {
    if (!hasExactOrigin(response.url(), server.origin)) externalNetworkResponses.push(response.url())
  })
  await page.route('**/*', async (route) => {
    if (hasExactOrigin(route.request().url(), server.origin)) await route.continue()
    else await route.abort('blockedbyclient')
  })
  await page.goto(`${server.origin}/poc/index.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.researchHarnessReady === true)
  const result = await page.evaluate((enabled) => window.runResearchSensors({ monitoring: enabled }), monitoring)
  await context.close()
  return { result, externalNetworkAttempts, externalNetworkResponses }
}

test('first-party classification compares parsed origins exactly without network access', () => {
  const origin = 'http://127.0.0.1:43210'
  const cases = [
    ['exact local origin', origin, true],
    ['same origin with another path', `${origin}/poc/index.html?sample=1`, true],
    ['different host', 'http://evil.invalid:43210/probe', false],
    ['different port', 'http://127.0.0.1:43211/probe', false],
    ['different scheme', 'https://127.0.0.1:43210/probe', false],
    ['hostname-prefix confusion', 'http://127.0.0.10:43210/probe', false],
    ['subdomain confusion', 'http://127.0.0.1.evil.invalid:43210/probe', false],
    ['user-information bypass', 'http://127.0.0.1:43210@evil.invalid/probe', false],
    ['malformed URL', 'not a URL', false],
  ]

  for (const [name, candidate, expected] of cases) {
    assert.equal(hasExactOrigin(candidate, origin), expected, name)
  }
})

test('monitoring:false prevents all package-generated third-party attempts even when sampling is forced', async () => {
  const { result, externalNetworkAttempts, externalNetworkResponses } = await probe(false)
  assert.deepEqual(result.attempted_request_urls, [])
  assert.deepEqual(externalNetworkAttempts, [])
  assert.deepEqual(externalNetworkResponses, [])
})

test('negative control observes and blocks both known monitoring requests', async () => {
  const { result, externalNetworkAttempts, externalNetworkResponses } = await probe(true)
  const expected = [
    'https://m1.openfpcdn.io/botd/v2.0.0/npm-monitoring',
    'https://m1.openfpcdn.io/fingerprintjs/v5.2.0/npm-monitoring',
  ]
  assert.deepEqual([...result.attempted_request_urls].sort(), expected)
  assert.deepEqual([...externalNetworkAttempts].sort(), expected)
  assert.deepEqual(externalNetworkResponses, [])
})
