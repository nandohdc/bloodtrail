## Context

See `proposal.md` for motivation. The canonical validator and the SDK Core validator are separate
authored implementations of the same `1.1.0` semantic rule. Both currently use JavaScript relational
string comparison, whose UTF-16 code-unit order differs from Unicode code-point order when astral
characters are present. Duplicate detection precedes ordering, and ordering precedes input-path
resolution, so the repair must preserve that diagnostic precedence.

The generator owns committed contract fixtures and documentation. Although all currently resolvable
canonical and registered-extension paths are ASCII, the structural contract permits any bounded
non-empty string and the semantic validator must order it before deciding whether it resolves.

The aggregate negative-fixture projection is part of the SDK Core frozen-contract provenance set,
and all contract paths are protected by the lifecycle-aware changed-path gate. The implementation
therefore cannot pass full validation merely by regenerating the corrected fixture: the established
governed-candidate mechanism must bind the exact protected-path inventory to an immutable technical
commit and advance every exact target copy coherently.

## Goals / Non-Goals

**Goals:**

- Give both validators the same total, deterministic lexicographic order over Unicode code points.
- Pin both directions of the astral/BMP disagreement without relying only on prose.
- Keep generated artifacts derived exclusively from the canonical generator.
- Preserve current validation-error precedence, bounds, and secret-free diagnostics.
- Rebind the frozen-contract gates to one exact technical candidate while retaining fail-closed
  rejection of undeclared or byte-different protected writes.

**Non-Goals:**

- Restrict provenance inputs to ASCII or normalize Unicode.
- Export a new comparator API, share runtime code across package boundaries, or add a dependency.
- Change the `1.1.0` contract meaning, schema version, path-resolution rules, or error vocabulary.
- Remove a protected prefix, add a generic exemption, or otherwise relax frozen-contract policy.

## Decisions

### D1 — Compare decoded code-point sequences lexicographically

Each validator will convert the two bounded strings into sequences using JavaScript string
iteration, compare the numeric `codePointAt(0)` values at the first differing position, and put a
shorter equal-prefix sequence first. The allocation is bounded by the existing 256-code-unit input
limit and makes the rule easier to audit than manual surrogate-index arithmetic.

The alternative of `localeCompare` is locale/configuration sensitive. Relational operators preserve
the defect, and normalizing before comparison changes caller data and collapses distinct strings.
The algorithm remains locally duplicated because the canonical contract workspace cannot depend on
the SDK and the SDK runtime cannot depend on the contract's development script.

### D2 — Preserve diagnostic precedence

The new comparator replaces only the predicate inside the existing order check. Duplicate input is
still reported before ordering, and path resolution still follows ordering. A code-point-descending
astral fixture must therefore report `DERIVED_FROM_NONCANONICAL_ORDER` even though its strings are
also unresolvable.

Moving resolution ahead of ordering was rejected because it would change the ratified distinct
outcome behavior and would make the generated regression fixture unable to observe this defect.

### D3 — Use inverse controls for the latent input class

The generator will emit `[U+10000, U+FF01]`, which is ascending by UTF-16 code unit but descending by
code point, as the canonical negative fixture. Focused contract and SDK tests will also reverse the
pair and assert that it proceeds to the existing unresolvable-input outcome rather than producing an
order error. The inverse is a comparator-positive control, not a fully valid event, because no
currently resolvable path contains astral characters.

### D4 — Generate precise prose from the declared rule

`docs/validation.md` will gain generated prose defining first-difference and prefix behavior and
explicitly excluding UTF-16 code-unit and locale collation. The generator will select that prose by
the exact `canonical_order` declaration and fail closed for an unknown value, preventing an order
rename from silently retaining stale documentation.

### D5 — Keep schema version `1.1.0`

The already-ratified capability and canonical source declare code-point order. Correcting reference
implementations and their evidence changes neither the normative accepted-data set nor its
interpretation, so it uses the contract's patch-compatible correction class without a schema-version
move. Release/package automation may assign a patch release independently of the schema literal.

### D6 — Rebind the exact correction candidate without weakening the freeze

After the corrected planning packet is merged, the comparator, tests, generator, generated
documentation, and generated negative fixtures will be committed as a named technical endpoint. The
merged planning commit remains the base for the separately audited #423 correction delta, whose
strict code-point-sorted protected inventory contains exactly the six contract paths changed by this
fix.

