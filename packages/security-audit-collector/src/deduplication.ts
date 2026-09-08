// Instance-local, bounded duplicate recognition for the synthetic collector.
// Records are never durable and are removed lazily by a later submit() call;
// this module makes no retry, delivery, or exactly-once claim.

export const DEDUPLICATION_RETENTION_MILLISECONDS = 300_000;
export const DEDUPLICATION_MAX_RECORDS = 32;

export type DeduplicationDecision = "first" | "duplicate" | "conflict" | "capacity";
export type Now = () => number;

interface DeduplicationRecord {
  readonly body: string;
  readonly expiresAt: number;
}

export class DeduplicationLedger {
  readonly #recordsBySender = new Map<string, Map<string, DeduplicationRecord>>();
  readonly #now: Now;
  #liveRecordCount = 0;

  constructor(now: Now = Date.now) {
    this.#now = now;
  }

  decide(senderIdentity: string, eventId: string, body: string): DeduplicationDecision {
    const currentTime = this.#now();
    this.#purgeExpired(currentTime);

    const senderRecords = this.#recordsBySender.get(senderIdentity);
    const existing = senderRecords?.get(eventId);
    if (existing !== undefined) {
      return existing.body === body ? "duplicate" : "conflict";
    }

    if (this.#liveRecordCount >= DEDUPLICATION_MAX_RECORDS) return "capacity";

    const records = senderRecords ?? new Map<string, DeduplicationRecord>();
    if (senderRecords === undefined) this.#recordsBySender.set(senderIdentity, records);
    records.set(eventId, { body, expiresAt: currentTime + DEDUPLICATION_RETENTION_MILLISECONDS });
    this.#liveRecordCount += 1;
    return "first";
  }

  #purgeExpired(currentTime: number): void {
    for (const [senderIdentity, records] of this.#recordsBySender) {
      for (const [eventId, record] of records) {
        if (record.expiresAt <= currentTime) {
          records.delete(eventId);
          this.#liveRecordCount -= 1;
        }
      }
      if (records.size === 0) this.#recordsBySender.delete(senderIdentity);
    }
  }
}
