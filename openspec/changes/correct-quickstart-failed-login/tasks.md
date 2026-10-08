## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern assessment for `correct-quickstart-failed-login`. Verify `openspec validate correct-quickstart-failed-login --strict`, `node openspec/scripts/generate-assessment.mjs --change correct-quickstart-failed-login --check` and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change correct-quickstart-failed-login` pass.

## 2. Quickstart correction

- [x] 2.1 Change the failed-login call to use `anonymousActor()` and `authoritativeTenant({ scope: "tenantless" })` without naming a submitted username, account identifier, or display name; preserve the separate per-request context-scope half.
- [x] 2.2 Add the settled opening-paragraph sentence explaining why a submitted username cannot identify the actor and when a server-resolved tenant may replace the tenantless scope.

## 3. Verify

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on Node 26 and `npm test --prefix packages/security-audit-sdk-node` on Node 24.2.0.
- [x] 3.2 Run the governance chain: generated-artifact and changed-path checks, strict OpenSpec validation, generated-assessment drift, final design-pattern governance, dual checks, contract reuse, normative precedence, `make`, and `git diff --check`.
- [x] 3.3 Build a distributable kit, unpack it in a fresh directory, run the byte-for-byte copied failed-login block and its print-sink variant, run the kit gate, and record every command and output.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive `correct-quickstart-failed-login` in a separate pull request.
