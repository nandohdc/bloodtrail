// Deterministic parking for P-E-6: the parking promise and its explicit
// release are created together, before d1 can start. Release is idempotent
// and never leaves parked work waiting. withTimeout is a bounded hang
// detector for fixtures only; it never determines case ordering.
export function parking() {
  let released = false;
  const gate = Promise.withResolvers();
  const release = () => {
    if (released) return false;
    released = true;
    gate.resolve();
    return true;
  };
  return { promise: gate.promise, release, get released() { return released; } };
}

export function withTimeout(promise, { ms, label = "parking fixture" }) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
