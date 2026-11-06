// Test support: fake SDK Node primitives for copies probe (#839, Q166, Q180, Q183, Q185).
import { request } from "node:http";

const ORIGIN_PATTERN = /^https?:\/\/(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;
const BOUNDED_ABSOLUTE_PATH = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]{1,2047}$/;
const RETRYABLE_4XX = new Set([408, 425, 429]);

export function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFunction(value) {
  return typeof value === "function";
}

export function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isBoundedRetryAttempts(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 1000;
}

export function isBoundedBackpressureCapacity(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 100000;
}

export function isOriginString(value) {
  return typeof value === "string" && ORIGIN_PATTERN.test(value);
}

export function isAbsolutePathString(value) {
  return typeof value === "string" && BOUNDED_ABSOLUTE_PATH.test(value);
}

function hasTimerMethods(value) {
  return isFunction(value.setTimeout) && isFunction(value.clearTimeout);
}

export function isTimerProvider(value) {
  return isObject(value) && hasTimerMethods(value);
}

export function requireOption({ name, value, check, message }) {
  if (!check(value)) {
    throw new TypeError(message || `Invalid option: ${name}`);
  }
  return value;
}

const timerHandleMap = new WeakMap();

export const nodeTimers = Object.freeze({
  setTimeout(callback, ms) {
    const raw = setTimeout(callback, ms);
    const handle = {
      raw,
      unref() {
        raw.unref();
      },
    };
    timerHandleMap.set(handle, raw);
    return handle;
  },
  clearTimeout(handle) {
    if (!handle) return;
    const raw = timerHandleMap.get(handle);
    if (raw) {
      clearTimeout(raw);
    }
  },
});

function buildHttpStatusMap() {
  const map = new Map();
  for (let s = 200; s < 300; s += 1) {
    map.set(s, { status: "success", code: "success" });
  }
  for (let s = 400; s < 500; s += 1) {
    const isRetry = RETRYABLE_4XX.has(s);
    map.set(s, isRetry
      ? { status: "retryable", code: "http_retryable" }
      : { status: "non_retryable", code: "http_permanent" });
  }
  for (let s = 500; s < 600; s += 1) {
    map.set(s, { status: "retryable", code: "http_retryable" });
  }
  return map;
}

const HTTP_STATUS_MAP = buildHttpStatusMap();

export function classifyHttpStatus(status) {
  const entry = HTTP_STATUS_MAP.get(status);
  if (entry) return entry;
  return { status: "protocol_error", code: "unexpected_response" };
}

function isValidAcknowledgment(ack) {
  return Boolean(ack && typeof ack.event_id === "string" && ack.outcome === "accepted");
}

function parseAcceptedAcknowledgments(body) {
  try {
    const parsed = JSON.parse(body);
    if (!parsed) return [];
    if (!Array.isArray(parsed.acknowledgments)) return [];
    if (!parsed.acknowledgments.every(isValidAcknowledgment)) return [];
    return parsed.acknowledgments.map((ack) => ({
      event_id: ack.event_id,
      outcome: "accepted",
    }));
  } catch {
    return [];
  }
}

function executeFetchHttp({ origin, requestData, timeoutMs, callerHeaders }) {
  return new Promise((resolve) => {
    const url = new URL(requestData.path, origin);
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: requestData.method,
        headers: {
          ...callerHeaders,
          "content-type": requestData.headers["content-type"],
          "content-length": requestData.headers["content-length"],
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const acknowledgments = parseAcceptedAcknowledgments(raw);
          resolve({ kind: "response", status: res.statusCode ?? 500, acknowledgments });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ kind: "timeout" });
    });
    req.on("error", () => {
      resolve({ kind: "transport_failure" });
    });
    req.write(requestData.body);
    req.end();
  });
}

export function createFetchHttpExchange(options) {
  requireOption({ name: "options", value: options, check: isObject, message: "fetch exchange options must be an object" });
  const origin = requireOption({ name: "origin", value: options.origin, check: isOriginString, message: "HTTP origin must be a valid http or https URL" });
  const timeoutMs = requireOption({ name: "timeoutMs", value: options.timeoutMs, check: isPositiveSafeInteger, message: "HTTP exchange timeout must be a positive integer" });
  const callerHeaders = Object.freeze({ ...options.headers });
  return async (requestData) => {
    return executeFetchHttp({ origin, requestData, timeoutMs, callerHeaders });
  };
}

function hasExactAcknowledgment(acknowledgments, eventId) {
  if (!Array.isArray(acknowledgments) || acknowledgments.length !== 1) return false;
  const [ack] = acknowledgments;
  if (!ack || typeof ack !== "object") return false;
  return ack.event_id === eventId && ack.outcome === "accepted";
}

