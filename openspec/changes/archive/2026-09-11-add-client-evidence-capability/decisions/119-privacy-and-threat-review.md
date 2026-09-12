# Client-Evidence Privacy and Threat-Model Review (#119)

Status: **APPROVE FOR PROPOSAL — synthetic, non-production scope only**.

## Review record

- **Reviewer:** Claude (AI model `claude-opus-5`), under delegation from the project owner
  (`nandohdc`), per the instruction quoted in `117-client-evidence-purpose.md`
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`
- **Qualification:** **the reviewer is not a qualified privacy or legal professional.** This is a
  technical privacy and threat-model review. It is **not** the qualified privacy/legal review that the
  2026-07-31 owner outcome makes mandatory before any real-user experiment, shadow collection, pilot,
  analytics, enforcement, or other real-user collection. That review remains open and must precede
  any real-user use. None is authorized.
- **Date:** 2026-09-10
- **Material reviewed:** `117-client-evidence-purpose.md`, `118-success-and-stop-criteria.md`, the
  2026-07-31 outcome and `research/browser-telemetry/reviews/privacy-restriction.md`, and the
  security-audit contract at `57814810a902538003e2df46e3e30bc02b73633b`
- **Outcome:** **APPROVE FOR PROPOSAL.** The governed proposal (#120) may be written for P1 with the
  controls below. Approval for proposal is not approval for collection.

## Privacy assessment

| Question | Finding |
|---|---|
| **Data subjects** | End users of an application that embeds the SDK. There are none in this repository; all data is synthetic |
| **Controller / processor** | Bloodtrail is software. A deploying operator would be controller for its users' audit records, and nothing here processes personal data on anyone's behalf. Role allocation for a real deployment is a question for the qualified review |
| **Data categories** | Exactly #117's inventory: one random per-interaction identifier, one closed-vocabulary interaction kind, envelope version and bounds metadata, and in Mode A an echoed server-issued nonce. The identifier is personal data only by linkage to the audit event it accompanies, which is already about that person |
| **Purpose limitation** | P1 only. Every other use is prohibited below and, for risk inputs, mechanically capped by contract `2.0.0` |
| **Minimization** | The inventory adds no datum trace-context propagation does not already send, apart from the interaction kind. It deliberately excludes everything a fingerprint could be built from |
| **Retention and deletion** | The envelope has no retention of its own: it lives inside, or alongside, the audit record it annotates, and is deleted whole with that record under the record's `data.retention_class` (collector-storage-semantics). The SDK retains nothing past one interaction |
| **Consent and notice** | A deploying operator would need a legal basis and notice for audit logging generally. Whether P1 changes that is for the qualified review. Nothing here collects anything, so nothing needs a basis yet |
| **Regional transfer** | Not applicable — nothing is transferred. For a real deployment, a question for the qualified review |
| **Data-subject rights** | Access and erasure follow the audit record, because the envelope cannot outlive it |
| **Children and sensitive data** | None is collected; the closed vocabulary and schema leave no field that could carry it |

## Threat model

The browser, the embedding page, the network, and the host application are all attacker-controlled
from the backend's point of view. The SDK runs inside a page it cannot trust.

| Threat | Attacker | Effect | Control | Residual |
|---|---|---|---|---|
| **Spoofing** — forged identifiers merge or split interaction groups | malicious page, script, or user | a reconstruction groups events wrongly | trust fixed at `client_claim`; server-issued nonce in Mode A binds a claim to an interaction the server started | **Unpreventable in Mode A.** A reviewer must weigh the grouping as a claim; #128 measures it |
| **Replay** — an old envelope resubmitted | anyone holding one | a stale grouping attached to new events | Mode A nonce is single-use and expires; ingress rejects reuse (#126) | none beyond nonce lifetime |
| **Fingerprinting** — the SDK becomes a tracking beacon | the SDK itself, or a later change | cross-interaction linkage of a person | per-interaction randomness from `crypto.getRandomValues`; no storage API; no device, browser, or network characteristic in the schema; S-privacy-1/2 stop the wave | a future change adding fields, which non-expansion forbids |
| **Correlation across origins or devices** | a party seeing several applications | linking one person's activity | identifiers are per-interaction and per-origin; none survives the interaction | none |
| **Exfiltration** — the page reads SDK state | malicious page | nothing sensitive to read | the SDK holds no credential, token, or collector secret, and never transmits | none |
| **Injection** — oversized or unknown content | anyone | resource exhaustion, parser confusion | closed schema, bounded strings and collections, unknown version rejected, reject rather than truncate (#123, #126) | none |
| **Server-field fabrication** — a claim overwrites server-owned fields | anyone | a client claim masquerades as server evidence | mapping never writes a client value to a server-owned field; floor enforcement; #127 mutation arms | none if #127's arms hold |
| **Malicious host page** — the page lies about everything | the embedding page | every claim is false | nothing prevents it, and nothing claims to | total, and stated: client evidence cannot prove a real browser existed |

## Required controls

1. Closed, versioned envelope schema; bounded strings and collections; unknown versions rejected; oversized input rejected, never truncated (#123).
2. Interaction identifiers from `crypto.getRandomValues`, 128 bits, never persisted and never reused (#124).
3. The SDK uses no storage API and makes no network request. The host sends the envelope with its own request (#124).
4. Browser Web APIs only; no Node built-ins; no dependency on the SDK Core (#124).
5. Backend ingress validates version, bounds, vocabulary, and Mode A nonce before mapping, and emits only privacy-safe rejection counters by stable class (#126).
6. Mapping preserves `client_claim` trust, never writes a server-owned field, and never feeds a risk, authentication, authorization, or enforcement path (#127).
7. Every one of #118's stop criteria is wired as a failing test before any proof-of-concept run (#128).

## Prohibited data

URLs, paths, and query strings; DOM or form content; user-agent strings; screen, device, hardware,
or rendering characteristics; locale and time zone; IP addresses and geolocation; cookies and any
storage identifier; account, user, or device identifiers; any value stable across interactions; and
any value derived from any of these.

## Assurance limitation

This review can permit a governed proposal. It cannot establish compliance in any jurisdiction,
cannot stand in for the mandatory qualified privacy/legal review, and cannot authorize collection.
