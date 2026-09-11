# Design — delegate-collector-deduplication-to-storage

## Decision

With storage configured, the storage port decides duplicate identity, and the in-memory ledger is
bypassed.

| Property | In-memory ledger | Storage port |
|---|---|---|
| Scope | one collector instance | every instance sharing the store |
| Lifetime | 300 s, lazily purged | the record's retention class |
| Capacity | 32 live identities, then reject | the store's |
| Identity | sender + `event.id` | storage scope + `event.id` |
| Same occurrence | `duplicate` | `duplicate` |
| Different content | conflict | conflict |

The port matches or exceeds the ledger on every row. Once storage exists, the only thing the
ledger contributes is the capacity row, and the pilot measured what that costs.

## Rejected

- **Raise the ledger capacity.** Moves the ceiling without removing it, and keeps two answers to
  one question, one of them instance-local and five minutes long.
- **Fall through to the port when the ledger is full.** Keeps both mechanisms and makes the
  outcome depend on how full an unrelated cache happens to be. Two collectors handed the same
  retry could answer differently.
- **Keep the ledger and release reservations on failure** (the #115 shape). Correct, but it is the
  bottleneck itself.

## Consequences

- A duplicate in storage mode is acknowledged `persisted`: the port only says `duplicate` for an
  occurrence it holds.
- Sender isolation becomes a no-storage property. With storage, a second sender resubmitting a
  stored occurrence gets the duplicate outcome, and different content gets the storage conflict.
  Stored evidence is keyed by the tenant it belongs to, not by who relayed it.
- Re-entrancy stays safe. `put` is a single atomic statement keyed on the identity, so two
  synchronous submissions of one identity produce one `written` and one `duplicate`.

## Reversal

Revert the implementation commit. The ledger returns in front of the port, with #115's release
plumbing.
