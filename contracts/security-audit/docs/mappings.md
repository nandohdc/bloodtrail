# Mappings

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

## OCSF 1.8.0

Boundary: ingestion/export only

Allowed claim: OCSF compatibility only for version 1.8.0, tested catalog events, selected classes/profiles, and explicit Bloodtrail extension losses.

| Event | OCSF Class | Status | Full Compatibility Claim |
| --- | --- | --- | --- |
| bloodtrail.audit.account.registration.attempted | account_change | extended | false |
| bloodtrail.audit.account.registration.completed | account_change | extended | false |
| bloodtrail.audit.authentication.succeeded | authentication | exact | false |
| bloodtrail.audit.authentication.failed | authentication | exact | false |
| bloodtrail.audit.authentication.mfa.enrolled | account_change | extended | false |
| bloodtrail.audit.authentication.mfa.removed | account_change | extended | false |
| bloodtrail.audit.session.created | session | extended | false |
| bloodtrail.audit.session.revoked | session | extended | false |
| bloodtrail.audit.account.password_reset.requested | account_change | extended | false |
| bloodtrail.audit.account.password_reset.completed | account_change | extended | false |
| bloodtrail.audit.authorization.allowed | authorization | extended | false |
| bloodtrail.audit.authorization.denied | authorization | extended | false |
| bloodtrail.audit.authorization.role.assigned | iam | extended | false |
| bloodtrail.audit.authorization.role.removed | iam | extended | false |
| bloodtrail.audit.authorization.privilege.elevated | iam | extended | false |
| bloodtrail.audit.administration.impersonation.started | admin_activity | extended | false |
| bloodtrail.audit.administration.impersonation.ended | admin_activity | extended | false |
| bloodtrail.audit.data.sensitive_resource.viewed | data_access | extended | false |
| bloodtrail.audit.data.sensitive_resource.created | data_activity | extended | false |
| bloodtrail.audit.data.sensitive_resource.modified | data_activity | extended | false |
| bloodtrail.audit.data.sensitive_resource.deleted | data_activity | extended | false |
| bloodtrail.audit.data.sensitive_data.exported | data_exfiltration | lossy | false |
| bloodtrail.audit.security.configuration.changed | configuration_change | extended | false |
| bloodtrail.audit.tenant.context_violation.detected | finding | extended | false |

## OpenTelemetry 1.59.0 / SemConv 1.43.0

Boundary: transport adapter only

Native fields: Timestamp, ObservedTimestamp, TraceId, SpanId, EventName, Resource, InstrumentationScope

Body policy: Canonical event may be in structured Body only with size/privacy checks; native authority fields must not conflict with attributes/body duplicates.

## CloudEvents 1.0.2

Boundary: optional transport envelope only

Data policy: canonical event remains data contract

Conflict policy: reject envelope/payload conflicts
