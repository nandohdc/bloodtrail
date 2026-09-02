# Archive Evidence — ratify-repository-topology

Explicit archive validation record (R24) for the archive relocation of the `ratify-repository-topology` change into `openspec/changes/archive/2026-09-02-ratify-repository-topology/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly five checkbox flips (1.4, 2.1, 2.2, 4.1, 4.2).

## Task completeness

- **1.1–1.3** were checked in the materialization stage (Hermes task t_fd7f892b: ADR commit 847441a1ce2ad47651b6ddaca1c13ba6938c93e8 + reconciliation commit cfc8d63b3c79ce9e4ed79fce3638901fc93449ca) and verified truthful by the independent review t_5e261c70.
- **1.4** — checked in this archive commit. Independent exact-commit technical review (Hermes task t_5e261c70, reviewer profile) bound to materialization PR #242 at live head **cfc8d63b3c79ce9e4ed79fce3638901fc93449ca**: verdict `technical_review` = "approved" (technically acceptable; formal approval not established), zero blocking findings. Review is evidence, not approval. The mandatory base-sync rebase under strict branch protection moved the PR head to **bf507d242dbba03db19cc04b8483caae98b3ddd5** before the identity-preserving merge **ba004a2766a1a7cff81d1b16b6ce03d5f3b6126f**; content equivalence between the reviewed head and the merged head is proven by diff-blob identity **af022559580559d4ff054ec1a971acb6e017ae6c** (`git diff-tree -p f5c69f7 cfc8d63b` and `git diff-tree -p 605f22e bf507d24` both hash to af022559…; reproduced locally during archive preparation).
- **2.1** — checked. t_349e7997 ran `openspec validate ratify-repository-topology --strict` (pass) plus semantic verification (8 requirements, 23 scenarios with WHEN/THEN, 12 tasks all unchecked at proposal time, unique task ids, assessment cross-references resolving, final newlines and whitespace clean) at proposal commit **7d7b39ede6210b3fbf9d31b9586efaa4e704a862**; the proposal commit touched only the six-file allowlist under `openspec/changes/ratify-repository-topology/` and neither `check-coherence.mjs` nor `compatibility.json`. Scope independently re-verified by t_17bed178 (6 files, 393 insertions, no runtime/manifest/CI/release/generated changes).
- **2.2** — checked. Independent exact-commit technical review (Hermes task t_17bed178) of proposal PR #237 bound to **7d7b39ede6210b3fbf9d31b9586efaa4e704a862**: verdict `technical_review` = "approved", zero blocking findings. Evidence, not approval.
- **2.3** — **UNCHECKED**. The task requires the project owner's approval bound to the exact commit being merged, recorded as an owner decision. No such decision record exists. What exists is PR-level owner authorization, not bound to a commit: for #242, the owner's chat authorization "ratify 605f22e and merge #242" (2026-09-02); for #245, the owner's standing authorization to merge the in-flight lifecycle PRs with `--admin` once CI had no failures (2026-09-02). Per governance policy this task must not be checked from PR-level authorization, PR assignment, or merged state.
- **3.1** — **UNCHECKED**. Both merges (#242 → ba004a2766a1a7cff81d1b16b6ce03d5f3b6126f, #245 → 5a66806e70004fd46e7a71126f61add9f73019ae) were owner-direct, not through the gate script, so the "integrator merges through the gate script" clause is unmet and is not back-filled. CI state at the merges was green: 18/18 CI checks passing at the #242 head and all nine required branch-protection contexts reported and passing at the #245 head (3cbaf18).
- **3.2** — **UNCHECKED**. No comments on #81/#82 yet; owned by downstream task t_f9aeda58.
- **4.1** — checked. The canonical fold landed as dedicated commit **3cbaf1821613e4ce6b2ebc3d446e41bc09ded1a7** (single file `openspec/specs/repository-topology/spec.md`, +131) while the change was active, and was merged identity-preservingly by **5a66806e70004fd46e7a71126f61add9f73019ae** (PR #245, parents ba004a2 + 3cbaf18). The fold transform is exactly two edits (prepend H1 `# repository-topology Specification`, `## ADDED Requirements` → `## Requirements`); applying the transform to the delta reproduces the canonical spec byte-for-byte; a second semantic application is a no-op; the merge tree carries the fold unchanged. The fold commit touched neither `check-coherence.mjs` nor `compatibility.json`.
- **4.2** — checked. This archive-relocation commit: byte identity table below, explicit staged scope, strict validation, archive attestations, and no implementation path changed.
- **4.3** — **UNCHECKED**. Closing #80 (naming the topology and the ADR path) and ticking #80 in #132's Wave 2 checklist is owned by downstream task t_f9aeda58; closure is expected only after this archive PR merges, and is not this commit's responsibility.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal | 7d7b39ede6210b3fbf9d31b9586efaa4e704a862 | reviewed by t_17bed178 |
| Proposal merge (PR #237) | f5c69f7 | |
| ADR materialization + reconciliation | 847441a1… / cfc8d63b… | reviewed by t_5e261c70 at cfc8d63b |
| Materialization merge (PR #242) | ba004a2766a1a7cff81d1b16b6ce03d5f3b6126f | 2 parents (605f22e + bf507d24); merged head content-equivalent to reviewed head (diff-blob af022559) |
| Canonical fold | 3cbaf1821613e4ce6b2ebc3d446e41bc09ded1a7 | single file, +131 |
| Fold merge (PR #245) | 5a66806e70004fd46e7a71126f61add9f73019ae | 2 parents (ba004a2 + 3cbaf18); identity-preserving |

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `ratify-repository-topology` entry, and the signed records in that file belong to the `contract-reuse-assessment` lifecycle. R24's signed-record clauses are therefore vacuous for this change and are recorded as such here rather than constructed.

## Canonical capability materialization

`openspec/specs/repository-topology/spec.md` exists at this archive head, created by fold commit 3cbaf18 and carried unchanged through fold merge 5a66806. Per fold-before-archive policy the fold landed while the change was active; this archive commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. The capability re-affirms the authorization boundary: it SHALL NOT authorize production transports, exporters, collectors, or storage; the declared target set is exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, the planned Node binding (#87), and `research/browser-telemetry`, with #124/#131 excluded and #117 undecided.

## Immutable archive contents

Byte-identical from the archive base HEAD (5a66806) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-01`)
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/repository-topology/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly five checkbox flips). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-ratify-repository-topology/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/repository-topology/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/ratify-repository-topology/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/repository-topology/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**` and `packages/security-audit-sdk-core/verification-lifecycle.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (5a66806); actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | b4b3ece7847e47875ed4057814d5a8a29a121c2c | b4b3ece7847e47875ed4057814d5a8a29a121c2c | identical |
| `assessment.json` | 998f66797fcaeaf121cd8b231094e330760627e1 | 998f66797fcaeaf121cd8b231094e330760627e1 | identical |
| `design.md` | 5aef9bc2e6fbf5e62cb540ae9efce37dff5556ec | 5aef9bc2e6fbf5e62cb540ae9efce37dff5556ec | identical |
| `proposal.md` | 8e554625cc0f85b45d08a9579537a2c9f73046b2 | 8e554625cc0f85b45d08a9579537a2c9f73046b2 | identical |
| `specs/repository-topology/spec.md` | 28e0f534464d1b601f5121969e90933c4be77e87 | 28e0f534464d1b601f5121969e90933c4be77e87 | identical |

`tasks.md` is the one relocated file whose bytes changed: exactly five `- [ ]` → `- [x]` flips on lines 1.4, 2.1, 2.2, 4.1, and 4.2; every other line is byte-identical.

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the governed evidence across the move.

## Active enforcement verification

Archive occurs only after active enforcement is verified. At this archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain)
- `npm run test:archive-attestations --prefix packages/security-audit-sdk-core`
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --check`; staged scope is the relocation allowlist only.

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge.

## Assurance limitations

- No owner approval bound to an exact merged commit was ever recorded for this change (task 2.3): both merges proceeded on PR-level owner authorization, recorded plainly above. This evidence does not construct approval from review evidence, PR assignment, merged state, or checked tasks.
- The two technical reviews (t_5e261c70, t_17bed178) are evidence, not approval, and are AI-assisted technical review records, not independent human assurance.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
