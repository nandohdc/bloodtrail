# Archive evidence: enforce-collector-auth-and-version

## Completion record

The implementation landed through PR #363 (`503f2d112095458ead5acc2bda46f28fe774cde2`), merged as the two-parent merge commit `543c1bffb0acc7665c3e67cf24bb9d75b7a4f57d`. Its required checks were all successful on that exact head before the authorized administrative merge.

The canonical-spec fold landed through PR #366 (`eec13a7c0d1a88afa5e131e88a4cf917fe5318d5`), merged as the two-parent merge commit `a6bc8196ed2d754b5c60860fe06d927fc5426372`. The fold proved that the collector requirement blocks were byte-identical after replacing the delta heading with the canonical `Requirements` heading, and that reapplying the repository-topology modification was a no-op.

Issue #107 received a closure comment covering E1--E8 and N0, the fixed ingress order (`authenticate -> size -> parse -> schema -> version -> accept`), and the boundary that authentication identifies a sender but does not establish truth, trust, integrity, or authority for evidence. The issue is closed, and its Wave 4 checklist entry in #132 is checked.

## Governance and validation

The implementation and fold heads each passed the final design-pattern-governance phase and the candidate/baseline dual check. The archive relocation is intentionally verified only after its commit exists: R15 resolves its relocation artifacts from committed `HEAD`, so the same final-phase command correctly rejects a staged-only move as uncovered rather than treating uncommitted archive files as governed. The archive commit's final-phase and dual-check results are therefore recorded by its PR check state before merge. No check requested a signed owner decision bound to an exact commit; none was invented. The staged archive candidate passed `npx --yes @fission-ai/openspec@latest validate --all --strict` and `git diff --check`.

The PR bodies for #363 and #366 state that AI verification is evidence rather than approval, the topology amendment remains decision-bearing and awaits owner ratification, and this work conveys no production authority. The implementation stays a synthetic, non-production library: it creates no listener, deployment, credential, storage, delivery, retry, or evidence-truth claim.

## Relocation integrity

The following active-change artifacts are relocated byte-for-byte. `tasks.md` is reconciled only by checking the four completed delivery/governance tasks; this evidence file is newly added for the archive.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `1a62d62b5b53a6566170b6badadd17e0c687568e` |
| `assessment.json` | `9ae993470d627bf5e7ade0e3333247b103eedefa` |
| `assessment.source.json` | `c287337c7e8c996d9b8c19162e9a92cbf1db4a4f` |
| `design.md` | `2bedf1e9ceb030eaca83c989702bf1ed09f49938` |
| `proposal.md` | `d50ad5fe5bc3014b16127ab4856f7329ef875cf3` |
| `specs/repository-topology/spec.md` | `8dda67a7e0c15f00c0d50eb8df2e95c6436bd1ab` |
| `specs/security-audit-collector/spec.md` | `a8f9ca4afe27baca91c1bf4601dca8d49a6a7489` |

The staged archive commit verifies those identities and reports the unchanged artifacts as 100% similar renames. Canonical specifications are already folded on `main`; this archive changes no canonical specification.
