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

Before installing or executing code from the evaluation kit, verify the integrity and provenance of the distribution:

1. **Inspect `kit-identity.json`:**
   The kit distribution root includes `kit-identity.json` containing cryptographic SHA-256 digests for all bundled tarballs and manifests:
   ```bash
   cat kit-identity.json
   ```

2. **Verify Tarball Checksums:**
   Generate the SHA-256 digest of the downloaded tarballs and confirm exact matches against `kit-identity.json`:
   ```bash
   shasum -a 256 *.tgz
   ```

3. **Verify Single Core Copy:**
   Confirm that the package manager installed exactly one authoritative copy of `@bloodtrail/security-audit-sdk-core`:
   ```bash
   node check-duplicate-core.mjs
   # Output must report: duplicate-copy-probe:pass
   ```

---

## 4. How to Report

At the conclusion of your evaluation (or when encountering a blocking issue):

1. **Complete the Evaluation Questionnaire:**
   Fill in all sections of `docs/evaluation-questionnaire.md`, recording exact wall-clock times for M1 (time to first valid event) and M2 (service integration), as well as results for M3 through M8.
2. **Participate in the Debrief Session:**
   Schedule a 30-minute debrief interview with the Bloodtrail maintainers to review your questionnaire, walk through any friction points, and provide qualitative feedback.
3. **Submit Defect Reports:**
   If you encountered SDK bugs or documentation ambiguities, file issues with sanitized logs and reproduction snippets referencing the evaluation alpha.
