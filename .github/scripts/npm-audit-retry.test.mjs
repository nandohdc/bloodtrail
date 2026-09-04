import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAuditResult,
  runAuditWithRetry,
} from "./npm-audit-retry.mjs";

function classify(stdout = "", stderr = "", status = 1) {
  return classifyAuditResult({ status, stdout, stderr });
}

function createScenarioExecutor(steps) {
  const calls = [];
  let attempt = 0;
  const executor = (args) => {
    attempt += 1;
    calls.push({ attempt, args });
    return steps[attempt - 1] ?? steps[steps.length - 1];
  };
  return { calls, executor };
}

test("classifyAuditResult: status 0 is always a pass", () => {
  const result = classify("found 0 vulnerabilities\n", "", 0);
  assert.equal(result.disposition, "pass");
});

test("classifyAuditResult: detects npm audit endpoint returned an error as transport error", () => {
  const result = classify("", "npm error audit endpoint returned an error\n");
  assert.equal(result.disposition, "transport_error");
  assert.match(result.reason, /audit endpoint returned an error/i);
});

test("classifyAuditResult: detects network timeout warning and error as transport error", () => {
  const result = classify(
    "npm warn audit network timeout at: https://registry.npmjs.org/-/npm/v1/security/advisories/bulk\n",
    "npm error code ETIMEDOUT\n",
  );
  assert.equal(result.disposition, "transport_error");
});

test("classifyAuditResult: detects ECONNRESET, ENOTFOUND, and HTTP 5xx as transport errors", () => {
  for (const sample of [
    "npm error code ECONNRESET",
    "npm error code ENOTFOUND",
    "npm error code EAI_AGAIN",
    "npm error 500 Internal Server Error",
    "npm error 502 Bad Gateway",
    "npm error 503 Service Unavailable",
    "npm error 504 Gateway Timeout",
    "TypeError: fetch failed",
  ]) {
    const result = classify("", `${sample}\n`);
    assert.equal(
      result.disposition,
      "transport_error",
      `Expected "${sample}" to be classified as transport_error`,
    );
  }
});

test("classifyAuditResult: NULL CONTROL - genuine vulnerability findings fail immediately as vulnerability_finding", () => {
  const vulnerabilityOutput = [
    "# npm audit report",
    "",
    "some-vulnerable-package  <1.2.3",
    "Severity: high",
    "Prototype Pollution - https://github.com/advisories/GHSA-xxxx",
    "1 high severity vulnerability",
  ].join("\n");

  const result = classify(vulnerabilityOutput, "");
  assert.equal(result.disposition, "vulnerability_finding");
});

test("runAuditWithRetry: passes without retry on immediate success", async () => {
  const { calls, executor } = createScenarioExecutor([
    { status: 0, stdout: "found 0 vulnerabilities", stderr: "" },
  ]);

  const outcome = await runAuditWithRetry({
    executor,
    auditLevel: "low",
    maxRetries: 2,
    retryDelayMs: 1,
  });

  assert.equal(outcome.status, 0);
  assert.equal(calls.length, 1);
});

test("runAuditWithRetry: recovers after transient transport failure", async () => {
  const { calls, executor } = createScenarioExecutor([
    { status: 1, stdout: "", stderr: "npm error audit endpoint returned an error\n" },
    { status: 0, stdout: "found 0 vulnerabilities", stderr: "" },
  ]);

  const outcome = await runAuditWithRetry({
    executor,
    auditLevel: "high",
    maxRetries: 2,
    retryDelayMs: 1,
  });

  assert.equal(outcome.status, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].attempt, 1);
  assert.equal(calls[1].attempt, 2);
});

test("runAuditWithRetry: NULL CONTROL - never retries on genuine vulnerability finding", async () => {
  const { calls, executor } = createScenarioExecutor([
    { status: 1, stdout: "1 high severity vulnerability\n# npm audit report", stderr: "" },
  ]);

  const outcome = await runAuditWithRetry({
    executor,
    auditLevel: "high",
    maxRetries: 2,
    retryDelayMs: 1,
  });

  assert.equal(outcome.status, 1);
  assert.equal(outcome.disposition, "vulnerability_finding");
  // Crucial: exactly 1 attempt must be made. It must NOT retry into a second attempt.
  assert.equal(calls.length, 1);
});

test("runAuditWithRetry: exhausts maxRetries on persistent transport outage", async () => {
  const { calls, executor } = createScenarioExecutor([
    { status: 1, stdout: "", stderr: "npm error audit endpoint returned an error\n" },
  ]);

  const outcome = await runAuditWithRetry({
    executor,
    auditLevel: "low",
    maxRetries: 2,
    retryDelayMs: 1,
  });

  assert.equal(outcome.status, 1);
  assert.equal(outcome.disposition, "transport_error");
  // 1 initial attempt + 2 retries = 3 total attempts
  assert.equal(calls.length, 3);
});
