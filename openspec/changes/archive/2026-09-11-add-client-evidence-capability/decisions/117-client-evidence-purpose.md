# Client-Evidence Purpose Decision (#117)

Status: **decided — GO, for one bounded purpose only, taken under delegation**.

This record is new. It does not edit, weaken, or reopen
`research/browser-telemetry/reviews/final-project-owner-outcome.md`, and it uses that record's
shape on purpose, so the two can be read side by side.

## Review record

- **Decision taken by:** Claude (AI model `claude-opus-5`), acting under delegation from the project owner
- **Project owner:** Fernando Homem da Costa (`nandohdc`)
- **Delegation:** on 2026-09-10, in an interactive session, the owner instructed: *"I want you to keep
  going and implement ONLY the issues between #96 to #132 … you full authorization to implement
  them"* and *"I dont have time to make decisions, you must do for me."* #117 is in that range.
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`
- **Review type:** delegated project-owner decision. **The owner has not personally reviewed this
  record.** It is not an exact-commit owner authorization, and it must not be cited as one.
- **Date:** 2026-09-10
- **Commit reviewed:** `57814810a902538003e2df46e3e30bc02b73633b` (`main`)
- **Prior outcome bound to:** `research/browser-telemetry/reviews/final-project-owner-outcome.md`,
  project-owner decision of 2026-07-31 against commit `e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`
- **Material reviewed:** that outcome and the six reviews it consolidates; the canonical
  security-audit contract at the commit above (`correlation.*`, `source.client_reported.*`,
  `request.user_agent`, the trust registry, and `derived_field_provenance`); the #117 triage comment
  of 2026-08-23 and its test for whether a supersession is available at all.
- **Decision:** **GO for purpose P1 only** (below). No other purpose is decided.
- **Production authorization:** none
- **Real-user collection authorization:** none
- **Authorizes:** nothing beyond purpose establishment. Fields, formats, and collection are decided
  by #122, #123, and #121, each separately.

## The purpose, P1

> **Interaction-scoped audit correlation.** Let a person answering an audit inquiry decide which
> server-side audit events were caused by *one* user-initiated client interaction, carrying that
> grouping as an explicitly low-assurance client claim rather than as transport-observed or
> server-authoritative evidence.

### The decision it supports, and who holds it

An audit reviewer or incident responder answers a question about recorded events: *was this set
of server-side events one action the user initiated, or several?* A UI "delete selected" that sends
twelve API requests, a multi-step wizard, and a retried form submission all produce several
server-side audit events with distinct request identifiers. The person reconstructing the record has
to decide whether they belong together. That decision is the reviewer's. It is made after the fact,
against stored records, and its output is a reconstruction. It is not a score, a verdict about a
person, or an enforcement action.

### Why current server evidence and lower-data alternatives are insufficient

| Existing evidence | Why it does not answer the question |
|---|---|
| `request.id`, `correlation.correlation_id`, `operation_id` | Server-assigned per request or per server operation. Twelve requests from one click carry twelve values |
| `session.id` | Groups hours of unrelated activity; too coarse to separate one interaction from the next |
| `correlation.trace_id` from propagated trace context | The closest existing signal, and the reason this purpose is narrow. It can group requests when the client starts a trace per interaction, but the contract labels it `observed_transport`. That overstates it: the *client* chose the value, and the transport merely carried it. Nothing in the record says the grouping is a claim. It also carries no interaction semantics |
| Timing proximity | Heuristic. Concurrent interactions from one session interleave, and a reconstruction built on it is not reproducible |

The lowest-data alternative is to do nothing new and rely on trace context. It is rejected for this
purpose for one reason only: it records a client-chosen grouping at a trust level that says the
opposite of what it is. P1's representation carries essentially the *same* data trace context
already sends — one random identifier per interaction — plus one value from a closed vocabulary
naming the kind of interaction, and it labels both `client_claim`. **Measured in data it adds almost
nothing; measured in honesty it lowers an overstated trust label.** If that residual gap is not worth
a governed capability, #118's utility stop criterion ends the wave at the proof of concept, and that
outcome is designed in rather than hoped against.

### Data subjects

End users of an application whose server emits Bloodtrail audit events and whose client embeds the
client-evidence SDK. **There are none in this repository**: everything authorized is synthetic and
non-production.

### Minimum necessary data (this bounds #122 and #123)

1. **One interaction identifier:** 128 random bits generated per interaction, held only for that
   interaction, never persisted client-side, and never derived from the device, browser, user,
   account, or any earlier identifier.
2. **One interaction kind** from a closed vocabulary of at most eight values, fixed by #123.
3. **Envelope version and bounds metadata** needed to validate the above.
4. **Mode A only:** echoing a server-issued nonce, which contains nothing the server did not issue.

**Nothing else.** In particular: no URL, path, query string, DOM content, form value, user-agent
string, screen or device characteristic, locale, time zone, IP address, geolocation, cookie, storage
identifier, account identifier, or any value usable as a fingerprint.

### Foreseeable misuse

| Misuse | Why it matters | Where it is stopped |
|---|---|---|
| Using the interaction identifier to link a person's interactions over time | That is tracking | It is per-interaction and never persisted; #119 prohibits persistence and #123's schema has no field that could carry a stable value |
| Feeding it to risk scoring | Prohibited by the 2026-07-31 outcome | Contract `2.0.0`'s trust floor (#96) caps any risk model listing a client-evidence input at `client_claim`, and #119 prohibits the use outright |
| Treating it as identity or authentication evidence | Prohibited by the 2026-07-31 outcome | Its trust is `client_claim`, below every authenticated level, and the no-trust-escalation rule rejects promoting it |
| Enforcement — blocking or allowing an action on it | Prohibited by the 2026-07-31 outcome | No mapping writes it to an authorization or decision field; #127 must prove that |
| A malicious host page forging interactions to merge or split groups | It makes a reconstruction wrong | Unpreventable in Mode A and named as such; the label is `client_claim`, so a reviewer weighs it as a claim. #128 measures it |

### The supersession test from the #117 triage

The supersession argument holds only if P1 has no detection component. P1 was tested against the
four prohibited uses:

- **Risk scoring:** P1 produces no score and supplies no risk input. Its only consumer is a person
  reconstructing a record.
- **Identity attribution:** P1 attributes nothing to a person. The events it groups are already
  attributed by the server's own authoritative actor fields.
- **Authentication use:** none. P1 is not a credential and its trust is `client_claim`.
- **Enforcement:** none. Grouping happens after the fact, against stored records.

And the triage's language check — *"if a sentence would still read as true with 'for detection'
appended, rewrite it"* — was applied to P1's statement. "Decide which server-side audit events were
caused by one user-initiated client interaction, for detection" does not describe what the reviewer
is doing: the reviewer answers an inquiry about events already known to have happened.

## Decision

**GO for P1.** It rests on three things: a concrete decision held by a real role; a lowest-data
alternative that exists but mislabels its trust; and a data inventory no larger than what that
alternative already sends.

## Supersession clause — for P1 only

For purpose P1 **only**, this record supersedes the detection-domain reconsideration criteria of the
2026-07-31 outcome: measurable detection lift, false-positive limits, conversion-impact limits, and
physical-device coverage. They are superseded, not waived, on the stated ground that audit
correlation has no detection lift to measure. #118 replaces them with criteria that fit P1.

This record **does not** reopen, weaken, or imply reconsideration of the 2026-07-31 no-adoption
decision for the detection use case. For every purpose other than P1 — detection, risk scoring,
identity attribution, authentication, enforcement — the 2026-07-31 outcome applies unchanged.

## Conditions

- No production implementation, publication, deployment, or real-user collection is authorized.
- Qualified privacy/legal review, which the 2026-07-31 outcome independently requires before any
  real-user experiment, is **not** discharged by this record or by #119's technical review.
- Adding any datum to the inventory above requires a new purpose record in this format.

## Follow-up owner

Fernando Homem da Costa. Until the owner personally reviews this record, every downstream artifact
carries the delegated `decision_source` above.

## Reversal

A NO-GO from the owner closes the wave: #118–#131 resolve as `wontfix` with this record cited, and
the implementation merged under it is reverted merge-commit by merge-commit. Nothing merged under P1
is deployed, so reversal affects no one outside this repository.

## Assurance limitation

This record establishes a purpose and a narrow supersession. It is not independent assurance, legal
advice, or a privacy review, and because it was taken under delegation it is weaker governance than
the 2026-07-31 outcome it supersedes for one purpose.
