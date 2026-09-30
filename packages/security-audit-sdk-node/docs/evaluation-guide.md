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

Check the kit before you install or run anything from it. Every check uses only `shasum`, which ships with
macOS and, on Linux, with Perl. The checks inside the unpacked kit name only files the kit ships.

1. **Check the archive.** An archive cannot contain its own digest, so the facilitator records the
   archive's SHA-256 on the evaluation issue when the kit is distributed. Before unpacking, run
   `shasum -a 256` on the archive file, and compare the result with the value on the evaluation issue.

2. **Check every file.** Inside the unpacked kit directory, run:

   ```sh
   shasum -a 256 -c checksums.sha256
   ```

   Every line must end in `OK`. The list covers every kit file except `identity.json` and the list itself:
   the three tarballs, `package.json`, `pnpm-workspace.yaml`, the documents and the examples.

3. **Check the list against the identity.** Run:

   ```sh
   shasum -a 256 checksums.sha256
   ```

   The digest it prints must equal `checksum_list.sha256` in `identity.json`.

**How the identity is defined.** `identity.json` declares `identity_format_version` 2. It records the
commit the kit was built from and each tarball's SHA-256, together with these digests, each a SHA-256 in
lowercase hexadecimal:

- `package_set_digest`: the digest of one line per tarball, `<sha256>  <file name>` followed by a newline,
  in code-point order of file name;
- `manifest_digest`: the digest of `package.json`;
- `checksum_list.sha256`: the digest of `checksums.sha256`;
- `kit_digest`: the digest of the package-set digest, the manifest digest and the checksum-list digest,
  each followed by a newline, in that order.

A kit built before format 2 declares no format version, and its kit digest does not cover a checksum list.
Never compare its digests with a format 2 kit's.

**Facilitator.** At distribution, run `shasum -a 256` on the archive and post the result on the evaluation
issue, together with the kit's `kit_digest`. Evaluators compare the archive against that comment in step 1.
The facilitator answer key for the M3 seeded invalid-call exercise lives at
`facilitator/seeded-invalid-calls-answer-key.md` in the repository tree; evaluators never receive it, and
the kit builder never packages or copies it into the distributed evaluation kit.

---

## 4. How to Report

At the conclusion of your evaluation (or when encountering a blocking issue):

1. **Complete the Evaluation Questionnaire:**
   Fill in all sections of `docs/evaluation-questionnaire.md`, recording exact wall-clock times for M1 (time to first valid event) and M2 (service integration), as well as results for M3 through M8.
2. **Participate in the Debrief Session:**
   Schedule a 30-minute debrief interview with the Bloodtrail maintainers to review your questionnaire, walk through any friction points, and provide qualitative feedback.
3. **Submit Defect Reports:**
   If you encountered SDK bugs or documentation ambiguities, file issues with sanitized logs and reproduction snippets referencing the evaluation alpha.
