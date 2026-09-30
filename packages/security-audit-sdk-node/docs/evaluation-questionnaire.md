# SDK Evaluation Questionnaire & Debrief Script

This document captures quantitative metrics (M1–M8) and qualitative feedback from evaluators testing the `@bloodtrail/security-audit-sdk-node` evaluation alpha.

---

## Evaluator Information

- **Evaluator Name / Identifier:**
- **Date Completed:**
- **Evaluation Environment:** (Node.js version, OS, test service framework)
- **Service Domain / Context:**

---

## Part 1: Quantitative Evaluation Metrics (M1–M8)

### Metric M1: Time to First Valid Event
*Measured from unpacking the kit to emitting a valid, accepted event using the quickstart, unassisted.*
- **Time Elapsed (minutes):** _______ min
- **Threshold Target:** $\le 15$ minutes. *(Note: $>30$ minutes triggers a P0 documentation or SDK defect issue).*
- **Notes on Quickstart Clarity:**

---

### Metric M2: Own-Service Integration
*Time required to integrate four core audit events into your own test service: authentication success, authentication failure, authorization denial, and one operation-handle-based resource modification.*
- **Authentication Success Time:** _______ hours
- **Authentication Failure Time:** _______ hours
- **Authorization Denial Time:** _______ hours
- **Operation-Handle Modification Time:** _______ hours
- **Total Work Time:** _______ hours (Median target: $\le 2$ hours per event; maximum ceiling: $\le 4$ hours per event).
- **Integration Blockers or Difficulties Encountered:**

---

### Metric M3: Seeded Invalid-Call Diagnosis
*Score achieved on diagnosing the 5 seeded invalid calls in `docs/seeded-invalid-calls.md` using only the SDK error output and `docs/error-catalog.md`.*
- **Score (out of 5 correct):** _______ / 5
- **Threshold Target:** $\ge 4 / 5$ correct diagnoses.
- **Which error messages or paths were difficult to diagnose?**

---

### Metric M4: Help Requests During Setup (M1)
*Number of external help requests or clarification questions asked during initial quickstart onboarding.*
- **Total Help Requests:** _______
- **Threshold Target:** $\le 1$ help request.

---

### Metric M5: Field Populability
*Were there any required fields in the demonstrated events that could not be populated from your service context?*
- **Any Unpopulatable Fields?** [ ] Yes  [ ] No
- **If Yes, which fields and why?**
- **Threshold Target:** No required field unpopulatable for $\ge 2$ evaluators.

---

### Metric M6: Core Adoption Value
*Primary decision question:*
> **"Would you use this instead of emitting your own audit JSON?"**
>
> - [ ] **Definitely**
> - [ ] **Probably**
> - [ ] **Probably Not**
> - [ ] **Definitely Not**

- **Concrete Benefits Identified:** (What specific value did the SDK provide over manual JSON logging? E.g., type safety, schema guarantees, context propagation, tamper detection).

---

### Metric M7: Critical Defects in MVP Path
*Number of open critical defects (security issues, crashes, unrecoverable states) encountered during evaluation.*
- **Critical Defects Found:** _______
- **Threshold Target:** Exactly 0 open critical defects in MVP path.

---

### Metric M8: HTTP End-to-End Reliability
*Did HTTP event delivery to the receiver work reliably end-to-end?*
- [ ] **Yes, worked reliably end-to-end**
- [ ] **No, experienced connection drops or unhandled delivery failures**
- **Threshold Target:** 100% operational across all evaluators.

---

## Part 2: Debrief Interview Script

The debrief interview is conducted as a structured 30-minute conversation between the evaluation lead and the evaluator.

### 1. Developer Experience & Ergonomics
1. *How natural did the authoritative context model feel (`runWithContext`, `authenticatedHumanActor`, `authoritativeTenant`)?*
2. *Did you encounter any situations where context was lost across asynchronous promise chains or callbacks?*
3. *How was your experience working with operation handles (`beginOperation`, `markCommitted`)? Did the commit lifecycle align with your database transaction flow?*

### 2. Error Diagnostics & Catalog
1. *When an SDK call was rejected, did the returned `code` and `path` immediately indicate what was wrong?*
2. *Did you consult `docs/error-catalog.md`? Was the guidance actionable and easy to find?*

### 3. Missing Capabilities vs Unwanted Complexity
1. *Reviewing `docs/supported-and-planned.md`, which planned feature would be most critical before you could adopt this in production?*
2. *Were there any parts of the SDK API surface that felt overly complex, redundant, or unnecessary for your use case?*

### 4. Overall Decision Summary
- **Evaluation Lead Assessment:** [ ] Continue  [ ] Change Direction  [ ] Stop
- **Summary Justification:**