The changed-path gate scans from the older SDK remediation baseline and its lifecycle schema carries
one `governedCandidate`, not an append-only candidate list. Replacing that record with the six-path
delta would therefore reopen every protected `1.1.0` write admitted by the preceding
`add-derived-field-provenance` candidate. The lifecycle binding will instead retain that candidate's
existing range base `cdecd7f3f2804517d9aa25ee4322b6486fd7a5bb`, advance its endpoint to the exact
#423 technical commit, and regenerate the protected-path inventory as the exact cumulative diff
across that range. This cumulative gate witness preserves the previous approvals; it does not widen
the #423 implementation scope, which remains independently reproducible from the merged planning
baseline to the same endpoint.

`contract-provenance.json` will advance both the normative technical target and its immutable
comparison baseline to that technical commit. The matching target copies in compatibility metadata,
human-readable package guidance, the coherence and immutability checkers, and the changed-path
checker will move together. The binding commit itself will not alter protected contract content,
and verification controls must continue to reject an undeclared path, a mismatched candidate blob,
an incorrect range, and an incorrect target.

The alternative of exempting the aggregate fixture or removing a protected prefix creates a reusable
freeze bypass. Replacing the cumulative witness with only the narrow correction range makes earlier
protected `1.1.0` paths fail again. Adding a multi-candidate policy and overlap precedence would add
new checker semantics solely to represent history already captured by one exact cumulative range, so
it is rejected as unnecessary governance complexity. Leaving the previous endpoint bound makes the
approved correction impossible to validate and falsely describes the authoritative contract content.
Folding the rebinding into an unidentifiable working tree was also rejected because the gate requires
an immutable commit and independently reproducible cumulative and correction inventories.

### D7 — Re-derive package gate constants the comparator moves

`tests/verification/platform-coupling-mutations.test.mjs` pins an exact authored-reference count for
the SDK's platform-coupling inventory. That count is derived from the same `src/validation/semantic.ts`
this change already owns, so adding the comparator moves it: measured 122 with `semantic.ts` at the
merged planning baseline and 123 at the technical commit. The pin will be re-derived to the measured
value, and the control's path joins the closed owned-path inventory.

Relaxing the assertion to a bound or a regular expression was rejected: the pin exists to force a
human to notice that the platform-coupling surface moved, and a range would admit a real host coupling
under the same change. Leaving the path unowned was also rejected — the association gate correctly
reports a governed implementation path that no change claims, and declaring it is the honest
correction rather than an exception.

This is the same shape as the defects the preceding change recorded: the inventory already claimed the
source whose edit moves the constant, so the area was known to be implicated and only part of it was
moved. Ownership is not coverage.

## Risks / Trade-offs

- [One validator drifts from the other] → Run the same disagreement pair through both public
  validation boundaries and require identical outcomes.
- [The fix changes error precedence] → Assert descending order reports the order error and ascending
  order reaches resolution.
- [Astral conversion adds hot-path allocation] → Inputs are already bounded to 32 entries of at most
  256 UTF-16 code units; prefer the simpler auditable implementation at this non-dominant boundary.
- [Generated output is edited manually] → Change only the generator and regenerate/check the
  committed docs and fixtures.
- [Patch classification is mistaken for a new contract meaning] → Leave the canonical source and
  capability text unchanged and record that the code is conforming to their existing rule.
- [Gate rebinding becomes a broad exception] → Bind one named change, exact range, exact technical
  commit, and exact protected-path inventory; retain mutation tests for every fail-closed boundary.
- [The cumulative inventory is mistaken for #423 scope] → Record both ranges: the existing candidate
  base to the new endpoint for enforcement, and the merged #423 planning baseline to that endpoint
  for the exact six-path correction delta.
- [A later binding edit silently changes protected content] → Commit protected content first and
  require every protected blob at the PR head to match the named technical commit exactly.

## Migration Plan

Merge the corrected planning and assessment packet before creating the governed technical commit.
Regenerate contract artifacts, commit the closed technical path set, derive both the six-path
correction inventory and the cumulative protected inventory, bind the frozen-contract gates to that
exact endpoint, then validate the contract and SDK Core workspaces and run repository governance and
strict OpenSpec checks before delivery. Rollback is a branch revert before merge; no data migration,
version negotiation, or production rollout is involved.
