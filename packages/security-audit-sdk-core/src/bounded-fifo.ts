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
