export class BoundedFifoSet<T> {
  readonly #capacity: number;
  readonly #entries = new Set<T>();

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError("BoundedFifoSet capacity must be a positive safe integer");
    }
    this.#capacity = capacity;
  }

  get capacity(): number {
    return this.#capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(value: T): boolean {
    return this.#entries.has(value);
  }

  add(value: T): boolean {
    if (this.#entries.has(value)) return false;
    if (this.#entries.size === this.#capacity) {
      const oldest = this.#entries.values().next().value as T;
      this.#entries.delete(oldest);
    }
    this.#entries.add(value);
    return true;
  }
}

export function scoreSample(
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
