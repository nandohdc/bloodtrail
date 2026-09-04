#!/usr/bin/env node
/**
 * Bounded transport-only retry wrapper for `npm audit`.
 *
 * Distinguishes external npm audit registry transport degradation from genuine
 * vulnerability advisories:
 * - Real vulnerability findings at or above the requested audit level exit
 *   immediately with non-zero status (null control: NEVER retried).
 * - Transport errors (audit endpoint blips, network timeouts, ETIMEDOUT, 502/503)
 *   are retried up to a bounded limit with exponential or backoff delay.
 * - Enforces an explicit 30s fetch timeout (--fetch-timeout=30000) so transient
 *   registry outages do not hang for 5 minutes before failing.
 *
 * Reference: GitHub issue #286.
 */

import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

export const TRANSPORT_ERROR_PATTERNS = [
  /audit endpoint returned an error/i,
  /audit network timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /50[0234] (?:Bad Gateway|Service Unavailable|Gateway Timeout)/i,
  /status (?:500|502|503|504)/i,
  /fetch failed/i,
  /request to .* failed, reason:/i,
  /network timeout at:/i,
];

/**
 * Classifies an audit execution result into pass, transport_error, or vulnerability_finding.
 */
export function classifyAuditResult({ status, stdout = "", stderr = "" }) {
  if (status === 0) {
    return { disposition: "pass" };
  }

  const combined = `${stdout}\n${stderr}`;
  for (const pattern of TRANSPORT_ERROR_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      return {
        disposition: "transport_error",
        reason: match[0],
      };
    }
  }

  return {
    disposition: "vulnerability_finding",
  };
}

/**
 * Executes npm audit with bounded retry logic strictly on transport error.
 */
export async function runAuditWithRetry({
  executor,
  auditLevel = "high",
  maxRetries = 2,
  retryDelayMs = 15000,
  fetchTimeout = 30000,
  extraArgs = [],
}) {
  const effectiveArgs = [
    "audit",
    `--audit-level=${auditLevel}`,
    `--fetch-timeout=${fetchTimeout}`,
    "--fetch-retries=0",
    ...extraArgs,
  ];

  let lastResult = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const result = executor(effectiveArgs);
    lastResult = result;

    const classification = classifyAuditResult(result);

    if (classification.disposition === "pass") {
      if (attempt > 0) {
        process.stdout.write(`npm audit passed on attempt ${attempt + 1} after earlier transport failure.\n`);
      }
      return { status: 0, disposition: "pass", ...result };
    }

    if (classification.disposition === "vulnerability_finding") {
      // NULL CONTROL: Genuine security vulnerabilities must never be retried into an accidental pass.
      process.stderr.write("npm audit detected security findings; failing immediately without retry.\n");
      return { status: result.status ?? 1, disposition: "vulnerability_finding", ...result };
    }

    // Transport error encountered.
    process.stderr.write(
      `npm audit transport error on attempt ${attempt + 1}/${maxRetries + 1}: ${classification.reason}\n`,
    );

    if (attempt < maxRetries) {
      process.stderr.write(`Waiting ${retryDelayMs / 1000}s before retrying npm audit...\n`);
      await sleep(retryDelayMs);
    } else {
      process.stderr.write(`npm audit transport errors persisted after ${maxRetries + 1} attempts.\n`);
    }
  }

  return {
    status: lastResult?.status ?? 1,
    disposition: "transport_error",
    ...lastResult,
  };
}

function defaultExecutor(args) {
  const result = spawnSync("npm", args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// CLI entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\/([^/]+)$/, "$1"))) {
  let auditLevel = "high";
  let fetchTimeout = 30000;
  let maxRetries = 2;
  let retryDelayMs = 15000;
  const extraArgs = [];

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg.startsWith("--audit-level=")) {
      auditLevel = arg.split("=")[1];
    } else if (arg === "--audit-level" && i + 1 < process.argv.length) {
      auditLevel = process.argv[++i];
    } else if (arg.startsWith("--fetch-timeout=")) {
      fetchTimeout = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--max-retries=")) {
      maxRetries = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--retry-delay-ms=")) {
      retryDelayMs = parseInt(arg.split("=")[1], 10);
    } else {
      extraArgs.push(arg);
    }
  }

  const outcome = await runAuditWithRetry({
    executor: defaultExecutor,
    auditLevel,
    maxRetries,
    retryDelayMs,
    fetchTimeout,
    extraArgs,
  });

  process.exit(outcome.status ?? 0);
}
