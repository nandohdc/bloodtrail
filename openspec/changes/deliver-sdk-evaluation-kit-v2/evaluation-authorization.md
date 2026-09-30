# Evaluation authorization: SDK evaluation kit v2

**Status: agent-drafted. It takes effect only through the owner's approval act described below.** An agent
drafted this record on 2026-09-29 for #650. It grants nothing unless and until the project owner performs
that act, and the record's own text is never evidence that the act happened.

- **How the owner approves it.** The act has two parts, and both are required:
  1. The owner posts an approval comment on the pull request that proposes the
     `deliver-sdk-evaluation-kit-v2` change. The comment names the change and the head commit SHA being
     approved.
  2. The owner merges that commit personally.

  The act approves exactly the text at that commit.
- **What never approves it.**
  - A statement in this file.
  - An AI review, an issue assignment, or a comment by anyone other than the owner.
  - The merged state on its own (`CONTRIBUTING.md`).
  - A merge made by an agent or by auto-merge. No agent merges that pull request or arms auto-merge on it.

| Field | Value |
|---|---|
| Governing change | `deliver-sdk-evaluation-kit-v2` |
| Spec | #649 |
| Evaluator amendment ticket | #665 |
| Evaluation ticket | #666 |
| Drafted by | Claude (agent), 2026-09-29 |
| Approved by | The project owner, through the approval comment naming the head SHA and the owner's own merge. The record grants nothing without both. |

This record replaces nothing. #575's authorization was archived with `deliver-sdk-evaluation-alpha`, and it
does not cover kit v2 or any evaluator named here.

## Scope

This record covers a non-production evaluation of the Bloodtrail SDK through evaluation kit v2, and nothing
else:

- the SDK core (`@bloodtrail/security-audit-sdk-core` 0.4.0);
- the Node binding (`@bloodtrail/security-audit-sdk-node` 0.4.0), including its existing non-production
  HTTP audit sink;
- the collector ingress (`@bloodtrail/security-audit-collector` 0.1.0), used only inside the example
  receiver.

On approval, this record authorizes implementing the governing change and building and verifying kit v2.
It does not authorize distributing any kit (see Evaluators).

Once an amendment authorizes them, evaluators use the kit to follow the quickstart and to integrate the SDK
into non-production services they own.

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
| Authorized evaluators | None yet |
| Evaluation distribution allowed | **No** |

This version of the record authorizes no evaluator, and forbids distributing any kit to anyone.

- **The cohort.** At least two developers new to Bloodtrail, and preferably three. Each has never used or
  contributed to Bloodtrail, and each integrates the kit into a non-production service they own.
- **The owner's own run.** The owner's run recorded on #605 is dogfooding. It is reported separately and
  never counts toward the cohort's metrics.
- **The amendment.** Distribution needs an amendment to this record (#665). It names each evaluator by
  GitHub handle, together with kit v2's kit digest and archive SHA-256. It takes effect only through the
  same two-part act: the owner's approval comment naming the amendment's head SHA, then the owner's own
  merge.
- **Handles are never invented.** An agent drafts the amendment only after the owner supplies the handles.

## Duration

The window is two weeks from the delivery of kit v2 to the evaluators. It ends earlier if a stop condition
applies.

A blocking defect may cause the kit to be re-issued, at most twice. Each re-issue carries a new identity,
recorded on #666, and resets only the metric the defect affected. If a third re-issue would be needed, the
evaluation ends and the facts go to the decision brief.

The metrics M1–M8, their thresholds, and the continue, change-direction and stop rules are those of #575,
unchanged. Prior investment is never a criterion.

## Kit identity

A kit, whether kit v2 or a re-issue, is identified by:

- the commit SHA it was built from;
- the identity-format version;
- the SHA-256 of each packed artifact;
- the package-set digest and the manifest digest, following the repository's package-set hash convention;
- the checksum list covering every kit file;
- the kit digest, which commits to the digests above and to the checksum list;
- the SHA-256 of the distributed archive.

The identity of kit v2 is not known yet. It is recorded by the amendment, and none of it is filled in here.

The identity is recorded in two places before a kit is distributed:

- the kit's identity file, and the archive's SHA-256 alongside it;
- a comment on #666.

A kit whose identity has not been recorded both ways is not authorized for distribution.

## Stop conditions

- **Non-synthetic data reaches a receiver.** Stop the evaluation. Purge the data from every receiver, log
  and machine it reached. Report the incident on #666 without reproducing the data.
- **A critical security defect appears in the evaluated path.** Stop the evaluation and fix the defect
  under the governing change. Resume only with a re-issued kit whose new identity has been recorded.

## Not authorized

This record does not authorize any of the following, and nothing done under it may be taken as
authorizing it:

- publication to any package registry, public or private;
- any license change: every package stays `private` and `UNLICENSED`;
- production deployment of any kind;
- processing real-user or personal data;
- a package version move, a release tag, or the use of any release pull request;
- any transport, exporter, collector deployment, queue, outbox, storage, SIEM integration, analytics,
  detection, browser telemetry, framework instrumentation or cryptographic audit-log chaining, beyond the
  existing non-production HTTP audit sink;
- distributing a kit before an amendment names the evaluators and kit v2's identity, or distributing it to
  anyone that amendment does not list.
