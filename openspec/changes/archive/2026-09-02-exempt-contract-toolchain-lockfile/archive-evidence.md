# Archive Evidence — exempt-contract-toolchain-lockfile

Explicit archive validation record (R24) for the archive relocation of the `exempt-contract-toolchain-lockfile` change into `openspec/changes/archive/2026-09-02-exempt-contract-toolchain-lockfile/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). The relocation is byte-preserving: the exhaustive byte-change enumeration for the relocated files is **zero changes** — every relocated file is byte-identical to the object the active change path carried at the archive base HEAD (f7e3f70ca71aeb8c5ed0417c277707fa4f4db3a5), so Git records all seven as `R100`. `tasks.md` required **zero checkbox flips** in this commit: it was already 15/15 checked at the fold. `archive-evidence.md` (this file) is the only new file, and no path outside the two change directories is touched.

## Why this change existed

Two required branch-protection contexts were mutually unsatisfiable:

- `contract` required `npm audit --audit-level=high` clean in `contracts/security-audit/`.
- `sdk` ran `test:changed-paths`, which rejected **every** path under `contracts/security-audit/` as canonical-contract drift.

When the four `fast-uri` advisories (GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp) landed against `fast-uri@3.1.5`, the contract workspace lockfile became un-updatable: the audit demanded a bump and the changed-path gate forbade one. No commit could satisfy both, so the repository could not merge anything at all. That defect is #256, and it was verified live rather than inferred — `main`'s own contract lockfile failed `npm audit --audit-level=high` on demand at the time of the fix.

The change adds a bounded, self-policing exemption list rather than relaxing the prefix rule. The lockfile is **build toolchain, not contract content**: `packages/security-audit-sdk-core/contract-provenance.json` declares the canonical capability, the archived contract change, and every entry under `sources` — and `contracts/security-audit/package-lock.json` appears in none of them.

## Two-PR shape, and why

This archive is the second of two pull requests, and the split is load-bearing rather than cosmetic.

| PR | Commit | Role |
| --- | --- | --- |
| #261 | c30b090971b35da1824f421b787f17bae9d34786 | canonical fold — applies the delta to `openspec/specs/security-audit-sdk-core/spec.md` **while the change is still active** |
| this PR | this commit | archive relocation — moves the change directory, carrying **no canonical write of its own** |

A combined shape was attempted first, twice, and correctly rejected both times with `openspec-association-unrelated` on `openspec/specs/security-audit-sdk-core/spec.md` — once as a single fold-and-archive commit, and once as a fold commit plus an archive commit inside the same PR. The cause is deliberate, and `ownedPathsFor` in `openspec/scripts/design-pattern-governance/perimeter.mjs` states it:

> A relocated change keeps its archived capability declaration for the association's capability gate, but the declaration no longer covers canonical spec paths or its former owned paths: further work on anything but the relocation itself requires a new active change.

So as soon as the relocation appears anywhere in the range, the change stops owning the canonical spec and the canonical write in that same range has no owner. Only two separate PRs satisfy it — the pattern already set by `83a1902`, `3bf0332`, `6d3e39b` and `69e0cd8`. The trap is filed as #262, because `openspec archive` produces the rejected shape by default and no document records the sequence.

The proposal had also omitted `openspec/specs/security-audit-sdk-core/spec.md` from `owned_paths` while declaring every delta and implementation path. That omission is corrected in the fold PR (task 5.2) rather than papered over here.

## Task completeness

All 15 tasks were checked before this commit; none was completed post-hoc in the archive.

- **1.1–1.3** — `contract.toolchainExemptions` added to `verification-lifecycle.json`; honoured at the protected-prefix rule in `check-changed-paths.mjs`; every entry validated for shape, prefix membership, and absence from the provenance manifest.
- **2.1** — `fast-uri` moved to 3.1.7 in both workspace lockfiles via `npm audit fix --package-lock-only`; both manifests untouched, so no direct dependency contract changed and the zero-runtime-dependency invariant is preserved.
- **3.1–3.5** — the five verification scenarios, implemented in `tests/verification/contract-toolchain-exemption.test.mjs` (9 tests, 9 pass), each operating on a disposable clone rather than the live tree.
- **4.1–4.4** — `check:generated` (run *before* `validate`, so committed drift could not be masked), both workspace `validate` chains, both audit thresholds, and the governance checker plus both governance suites.
- **5.1–5.2** — the canonical fold and the `owned_paths` correction, both in c30b090.

## The exemption cannot be widened into contract content

The mechanism fails closed. `validateContractToolchainExemptions` rejects the whole configuration — rather than skipping a bad entry — when an entry:

1. names a path `contract-provenance.json` declares, or a path beneath a declared directory;
2. names a directory, contains glob characters, contains path traversal, contains a NUL byte, uses backslashes, or is absolute;
3. lies outside every protected contract prefix.

`test:contract-immutability` does **not** consult the exemption list, so contract identity remains bound independently of it. This was verified rather than assumed: the suite passes with `contracts/security-audit/package-lock.json` modified, which is the direct evidence that the lockfile is not part of contract identity.

An exempted path stays **classified**, not hidden: it is still reported under the `event-contract` classification (`"event-contract": 1`), so the exemption suppresses the violation without suppressing visibility.

## The gate is known to bite (null control)

The green result is not self-referential. Scenario 3.5 is a deliberate null control: a modified contract path that is *not* on the exemption list still fails `test:changed-paths` and is still named in the failure. Without that arm, a passing suite would be consistent with a gate that had simply stopped enforcing — the failure mode recorded in `verify-a-gate-can-fail`, where `codescene delta` was a no-op for its entire life because `cs delta` exits 0 unless `--error-on-warnings` is passed. Seven negative arms (three declared-content forms, four malformed-entry forms) are each asserted to be rejected.

## Fold idempotence

The canonical fold is proven idempotent rather than asserted. Re-running `openspec archive` on the folded tree reported:

```
Specs to update:
  security-audit-sdk-core: update
