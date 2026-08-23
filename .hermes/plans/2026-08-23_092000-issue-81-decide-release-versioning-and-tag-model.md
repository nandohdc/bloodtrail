# Issue #81 — Decide the Multi-Package Release Versioning and Tag Model — Decision Packet

> **For Hermes:** Owner decision, gated on #80. **Do not touch `release-please-config.json` or
> `.release-please-manifest.json`** — both are now classified (`governance_core` and `documentation_only`
> respectively, since #202), and PR #182 is a live release PR sitting on those exact files. An edit here
> collides with it. This issue decides a model; #84 implements it. One fact worth leading with: the
> repository already has **two version namespaces that disagree** — `version.txt` moving toward `0.4.0` via
> release-please, and the SDK package pinned at `0.1.0` by `check-coherence.mjs` — and no record says
> which owns what.

**Goal:** One recorded release model — repo-scoped or per-package versions and tags — with version
ownership, tag/component and manifest behaviour, and private status all explicit.

**Status at this baseline:** BLOCKED ON #80 (owner), which is unanswered.

**Blast radius if unanswered:** #84 directly.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #81, OPEN, labels `question` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #80 — **open, `ready-for-human`, unanswered** |
| Native GitHub blockers | `blocked_by` is `0` |
| Repo version | `version.txt` — release-please's `simple` target; PR #182 proposes `v0.4.0` |
| SDK version | `package.json` `0.1.0`, `private: true`, `license: UNLICENSED` |
| SDK version pin | `check-coherence.mjs` `rule("package-version", …)` against `compatibility.json.package.version` |
| Release config | `release-please-config.json` — `governance_core` since #202 |
| Release manifest | `.release-please-manifest.json` — `documentation_only` since #202 |
| Live release PR | **#182**, `chore: release v0.4.0`, touching `.release-please-manifest.json`, `CHANGELOG.md`, `version.txt` |
| What a release does today | versions `version.txt` and creates a `vX.Y.Z` tag — **no package is ever published, no `package.json` version moves** |
| Authorization | a tag does not lift the authorization boundary (`RELEASING.md`) |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Two version namespaces already exist and nothing records their relationship

`version.txt` is the repository's release version, driven by Conventional Commits. `package.json` is
`0.1.0` and pinned by a coherence rule against `compatibility.json`. They have never moved together and
nothing says they should. #81's "Why" line names exactly this ("Repo version 0.2.2 and SDK version 0.1.0
already form separate namespaces") — the numbers have moved since, the situation has not.

### F2 — The current model is already per-repository, and it is deliberately decoupled from packages

`RELEASING.md`: a release versions `version.txt` and a tag only. No `package.json` version moves. So the
existing model is **repo-scoped, package-agnostic**, and it works precisely because no package is
published. Choosing per-package tags introduces a namespace whose entries would refer to artifacts that
cannot be distributed.

### F3 — Per-package release presupposes something that is unauthorized

Component tags and per-package manifest entries exist to coordinate **publication**. The SDK is `private`,
`UNLICENSED`, and never published; publication is explicitly outside the authorization boundary and
`check-publication-path.mjs` exists to keep it that way. A per-package release model would create the
metadata of a publishing repository without the authorization to publish — and #84's own acceptance
criterion says the docs must state the configuration is non-authorizing.

### F4 — #182 makes this urgent in a way the issue does not say

A release PR is open right now. Whatever model is chosen must not invalidate it, and any edit to
`release-please-config.json` while #182 is open creates a conflict on a branch under bot automation —
which must **not** be rebased or force-pushed beneath the writer. Sequence matters: let #182 land (or be
closed) before #84 edits the config.

### F5 — This decision is cheap to defer and expensive to get wrong

Unlike #80, nothing is blocked behind #81 except #84, and #84 is itself only useful once #83 has
materialized new packages. If #80 ratifies standalone with no new packages imminent, **the honest
recommendation is to record "repo-scoped, unchanged" and close** rather than design a component-tag scheme
for packages that do not exist.

---

## The decision, as the owner should see it

| | **Repo-scoped (current)** — recommended | **Per-package component tags** |
| --- | --- | --- |
| What is versioned | `version.txt` + one `vX.Y.Z` tag | one tag per package, `<pkg>-vX.Y.Z` |
| Config change | none | `release-please-config.json` gains a package map; manifest gains entries |
| Interaction with #182 | none | must wait for #182 (F4) |
| Meaning of a version | "this repository, at this commit" | "this package, releasable" — **but nothing is releasable** (F3) |
| Tag collision risk | none | real, and #81 asks for it to be specified |
| Private status | unchanged, explicit | must be re-stated per package |
| Fits current authorization | yes | creates publication-shaped metadata without publication authority |

**Recommendation: repo-scoped, ratified and written down.** Revisit when (a) #83 has actually created more
than one shipping package **and** (b) publication has been separately authorized. Both are false today and
(b) is explicitly outside the boundary.

---

## Task 0: Gate and re-verify

- [ ] 0.1 **Confirm #80 is answered.** If not, stop — the topology decides whether more packages exist at
      all.
- [ ] 0.2 Confirm #182's state. If open, record that no config edit may happen until it lands or closes.
- [ ] 0.3 Re-read `RELEASING.md` and confirm F2 verbatim.
- [ ] 0.4 Record both current versions and the coherence rule pinning the SDK's (F1).

## Task 1: Post the decision brief

- [ ] 1.1 Lead with F1 (two namespaces, no record) and F3 (per-package presupposes publication).
- [ ] 1.2 Include the comparison table.
- [ ] 1.3 State the #182 sequencing constraint (F4) explicitly.
- [ ] 1.4 Carry the AI-triage disclaimer; move `needs-triage` → `ready-for-human`.

## Task 2: When the owner answers

- [ ] 2.1 Root ADR recording: the model, which artefact owns which version, tag/component naming, manifest
      behaviour, and **which packages remain private** (all of them, today).
- [ ] 2.2 The ADR must repeat that release metadata cannot imply publication authority (#81's own security
      note).
- [ ] 2.3 If per-package is chosen: validate a **disposable** Release Please configuration and dry-run
      before #84 touches the real one. #81's verification step requires it.
- [ ] 2.4 Comment on #84 with the selected model.

## Task 3: Close

- [ ] 3.1 Close #81 naming the model and the ADR.
- [ ] 3.2 Tick #81 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#81) | Where satisfied |
| --- | --- |
| Exactly one model selected | owner's recorded answer |
| Version ownership explicit | ADR (F1) |
| Tag/component and manifest behaviour specified | ADR; dry-run if per-package (Task 2.3) |
| Private status remains explicit | ADR — every package `private: true`, `UNLICENSED` |

## Risks and open questions

- **Editing release config while #182 is open** is the concrete near-term hazard (F4).
- **Designing a component-tag scheme for packages that do not exist** wastes the decision and creates
  config that must be maintained. Guard against it with the F5 recommendation.
- **Open question for the owner:** should `version.txt` and the SDK's `package.json` version ever be
  coupled? Today they are independent and nothing says whether that is intentional. Answering it is most
  of what this issue is actually for.

## What this does not authorize

Editing release configuration, creating tags, publishing, or changing licensing.

## What this plan did not verify

Whether release-please's `simple` strategy would tolerate a mixed repo-scoped + component-tag
configuration. Measure it in a disposable config if per-package is chosen.
