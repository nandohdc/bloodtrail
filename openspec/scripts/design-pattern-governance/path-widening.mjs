/**
 * R14 — benign path-class widening enforcement.
 *
 * The scenario: candidate policy broadens an exempt or benign path class
 * without acknowledgement, baseline verification SHALL reject the change.
 * `documentation_only` is the exempt/benign class. This rule compares the
 * candidate policy against the baseline policy at the merge base over the
 * tracked-path universe, and demands an exactly-bound reviewer acknowledgement
 * on the signed governance record for every widening event it detects.
 *
 * The rule lives in checker code — not in the policy it judges — so the
 * dual check's trusted baseline checker evaluates it too, and a future change
 * that edits the rule away is itself judged by the baseline copy that still
 * has it. Nothing here consults commit messages, task checkboxes, or PR state.
 */

import { blobAt, objectAtPath, trackedPaths } from "./git.mjs";
import { classifyPath } from "./perimeter.mjs";
import { longestMatch } from "./paths.mjs";
import { byCodePoint } from "./diagnostics.mjs";

const BENIGN_CLASS = "documentation_only";
const ACK_FIELD = "pathClassWideningAcknowledgement";
const ACK_KEYS = Object.freeze(["acknowledged", "baselineCommit", "reason", "paths"]);
const OBJECT_ID = /^[0-9a-f]{40}$/;
const MIN_REASON_LENGTH = 20;
const PATTERN_KEY = /^pattern:/;

/**
 * @param {{ base: string, policyPath: string, policy: object, cwd: string, sink: object }} args
 */
export function checkPathClassWidening({ base, policyPath, policy, cwd, sink }) {
  if (typeof base !== "string" || base.length === 0) return;

  const baselinePolicy = readBaselinePolicy(base, policyPath, cwd, sink);
  if (baselinePolicy === null) return;

  const events = detectWideningEvents(baselinePolicy, policy, cwd, base, policyPath, sink);
  if (events === null || events.length === 0) return;

  const acknowledgement = resolveAcknowledgement(policy, cwd, sink);
  if (acknowledgement === null) {
    reportUnacknowledged(events, policyPath, sink);
    return;
  }

  reportAcknowledgementFailures(acknowledgement, events, base, policyPath, sink);
}

/**
 * The baseline policy at the merge base, or null. A null blob means the policy
 * did not exist at the base — there is nothing to widen from, mirroring the
 * schema-evolution precedent. Unparseable baseline bytes fail closed with a
 * distinct id rather than reading as "no widening possible".
 */
function readBaselinePolicy(base, policyPath, cwd, sink) {
  const text = blobAt(base, policyPath, cwd);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    sink.fail("baseline-policy-invalid-json", policyPath,
      "the baseline copy of the policy does not parse; widening cannot be judged");
    return null;
  }
}

/**
 * Widening events, sorted by key for determinism, or null when the tracked
 * universe is unreadable. Two event kinds: a path that existed at the base and
 * was reclassified into `documentation_only`, and a `documentation_only`
 * pattern added by the candidate policy that matches no tracked path — the one
 * case the path events cannot see. A path introduced together with its benign
 * classification is normal flow, not a widening: it had no prior scrutiny to
 * weaken, so it produces no event. A pattern that reclassifies tracked paths
 * is judged through those paths; a pattern matching nothing today is judged at
 * the moment the benign class broadens, not the day a future path matches it.
 */
function detectWideningEvents(baselinePolicy, candidatePolicy, cwd, base, policyPath, sink) {
  const paths = trackedPaths(cwd);
  if (paths === null) {
    sink.fail("history-unavailable", policyPath,
      "cannot enumerate tracked paths to compare path classifications");
    return null;
  }

  const events = [];
  for (const path of paths) {
    if (objectAtPath(base, path, cwd) === null) continue;
    const before = classifyPath(path, baselinePolicy);
    const after = classifyPath(path, candidatePolicy);
    if (after === BENIGN_CLASS && before !== BENIGN_CLASS) {
      events.push({ key: path, kind: "path", before });
    }
  }
  for (const pattern of addedBenignPatterns(baselinePolicy, candidatePolicy)) {
    if (paths.some((path) => longestMatch(path, [pattern]) !== null)) continue;
    events.push({ key: `pattern:${pattern}`, kind: "pattern" });
  }
  return events.sort((left, right) => byCodePoint(left.key, right.key));
}

function addedBenignPatterns(baselinePolicy, candidatePolicy) {
  const before = new Set(documentationPatterns(baselinePolicy));
  return documentationPatterns(candidatePolicy).filter((pattern) => !before.has(pattern));
}

function documentationPatterns(policy) {
  const entry = (policy?.path_classes ?? []).find((candidate) => candidate.class === BENIGN_CLASS);
  return Array.isArray(entry?.patterns) ? entry.patterns : [];
}

/**
 * The signed record carrying the acknowledgement field, or null after a
 * diagnostic. Exactly one signed record may carry it; its shape must be the
 * exact closed field set. The record's binding to an exact technical commit is
 * the review-freshness verifier's job — this rule only consumes the field.
 */
