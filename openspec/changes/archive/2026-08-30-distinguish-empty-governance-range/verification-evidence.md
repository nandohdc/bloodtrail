# Verification evidence — #191

This evidence records executable observations for the bounded range-reporting change. It does not constitute human review, owner approval, independent assurance, merge authorization, or production authorization.

## Differential RED/GREEN proof

- Pre-fix source: `e0cb2a2a3566efe628ac69df34a3625afb608180`, with the current focused test overlaid in an isolated worktree.
- Candidate source: `c3377d478aaab439780cdf91f1b2b26f65be2421`, with the pending `rangeHead` completion overlaid in the isolated worktree.
- The focused `base === HEAD` regression failed against the pre-fix checker with the expected assertion mismatch: the reported base/count fields remained `null`.
- The same regression passed against the candidate and reported the resolved baseline with exactly zero inspected commits and paths.
- A direct source contract asserted that the empty-range branch sets `rangeBase`, `rangeHead`, `rangeCommitCount`, and `rangePathCount`; it passed for the candidate after the `rangeHead` completion.

## Five-phase differential matrix

The matrix used an exact full-SHA base for the empty arm and a raw `HEAD` ref plus one untracked `zz-unclassified-probe.txt` for the non-empty/null-control arm. It compared the pre-fix source with the candidate source.

| Phase | Empty pre-fix | Empty candidate | Non-empty pre-fix | Non-empty candidate |
| --- | --- | --- | --- | --- |
| `bootstrap` | exit 1, `bootstrap-re-entry` | exit 1, unchanged | exit 1, unchanged | exit 1, unchanged |
| `activation` | exit 0, unchanged | exit 0, unchanged | exit 0, unchanged | exit 0, unchanged |
| `assessment` | exit 0, unchanged | exit 0, unchanged | exit 0, unchanged | exit 0, unchanged |
| `implementation` | exit 0, short pass line | exit 0, `inspected 0 commit(s) and 0 path(s) from c3377d478aaa` | exit 1, `path-unclassified` | exit 1, `path-unclassified` |
| `final` | exit 0, short pass line | exit 0, `inspected 0 commit(s) and 0 path(s) from c3377d478aaa` | exit 1, `path-unclassified` | exit 1, `path-unclassified` |

Only the two perimeter-bearing empty-range cells gained the zero-count suffix. The raw-ref probe remains a failure with the exact diagnostic `[path-unclassified] zz-unclassified-probe.txt: path matches no declared classification; an unclassified path fails closed rather than passing`.

## Trusted-baseline comparison

`node openspec/scripts/run-governance-dual-check.mjs --base d9ff9aaa6f6cd7185dbe62767ae8457e14d515e4 --phase final --json` reported:

- trusted baseline: exit `0`, source `d9ff9aaa6f6cd7185dbe62767ae8457e14d515e4`, checker blob `93a29747c17f36ac29811433dd9ec63f208b4d81`, zero diagnostics;
- candidate: exit `0`, source `candidate (working tree)`, checker blob `9343b218811097b4eaff672d3d5b1f589f305999`, zero diagnostics; and
- `disagreement: null`.

## Isolated exact-commit matrix

Before the `rangeHead` completion, an isolated checkout at `c3377d478aaab439780cdf91f1b2b26f65be2421` passed `npm run check:generated --prefix packages/security-audit-sdk-core`, the complete SDK validation chain (including 112 runtime tests and 239 verification tests), contract validation (14 tests), all 213 design-pattern-governance tests, strict OpenSpec validation, and a final-phase checker run from `main@d9ff9aaa6f6cd7185dbe62767ae8457e14d515e4`.

The isolated candidate matrix was rerun after the `rangeHead` completion and this evidence/ADR reconciliation. It validates these candidate bytes only; human review, final owner decision, merge, and archive remain pending.
