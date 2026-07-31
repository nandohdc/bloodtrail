import * as FingerprintJS from '/vendor/fingerprintjs.js'
import * as BotD from '/vendor/botd.js'

window.runResearchSensors = async function runResearchSensors({ monitoring = false } = {}) {
  const attemptedRequestUrls = []
  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    attemptedRequestUrls.push(String(url))
    return originalOpen.call(this, method, url, ...rest)
  }

  try {
    const fpLoadStart = performance.now()
    const fp = await FingerprintJS.load({ monitoring })
    const fpLoadMs = performance.now() - fpLoadStart
    const fpCollectStart = performance.now()
    const fpResult = await fp.get()
    const fpCollectMs = performance.now() - fpCollectStart

    const botdLoadStart = performance.now()
    const botd = await BotD.load({ monitoring })
    const botdLoadMs = performance.now() - botdLoadStart
    const botdDetectStart = performance.now()
    const botdResult = botd.detect()
    const botdDetectMs = performance.now() - botdDetectStart

    const fpComponents = Object.fromEntries(
      Object.entries(fpResult.components).map(([name, component]) => [
        name,
        {
          status: Object.prototype.hasOwnProperty.call(component, 'value') ? 'ok' : 'error',
          duration_ms: component.duration,
        },
      ]),
    )

    return {
      webdriver_exposed: navigator.webdriver === true,
      fingerprintjs: {
        version: fpResult.version,
        environment_cluster_value_for_in_memory_counting_only: fpResult.visitorId,
        confidence_score: fpResult.confidence.score,
        load_ms: fpLoadMs,
        collect_ms: fpCollectMs,
        components: fpComponents,
      },
      botd: {
        result: botdResult,
        load_ms: botdLoadMs,
        detect_ms: botdDetectMs,
        components: botd.getComponents(),
        detections: botd.getDetections(),
      },
      attempted_request_urls: attemptedRequestUrls,
      approximate_heap_bytes: performance.memory?.usedJSHeapSize ?? null,
    }
  } finally {
    XMLHttpRequest.prototype.open = originalOpen
  }
}

window.researchHarnessReady = true