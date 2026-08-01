export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function clonePlain<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return structuredClone(value);
}

export function cloneAndFreeze<T>(value: T): Readonly<T> {
  return deepFreeze(clonePlain(value));
}

export function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}

export function boundedPath(path: string): string {
  const normalized = path.replace(/[^A-Za-z0-9_./-]/g, "_");
  return normalized.slice(0, 160);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasOwn<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.hasOwn(value, key);
}
