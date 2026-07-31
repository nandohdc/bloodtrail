# Browser Telemetry Research — Project-Owner Governance Packet

Status: **all six project-owner governance records complete; 22/22 OpenSpec tasks complete**.

## Project state

| Item | Current state |
|---|---|
| Provisional decision | `DEFER BROWSER TELEMETRY` |
| Final decision | `DEFER BROWSER TELEMETRY — no adoption at this time` |
| Production authorization | `none` |
| Real-user collection authorization | `none` |
| Permitted possible successor | `continue-browser-telemetry-poc` |

This research change authorizes no production integration, real-user collection, experiment, shadow collection, pilot, analytics use, or customer-facing enforcement. It does not authorize any implementation successor.

## Project owner

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer

Bloodtrail is a personal open-source project. Fernando may perform and record the project-owner reviews defined by the governing OpenSpec change. These records are project-owner self-reviews or project-owner decisions. They are not independent review, third-party assurance, formal certification, legal advice, or organizational approval.

## Six completed records

Exactly these six project-owner governance records are complete:

1. [Project-owner security architecture self-review](security-architecture-self-review.md)
2. [Project-owner privacy restriction](privacy-restriction.md)
3. [Project-owner technical self-review](technical-self-review.md)
4. [Project-owner product decision](product-decision.md)
5. [Project-owner dependency and license acceptance](dependency-license-acceptance.md)
6. [Final project-owner outcome](final-project-owner-outcome.md)

The records were completed in the governing sequence, with the final outcome following the five prerequisite records. This does not change the six OpenSpec task definitions.

The first five records bind to Commit A, `b6bb577b1fda865610ef93ec8ef31527046c3c44`. The final project-owner outcome binds to Commit B, `e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`. These are the exact commits assessed by the records.

A later status-reconciliation commit may update summary documents to reflect the already-recorded decisions. Such an administrative correction does not replace the commits reviewed by the owner records and does not modify the technical evidence, review decisions, or authorization boundaries.

## Record format used

Every completed record uses these fields:

- Reviewer
- GitHub handle
- Role
- Review type
- Date
- Commit reviewed
- Material reviewed
- Decision
- Conditions
- Concerns
- Follow-up owner
- Reconsideration requirements
- Assurance limitation

`Commit reviewed` must contain the exact Git commit hash actually reviewed. A branch name, pull-request number, assignment, AI review, or informal message is not a substitute for the hash or for Fernando's written decision.

## Common material

Each owner record identifies the exact material actually reviewed. The common scope used is:

1. `openspec/changes/investigate-browser-telemetry-signals/proposal.md`
2. `openspec/changes/investigate-browser-telemetry-signals/design.md`
3. `openspec/changes/investigate-browser-telemetry-signals/tasks.md`
4. `research/browser-telemetry/README.md`
5. `research/browser-telemetry/source-evidence.md`
6. The relevant PoC, tests, dependency documents, and sanitized evidence identified by that record

Each individual record remains authoritative for its own material-reviewed field.

## Assurance and authorship boundaries

For project-owner self-reviews, the record must include:

> This review was performed by the project owner and implementer. It provides documented project governance but not independent assurance.

Security and technical self-reviews also carry their specific non-independent-assurance statements. Dependency and license acceptance carries its specific legal/governance limitation.

Hermes may maintain status documentation, verify consistency, and report missing fields. Hermes must not:

- sign for Fernando;
- invent Fernando's decisions;
- infer approval from prompts or earlier discussion;
- mark an owner-governance task complete without Fernando's written decision;
- present AI verification as Fernando's review;
- present a self-review as independent assurance; or
- present the privacy restriction as legal advice.

## Binding privacy restriction

The privacy record must explicitly preserve this restriction:

> No production or real-user browser telemetry is authorized. A qualified privacy/legal review is mandatory before any future continuation involving real-user collection.

This active project restriction is not legal advice or a privacy-law compliance conclusion. It applies before real-user experiments, shadow collection, pilots, analytics, enforcement, or any other real-user browser telemetry. The completed project-owner privacy record does not satisfy the qualified privacy/legal review required for future real-user work.

## Superseded review model

This packet supersedes references that treated separate security architecture, privacy/legal, frontend, platform, product, or dependency/license governance reviewers as current closure requirements for this personal research project. Existing technical evidence and historical reproduction records are not rewritten by this migration. The current closure model is the six completed project-owner records above.

Qualified external privacy/legal review remains mandatory before any future continuation involving real-user collection. This future-use gate is not a current legal approval and is not satisfied by the project-owner privacy restriction.

The records provide documented project governance but not independent assurance. The final decision is no adoption at this time, production authorization is `none`, and real-user collection authorization is `none`. Any future real-user continuation requires qualified privacy/legal review and a separate OpenSpec change; `continue-browser-telemetry-poc` remains the only named possible successor.
