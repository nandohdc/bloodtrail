# Browser Telemetry Research Review Packet

Status: **pending external review**. This packet prepares review; it is not approval. An AI-generated assessment must not be recorded as organizational sign-off.

Provisional decision: **DEFER BROWSER TELEMETRY**. Production authorization: none.

This research change authorizes no production integration or customer-facing enforcement. Any future bounded research requires a separate reviewed OpenSpec change; production implementation could be considered only after measurable incremental value and all required reviews are recorded.

Reviewers should read, in order:

1. `openspec/changes/investigate-browser-telemetry-signals/proposal.md`
2. `openspec/changes/investigate-browser-telemetry-signals/design.md`
3. `openspec/changes/investigate-browser-telemetry-signals/tasks.md`
4. `research/browser-telemetry/README.md`
5. `research/browser-telemetry/source-evidence.md`
6. `research/browser-telemetry/evidence/`

For every review, record:

```text
Reviewer:
Role:
Date:
Commit reviewed:
Material reviewed:
Decision:
Conditions:
Concerns:
Follow-up owner:
Reconsideration requirements:
```

`Commit reviewed` must contain the exact Git commit hash reviewed by the human approver so that the decision is bound to a specific repository state.

## Security architecture review — pending

Decision requested: Is the attacker-controlled browser trust model accurate, and is deferral appropriate given the bypass, replay, failure, and supply-chain evidence?

Evidence required to close:

- Confirm freshness is not conflated with authenticity, and integrity is not conflated with truthfulness.
- Confirm BotD cannot authorize allow/challenge/block and detector negatives do not prove humanity.
- Confirm missing or failed telemetry does not automatically indicate abuse.
- Confirm a server challenge can constrain nonce, origin, audience, session, expiry, and replay but cannot attest truthful browser state.
- Confirm no production dependency or collection path exists.

## Privacy/legal review — pending

Decision requested: Is the documented deferral and minimization posture appropriate, and what legal conditions would apply before any bounded continuation PoC?

Evidence required to close:

- Necessity, proportionality, purpose, jurisdiction, lawful basis or terminal-device exemption.
- Notice, consent where applicable, DPIA/LIA, retention, deletion/DSR, residency, and tenant access.
- Cross-restaurant correlation classification and prohibition on advertising, analytics, or unrelated profiling reuse.
- Review of the sanitized committed evidence.

## Frontend review — pending

Decision requested: Are the performance conclusions appropriately limited, and are the future customer-experience gates sufficient?

Evidence required to close:

- Verify measured desktop timings and bundle bytes are reported as local package-asset evidence only.
- Confirm physical mobile, in-app browser, accessibility, battery, long-task, and conversion gaps remain future gates.
- Confirm a full collector may not run synchronously before initial menu usability.
- Confirm the research harness is excluded from storefront builds.

## Platform review — pending

Decision requested: Is the research harness reproducible and isolated, and are egress/supply-chain controls adequate for research use?

Evidence required to close:

- Re-run `npm ci`, tests, PoC, evidence validation, SBOM, and audit commands.
- Confirm first-party local serving, pinned lock integrity, monitoring opt-out, blocked external requests, and negative control.
- Confirm no runtime/deployment dependencies and define future ownership, rollback, and kill-switch requirements.

## Product review — pending

Decision requested: Does the evidence support no adoption for now, with behavior and commercial outcomes remaining the priority?

Evidence required to close:

- Confirm no claim of improved detection, reduced false positives, or conversion safety is made.
- Confirm unresolved labeled-traffic and advanced-attacker evidence remains a future reconsideration gate.
- Confirm normal menu access must not be gated by browser telemetry.

## Dependency/license or open-source governance review — pending

Decision requested: Are the exact pinned research dependencies, MIT obligations, SBOM, audit evidence, package monitoring behavior, and research-only disposition acceptable?

Evidence required to close:

- Review `evidence/licenses.json`, `evidence/sbom.cdx.json`, `evidence/npm-audit.json`, package lock integrity, and upstream license texts.
- Confirm no upstream source was copied into production and no fork was created.
- Confirm any package update requires a new source/egress/evidence review.

## Final decision record — pending

Allowed outcomes:

- `no adoption`
- `bounded continuation PoC`
- `small internal sensor`

The final record must identify real reviewers, dates, conditions, unresolved gaps, follow-up owners, and reconsideration/expiry conditions. Until that record exists, the provisional decision remains **DEFER BROWSER TELEMETRY** and no implementation is authorized.