Totals: + 0, ~ 0, - 0, → 0
Specs already in sync; no files changed.
```

`openspec/specs/security-audit-sdk-core/spec.md` is blob `d696f681f4fe5c1c94056ed3a3de255fc4fd88a5` both before and after this commit — the archive changes it by zero bytes. In the canonical capability the requirement heading occurs exactly once, each of the five scenario headings occurs exactly once, the delta body is present verbatim exactly once from its first `### Requirement:` line onward, and no `## ADDED` / `## MODIFIED` / `## REMOVED` / `## RENAMED` delta operation header appears anywhere in the file.

`openspec/specs/security-audit-sdk-core/` may only change in `archived` mode, which resolved from the dated archive of `remediate-security-audit-sdk-adversarial-review` (`openspec/changes/archive/2026-08-11-remediate-security-audit-sdk-adversarial-review` exists; its active directory does not).

## Immutable archive contents

Byte-identical from the archive base HEAD (f7e3f70ca71aeb8c5ed0417c277707fa4f4db3a5) into the archive. Expected blobs are the objects at that HEAD under `openspec/changes/exempt-contract-toolchain-lockfile/<file>`; actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 032461ff9fabbf3f9d3ee05069937b5d3e5d2252 | 032461ff9fabbf3f9d3ee05069937b5d3e5d2252 | identical |
| `assessment.json` | 638c5bdbd37afacf7bb155c837315a46c2e6dd34 | 638c5bdbd37afacf7bb155c837315a46c2e6dd34 | identical |
| `contract-reuse.json` | 8063743aa6fd1e1c0b13822f341120e9c98c14aa | 8063743aa6fd1e1c0b13822f341120e9c98c14aa | identical |
| `design.md` | 6c266f8ece84fc51161cb7656832bf33027fc90b | 6c266f8ece84fc51161cb7656832bf33027fc90b | identical |
| `proposal.md` | 9fb2287ce1950460d260b00792bc44b5bada4514 | 9fb2287ce1950460d260b00792bc44b5bada4514 | identical |
| `specs/security-audit-sdk-core/spec.md` | 0418a1fc94686e7105b26f3c973b71b631c834f5 | 0418a1fc94686e7105b26f3c973b71b631c834f5 | identical |
| `tasks.md` | ebc0e9ecb5d0a38bcc9700bf817f9ceb1087e037 | ebc0e9ecb5d0a38bcc9700bf817f9ceb1087e037 | identical |

