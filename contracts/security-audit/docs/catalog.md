# Event Catalog

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Semantic | Event Name | Category | Action | Phases | Outcomes | Commit | Delivery | Retention | Producer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| account_registration_attempted | bloodtrail.audit.account.registration.attempted | account | register | attempted | success, failure, denied, cancelled | not_started, not_applicable, unknown | security_significant | security_standard | registration-boundary |
| account_registration_completed | bloodtrail.audit.account.registration.completed | account | register | completed | success, failure, partial, cancelled | committed, not_committed, partially_committed | transaction_critical | security_elevated | account-transaction-owner |
| authentication_succeeded | bloodtrail.audit.authentication.succeeded | authentication | authenticate | completed | success | not_applicable | security_significant | security_standard | authentication-authority |
| authentication_failed | bloodtrail.audit.authentication.failed | authentication | authenticate | completed | failure | not_applicable | security_significant | security_standard | authentication-authority |
| mfa_enrolled | bloodtrail.audit.authentication.mfa.enrolled | authentication | enroll_mfa | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | mfa-account-authority |
| mfa_removed | bloodtrail.audit.authentication.mfa.removed | authentication | remove_mfa | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | mfa-account-authority |
| session_created | bloodtrail.audit.session.created | session | create_session | completed | success | not_applicable | security_significant | security_standard | session-authority |
| session_revoked | bloodtrail.audit.session.revoked | session | revoke_session | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | session-authority |
| password_reset_requested | bloodtrail.audit.account.password_reset.requested | account | request_password_reset | attempted | success, failure, denied | not_applicable, not_started | security_significant | security_standard | recovery-authority |
| password_reset_completed | bloodtrail.audit.account.password_reset.completed | account | complete_password_reset | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | recovery-transaction-owner |
| authorization_allowed | bloodtrail.audit.authorization.allowed | authorization | evaluate_authorization | attempted | success | not_applicable | best_effort | operational_short | policy-enforcement-point |
| authorization_denied | bloodtrail.audit.authorization.denied | authorization | evaluate_authorization | attempted | denied | not_applicable, not_started | security_significant | security_standard | policy-enforcement-point |
| role_assigned | bloodtrail.audit.authorization.role.assigned | authorization | assign_role | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | authorization-transaction-owner |
| role_removed | bloodtrail.audit.authorization.role.removed | authorization | remove_role | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | authorization-transaction-owner |
| privilege_elevated | bloodtrail.audit.authorization.privilege.elevated | privilege | elevate_privilege | completed | success, failure, denied | committed, not_committed | policy_critical | policy_governed | privilege-authority |
| impersonation_started | bloodtrail.audit.administration.impersonation.started | administration | start_impersonation | completed | success, failure, denied | committed, not_committed | policy_critical | policy_governed | impersonation-authority |
| impersonation_ended | bloodtrail.audit.administration.impersonation.ended | administration | end_impersonation | completed | success, failure | committed, not_committed | policy_critical | policy_governed | impersonation-session-authority |
| sensitive_resource_viewed | bloodtrail.audit.data.sensitive_resource.viewed | data_access | view | completed | success, failure, denied | not_applicable | security_significant | security_elevated | resource-access-owner |
| sensitive_resource_created | bloodtrail.audit.data.sensitive_resource.created | data_access | create | completed | success, failure, denied | committed, not_committed | transaction_critical | security_elevated | resource-transaction-owner |
| sensitive_resource_modified | bloodtrail.audit.data.sensitive_resource.modified | data_access | modify | completed, compensating | success, failure, denied, partial | committed, not_committed, partially_committed, compensated | transaction_critical | security_elevated | resource-transaction-owner |
| sensitive_resource_deleted | bloodtrail.audit.data.sensitive_resource.deleted | data_access | delete | completed | success, failure, denied, partial | committed, not_committed, partially_committed | transaction_critical | security_elevated | resource-transaction-owner |
| sensitive_data_exported | bloodtrail.audit.data.sensitive_data.exported | data_access | export | completed | success, failure, denied, partial, cancelled | committed, not_committed, partially_committed | policy_critical | policy_governed | export-transaction-owner |
| security_configuration_changed | bloodtrail.audit.security.configuration.changed | security_configuration | change_security_configuration | completed | success, failure, denied, partial | committed, not_committed, partially_committed | transaction_critical | security_elevated | configuration-transaction-owner |
| tenant_context_violation_detected | bloodtrail.audit.tenant.context_violation.detected | tenant_security | detect_tenant_violation | attempted | denied, failure, unknown | not_applicable, not_started | security_significant | security_elevated | tenant-enforcement-boundary |

