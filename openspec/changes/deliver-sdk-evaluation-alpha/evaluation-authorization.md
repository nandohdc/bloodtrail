# Evaluation authorization: SDK evaluation alpha

**Status: agent-drafted. It takes effect only through the owner's approval act described below.** An agent
drafted this record on 2026-09-23 for #578. It grants nothing unless and until the project owner performs
that act, and the record's own text is never evidence that the act happened.

- **How the owner approves it.** The act has two parts, and both are required:
  1. The owner posts an approval comment on the pull request that proposes the
     `deliver-sdk-evaluation-alpha` and `add-sdk-node-http-audit-sink` changes. The comment names both
     changes and the head commit SHA being approved.
  2. The owner merges that commit personally.

  The act approves exactly the text at that commit.
- **What never approves it.**
  - A statement in this file.
  - An AI review, an issue assignment, or a comment by anyone other than the owner.
  - The merged state on its own (`CONTRIBUTING.md`).
  - A merge made by an agent or by auto-merge. No agent merges that pull request or arms auto-merge on it.

| Field | Value |
|---|---|
| Governing change | `deliver-sdk-evaluation-alpha` (the HTTP audit sink is governed by `add-sdk-node-http-audit-sink`) |
| Spec | #575 |
| Evaluation ticket | #605 |
| Drafted by | Claude (agent), 2026-09-23 |
| Approved by | The project owner, through the approval comment naming the head SHA and the owner's own merge. The record grants nothing without both. |

## Scope

This record covers a non-production evaluation alpha of the Bloodtrail SDK and nothing else:

- the SDK core (`@bloodtrail/security-audit-sdk-core` 0.4.0);
- the Node binding (`@bloodtrail/security-audit-sdk-node` 0.4.0), including the non-production HTTP audit
  sink that `add-sdk-node-http-audit-sink` adds;
- the collector ingress (`@bloodtrail/security-audit-collector` 0.1.0), used only inside the example
  receiver.

These are delivered as an evaluation kit to the evaluators this record authorizes. Evaluators use them to
follow the quickstart and to integrate the SDK into non-production services they own.

## Data

Only synthetic data is allowed. Every tenant, actor, subject, resource, identifier, credential and key an
evaluator uses is invented for the evaluation. The following are not allowed:

- real users, customers or employees;
- personal data;
- production secrets, credentials or tokens;
- data copied from a production system.

## Environments

- Developer machines.
- CI.
- Loopback or private networks.
- Evaluators' own non-production services.

No production environment, production network or production data store may send to or receive from a kit
component.

## Evaluators

| Field | Value |
|---|---|
| Authorized evaluators | `@nandohdc` |
| Evaluation distribution allowed | **Yes** |

This amended version of the record authorizes kit distribution to the named evaluator above (`@nandohdc`)
under the governing change.

The evaluation (#605) proceeds with the authorized evaluator integrating the kit into non-production services.
Distribution is strictly limited to the listed handle and synthetic data.

## Duration

The window is two weeks from the delivery of kit v1. It ends earlier if a stop condition applies.

A blocking defect may cause the kit to be re-issued, at most twice. Each re-issue carries a new identity,
and resets only the metric the defect affected. If a third re-issue would be needed, the evaluation ends
and the facts go to the decision brief.

## Kit identity

A kit, whether v1 or a re-issue, is identified by three values:

- the commit SHA it was built from;
- the SHA-256 of each packed artifact;
- a kit digest that follows the repository's package-set hash convention: a set digest over the
  `shasum` lines, and a manifest digest over the JSON.

The identity of kit v1 authorized for distribution is:

- **Commit SHA**: `e64fdb9118d2a2446fe3abb37ed909a689a097bf`
- **Artifacts**:
  - `bloodtrail-security-audit-collector-0.1.0.tgz`: `8db7de4d0f61a7e8080a09ab2e6c7c962b266c61b2d090ab23b125bd94627d13`
  - `bloodtrail-security-audit-sdk-core-0.4.0.tgz`: `615d9edc8d15108cf0c8f6b39558ddba29fc820e1ac0313964863d318231e9b2`
  - `bloodtrail-security-audit-sdk-node-0.4.0.tgz`: `76e3c65cfc47b7667b3bbc571afd63b71c35e64b660ed670a825c3a2bad91535`
- **Package set digest**: `ae1fee3586119004894af3f0c23d8534b40dd07f5642e57c370b9e411a19f88b`
- **Manifest digest**: `20d8333565b31150e77ccc885528ee8d76382add671d49df0c0beb6bb1b2899c`
- **Kit digest**: `a7e0805a8789dfe3603f25f742c8c7ccecf4e8eb8f0cd201f7e584aec6e2c89b`

The identity is recorded in two places before that kit is distributed:

- the kit's identity file;
- a comment on #605.

A kit whose identity has not been recorded both ways is not authorized for distribution.

## Stop conditions

- **Non-synthetic data reaches a receiver.** Stop the evaluation. Purge the data from every receiver,
  log and machine it reached. Report the incident on #605 without reproducing the data.
- **A critical security defect appears in the MVP path.** Stop the evaluation and fix the defect under the
  governing change. Resume only with a re-issued kit whose new identity has been recorded.

## Not authorized

This record does not authorize any of the following, and nothing done under it may be taken as
authorizing it:

- publication to any package registry, public or private;
- any license change: every package stays `private` and `UNLICENSED`;
- production deployment of any kind;
- processing real-user or personal data;
- a package version move or a release tag;
- use of release PR #537;
- any transport, exporter, collector deployment, queue, outbox, storage, SIEM integration, analytics,
  detection, browser telemetry, framework instrumentation or cryptographic audit-log chaining, beyond the
  non-production HTTP audit sink that the governing change adds;
- distributing a kit before an amendment authorizes evaluators, or to anyone that amendment does not
  list.
