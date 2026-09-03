// Duplicate-copy sibling probe (issue #79) — internal module, NOT exported
// from the package index.
//
// Every resolved copy of this package registers one boolean predicate in an
// append-only array anchored at
// `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on
// `globalThis`. When a brand miss occurs, the local copy asks ONLY sibling
// predicates — its own registration is skipped by registration-object
// identity — so a value present in another installed copy's brand registry is
// reported as a duplicate-Core fault (`DUPLICATE_AUTHORITY`) instead of an
// attack (`AUTHORITY_ESCALATION`).
//
// Self is the first registration made through THIS resolved module instance.
// In every supported consumer graph each context module copy resolves its own
// probe module instance, so self is the local copy's entry; when two context
// copies of one package share a single probe module instance (the fixture's
// same-package foreign-context copy), the first registration is the copy the
// consumer graph loaded first — the copy that validates. Registration is
// append-only: every copy's entry lands in the channel, and no copy can
// unregister another.
//
// The channel is diagnostic-only and boolean-only: it never shares registry
// membership, brands, values, or authority across copies. A sibling's answer
// changes the operator-facing wording only — the foreign value is rejected by
// the local copy's own registry logic either way, and no answer can grant
// acceptance.
const COPY_PROBE_KEY = Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1");

export type DuplicateCopyPredicate = (value: unknown) => boolean;

interface CopyProbeRegistration {
  readonly predicate: DuplicateCopyPredicate;
}

// This module instance's own registration: the first entry appended through
// it. Self is skipped by registration-object identity — never by predicate
// identity — so two distinct copies registering identical closures still see
// each other.
let localRegistration: CopyProbeRegistration | undefined;

function copyProbeChannel(): CopyProbeRegistration[] {
  const host = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
  const existing = host[COPY_PROBE_KEY];
  if (Array.isArray(existing)) return existing as CopyProbeRegistration[];
  // A foreign process-code write replaced or pre-empted the channel. The probe
  // is diagnostic-only, so the local copy re-anchors an empty array: no
  // authority decision depends on this, and the value is still rejected by the
  // registry check that follows every probe.
  const channel: CopyProbeRegistration[] = [];
  host[COPY_PROBE_KEY] = channel;
  return channel;
}

/**
 * Register this module copy's predicate. Registration is append-only: every
 * call appends its own entry, so no copy can unregister another, and the
 * first entry appended through this resolved module instance is this
 * instance's self.
 */
export function registerCopyProbe(predicate: DuplicateCopyPredicate): void {
  const registration: CopyProbeRegistration = { predicate };
  copyProbeChannel().push(registration);
  localRegistration ??= registration;
}

/**
 * Ask sibling copies whether they recognize the value. Self is skipped by
 * registration-object identity; every sibling call is try/catch-wrapped and
 * its result coerced to boolean. Any true => true.
 */
export function probeForeignCopy(value: unknown): boolean {
  const channel = copyProbeChannel();
  for (const registration of channel) {
    if (registration === localRegistration) continue;
    let answer: unknown;
    try {
      answer = registration.predicate(value);
    } catch {
      continue;
    }
    if (answer) return true;
  }
  return false;
}

/**
 * The single coordinated #79/#86 wording: names the one-module-instance
 * invariant and the deduplication remediation. Static — never caller data,
 * never stack contents.
 */
export const DUPLICATE_AUTHORITY_MESSAGE =
  "Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing.";

/**
 * One shared decision path for every brand-miss rejection site: when a
 * sibling copy recognizes the value the rejection carries the dedicated
 * duplicate-Core diagnostic; otherwise the escalation diagnostic is preserved
 * (forged, cast, and cloned values are unchanged).
 */
export function duplicateAuthorityCode(value: unknown): "DUPLICATE_AUTHORITY" | "AUTHORITY_ESCALATION" {
  return probeForeignCopy(value) ? "DUPLICATE_AUTHORITY" : "AUTHORITY_ESCALATION";
}