## bloodtrail.audit.account.registration.attempted

Purpose: Record accepted, rejected, or failed registration attempt without asserting account creation.

Trigger: registration request reaches server registration boundary

Required context: actor, tenant, request, source, correlation

Actor rule: anonymous actor permitted; no fabricated principal

Tenant rule: tenantless or resolved tenant; claimed tenant remains client claim

Resource rule: account resource only after server resolution

Authorization rule: not applicable unless policy denied the attempt

Privacy concerns: account claims restricted, source minimized

Investigation value: abuse patterns and correlation to completion

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.account.registration.completed

Purpose: Record final committed registration result.

Trigger: account transaction reaches authoritative completion

Required context: actor, tenant, subject, resource, correlation

Actor rule: anonymous source may be linked but subject is server-resolved

Tenant rule: effective and resource tenant required

Resource rule: account resource required

Authorization rule: not applicable or policy context when tenant controls registration

Privacy concerns: account identifiers restricted

Investigation value: account creation provenance

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authentication.succeeded

Purpose: Record authoritative successful authentication.

Trigger: authentication authority completes successful transaction

Required context: actor, authenticated_principal, authentication, credential, session, source

Actor rule: authenticated human or service principal

Tenant rule: validated principal tenant when tenant scoped

Resource rule: credential/session references only; no secrets

Authorization rule: not applicable

Privacy concerns: identity session source restricted

Investigation value: account access and assurance lineage

Mapping status: OCSF exact, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authentication.failed

Purpose: Record failed authentication without account enumeration or secret leakage.

Trigger: authentication authority rejects or cannot complete authentication

Required context: actor, authentication, source, request, correlation

Actor rule: anonymous actor permitted

Tenant rule: tenantless or resolved tenant; claimed tenant remains claim

Resource rule: credential type only when safe

Authorization rule: not applicable

Privacy concerns: claims source restricted

Investigation value: credential abuse and brute force investigation

Mapping status: OCSF exact, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authentication.mfa.enrolled

Purpose: Record committed enrollment of an MFA method without factor contents.

Trigger: MFA/account authority commits enrollment

Required context: actor, subject, tenant, authentication, authorization, resource

Actor rule: authenticated human required

Tenant rule: tenant scoped

Resource rule: credential resource without factor contents

Authorization rule: policy decision and enforcement required

Privacy concerns: factor metadata restricted

Investigation value: account security posture change

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authentication.mfa.removed

Purpose: Record committed or denied MFA removal.

Trigger: MFA/account authority completes removal decision

Required context: actor, subject, tenant, authentication, authorization, resource

Actor rule: authenticated human or administrator

Tenant rule: tenant scoped

Resource rule: credential resource without factor contents

Authorization rule: policy decision and reason required

Privacy concerns: factor metadata and recovery context restricted

Investigation value: takeover and recovery investigation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.session.created

Purpose: Record creation of an authenticated session.

Trigger: session authority creates non-secret session reference

Required context: authenticated_principal, authentication, session, tenant, source

Actor rule: authenticated actor required

Tenant rule: validated principal tenant

Resource rule: session resource reference

Authorization rule: not applicable

Privacy concerns: session identity source restricted

Investigation value: session provenance and login correlation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.session.revoked

Purpose: Record committed session revocation.

