# Browser Telemetry Research — Project-Owner Governance Packet

Status: **six project-owner governance records pending; unsigned; no owner decision recorded**.

## Project state

| Item | Current state |
|---|---|
| Provisional decision | `DEFER BROWSER TELEMETRY` |
| Production authorization | `none` |
| Real-user collection authorization | `none` |
| Permitted possible successor | `continue-browser-telemetry-poc` |

This research change authorizes no production integration, real-user collection, experiment, shadow collection, pilot, analytics use, or customer-facing enforcement. It does not authorize any implementation successor.

## Project owner

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer

Bloodtrail is a personal open-source project. Fernando may perform and record the project-owner reviews defined by the governing OpenSpec change. These records are project-owner self-reviews or project-owner decisions. They are not independent review, third-party assurance, formal certification, legal advice, or organizational approval.

## Six pending records

Exactly these six governance records are required and currently pending:

1. [Project-owner security architecture self-review](security-architecture-self-review.md)
2. [Project-owner privacy restriction](privacy-restriction.md)
3. [Project-owner technical self-review](technical-self-review.md)
4. [Project-owner product decision](product-decision.md)
5. [Project-owner dependency and license acceptance](dependency-license-acceptance.md)
6. [Final project-owner outcome](final-project-owner-outcome.md)

The recommended completion order is privacy restriction, security architecture, technical, dependency and license, product, and final outcome. Ordering does not change the six OpenSpec task definitions.

Every file is a blank pending template. No template is signed, approved, or complete. Fernando must personally supply each written decision before the corresponding task may be checked.

## Required record fields

Every record provides fields for:

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

Each owner record should identify the exact material actually reviewed. The expected common scope is:

1. `openspec/changes/investigate-browser-telemetry-signals/proposal.md`
2. `openspec/changes/investigate-browser-telemetry-signals/design.md`
3. `openspec/changes/investigate-browser-telemetry-signals/tasks.md`
4. `research/browser-telemetry/README.md`
5. `research/browser-telemetry/source-evidence.md`
6. The relevant PoC, tests, dependency documents, and sanitized evidence identified by that record

Listing expected material in a template does not assert that Fernando reviewed it.

## Assurance and authorship boundaries

For project-owner self-reviews, the record must include:

> This review was performed by the project owner and implementer. It provides documented project governance but not independent assurance.

Security and technical self-reviews also carry their specific non-independent-assurance statements. Dependency and license acceptance carries its specific legal/governance limitation.

Hermes may create templates, migrate documentation, verify consistency, and report missing fields. Hermes must not:

- sign for Fernando;
- invent Fernando's decisions;
- infer approval from prompts or earlier discussion;
- mark any of the six owner-governance tasks complete;
- present AI verification as Fernando's review;
- present a self-review as independent assurance; or
- present the privacy restriction as legal advice.

## Binding privacy restriction

The privacy record must explicitly preserve this restriction:

> No production or real-user browser telemetry is authorized. A qualified privacy/legal review is mandatory before any future continuation involving real-user collection.

This is a project restriction, not legal advice or a privacy-law compliance conclusion. It applies before real-user experiments, shadow collection, pilots, analytics, enforcement, or any other real-user browser telemetry. Fernando must explicitly approve the pending privacy record before its task may be checked.

## Superseded review model

This packet supersedes references that treated separate security architecture, privacy/legal, frontend, platform, product, or dependency/license governance reviewers as current closure requirements for this personal research project. Existing technical evidence and historical reproduction records are not rewritten by this migration. Where those records describe external or specialist approval as pending, the current closure model is the six project-owner records above.

Qualified external privacy/legal review remains mandatory before any future continuation involving real-user collection. This future-use gate is not a current legal approval and is not satisfied by the project-owner privacy restriction.

Until Fernando writes all applicable records, the OpenSpec owner-governance tasks remain unchecked, the provisional decision remains `DEFER BROWSER TELEMETRY`, and both production and real-user collection authorization remain `none`.
