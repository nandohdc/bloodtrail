# Issue #131 — Implement the Approved React Native Evidence Adapter — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #123, #129 and **#86**. This is the only Wave 5
> issue that depends on Wave 2, and that asymmetry is deliberate and load-bearing: unlike #124 (browser),
> which must have **no Core dependency**, this package **is** a Core binding — the 2026-08-10 correction on
> #124 says so explicitly. So #131 waits for the platform-neutral Core to exist. If #129 records NO-GO
> (its plan's leading option), #131 does not disappear — it re-scopes to a Core binding without
> attestation, which is a substantially smaller issue. Check that first.

**Goal:** A React Native package reusing Core semantics and ClientEvidenceEnvelope v1, with no Node or
browser runtime leakage, only approved mobile context and attestation adapters, and deterministic
behaviour on missing native modules and unsupported platforms.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #123, #129, #86.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #131, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #123, #129, **#86** — all blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-059 | defer React Native specifics; implement **only after** the neutral Core and client governance are established |
| The asymmetry | #124 browser: **no Core dep**. #131 React Native: **is** a Core binding — from #124's 2026-08-10 correction |
| Core SPIs (from #86) | ids, clock, byte length, timer, schema runtime, plus a `ContextProvider` |
| Node binding precedent | #87 — the shape #131 mirrors for a different host |
| Forbidden terms | `adapter`, `browser`, `telemetry`, `transport`, `collector`, `detection`, `analytics` — filenames and exports |
| Zero-dependency policy | zero runtime dependencies, enforced by three gates |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — #131 is #87 for a different host, and that is the cheapest way to think about it

#87 implements Core's SPIs with Node primitives. #131 implements the same SPIs with React Native
primitives: an id source, a clock, byte length, timers, a schema runtime, and a context provider. The
**shape is already designed** by #86, and #87 is the worked example.

Practical consequence: if #86 and #87 are done well, #131 is a mechanical exercise plus the mobile-specific
problems in F3.

### F2 — If #129 records NO-GO, #131 shrinks and should be re-scoped, not closed

#131 declares #129 because of "approved mobile context/attestation adapters". Without attestation, #131 is
still a valid Core binding for React Native, producing envelopes at baseline trust. **That is a coherent,
smaller issue** — and it would then depend only on #123 and #86.

Re-scope rather than close, and say so on the issue when #129 answers.

### F3 — Three mobile-specific problems have no Node or browser analogue

| Problem | Why it is different | Consequence |
| --- | --- | --- |
| **Missing native modules** | a JS bundle can load while its native counterpart is absent | must degrade to a documented bounded outcome, not throw |
| **Lifecycle / background** | the app is suspended and resumed; timers and in-flight work behave unlike a server process | the timer SPI's `unref`-equivalent has no meaning; state the degradation |
| **Forged native-module output** | the JS side cannot verify what a native module returned | #131's fourth criterion — a forged native output must fail or remain baseline trust |

The third is the security-relevant one: a native module is an attacker-controlled boundary from the JS
side's perspective, exactly as the host page is for the browser package.

### F4 — "No Node/browser-only dependencies" needs a coupling policy, which is #88's shape again

React Native's runtime is neither Node nor a browser. A package that accidentally imports `node:crypto` or
touches `window` will work in some environments and fail in others. The gate is a per-package coupling
policy declaring React Native's approved globals — a third role beyond Core and Node.

### F5 — The supported-target matrix must be enumerated, and "Expo/bare/native combinations" is a matrix

#131's out-of-scope line says supporting unapproved combinations is out of scope, which implies an approved
list exists. It does not. Someone must enumerate: which React Native versions, Expo managed vs bare, iOS
and Android minimums. **That enumeration is a prerequisite nobody owns** — flag it.

### F6 — Envelope output must match #124's byte for byte in shape

Both packages produce ClientEvidenceEnvelope v1. If they diverge, #126's ingress validation sees two
dialects. The test: generate an envelope from each package with equivalent inputs and assert schema
validity plus structural equivalence.

### F7 — Zero runtime dependencies is going to be hard here

React Native packages conventionally depend on `react-native` as a peer and often on native module
wrappers. The repository's policy is zero runtime dependencies with `peerDependencies` **also** empty and
gated. **That is a real conflict** and it must be resolved in the design, not discovered in CI. A peer
dependency on `react-native` may be unavoidable, which would require an explicit, governed exception.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #86 is complete** — Core exists with its SPIs. If not, stop.
- [ ] 0.2 **Confirm #123's envelope is final.**
- [ ] 0.3 **Read #129's decision.** On NO-GO, re-scope #131 to drop attestation (F2) rather than closing it.
- [ ] 0.4 Confirm #121's authorization covers the React Native platform specifically.
- [ ] 0.5 **Resolve F7** — can this package have zero runtime and peer dependencies? If not, the exception
      is a prerequisite decision.

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change, or a dedicated change.
- [ ] 1.2 Full assessment — `public_api`, `integration`, `security_sensitive_behavior`.
- [ ] 1.3 The design is #87's table for a new host: Core SPI → React Native implementation → equivalence
      test (F1), plus the three mobile problems (F3), the coupling policy (F4), the target matrix (F5), and
      the dependency resolution (F7).

## Task 2: RED then GREEN — nine arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| U1 | imports in each approved React Native target | loads; **no Node or browser-only dependency** (F4) |
| U2 | canonical envelope generated | matches #123's schema and #124's structure (F6) |
| U3 | a native module absent | documented bounded fallback, **no throw** (F3) |
| U4 | app backgrounded and resumed mid-operation | documented behaviour; no lost or duplicated envelope |
| U5 | forged native-module output | fails or remains **baseline trust** (F3) |
| U6 | unsupported platform or version | deterministic failure (F5) |
| U7 | serialization round trip | envelope survives the RN bridge unchanged |
| U8 | dependency and bundle inspection | matches the resolved policy from F7 |
| N0 | **null control** — normal operation on a supported target | envelope valid; no diagnostics |

## Task 3: Verify, commit, PR, close

- [ ] 3.1 Run the approved React Native target matrix; dependency inspection; pack/install tests;
      native-adapter negative fixtures.
- [ ] 3.2 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.3 Closing comment: the nine arms, the supported target matrix, and the statement that runtime
      compatibility and adapter validation **do not prove device integrity or claim truth**.
- [ ] 3.4 Tick #131 in #132's Wave 5 checklist — **this closes Wave 5**.

---

## Validation matrix

| Acceptance criterion (#131) | Arm |
| --- | --- |
| Imports in each approved target without Node/browser-only dependencies | U1, U8 |
| Envelope output matches the approved client contract | U2, U7 |
| Missing or failed native capabilities produce the approved bounded fallback | U3, U4 |
| Unsupported platform/version and forged native output fail or remain baseline trust | U5, U6 |
| NOT AUTHORIZED until platform, privacy, owner and package prerequisites complete | Task 0 |

## Risks and open questions

- **The zero-dependency conflict (F7)** is the most likely blocker and it is discoverable today.
- **An unenumerated target matrix (F5)** makes "unsupported combinations are out of scope" meaningless.
- **Trusting native-module output (F3)** — it is an attacker-controlled boundary from JS.
- **Divergence from #124's envelope (F6)** creates two dialects for #126 to accept.
- **Open question for the owner:** is React Native support actually wanted, or was it recorded as a
  possibility? It is the last issue in the last wave, behind eleven gates, and it is the only Wave 5 item
  that also depends on Wave 2. If the answer is "not planned", closing it as `wontfix` with the reasoning
  is cleaner than carrying it.

## What this does not authorize

Supporting Expo/bare/native combinations not explicitly approved, silent fallback to elevated trust,
publishing, or production deployment.

## What this plan did not verify

Whether a React Native package can satisfy the zero-runtime-and-peer-dependency policy (F7). That single
question may require a governed exception before any code is written.