Trigger: session authority commits revocation or records denial

Required context: actor, subject, tenant, authorization, correlation

Actor rule: authenticated actor required

Tenant rule: tenant scoped or cross-tenant admin with policy

Resource rule: session subject and original session link

Authorization rule: policy decision required for admin revocation

Privacy concerns: session identity restricted

Investigation value: containment and logout history

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.account.password_reset.requested

Purpose: Record reset request handling without revealing account existence externally.

Trigger: recovery authority handles reset request

Required context: actor, request, source, correlation

Actor rule: anonymous actor permitted

Tenant rule: tenantless or resolved tenant; subject only if safely resolved

Resource rule: account only if resolved safely

Authorization rule: not applicable or abuse policy denial

Privacy concerns: recovery identity source restricted

Investigation value: reset abuse precursor correlation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.account.password_reset.completed

Purpose: Record committed password reset without credential contents.

Trigger: account/recovery transaction owner commits reset result

Required context: actor, subject, tenant, authentication, session, correlation

Actor rule: authenticated or recovery-verified actor

Tenant rule: tenant scoped

Resource rule: credential/account resource without new credential material

Authorization rule: recovery policy context required

Privacy concerns: recovery identity restricted

Investigation value: takeover and credential lifecycle

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authorization.allowed

Purpose: Preserve policy allow decision independently of operation result.

Trigger: policy decision and enforcement point records allow

Required context: actor, tenant, resource, authorization, request

Actor rule: resolved actor or service identity required

Tenant rule: tenant scoped or cross-tenant with policy

Resource rule: evaluated resource context required

Authorization rule: decision must be allow

Privacy concerns: policy resource identity restricted

Investigation value: explain access path and policy version

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authorization.denied

Purpose: Preserve policy deny decision and attempted action.

Trigger: policy decision and enforcement point records deny

Required context: actor, tenant, resource, authorization, source

Actor rule: resolved actor or claim per catalog

Tenant rule: tenant scoped or tenant violation linked

Resource rule: attempted resource context required

Authorization rule: decision must be deny

Privacy concerns: policy resource identity restricted

Investigation value: attack and access-control investigation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authorization.role.assigned

Purpose: Record committed role assignment.

Trigger: identity/authorization transaction owner commits assignment

Required context: administrator, subject, tenant, role, authorization, reason

Actor rule: administrator actor required

Tenant rule: tenant scoped or cross-tenant platform admin

Resource rule: role resource required

Authorization rule: policy allow required for success

Privacy concerns: role identity restricted

Investigation value: privilege provenance

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authorization.role.removed

Purpose: Record committed role removal.

Trigger: identity/authorization transaction owner commits removal

Required context: administrator, subject, tenant, role, authorization, reason

Actor rule: administrator actor required

Tenant rule: tenant scoped or cross-tenant platform admin

Resource rule: role resource required

Authorization rule: policy allow required for success

Privacy concerns: role identity restricted

Investigation value: privilege revocation history

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.authorization.privilege.elevated

Purpose: Record temporary or permanent privilege elevation or break-glass use.

Trigger: privilege authority records elevation decision

Required context: real_actor, subject, delegation, tenant, authorization, reason, expiry

Actor rule: real actor preserved; privilege label alone insufficient

Tenant rule: platform or cross-tenant authority explicit

Resource rule: privilege grant resource required

Authorization rule: override and break-glass explicit when used

Privacy concerns: highly restricted

Investigation value: high-value escalation and abuse evidence

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.administration.impersonation.started

Purpose: Record start of approved administrative impersonation.

Trigger: impersonation authority commits start

Required context: real_admin_actor, impersonated_subject, tenants, scope, policy, session, expiry

Actor rule: real administrator and impersonated subject both required

Tenant rule: cross-tenant or tenant admin with explicit target

Resource rule: impersonation session resource required

Authorization rule: policy allow and reason required for success

Privacy concerns: highly restricted

Investigation value: accountability during impersonation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.administration.impersonation.ended

