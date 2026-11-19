# Tasks: Deploy the collector for a local PoC and a live PoC

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta specs (`security-audit-collector-server`, `security-audit-collector`,
  `collector-storage-semantics`, `security-audit-sdk-core`, `security-audit-sdk-node`, `repository-topology`,
  `ci-topology`) and tasks from the 2026-11-18 owner decisions.
  Verify that `openspec validate add-collector-live-poc-deployment --strict` passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change add-collector-live-poc-deployment --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change add-collector-live-poc-deployment`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [ ] 1.3 Record the owner's 2026-11-18 authorization on the tracking issue, quoting its scope:
  - the local PoC and the live PoC;
  - one business application;
  - the three authentication events;
  - their `operational_short` deviation from the catalog;
  - SDK use through the frozen delivery primitives, from a commit to be recorded there.

  Verify that the issue comment exists and that proposal.md links it.
- [ ] 1.4 Once every required context is green, merge the proposal PR as a merge commit. Verify by recording the
  proposal commit and the merge commit here.

## 2. Slice 1: asynchronous port, stored retention classes, PostgreSQL backend

- [ ] 2.1 Add tests to the collector library that pin the asynchronous ingress. They should show that:
  - `submit()` returns a promise with and without storage;
  - a pending `put` holds back the outcome;
  - a rejected `put` is indeterminate;
  - two concurrent submissions of one identity give one `persisted` and one duplicate acknowledged `persisted`;
  - a stream body that fails authentication is never read;
  - an oversized stream stops being read once it passes `event_max_bytes`;
  - string and stream bodies of the same bytes give the same outcome.

  Verify that they fail on the synchronous ingress.
- [ ] 2.2 Make `StoragePort` asynchronous, make `submit()` always return a promise and accept a `string` or
  `AsyncIterable<Uint8Array>` body, and adapt `SqliteStorage`, the storage and ingress tests, and the
  package-contents probe. Update the Node binding's evaluation receiver to await `submit()`, keeping its
  statuses and its string-anchored receiver controls intact. Verify that:
  - `npm run validate --prefix packages/security-audit-collector` passes;
  - the `secure_delete` residue probe still passes;
  - `npm run validate --prefix packages/security-audit-sdk-node` passes, including the evaluation kit and
    receiver controls.
- [ ] 2.3 Add `storage.storedRetentionClasses`, with tests that:
  - an undeclared class is declined with `COLLECTOR_RETENTION_CLASS_DECLINED` before the port is called;
  - an empty or unknown class fails construction;
  - leaving it unset stores all three classes.

  Verify that the tests fail before the change and pass after.
- [ ] 2.4 Update the collector README (async usage, stored classes) and `CONTEXT.md` (add **live PoC** and
  **local PoC**). Verify that the README examples type-check under `npm run build`.
- [ ] 2.5 Scaffold `packages/security-audit-collector-server`: a private, UNLICENSED, standalone `package.json` with
  the collector library by `file:` reference, `pg` and `@aws-sdk/rds-signer`, plus its dependency and scope gates.
  Give it the mandatory check set:
  - build, typecheck and runtime tests;
  - a production-only packed install whose closure is exactly the collector, `pg` and `@aws-sdk/rds-signer`;
  - a deterministic mutation control that plants a forbidden dependency and a forbidden built-in;
  - enforced line and branch coverage thresholds.

  Add it to `DECLARED_PACKAGES` and its test, the `Makefile` targets, the per-concern CI jobs, and
  `sonar-project.properties`. Run `npm audit --omit=dev` on its lockfile. If anything is at or above the CI
  threshold, stop and report it for an owner decision; never add an override. Verify that:
  - `node .github/scripts/check-package-discovery.mjs` and its test pass with the server declared;
  - the mutation control fails the dependency and scope gates on its plants;
  - the packed install passes;
  - the coverage thresholds are enforced.
- [ ] 2.6 Extract the storage-port conformance suite so it runs against both `SqliteStorage` and `PostgresStorage`,
  and implement `PostgresStorage` with the design D4 schema and result mapping. Verify that the suite passes against
  a `postgres` service container in CI, and that a severed-connection test reports `indeterminate`.
- [ ] 2.7 Add the database connection layer: IAM tokens through `@aws-sdk/rds-signer` with connection lifetime under
  15 minutes, `verify-full` TLS against the bundled RDS CA, and the `COLLECTOR_DB_MODE=local` switch. Verify with
  tests that an untrusted certificate is refused, that a token is requested once per new connection, and that
  startup refuses local mode together with `COLLECTOR_ENV=live`.
- [ ] 2.8 Update `CLAUDE.md`, `AGENTS.md`, `.hermes.md`, `README.md` and `SECURITY.md` wherever they state the workspace count, the
  collector's storage boundary, or that no real-user data is processed. Verify that `test:coherence` and the package-discovery check both pass.

## 3. Slice 2: HTTP endpoint and API-key authenticator

- [ ] 3.1 Implement the API-key authenticator over a mounted `keys.json` of application name to SHA-256 hash, using
  `timingSafeEqual`. Verify with tests that a missing, malformed or unknown key is rejected before the body is read,
  that the sender identity is the application name, and that no key value appears in any output, log or metric.
- [ ] 3.2 Implement `POST /v1/events` and `GET /healthz` on `node:http`, handing the request stream to `submit()`
  with the design D6 status and acknowledgment mapping. Make startup fail before listening when storage or any owner
  role is missing (D10). Verify with tests over a real socket that:
  - every ingress outcome gets its fixed status and body;
  - an oversized body is not buffered past the cap;
  - health discloses nothing;
  - the server never listens without storage.
- [ ] 3.3 Add conformance tests that drive the D11 composition (`createHttpDeliveryHandoff` over
  `createFetchHttpExchange` with `createBoundedDeliveryRetry`), as dev dependencies, against the real server over
  `PostgresStorage` on the CI container. The tests send the three live PoC events built by the SDK core as
  `operational_short`. Verify that:
  - a stored event and its retry are both `acknowledged`;
  - a storage failure is retryable;
  - every other rejection is permanent;
  - with two server instances sharing one database, one event gives one `persisted` and one duplicate acknowledged
    `persisted`.
- [ ] 3.4 Add the metrics port and the per-request log line (D9). Verify with sentinel values in the body, key,
  sender and tenant that no sentinel appears in any log line or metric, and that the metrics port is not on the
  load-balanced `Service`.
- [ ] 3.5 Write the server README: endpoints, statuses, key rotation, configuration, and the known limits (VACUUM
  residue, backups, traffic from the load balancer to the pod, backend-only senders). Verify that each documented configuration variable
  is one the server reads.

## 4. Slice 3: image, manifests, local PoC

- [ ] 4.1 Add the multi-stage Dockerfile (distroless Node 24, non-root, read-only root filesystem, RDS CA bundled)
  and the migrate entry point. Verify that the image builds, runs as non-root, and passes `/healthz`.
- [ ] 4.2 Add the Kustomize `base` and the `overlays/local` and `overlays/live` overlays, as in design D8. Verify
  that `kubectl kustomize` renders both overlays, and that the live overlay contains no database password and sets
  2 replicas.
- [ ] 4.3 Add a `make` target for the local PoC that starts LocalStack, creates RDS and EKS, applies
  `overlays/local`, runs the migration Job, and submits a synthetic event. Verify that it reports `persisted`, and
  that the documentation states the emulator does not validate IAM tokens or enforce TLS.
- [ ] 4.4 Add the non-required `localstack` CI job, gated on `LOCALSTACK_AUTH_TOKEN` and running the 4.3 target.
  Verify that it renders as a skip when the secret is absent, and that it is not in branch protection's required
  set.
- [ ] 4.5 Write the go-live checklist into the server README:
  - the owner roles are named;
  - the deletion job has landed (separate issue);
  - an AWS check shows a wrong or expired token is refused;
  - `rds.force_ssl=1` is set;
  - the backup retention is 1 day;
  - the business application tags `operational_short`;
  - the SDK tarball commit is recorded on the tracking issue.

  Verify that every go-live item in the spec has a checklist line naming its evidence.

- [ ] 4.6 Document the producer integration in the server README: the D11 composition, the `operational_short`
  override, and the `npm pack` commands for both SDK packages from a recorded commit. Verify that the packed
  tarballs install into a scratch project outside the repository, and deliver a synthetic event to the local PoC
  as `persisted`.

## 5. Verification

- [ ] 5.1 Run `make governance-gates` on the final technical commit and record the result. Verify that every
  workspace, including the server, passes.
- [ ] 5.2 Run `openspec validate add-collector-live-poc-deployment --strict` and
  `check-design-pattern-governance --phase final`. Verify that both pass on the final technical commit.

## Workflow follow-up

- Fold the delta specs into `openspec/specs/` in their own PR, then archive the change in a separate PR with a merge
  commit.
- The live PoC opens to real traffic only after every go-live checklist item is recorded as met.