function classifyOutcomeResponse(outcome, eventId, attempt) {
  if (outcome.kind === "timeout") {
    return { status: "retryable", code: "timeout", event_id: eventId, attempt };
  }
  if (outcome.kind === "transport_failure") {
    return { status: "retryable", code: "transport_failure", event_id: eventId, attempt };
  }
  const classified = classifyHttpStatus(outcome.status);
  if (classified.status !== "success") {
    return { status: classified.status, code: classified.code, event_id: eventId, attempt };
  }
  if (hasExactAcknowledgment(outcome.acknowledgments, eventId)) {
    return { status: "acknowledged", code: "acknowledged", event_id: eventId, attempt };
  }
  return { status: "protocol_error", code: "malformed_acknowledgment", event_id: eventId, attempt };
}

export function createHttpDeliveryHandoff(options) {
  requireOption({ name: "options", value: options, check: isObject, message: "HTTP handoff options must be an object" });
  const path = requireOption({ name: "path", value: options.path, check: isAbsolutePathString, message: "HTTP handoff path must be a bounded absolute path" });
  const exchange = requireOption({ name: "exchange", value: options.exchange, check: isFunction, message: "HTTP handoff exchange must be a function" });

  return {
    async handoff(event, attempt = 0) {
      const body = JSON.stringify(event);
      const requestData = {
        method: "POST",
        path,
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
        },
        body,
        event_id: event.event.id,
        attempt,
      };
      try {
        const outcome = await exchange(requestData);
        return classifyOutcomeResponse(outcome, event.event.id, attempt);
      } catch {
        return { status: "retryable", code: "transport_failure", event_id: event.event.id, attempt };
      }
    },
  };
}

function validateJitter(jitter) {
  if (!Number.isFinite(jitter)) {
    throw new TypeError("delivery retry jitterSource must return a finite value in [0, 1)");
  }
  if (jitter < 0 || jitter >= 1) {
    throw new TypeError("delivery retry jitterSource must return a finite value in [0, 1)");
  }
  return jitter;
}

function computeDelay(baseDelayMs, maxDelayMs, attempt, jitterSource) {
  const uncapped = baseDelayMs * 2 ** attempt;
  const capped = Math.min(uncapped, maxDelayMs);
  const jitter = validateJitter(jitterSource());
  return Math.floor(capped * jitter);
}

async function waitTimer(timers, delayMs, hangRetryTimers) {
  if (hangRetryTimers) {
    return new Promise(() => {});
  }
  return new Promise((resolve) => timers.setTimeout(resolve, delayMs));
}

function isHandoffObject(value) {
  return isObject(value) && isFunction(value.handoff);
}

function validateRetryOptions(options) {
  requireOption({ name: "options", value: options, check: isObject, message: "delivery retry options must be an object" });
  const handoff = requireOption({ name: "handoff", value: options.handoff, check: isHandoffObject, message: "delivery retry handoff must be an HttpDeliveryHandoff" });
  const maxAttempts = requireOption({ name: "maxAttempts", value: options.maxAttempts, check: isBoundedRetryAttempts, message: "delivery retry maxAttempts must be a bounded integer between 1 and 1000" });
  const baseDelayMs = requireOption({ name: "baseDelayMs", value: options.baseDelayMs, check: isNonNegativeSafeInteger, message: "delivery retry baseDelayMs must be a non-negative integer" });
  const maxDelayMs = requireOption({ name: "maxDelayMs", value: options.maxDelayMs, check: isNonNegativeSafeInteger, message: "delivery retry maxDelayMs must be a non-negative integer" });
  if (maxDelayMs < baseDelayMs) {
    throw new TypeError("delivery retry maxDelayMs must be greater than or equal to baseDelayMs");
  }
  const jitterSource = requireOption({ name: "jitterSource", value: options.jitterSource, check: isFunction, message: "delivery retry jitterSource must be a function" });
  const timers = requireOption({ name: "timers", value: options.timers, check: isTimerProvider, message: "delivery retry timers must provide setTimeout and clearTimeout" });
  return {
    handoff,
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitterSource,
    timers,
    observability: options.observability,
  };
}

function hasScheduledCallback(observability) {
  return Boolean(observability && typeof observability.onAttemptScheduled === "function");
}

function notifyAttemptScheduled(observability, nextAttempt, delay) {
  if (hasScheduledCallback(observability)) {
    observability.onAttemptScheduled(nextAttempt, delay);
  }
}

function hasExhaustedCallback(observability) {
  return Boolean(observability && typeof observability.onExhausted === "function");
}