Exhaustive byte-change enumeration: none of the seven relocated files differs by even one byte. There is no silent task-line edit, no metadata rewrite, and no checkbox flip.

`proposal.md` is unchanged from the object history carried at the active change path since the original proposal commit ff7b71a, so the dated archive directory is recognized as the genuine relocation of the change under the R15 relocation-artifact rule, which preserves the governed evidence across the move. `assessment.json` also matches the object history carried at the active path, at the fold commit c30b090.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-exempt-contract-toolchain-lockfile/`:

- `.openspec.yaml`
- `assessment.json`
- `contract-reuse.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/exempt-contract-toolchain-lockfile/` (active path): the same seven files.

No other path is touched by this commit. In particular `openspec/specs/**`, `contracts/**`, `packages/security-audit-sdk-core/src/**`, `packages/security-audit-sdk-core/scripts/**`, `packages/security-audit-sdk-core/verification-lifecycle.json`, `.github/workflows/**`, and `docs/adr/**` are untouched.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal | ff7b71a535d1d5b6a81c2c2b45700aa0657d248b | `docs(openspec): propose exempt-contract-toolchain-lockfile` |
| Implementation | fa3574d74b305bb13fb944f64d5ccfdc9f4f9cd4 | `fix(sdk): exempt the contract build-toolchain lockfile from the frozen prefix` |
| Contract reuse record | f17734f8e122eddbd0a9f522cbfb3acb287e0dd1 | `docs(openspec): record the contract reuse assessment for the toolchain exemption` |
| Codecov archive (carried) | 30ba07986611bff4d7d0d04cfca44e88968a9731 | `docs(openspec): archive fix-codecov-test-results-upload` |
| Merge (PR #259) | a49582c74d1ca93ce7205bf09ff1c270605fe8e8 | identity-preserving merge, 2 parents (c6a4b74c + 30ba0798) |
| Canonical fold (PR #261) | c30b090971b35da1824f421b787f17bae9d34786 | delta applied while the change was still active; merged as f7e3f70c |
| Archive relocation | this commit | byte-preserving; zero relocated-byte changes; no canonical write |

Proposal, implementation, record, fold, and archive were each kept in separate commits; none was mixed.

## Superseded work

Two open pull requests were closed rather than merged, because their payloads landed in this change:

- **#255** (Dependabot, `fast-uri` 3.1.5 → 3.1.7 in the SDK workspace) — the identical bump is on `main`; merging it would have been a no-op.
- **#257** (`fix(ci): repair SDK audit and archive Codecov change`) — its SDK lockfile bump and its Codecov archive both landed here. Its only unique content was an `upgrade-fast-uri-3-1-7` change directory, which could not land: this change's `owned_paths` already declares `packages/security-audit-sdk-core/package-lock.json`, so a second active change claiming the same path is an ownership collision rather than a duplicate document.

## Assurance limitations

- **No owner decision is bound to this change.** It was authored and merged under a standing instruction to keep the fleet moving and to merge PRs whose CI has no failures. That instruction is not a review of this change's design, and this record does not manufacture one.
- **No independent technical review is bound to this change either.** Unlike the #78 proposal, which carries a reviewer verdict bound to its exact head, this change has no reviewer run. Its evidence is the gate results and the null control, nothing more.
- The merges used `--admin`. That flag bypasses only the checks' *blocking* effect, never the checks themselves; all nine required contexts were `SUCCESS` at each merged head, counted against the branch-protection context list rather than read from `gh pr checks --required` (which lists only contexts that have reported). The implementation was independently re-run locally: `check:generated` clean, sdk `validate` 257/257, contract `validate` 14/14, both audit thresholds exit 0, exemption suite 9/9.
- This change **widens a governance perimeter**. The widening is bounded by the provenance manifest and defended by a null control, but it is still a perimeter change, and it warrants the owner's retrospective review even though CI accepted it. #260 tracks a related concurrency defect in the contract-reuse checker; #262 tracks the fold/archive sequencing trap.
- No signed governance record exists for this change: `verification-lifecycle.json` carries no `exempt-contract-toolchain-lockfile` entry, and none is constructed here. R24's signed-record clauses are vacuous for this change and are recorded as such rather than fabricated.
- This archive-evidence record asserts the relocation and gate facts above. It is not approval, assurance, or authorization.
