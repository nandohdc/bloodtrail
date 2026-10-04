# SDK Evaluation Guide

This guide establishes the operating rules, verification procedures, stop conditions, and reporting workflow for developers participating in the `@bloodtrail/security-audit-sdk-node` evaluation alpha program.

---

## 1. Operating Rules & Constraints

Participation in the evaluation alpha requires strict adherence to three non-negotiable boundaries:

1. **Synthetic Data Only:**
   Under no circumstances may real production credentials, real personal identifiable information (PII), live customer records, or real secret tokens be processed, passed to the SDK, or delivered over the HTTP sink. All actor identifiers, emails, tenant IDs, and payload attributes must use synthetic, mock values (e.g., `actor-eval-1`, `tenant-eval-alpha`, `pseudo-actor-...`).

2. **Non-Production Environments Only:**
   The evaluation kit is designed exclusively for evaluation against local test rigs, developer laptops, sandbox services, or isolated continuous integration nodes. It must **never** be deployed to, integrated with, or invoked by any production service, staging environment with live data, or customer-facing host.

3. **Two-Week Evaluation Window:**
   The evaluation window extends for exactly **two calendar weeks** from the timestamp of kit receipt.
   - At most two kit re-issues are permitted during the evaluation window to remediate blocking defects.
   - A kit re-issue resets only the metric affected by the blocking defect.

---

## 2. Stop Conditions (What To Do When Something Goes Wrong)

If an unexpected condition arises during evaluation, evaluators must immediately determine if it triggers one of the two mandatory stop conditions:

### Stop Condition 1: Non-Synthetic Data Leak
- **Trigger:** Real customer data, live credentials, real production secrets, or non-synthetic personal data reaches a receiver or is logged by the SDK.
- **Action:** **STOP AND PURGE IMMEDIATELY**.
  1. Terminate all running service and receiver processes at once.
  2. Permanently purge and wipe receiver log files, memory stores, and test databases containing the data.
  3. Notify the evaluation lead immediately with details of the exposure.

### Stop Condition 2: Critical Security Defect
- **Trigger:** Discovery of a critical security vulnerability, such as unhandled credential disclosure, path traversal, untrusted code execution, or context boundary leakage across concurrent requests.
- **Action:** **STOP AND FIX IMMEDIATELY**.
  1. Halt further evaluation runs.
  2. Document reproduction steps using synthetic inputs.
  3. Submit the finding directly to the project security contact for immediate triage and patch issuance.

### General Operational Troubleshooting
For non-critical defects (e.g., syntax errors, unexpected validation rejections, or transport timeouts):
- Refer to `docs/error-catalog.md` to identify the diagnostic code and failure category.
- Verify that your payload matches Contract 2.1.0 field definitions.
- Record the time spent troubleshooting and any questions asked for evaluation metric accounting.

---

## 3. How to Check Kit Identity

Check the kit before you install or run anything from it. Every integrity command below uses only `shasum`,
which ships with macOS and, on Linux, with Perl. The commands inside the unpacked kit name only files the
kit ships.

1. **Check the archive.** An archive cannot contain its own digest, so the evaluation facilitator records the
   archive's SHA-256 on the evaluation issue when the distributable kit is distributed. Before unpacking,
   run `shasum -a 256` on the archive file, and compare the result with the archive digest on the
   evaluation issue.

2. **Check the kit digest.** Inside the unpacked kit directory, run:

   ```sh
   shasum -a 256 -c kit-digest.sha256
   ```

   It must print `checksums.sha256: OK`. Then run:

   ```sh
   shasum -a 256 checksums.sha256
   ```

   The digest it prints must equal the kit digest the evaluation facilitator posted on the evaluation issue.

3. **Check every listed file.** Run:

   ```sh
   shasum -a 256 -c checksums.sha256
   ```

   Every line must end in `OK`. The list covers every kit file except itself and `kit-digest.sha256`,
   including `identity.json`: the three tarballs, `package.json`, `pnpm-workspace.yaml`, the documents and
   the examples.

**How the identity is defined.** `identity.json` declares these six format-3 keys:
`identity_format_version` (3), `commit`, `distributable`, `artifacts`, `package_set_digest`, and
`manifest_digest`. `commit` is the commit the kit was built from, `distributable` records whether the kit
is distributable, and `artifacts` records each tarball's SHA-256. `package_set_digest` is the SHA-256 of
one line per tarball, `<sha256>  <file name>` followed by a newline, in code-point order of file name;
`manifest_digest` is the SHA-256 of `package.json`. The kit digest is the SHA-256 of
`checksums.sha256`; it is recorded in `kit-digest.sha256`, outside the checksum list.

A kit whose identity declares format 2, or no format version (a kit v1 identity), computes its kit digest
differently. Never compare either format's digests with a format-3 kit's. The kit gate refuses format 2 and
kit v1 identities by name.

**Evaluation facilitator.** At distribution, post both the archive digest and the kit digest on the
evaluation issue. Evaluators compare the archive digest against that issue in step 1 and the kit digest in
step 2. Neither digest authorizes a release. The facilitator answer key for the M3 seeded invalid-call
exercise lives at `facilitator/seeded-invalid-calls-answer-key.md` in the repository tree; evaluators
never receive it, and the kit builder never packages or copies it into the distributed evaluation kit.

---

## 4. How to Report

At the conclusion of your evaluation (or when encountering a blocking issue):

1. **Complete the Evaluation Questionnaire:**
   Fill in all sections of `docs/evaluation-questionnaire.md`, recording exact wall-clock times for M1 (time to first valid event) and M2 (service integration), as well as results for M3 through M8.
2. **Participate in the Debrief Session:**
   Schedule a 30-minute debrief interview with the Bloodtrail maintainers to review your questionnaire, walk through any friction points, and provide qualitative feedback.
3. **Submit Defect Reports:**
   If you encountered SDK bugs or documentation ambiguities, file issues with sanitized logs and reproduction snippets referencing the evaluation alpha.