Purpose: Record termination or expiry of impersonation.

Trigger: impersonation/session authority terminates interval

Required context: real_actor_or_process, impersonated_subject, original_start, reason

Actor rule: real actor or scheduled expiry process

Tenant rule: same target tenant and original start correlation

Resource rule: impersonation session resource required

Authorization rule: not applicable or termination policy

Privacy concerns: highly restricted

Investigation value: close accountability interval

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.data.sensitive_resource.viewed

Purpose: Record read of cataloged sensitive resource.

Trigger: resource access/enforcement owner observes read result

Required context: actor, principal, tenant, resource, authorization, request

Actor rule: resolved actor or service identity required

Tenant rule: tenant scoped or authorized cross-tenant access

Resource rule: sensitive resource and classification required

Authorization rule: decision independent from outcome

Privacy concerns: resource identity restricted

Investigation value: inappropriate access and disclosure investigation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.data.sensitive_resource.created

Purpose: Record committed creation of sensitive resource.

Trigger: resource transaction owner commits creation

Required context: actor, tenant, resource, authorization, operation, transaction

Actor rule: resolved actor required

Tenant rule: effective and owning tenant required

Resource rule: resource id and owner required after commit

Authorization rule: policy allow required for success

Privacy concerns: resource metadata restricted

Investigation value: creation provenance

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.data.sensitive_resource.modified

Purpose: Record committed modification of sensitive resource without before/after bodies.

Trigger: resource transaction owner records modification or compensation

Required context: actor, tenant, resource, authorization, change_categories, transaction

Actor rule: resolved actor required

Tenant rule: effective and owning tenant required

Resource rule: no raw before/after payload

Authorization rule: policy allow required for success

Privacy concerns: no body; restricted metadata

Investigation value: tampering and change investigation

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.data.sensitive_resource.deleted

Purpose: Record committed deletion of sensitive resource without deleted content.

Trigger: resource transaction owner records deletion

Required context: actor, tenant, resource, authorization, deletion_mode, transaction

Actor rule: resolved actor required

Tenant rule: effective and owning tenant required

Resource rule: deleted content prohibited

Authorization rule: policy allow required for success

Privacy concerns: deleted content prohibited

Investigation value: destructive action accountability

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.data.sensitive_data.exported

Purpose: Record export without exported data.

Trigger: export transaction owner records export attempt or completion

Required context: actor, tenant, resource_scope, authorization, bounded_volume, destination_class

Actor rule: resolved actor required

Tenant rule: effective and owning tenant required; cross-tenant export requires explicit policy

Resource rule: bounded aggregate metadata only

Authorization rule: policy decision required

Privacy concerns: highly restricted export metadata

Investigation value: exfiltration and compliance investigation

Mapping status: OCSF lossy, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.security.configuration.changed

Purpose: Record committed change to security-relevant configuration.

Trigger: configuration transaction owner records change

Required context: actor, tenant_or_platform_scope, config_resource, authorization, change_category

Actor rule: administrator or workload identity required

Tenant rule: tenant, platform, or tenantless explicitly cataloged

Resource rule: configuration resource and category required

Authorization rule: policy allow required for success

Privacy concerns: configuration metadata restricted

Investigation value: control-plane change history

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.

## bloodtrail.audit.tenant.context_violation.detected

Purpose: Record mismatch, spoofing, or prohibited cross-tenant attempt.

Trigger: tenancy/resource/enforcement boundary detects conflict

Required context: actor_or_claim, authoritative_tenants, claimed_tenant, resource_owner, request_source, authorization

Actor rule: actor claim allowed only as claim

Tenant rule: claimed and authoritative tenants separately recorded

Resource rule: resource owner required when available

Authorization rule: decision deny or indeterminate expected

Privacy concerns: tenant identity source highly restricted

Investigation value: isolation failure and attack detection

Mapping status: OCSF extended, OpenTelemetry transformed, CloudEvents optional_envelope.
