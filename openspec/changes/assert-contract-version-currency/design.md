## Context

`check-coherence.mjs` holds one rule for the contract version in consumer documentation:

```js
rule("adr-contract", "adr", includesAll(allAdrs, [expected.normativeTarget, "contract `1.1.0`"]), …);
```

It asserts a *presence* across all ADRs concatenated. Three things follow, and all three are load
bearing:

1. One ADR mentioning `1.1.0` satisfies it for every ADR, so `adr/008` can go on asserting `1.0.0`.
2. It says nothing about the *absence* of a superseded version, so no amount of stale text fails it.
3. It reads `packages/security-audit-sdk-core` only. `check-coherence.mjs` is that package's own
   script; it cannot reach the Node binding, the collector, or the root documents, which between them
   carry six of the eleven defects.

`CLAUDE.md`'s contract-version pin inventory, added by #448, lists consumer docs as "gated by the
coherence rule `adr-contract`". That entry is why nobody looked: it names a gate that does not hold
the property.

## Goals / Non-Goals

**Goals.** Every current-tense statement names the current canonical version. Every legitimate
historical reference is unchanged and carries a recorded reason. A superseded version reappearing in
a current-tense assertion fails a required context, in every declared package rather than in one.

**Non-Goals.** Moving the contract version. Changing runtime behaviour, public API, or generated
artifacts. Correcting ratified specification text. Covering package versions (#462).

## Decisions

### D1 — A rule, not a documented manual step

#453 offers a choice: strengthen the rule, or record in the pin inventory that the step is manual.
The enumeration settles it. #448 *was* the manual step — it added the pin inventory to `CLAUDE.md`
while leaving two stale statements on the same page and four more in the packages the inventory is
about. A documented manual step has already been performed once and produced this list.

### D2 — Derive both versions; restate neither

The current canonical version is `metadata.schema_version` in
`contracts/security-audit/source/contract.source.json`, the single source of truth from which every
generated artifact follows. The superseded set is the `contract` enum in
`openspec/governance/schemas/contract-reuse.schema.json` minus the current version. `CLAUDE.md`
already requires that enum to gain each new version *and keep the old ones*, "or archived CRA records
stop being structurally valid" — so it is the repository's existing record of every contract version
that has existed, maintained for an independent reason and therefore not a list this change invents.

The checker fails when the current version is absent from that enum. That is the #426 defect shape
stated as an arm: a version move that updates the contract source and forgets the CRA enum leaves the
superseded set wrong, and a checker that silently accepted it would validate against an empty set.

### D3 — Derive the scan set from `DECLARED_PACKAGES`, and record the rest

Per package, the scan set is the package root's top-level `*.md`, its `adr/*.md`, and its `src/**`
sources. All three follow from `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs`,
so a sixth package is covered the moment it is declared — the property #412, #441 and #452 each had
to be taught separately.

The repository's own actor-neutral documents cannot be derived that way, so they are named:
`README.md`, `SECURITY.md`, `CLAUDE.md`, `AGENTS.md`, `.hermes.md`, `CONTRIBUTING.md`, `RELEASING.md`.
The checker asserts each exists, so the list fails rather than silently shrinking if one is renamed.

What is *not* scanned is recorded with its reason in the checker rather than left as an omission —
ratified specs, the protected contract tree, archived changes, agent plans, tests, examples and
generated output. Each exclusion is a decision, and the one that matters is `openspec/specs/**`:
correcting ratified text is a spec delta, and a gate demanding it would require the change it forbids.

### D4 — Recorded exceptions carry their reason, and fail closed both ways

#453's second acceptance criterion asks the change to say why each legitimate reference was left. In
prose that is a paragraph nobody re-reads; here each is an entry in
`RECORDED_HISTORICAL_REFERENCES` with a `path`, an optional `quote` and a `reason`.

Both directions fail. An occurrence matching no entry fails, naming the file and line. An entry
matching no occurrence *also* fails, so an exception cannot outlive the text it excuses — which is
what stops this list becoming the next stale hand-maintained set.

`MIGRATION.md` is the one file-scope entry rather than seven line entries. A migration document is by
construction a record of past transitions; every version literal in it describes a transition that
already happened. The trade-off is recorded rather than hidden: a genuinely current-tense claim added
to `MIGRATION.md` in future would not be caught, and the reason that is acceptable is that such a
claim does not belong in a migration document at all.

### D5 — Detect the literal, not the sentence

Distinguishing "current-tense" from "historical" mechanically was considered and rejected. It would
need to parse English tense, or to depend on section headings that are not stable across eleven
documents in three formats. Every heuristic considered either missed `adr/008`'s "Only version 1.0.0
… are typed and accepted" — grammatically indistinguishable from `adr/010`'s "has no … contract
`1.0.0` compatibility impact" — or flagged both.

So the checker detects the *literal* and requires a human decision, recorded once, for every
occurrence that is legitimate. That is a higher one-time cost — fifteen entries — and a far lower
recurring one: the next contract move flags every occurrence again, and each entry either still
matches or fails as stale.

### D6 — The required enforcement is the test, and the step is the diagnostic

`node --test .github/scripts/*.test.mjs` already runs in the `design-pattern-governance` job, which is
a required context, and the test file exercises the checker against the real repository. So the gate
holds even if a future edit removes the explicit step. The explicit step is added anyway, beside the
existing `check-package-discovery.mjs` invocation, because a failure there names the file and line
directly instead of inside a test report.

## Risks / Trade-offs

- **Fifteen recorded exceptions is a real maintenance surface.** It is bounded by the same
  fail-closed rule as the occurrences: an exception that stops matching fails the gate, so the set
  shrinks as stale text is removed rather than accumulating.
- **A false positive blocks a merge.** A new legitimate historical reference — a migration note, a
  changelog line — needs an exception entry before it can land. That is deliberate: it makes recording
  the reason a precondition of writing the reference, which is the discipline #453 asks for.
- **The scan set excludes ratified specs, so a stale ratified requirement stays stale.** Recorded, and
  it is the correct boundary: those are ratified statements of what was decided, and correcting one is
  a governed spec change with its own delta.
- **Four root `governance_core` documents are edited.** `CLAUDE.md` forbids touching them
  *incidentally alongside an unrelated bounded change*. They are not incidental here — they carry four
  of the eleven defects and the pin inventory entry #453 names as the correction being made — but the
  full assessment and fifteen-dimension justification the trigger forces are supplied rather than
  argued around.
