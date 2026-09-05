# Tasks: Execute Node 24 Matrix and Pin Node 26.5.0 in CI

- [x] 1. Pin exact Node 26.5.0 and execute Node 24.2.0 matrix leg in CI
  - [x] 1.1 Update `.github/workflows/ci.yml` to pin `node-version: "26.5.0"` across jobs (`ci`, `sdk`, `contract`, `design-pattern-governance`, `coverage`)
  - [x] 1.2 Add the Node `24.2.0` `test:matrix` execution step to the `sdk` job in `.github/workflows/ci.yml`
- [x] 2. Add verification mutation test coverage for Node compatibility policy
  - [x] 2.1 Add mutation test asserting dropping Node 24 from `compatibility.json` fails `check-coherence.mjs` and `check-compatibility.mjs`
  - [x] 2.2 Add mutation test asserting dropping Node 24 from `package.json` engines fails `check-coherence.mjs` and `check-compatibility.mjs`
- [x] 3. Verify matrix execution and governance coherence
  - [x] 3.1 Run SDK matrix-safe product loop on both Node 24.2.0 and Node 26.5.0
  - [x] 3.2 Run full SDK validation and cross-artifact coherence checks
  - [x] 3.3 Validate OpenSpec and governance dual check
