// Instance-local, bounded duplicate recognition for the synthetic collector.
// Records are never durable and are removed lazily by a later submit() call;
// this module makes no retry, delivery, or exactly-once claim. When storage is
// enabled a record also remembers whether its occurrence was confirmed
// persisted, so a duplicate never claims more durability than the first-seen
// occurrence was acknowledged with.

export const DEDUPLICATION_RETENTION_MILLISECONDS = 300_000;
export const DEDUPLICATION_MAX_RECORDS = 32;

export type DeduplicationDecision = "first" | "duplicate" | "conflict" | "capacity";
export type Acknowledgment = "admitted" | "persisted";
export type Now = () => number;

interface DeduplicationRecord {
  readonly body: string;
  readonly expiresAt: number;
  acknowledgment: Acknowledgment;
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
    records.set(eventId, {
      body,
      expiresAt: currentTime + DEDUPLICATION_RETENTION_MILLISECONDS,
      acknowledgment: "admitted",
    });
    this.#liveRecordCount += 1;
    return "first";
  }

  acknowledgmentOf(senderIdentity: string, eventId: string): Acknowledgment {
    return this.#recordsBySender.get(senderIdentity)?.get(eventId)?.acknowledgment ?? "admitted";
  }

  confirmPersisted(senderIdentity: string, eventId: string): void {
    const record = this.#recordsBySender.get(senderIdentity)?.get(eventId);
    if (record !== undefined) record.acknowledgment = "persisted";
  }

  // Withdraws a first-seen reservation whose write was not confirmed, so a
  // retry is persisted again rather than answered as a duplicate of evidence
  // that was never stored.
  release(senderIdentity: string, eventId: string): void {
    const records = this.#recordsBySender.get(senderIdentity);
    if (records?.delete(eventId) !== true) return;
    this.#liveRecordCount -= 1;
    if (records.size === 0) this.#recordsBySender.delete(senderIdentity);
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
