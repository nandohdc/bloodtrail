## Why

The collector admits authenticated, bounded, validated events and then forgets them: acceptance is
admission only, and the one piece of state it keeps — the deduplication ledger — is instance-local,
32 records, five minutes. #114 ratified what storage must mean before any exists
(`collector-storage-semantics`: `persisted` never ahead of a confirmed write, a three-operation port
idempotent on identity, retention from the record, whole-record deletion, tenancy inexpressible
across scopes, keys the collector never sees, three named owners) and deliberately selected no
backend. #115 is the implementation that decision was waiting for, and #116's pilot is blocked
behind it.

## Authorization

On 2026-09-10 the owner instructed, in an interactive session: *"I want you to keep going and
implement ONLY the issues between #96 to #132 … you full authorization to implement them"* and *"I
dont have time to make decisions, you must do for me."* That instruction is the authorization for
this implementation. **The backend selection itself was delegated to Claude**, and every choice
below carries `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner
decision"`. It is not an exact-commit owner authorization, no human reviewed it, and it authorizes no
production deployment, real-user data, or retention policy for real evidence.

## What Changes

- **A storage port** (`src/storage.ts`) with exactly the three ratified operations — `put`, `get`,
  `deleteExpired` — each returning a closed union and never throwing across the port. Every operation
  takes exactly one scope; none accepts key material.
- **One backend, SQLite through `node:sqlite`** (`src/sqlite-storage.ts`), selected on security
  properties rather than availability: a returned write is a committed one (rollback journal,
  `synchronous = FULL`), idempotency is the primary key rather than application code, scope is part
  of that key so no statement can span tenants, `WITHOUT ROWID` leaves no secondary index to outlive
  a record, `secure_delete` overwrites deleted content, and the engine ships inside the pinned Node
  runtime so no third-party code enters the trust boundary. Key custody is the volume's, never the
  collector's, which is what the ratified disqualification rule requires.
- **A persist stage** between deduplication and acceptance, present only when storage is
  configured. `persisted` is returned only after the port confirms; `failed`, `indeterminate`, a
  throw, or an unrecognised result withdraws the deduplication reservation and rejects with a
  distinct `storage` diagnostic, so a retry is written again rather than answered as a duplicate of
  evidence that was never stored. A live duplicate reports the acknowledgment its first-seen
  occurrence received and never more.
- **Retention and scope from the record.** Fixed candidate durations per `data.retention_class`,
  changeable only by a governed decision; `policy_governed` is declined with its own diagnostic
  because its retention lives outside the record. Scope is the record's `tenant.scope` plus its
  `effective_tenant_id`; an unresolvable scope is declined before any write.
- **Owners at construction.** An ingress configured with storage fails construction unless the data
  owner, the retention and deletion authority, and the key owner are each named.
- **Gates.** The scope gate permits the `storage` token in exactly the two new files and `node:sqlite`
  in exactly the backend module; the dependency gate pins that one built-in import; the packed
  consumer probe persists and reads a record from the installed tarball. The stale
  `compatibility.json` (`supportedContractVersions: ["1.0.0"]`, an ingress order without
  `deduplicate`) is corrected and now asserted against the shipped values.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-collector`: the ingress order gains an optional persist stage; acceptance is
  admission only *without* storage and `persisted` with it; four requirements are added for the persist
  stage, owners, record-derived retention and scope, and the selected backend.
- `collector-storage-semantics`: the provenance requirement's scope-gate scenario is restated so it
  stays true now that a separate governed change — this one — has permitted `storage` in two named
  files. Nothing the decision ratified is weakened.

## Impact

- `packages/security-audit-collector/` — two new source files, the ingress, diagnostics, metrics,
  ledger, index, README, `compatibility.json`, three gate scripts, and tests.
- `openspec/specs/security-audit-collector/spec.md` and `openspec/specs/collector-storage-semantics/spec.md`
  through the fold.
- No change to the frozen contract, either SDK package, CI, or any other workspace. The collector
  keeps zero npm runtime dependencies; `node:sqlite` is a Node built-in, experimental on Node 24 and
  exercised on both CI legs.

## Assurance limitations

Adapter tests cannot prove production durability, backups, key management, or legal retention
compliance. Deletion is proven only at the file level: journal blocks and SSD wear levelling below
the file system are outside the adapter's reach, and volume encryption under a separate key owner is
what bounds that residue. The collector cannot verify that its volume is encrypted.