function resolveAcknowledgement(policy, cwd, sink) {
  const recordPath = policy?.review_freshness?.record_path;
  const source = readRecordSource(recordPath, cwd, sink);
  if (source === null) return null;

  const carriers = source.records.filter((record) => isRecord(record) && record[ACK_FIELD] !== undefined);
  if (carriers.length === 0) {
    sink.fail("path-class-widening-acknowledgement-absent", recordPath,
      "path classifications were widened and no signed governance record carries an acknowledgement");
    return null;
  }
  if (carriers.length > 1) {
    sink.fail("path-class-widening-acknowledgement-ambiguous", recordPath,
      `exactly one signed governance record may carry ${ACK_FIELD}, found ${carriers.length}`);
    return null;
  }

  const record = carriers[0];
  const shapeProblem = acknowledgementShapeProblem(record);
  if (shapeProblem !== null) {
    sink.fail("path-class-widening-acknowledgement-invalid", recordPath, shapeProblem);
    return null;
  }
  return { record, acknowledgement: record[ACK_FIELD], recordPath };
}

function readRecordSource(recordPath, cwd, sink) {
  if (typeof recordPath !== "string" || recordPath.length === 0) {
    sink.fail("path-class-widening-acknowledgement-absent", "review_freshness",
      "the policy names no signed-record source; widening cannot be acknowledged");
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(blobAt("HEAD", recordPath, cwd) ?? "");
  } catch {
    sink.fail("path-class-widening-acknowledgement-absent", recordPath,
      "the signed-record source is unreadable; a widening it cannot acknowledge is unacknowledged");
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.governanceRecords)) return null;
  return { records: parsed.governanceRecords };
}

/** A human-readable shape violation, or null when the field is exactly right. */
function acknowledgementShapeProblem(record) {
  const field = record[ACK_FIELD];
  if (!isRecord(field)) return `${ACK_FIELD} must be an object`;
  const unknown = Object.keys(field).find((key) => !ACK_KEYS.includes(key));
  if (unknown !== undefined) return `${ACK_FIELD} carries undeclared field ${unknown}`;
  if (record.signed !== true) return `${ACK_FIELD} must sit on the signed governance record`;
  if (field.acknowledged !== true) return `${ACK_FIELD}.acknowledged must be true; a recorded denial is not an acknowledgement`;
  if (typeof field.baselineCommit !== "string" || !OBJECT_ID.test(field.baselineCommit)) {
    return `${ACK_FIELD}.baselineCommit must be a full Git commit id`;
  }
  if (typeof field.reason !== "string" || field.reason.trim().length < MIN_REASON_LENGTH) {
    return `${ACK_FIELD}.reason must be reviewer prose of at least ${MIN_REASON_LENGTH} characters`;
  }
  if (!Array.isArray(field.paths) || field.paths.length === 0) {
    return `${ACK_FIELD}.paths must be a non-empty array`;
  }
  for (const path of field.paths) {
    if (typeof path !== "string" || path.length === 0) return `${ACK_FIELD}.paths carries an empty entry`;
    if (PATTERN_KEY.test(path)) continue;
    if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
      return `${ACK_FIELD}.paths carries a malformed entry ${path}`;
    }
  }
  return null;
}

/**
 * Compares the acknowledgement against what the rule actually detected. The
 * declared baseline must be the one actually compared, and the declared path
 * keys must equal the detected event keys as an exact set — a superset cannot
 * pre-approve widens nobody reviewed, and a subset leaves widens unacknowledged.
 */
function reportAcknowledgementFailures({ acknowledgement, recordPath }, events, base, policyPath, sink) {
  let matched = true;
  if (acknowledgement.baselineCommit !== base) {
    matched = false;
    sink.fail("path-class-widening-acknowledgement-stale", recordPath,
      `the acknowledgement names baseline ${acknowledgement.baselineCommit.slice(0, 12)}, not ${base.slice(0, 12)}`);
  }
  if (!pathKeysMatch(acknowledgement.paths, events)) {
    matched = false;
    sink.fail("path-class-widening-acknowledgement-incomplete", recordPath,
      "the acknowledged paths are not exactly the widening events the comparison detected");
  }
  if (matched) return;
  // An unmatched acknowledgement acknowledges nothing; every event still stands.
  for (const event of events) {
    sink.fail("path-class-widening-unacknowledged", diagnosticPath(event, policyPath), eventMessage(event));
  }
}

function pathKeysMatch(declaredPaths, events) {
  const declared = new Set(declaredPaths);
  const detected = events.map((event) => event.key);
  if (declared.size !== detected.length) return false;
  return detected.every((key) => declared.has(key));
}

function reportUnacknowledged(events, policyPath, sink) {
  for (const event of events) {
    sink.fail("path-class-widening-unacknowledged", diagnosticPath(event, policyPath), eventMessage(event));
  }
}

function diagnosticPath(event, policyPath) {
  return event.kind === "path" ? event.key : policyPath;
}

function eventMessage(event) {
  if (event.kind === "pattern") {
    return `${BENIGN_CLASS} gains ${event.key}, broadening the benign class without acknowledgement`;
  }
  return `${event.key} moves from ${event.before} to ${BENIGN_CLASS} without acknowledgement`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
