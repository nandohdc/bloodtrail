## 1. Authorization, selection, and assessment

- [ ] 1.1 Record the owner's 2026-09-10 instruction as the authorization for #115, and record that the backend selection, the retention durations, and the scope derivation were delegated to Claude with `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`; verify no artifact states or implies a human owner decision, an exact-commit authorization, or any production authorization.
- [ ] 1.2 Select the backend on the ratified security properties rather than availability, comparing SQLite through `node:sqlite` against a file-per-record store, a networked database, SQLite with application-level encryption, and an in-memory map; verify the rejected alternatives and the key-custody disqualification rule are recorded in `design.md`.
- [ ] 1.3 Create the full design-pattern assessment source and generated assessment with exact owned paths, and justify every security dimension before any implementation commit.

## 2. Port, backend, and persist stage

- [ ] 2.1 Add `src/storage.ts` with the three-operation port, closed result unions, the one-scope-per-operation signature, fixed retention durations, and owner validation; verify it imports nothing.
- [ ] 2.2 Add `src/sqlite-storage.ts` over `node:sqlite` with a `WITHOUT ROWID` table keyed by scope and identity, `secure_delete`, a rollback journal, full synchronous commits, no-effect failure classification, and version-aware reads; verify it is the only module importing a built-in.
- [ ] 2.3 Insert the persist stage after deduplication, return `persisted` only after a confirmed write, withdraw the ledger reservation on every storage rejection, and carry the first-seen acknowledgment on duplicates; verify storage diagnostics and counters are closed and secret-free.
- [ ] 2.4 Permit the `storage` filename token for exactly the two new files, `node:sqlite` for exactly the backend module, and that one import in the dependency gate; extend the packed consumer probe to persist and read from the installed tarball; correct and assert `compatibility.json`.

## 3. Verification

- [ ] 3.1 Run the storage arms green: persisted and retrieved byte-identically, admission without storage, outright and indeterminate failures, retry after an indeterminate write, idempotent and conflicting writes, record-derived retention in two deployments, declined retention class, whole-record expiry, file-level residue with a null control, tenant isolation and scopeless reads, the closed port surface, owner validation, unsupported stored version, a locked and a closed database, unresolvable scope, secret-free failures, and reservation release.
- [ ] 3.2 Run `npm run validate --prefix packages/security-audit-collector` on Node 26 and `npm test` on Node 24, the scope-mutation arms for the confined built-in, strict OpenSpec validation, the assessment and implementation governance phases, and `git diff --check` with an empty index.

## 4. Delivery, fold, archive, and closure

- [ ] 4.1 Open the implementation PR with the authorization posture, the delegated-decision provenance, the AI-not-approval statement, and the no-production boundary; merge only when all ten required checks are green on the exact head.
- [ ] 4.2 Fold both deltas into their canonical specifications in a dedicated fold PR, proving each block is byte-identical and a second application is a no-op; merge only after its exact-head CI is green.
- [ ] 4.3 Archive the change in its own PR with byte-preserving relocation and `archive-evidence.md`; merge with a merge commit.
- [ ] 4.4 Close #115 with the storage evidence and tick it in #132's Wave 4 checklist after the archive merges.