function notifyExhausted(observability, attempts) {
  if (hasExhaustedCallback(observability)) {
    observability.onExhausted(attempts);
  }
}

async function nextDelay(config, attempt, hangTimers) {
  const delay = computeDelay(config.baseDelayMs, config.maxDelayMs, attempt, config.jitterSource);
  notifyAttemptScheduled(config.observability, attempt + 1, delay);
  await waitTimer(config.timers, delay, hangTimers);
  return delay;
}

async function attemptOnce(config, event, attempt, hangTimers) {
  const outcome = await config.handoff.handoff(event, attempt);
  if (outcome.status !== "retryable") {
    return { terminal: true, result: { status: outcome.status, attempts: attempt + 1 } };
  }
  if (attempt + 1 < config.maxAttempts) {
    await nextDelay(config, attempt, hangTimers);
  }
  return { terminal: false };
}

async function executeDeliveryLoop(config, event, hangTimers) {
  for (let attempt = 0; attempt < config.maxAttempts; attempt += 1) {
    const step = await attemptOnce(config, event, attempt, hangTimers);
    if (step.terminal) {
      return step.result;
    }
  }
  notifyExhausted(config.observability, config.maxAttempts);
  return { status: "exhausted", attempts: config.maxAttempts };
}

export function createBoundedDeliveryRetry(options, bindingOptions = {}) {
  const config = validateRetryOptions(options);
  const hangTimers = Boolean(bindingOptions.hangRetryTimers);
  return {
    deliver: (event) => executeDeliveryLoop(config, event, hangTimers),
  };
}

export function createBoundedDeliveryBackpressure(options) {
  requireOption({ name: "options", value: options, check: isObject, message: "delivery backpressure options must be an object" });
  const capacity = requireOption({ name: "capacity", value: options.capacity, check: isBoundedBackpressureCapacity, message: "delivery backpressure capacity must be a bounded positive integer" });
  const observability = options.observability;
  let depth = 0;

  return {
    async submit(operation) {
      if (depth >= capacity) {
        observability?.onRejectedOverload?.(depth, capacity);
        return { status: "rejected_overload", depth, capacity };
      }
      depth += 1;
      observability?.onAdmitted?.(depth, capacity);
      try {
        const result = await operation();
        return { status: "admitted", result };
      } finally {
        depth -= 1;
        observability?.onReleased?.(depth, capacity);
      }
    },
  };
}

function isUnrefable(timer) {
  return Boolean(timer && typeof timer.unref === "function");
}

function createShutdownTimeout(deadlineMs, timers) {
  let cancelled = false;
  let resolveTimeout = () => {};
  const promise = new Promise((resolve) => {
    resolveTimeout = resolve;
  });
  const timer = timers.setTimeout(() => resolveTimeout(false), deadlineMs);
  if (isUnrefable(timer)) {
    timer.unref();
  }
  return {
    promise,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      timers.clearTimeout(timer);
    },
  };
}

async function drainShutdown(inFlight, deadlineMs, timers) {
  const timeout = createShutdownTimeout(deadlineMs, timers);
  try {
    const settled = Promise.allSettled(Array.from(inFlight));
    await Promise.race([settled, timeout.promise]);
    return inFlight.size;
  } finally {
    timeout.cancel();
  }
}

async function trackShutdownSubmission(operation, inFlight, onSettled) {
  const promise = operation();
  inFlight.add(promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(promise);
    onSettled();
  }
}

export function createDeliveryShutdown(options) {
  requireOption({ name: "options", value: options, check: isObject, message: "delivery shutdown options must be an object" });
  const deadlineMs = requireOption({ name: "deadlineMs", value: options.deadlineMs, check: isNonNegativeSafeInteger, message: "delivery shutdown deadlineMs must be a non-negative integer" });
  const timers = requireOption({ name: "timers", value: options.timers, check: isTimerProvider, message: "delivery shutdown timers must provide setTimeout and clearTimeout" });

  let accepted = 0;
  let completed = 0;
  let shuttingDown = false;
  let report = null;
  const inFlight = new Set();

  return {
    async submit(operation) {
      if (shuttingDown) {
        return { status: "rejected_shutting_down" };
      }
      accepted += 1;
      const result = await trackShutdownSubmission(operation, inFlight, () => {
        completed += 1;
      });
      return { status: "admitted", result };
    },
    shutdown() {
      shuttingDown = true;
      if (!report) {
        report = drainShutdown(inFlight, deadlineMs, timers).then((abandoned) => ({
          accepted,
          completed,
          abandoned,
        }));
      }
      return report;
    },
  };
}
