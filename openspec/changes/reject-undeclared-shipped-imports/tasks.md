## 1. Decision and scope

- [x] 1.1 Record the gap, the repaired-defect context, and the traceability in the proposal — done: `proposal.md` distinguishes the #68 repair from this regression lock and traces PLAN-036, PLAN-038, and PLAN-074.
- [x] 1.2 Bound the change to the declared owned paths — done: the full assessment declares the four exact SDK paths and no governance-core, contract, generated, manifest, lockfile, or compatibility path.

## 2. Implementation and verification

- [x] 2.1 Prove the control fails on an undeclared shipped import before it exists — done: the dedicated RED run reported 17 tests and 17 failures; unit controls failed on the absent policy module, and the package-copy mutation failed because the existing gate named neither the shipped artifact nor the AJV module.
- [x] 2.2 Implement shipped-artifact import classification with a role-scoped policy — done: the pure inspector parses every shipped code artifact with TypeScript and classifies relative, role-approved builtin, declared-dependency, and verified self-reference specifiers.
- [x] 2.3 Wire the classification into the dependency gate with bounded diagnostics — done: `test:dependencies` consumes the package dry-run inventory before production-tree inspection and caps diagnostics at 50 entries with bounded artifact, specifier, and class components.
- [x] 2.4 Cover the bundled, declared, built-in, dynamic, and empty-inventory classes — done: 20 focused tests cover approved live output, bundled and declared fixtures, role-specific and unprefixed built-ins in both roles, self-references, static positions, dynamic forms, aliased and computed require, deterministic ordering, unreadable and unknown-role artifacts, empty inventory, and the bounded control-character-safe AJV mutation.
- [x] 2.5 Record the inspection in the dependency record — done: the Rules section records shipped-artifact module-specifier inspection without changing the dependency table.
- [x] 2.6 Run the full SDK and contract gate chains — done: the Sonar-style-remediated empty-index SDK validation chain passed all 19 gates with 223 verification tests, the contract validation chain passed all 14 tests, and `npm audit --audit-level=low` found no vulnerabilities.
- [x] 2.7 Run the governance checkers and strict OpenSpec validation — done: final-phase governance inspected 11 paths with no findings, candidate and baseline agreed, the governance suite passed 201 tests, and strict active and archived OpenSpec validation passed 5 and 17 items respectively.

## 3. Landing (human-owned)

- [ ] 3.1 Owner merges the implementation PR
- [ ] 3.2 Fold the capability requirement into the canonical spec
- [ ] 3.3 Archive the change as a complete relocation
- [ ] 3.4 Close #69 with evidence
