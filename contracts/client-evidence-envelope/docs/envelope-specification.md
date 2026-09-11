# ClientEvidenceEnvelope v1 Specification

> GENERATED FROM contracts/client-evidence-envelope/source/envelope.source.json. DO NOT EDIT BY HAND.

## Overview

- **Contract ID:** `client-evidence-envelope`
- **Schema Name:** `io.bloodtrail.client-evidence.envelope`
- **Schema Version:** `1.0.0`
- **Discriminator:** `envelope_version = 1`
- **Decision Source:** `delegated to Claude by the owner, 2026-09-10; not a human owner decision`

## Assurance Limitations

Envelope validity proves syntax and declared provenance only, not genuine browser/device origin or truthful host-page execution. All claims carry client_claim trust.

## Canonical Boundary

ClientEvidenceEnvelope is canonical for low-assurance client evidence and intentionally decoupled from security-audit event contract, SDK Core, and delivery adapters (PLAN-086).

## Structural Bounds

| Bound | Value | Rationale |
|---|---|---|
| `max_envelope_bytes` | 4096 bytes | Must sit strictly below the 64 KB audit event bound (PLAN-049) |
| `interaction_id_length` | 36 characters | RFC 4122 UUID v4 representation |
| `max_claims` | 8 items | Closed, bounded claim collection |
| `max_claim_name_length` | 32 characters | Bound on claim key identifier |
| `max_claim_value_length` | 128 characters | Bound on claim scalar payload |
| `max_transforms` | 4 items | Bound on client-side transform records |
| `nonce_length` | 32..64 characters | Server-issued hex token |

## Interaction Kinds (Closed Vocabulary, <= 8 items)

- `navigation`
- `form_submit`
- `button_click`
- `input`
- `dialog_action`
- `tab_switch`
- `refresh`
- `custom`

## Prohibited Claims (Privacy & Fingerprinting Inventory)

The following claims are strictly prohibited and cause deterministic validation failure:

- `account_id`
- `auth_token`
- `cookie`
- `credential`
- `decision`
- `device_id`
- `dom_content`
- `fingerprint`
- `form_value`
- `geolocation`
- `hardware`
- `ip`
- `locale`
- `location`
- `path`
- `query`
- `risk_score`
- `screen`
- `session_id`
- `timezone`
- `url`
- `user_agent`
- `user_id`
- `verdict`
