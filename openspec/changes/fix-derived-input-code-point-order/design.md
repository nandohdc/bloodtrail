## Context

See `proposal.md` for motivation. The canonical validator and the SDK Core validator are separate
authored implementations of the same `1.1.0` semantic rule. Both currently use JavaScript relational
string comparison, whose UTF-16 code-unit order differs from Unicode code-point order when astral
characters are present. Duplicate detection precedes ordering, and ordering precedes input-path
resolution, so the repair must preserve that diagnostic precedence.

The generator owns committed contract fixtures and documentation. Although all currently resolvable
canonical and registered-extension paths are ASCII, the structural contract permits any bounded
non-empty string and the semantic validator must order it before deciding whether it resolves.

## Goals / Non-Goals

**Goals:**

- Give both validators the same total, deterministic lexicographic order over Unicode code points.
- Pin both directions of the astral/BMP disagreement without relying only on prose.
- Keep generated artifacts derived exclusively from the canonical generator.
- Preserve current validation-error precedence, bounds, and secret-free diagnostics.

**Non-Goals:**

- Restrict provenance inputs to ASCII or normalize Unicode.
- Export a new comparator API, share runtime code across package boundaries, or add a dependency.
- Change the `1.1.0` contract meaning, schema version, path-resolution rules, or error vocabulary.

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

## Migration Plan

Regenerate contract artifacts, validate the contract and SDK Core workspaces, then run repository
governance and strict OpenSpec checks before delivery. Rollback is a branch revert before merge; no
data migration, version negotiation, or production rollout is involved.
