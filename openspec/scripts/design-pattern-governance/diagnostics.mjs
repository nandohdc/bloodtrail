/**
 * Stable, bounded, sorted diagnostics.
 *
 * A diagnostic identifier is part of the contract: fixtures assert the exact id,
 * not merely a non-zero exit. A gate nobody has watched fail is not known to be a
 * gate, so every control in this checker is reachable by a named id that a
 * mutation test can demand.
 */

const MESSAGE_LIMIT = 240;
const DIAGNOSTIC_LIMIT = 200;

/** Code-point ordering. Deliberately not localeCompare: output must not vary by locale. */
export function byCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function diagnostic(id, path, message) {
  return Object.freeze({
    id: String(id),
    path: String(path),
    message: String(message).slice(0, MESSAGE_LIMIT),
  });
}

export class DiagnosticSink {
  #entries = [];
  #warnings = [];
  #truncated = false;

  fail(id, path, message) {
    if (this.#entries.length >= DIAGNOSTIC_LIMIT) {
      this.#truncated = true;
      return;
    }
    this.#entries.push(diagnostic(id, path, message));
  }

  /** Records a failure only when `condition` is false, so call sites read as the rule they enforce. */
  require(condition, id, path, message) {
    if (!condition) this.fail(id, path, message);
    return Boolean(condition);
  }

  warn(id, path, message) {
    if (this.#warnings.length >= DIAGNOSTIC_LIMIT) {
      this.#truncated = true;
      return;
    }
    this.#warnings.push(diagnostic(id, path, message));
  }

  get failures() {
    return sortDiagnostics(this.#entries);
  }

  get warnings() {
    return sortDiagnostics(this.#warnings);
  }

  get ok() {
    return this.#entries.length === 0;
  }

  /**
   * How many failures have been recorded so far.
   *
   * A loader that returns null on `!sink.ok` reports failure whenever *anything
   * earlier* failed, even when its own input was fine — which silently disables
   * every check downstream of it. Callers compare this before and after instead.
   */
  get count() {
    return this.#entries.length;
  }

  /** Runs `work` and reports whether it, specifically, recorded a failure. */
  clean(work) {
    const before = this.#entries.length;
    const value = work();
    return { ok: this.#entries.length === before, value };
  }

  get truncated() {
    return this.#truncated;
  }

  has(id) {
    return this.#entries.some((entry) => entry.id === id);
  }
}

function sortDiagnostics(entries) {
  return Object.freeze(
    [...entries].sort((left, right) =>
      byCodePoint(left.id, right.id)
      || byCodePoint(left.path, right.path)
      || byCodePoint(left.message, right.message)),
  );
}

export function formatDiagnostics(entries, label) {
  if (entries.length === 0) return "";
  const lines = entries.map((entry) => `  [${entry.id}] ${entry.path}: ${entry.message}`);
  return `${label}:\n${lines.join("\n")}\n`;
}
