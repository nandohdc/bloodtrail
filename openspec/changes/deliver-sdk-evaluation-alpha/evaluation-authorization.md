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
| Authorized evaluators | **None yet** |
| Evaluation distribution allowed | **No** |

No evaluator is authorized by this version of the record, so no kit may be distributed and the evaluation
(#605) cannot start. Implementation and kit construction can proceed.

The plan is for three developers new to Bloodtrail to take part, with a minimum of two. Each will integrate
the kit into a non-production service they own. The owner's own dogfooding is reported separately and is
not an evaluator slot.

**Distribution becomes allowed only through an amendment to this file**, under the governing change. The
amendment must:

1. name each authorized evaluator by GitHub handle, and name no one invented or unconfirmed;
2. name the exact kit it authorizes, if the kit's identity is known by then (commit SHA, per-artifact
   SHA-256 and kit digest);
3. take effect through the same two-part act: an approval comment by the owner naming the amendment's head
   SHA, then the owner's own merge.

After the amendment, a kit goes only to a handle it lists. Adding or replacing an evaluator later needs
another amendment made the same way.

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
