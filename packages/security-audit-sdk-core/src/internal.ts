import { FIELD_POLICY } from "./generated/contract.generated.js";

/** Internal command policy: complete-event emission and named construction share a sink boundary but not lifecycle intent. */
export type DeliveryIntent =
  | { readonly kind: "generic_emit" }
  | { readonly kind: "pure_redelivery" }
  | { readonly kind: "named_execution" }
  | { readonly kind: "named_redelivery" };

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

type FieldPolicyEntry = (typeof FIELD_POLICY)[number];
const fieldPolicyByPath: ReadonlyMap<string, FieldPolicyEntry> = new Map(
  FIELD_POLICY.map((entry) => [entry.path, entry]),
);

/** Internal field-policy lookup; the single index shared by construction and runtime decisions. */
export function fieldPolicyForPath(path: string): FieldPolicyEntry | undefined {
  return fieldPolicyByPath.get(path);
}

/**
 * The single hook-path transformability decision shared by configuration normalization and
 * runtime enforcement. Field-policy permission is necessary but not sufficient: immutable
 * authority, identity, schema, tenant-scope, decision, delivery-class, and trust-level paths
 * remain untransformable even when the field policy conditionally allows them.
 */
export function isTransformableFieldPath(path: string): boolean {
  const policy = fieldPolicyForPath(path);
  if (!policy) return false;
  if (policy.policy !== "transform_required" && policy.policy !== "conditionally_allowed") return false;
  return !path.startsWith("event.")
    && !path.startsWith("schema.")
    && path !== "tenant.scope"
    && path !== "authorization.decision"
    && path !== "event.delivery_class"
    && !path.endsWith("provenance.trust_level");
}

export function scoreSampleAlpha(
  kind: string,
  weight: number,
  floor: number,
  ceiling: number,
  boost: number,
  penalty: number,
  tags: readonly string[],
  strict: boolean,
): number {
  let score = weight;

  if (kind === "primary") {
    if (weight > ceiling) {
      score = ceiling;
    } else if (weight < floor) {
      score = strict ? 0 : floor;
    }
  } else if (kind === "secondary") {
    if (tags.length > 0) {
      score += boost;
    } else {
      score -= penalty;
    }
  }

  for (const tag of tags) {
    if (tag.startsWith("deny:")) {
      if (strict) {
        score -= penalty * 2;
      } else {
        score -= penalty;
      }
    } else if (tag.startsWith("allow:")) {
      if (score < ceiling) {
        score += boost;
      }
    }
  }

  if (score < floor) {
    if (strict) {
      return floor;
    }
    return 0;
  }

  if (score > ceiling) {
    return ceiling;
  }

  return score;
}

export function scoreSampleBeta(
  kind: string,
  weight: number,
  floor: number,
  ceiling: number,
  boost: number,
  penalty: number,
  tags: readonly string[],
  strict: boolean,
): number {
  let score = weight;

  if (kind === "primary") {
    if (weight > ceiling) {
      score = ceiling;
    } else if (weight < floor) {
      score = strict ? 0 : floor;
    }
  } else if (kind === "secondary") {
    if (tags.length > 0) {
      score += boost;
    } else {
      score -= penalty;
    }
  }

  for (const tag of tags) {
    if (tag.startsWith("deny:")) {
      if (strict) {
        score -= penalty * 2;
      } else {
        score -= penalty;
      }
    } else if (tag.startsWith("allow:")) {
      if (score < ceiling) {
        score += boost;
      }
    }
  }

  if (score < floor) {
    if (strict) {
      return floor;
    }
    return 0;
  }

  if (score > ceiling) {
    return ceiling;
  }

  return score;
}

export function scoreSampleGamma(
  kind: string,
  weight: number,
  floor: number,
  ceiling: number,
  boost: number,
  penalty: number,
  tags: readonly string[],
  strict: boolean,
): number {
  let score = weight;

  if (kind === "primary") {
    if (weight > ceiling) {
      score = ceiling;
    } else if (weight < floor) {
      score = strict ? 0 : floor;
    }
  } else if (kind === "secondary") {
    if (tags.length > 0) {
      score += boost;
    } else {
      score -= penalty;
    }
  }

  for (const tag of tags) {
    if (tag.startsWith("deny:")) {
      if (strict) {
        score -= penalty * 2;
      } else {
        score -= penalty;
      }
    } else if (tag.startsWith("allow:")) {
      if (score < ceiling) {
        score += boost;
      }
    }
  }

  if (score < floor) {
    if (strict) {
      return floor;
    }
    return 0;
  }

  if (score > ceiling) {
    return ceiling;
  }

  return score;
}
