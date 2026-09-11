# Field Policy

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Path | Type | Requirement | Authority | Trust | Privacy | Policy | Retention | Compatibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| event.id | string | required | event_identity_catalog | authoritative_server | internal | allowed | security_standard | stable |
| event.name | string | required | event_identity_catalog | authoritative_server | public_metadata | allowed | security_standard | registry |
| event.category | string | required | event_identity_catalog | authoritative_server | public_metadata | allowed | security_standard | registry |
| event.action | string | required | event_identity_catalog | authoritative_server | public_metadata | allowed | security_standard | registry |
| event.lifecycle_phase | string | required | lifecycle_outcome_commit | authoritative_server | internal | allowed | security_standard | registry |
| event.outcome | string | required | lifecycle_outcome_commit | authoritative_server | internal | allowed | security_standard | stable_registry |
| event.outcome_reason.code | string | conditional | lifecycle_outcome_commit | authoritative_server | internal | conditionally_allowed | security_standard | registry |
| event.outcome_reason.message | string | optional | lifecycle_outcome_commit | authoritative_server | confidential | conditionally_allowed | operational_short | additive |
| event.commit_state | string | conditional | lifecycle_outcome_commit | authoritative_server | internal | allowed | security_standard | registry |
| event.timestamp | string | required | timestamps | authoritative_server | internal | allowed | security_standard | stable |
| event.observed_at | string | required | timestamps | observed_transport | internal | allowed | security_standard | stable |
| event.delivery_class | string | required | data_privacy_delivery | authoritative_server | internal | allowed | security_standard | registry |
| schema.name | string | required | event_identity_catalog | authoritative_server | public_metadata | allowed | security_standard | stable |
| schema.version | string | required | event_identity_catalog | authoritative_server | public_metadata | allowed | security_standard | stable |
| producer.name | string | required | producer_service_deployment | authoritative_server | internal | allowed | security_standard | registry |
| producer.version | string | required | producer_service_deployment | authoritative_server | internal | allowed | security_standard | stable |
| producer.instance_id | string | optional | producer_service_deployment | authoritative_server | confidential | conditionally_allowed | operational_short | additive |
| environment.name | string | required | producer_service_deployment | authoritative_server | internal | allowed | security_standard | registry |
| service.name | string | required | producer_service_deployment | authoritative_server | internal | allowed | security_standard | registry |
| service.version | string | conditional | producer_service_deployment | authoritative_server | internal | allowed | security_standard | stable |
| service.instance_id | string | optional | producer_service_deployment | authoritative_server | confidential | conditionally_allowed | operational_short | additive |
| deployment.id | string | conditional | producer_service_deployment | authoritative_server | internal | conditionally_allowed | security_standard | stable |
| deployment.region | string | optional | producer_service_deployment | authoritative_server | confidential | conditionally_allowed | security_standard | additive |
| deployment.zone | string | optional | producer_service_deployment | authoritative_server | confidential | conditionally_allowed | security_standard | additive |
| tenant.scope | string | required | tenant_context | authoritative_server | internal | allowed | security_standard | registry |
| tenant.actor_tenant_id | string | conditional | tenant_context | authoritative_server | confidential | transform_required | security_standard | stable |
| tenant.effective_tenant_id | string | conditional | tenant_context | authoritative_server | confidential | transform_required | security_standard | stable |
| tenant.resource_tenant_id | string | conditional | tenant_context | authoritative_server | confidential | transform_required | security_standard | stable |
| tenant.parent_tenant_id | string | optional | tenant_context | authoritative_server | confidential | transform_required | security_standard | additive |
| tenant.claimed_tenant_id | string | optional | claimed_identity | client_claim | restricted | transform_required | operational_short | additive |
| actor.type | string | required | authenticated_identity | authoritative_server | internal | allowed | security_standard | registry |
| actor.id | string | conditional | authenticated_identity | authoritative_server | confidential | transform_required | security_standard | stable |
| actor.tenant_id | string | conditional | tenant_context | authoritative_server | confidential | transform_required | security_standard | stable |
| actor.display_name | string | optional | claimed_identity | client_claim | restricted | conditionally_allowed | operational_short | additive |
| actor.provenance.trust_level | string | conditional | authenticated_identity | authoritative_server | internal | allowed | security_standard | stable |
| actor.provenance.source | string | conditional | authenticated_identity | authoritative_server | internal | allowed | security_standard | stable |
| subject.type | string | conditional | resource_context | authoritative_server | internal | allowed | security_standard | registry |
| subject.id | string | conditional | resource_context | authoritative_server | confidential | transform_required | security_standard | stable |
| subject.tenant_id | string | conditional | resource_context | authoritative_server | confidential | transform_required | security_standard | stable |
| subject.display_name | string | optional | claimed_identity | client_claim | restricted | conditionally_allowed | operational_short | additive |
| authenticated_principal.type | string | conditional | authenticated_identity | authoritative_server | internal | allowed | security_standard | registry |
| authenticated_principal.id | string | conditional | authenticated_identity | verified_assertion | confidential | transform_required | security_standard | stable |
| authenticated_principal.issuer | string | conditional | authenticated_identity | verified_assertion | internal | allowed | security_standard | stable |
| delegation.mode | string | conditional | delegation_impersonation | authoritative_server | internal | allowed | security_elevated | registry |
| delegation.principal_id | string | conditional | delegation_impersonation | authoritative_server | confidential | transform_required | security_elevated | stable |
| delegation.scope | array | conditional | delegation_impersonation | authoritative_server | confidential | conditionally_allowed | security_elevated | stable_registry |
| delegation.reason_code | string | conditional | delegation_impersonation | authoritative_server | confidential | allowed | security_elevated | registry |
| delegation.expires_at | string | conditional | delegation_impersonation | authoritative_server | confidential | allowed | security_elevated | stable |
| delegation.chain | array | optional | delegation_impersonation | authoritative_server | restricted | conditionally_allowed | security_elevated | additive |
| credential.type | string | conditional | authenticated_identity | authoritative_server | internal | allowed | security_standard | registry |
| credential.reference | string | optional | authenticated_identity | authoritative_server | restricted | transform_required | security_standard | stable |
| credential.key_id | string | optional | authenticated_identity | authoritative_server | internal | allowed | security_standard | additive |
| initiator.type | string | required | producer_service_deployment | authoritative_server | internal | allowed | security_standard | registry |
| initiator.id | string | required | producer_service_deployment | authoritative_server | confidential | allowed | security_standard | stable |
| initiator.version | string | optional | producer_service_deployment | authoritative_server | internal | allowed | security_standard | additive |
| session.id | string | conditional | authenticated_identity | authoritative_server | restricted | transform_required | security_standard | stable |
| session.created_at | string | optional | authenticated_identity | authoritative_server | confidential | conditionally_allowed | security_standard | additive |
| session.age_seconds | integer | optional | authenticated_identity | derived_server | confidential | conditionally_allowed | security_standard | additive |
| session.assurance_level | string | optional | authenticated_identity | authoritative_server | confidential | conditionally_allowed | security_standard | registry |
| authentication.method | string | conditional | authenticated_identity | authoritative_server | confidential | allowed | security_standard | registry |
| authentication.assurance_level | string | conditional | authenticated_identity | verified_assertion | confidential | allowed | security_standard | registry |
| authentication.mfa_state | string | conditional | authenticated_identity | authoritative_server | restricted | conditionally_allowed | security_standard | registry |
| authentication.credential_type | string | conditional | authenticated_identity | authoritative_server | confidential | allowed | security_standard | registry |
| authentication.authenticated_at | string | conditional | authenticated_identity | authoritative_server | confidential | allowed | security_standard | stable |
| authentication.identity_provider | string | optional | authenticated_identity | verified_assertion | confidential | conditionally_allowed | security_standard | stable |
| authentication.account_recovery.flow | string | optional | authenticated_identity | authoritative_server | restricted | conditionally_allowed | security_elevated | stable |
| authentication.account_recovery.state | string | optional | authenticated_identity | authoritative_server | restricted | conditionally_allowed | security_elevated | additive |
| authentication.account_recovery.reason_code | string | optional | authenticated_identity | authoritative_server | restricted | conditionally_allowed | security_elevated | registry |
| authentication.failure_reason | string | conditional | authenticated_identity | authoritative_server | restricted | conditionally_allowed | security_standard | registry |
| authentication.delegated | boolean | conditional | delegation_impersonation | derived_server | confidential | allowed | security_standard | stable |
| authentication.impersonated | boolean | conditional | delegation_impersonation | derived_server | restricted | allowed | security_elevated | stable |
| authorization.decision | string | conditional | authorization_context | authoritative_server | confidential | allowed | security_standard | stable_registry |
| authorization.policy_id | string | conditional | authorization_context | authoritative_server | confidential | allowed | security_standard | stable |
| authorization.policy_version | string | conditional | authorization_context | authoritative_server | confidential | allowed | security_standard | stable |
| authorization.capability | string | conditional | authorization_context | authoritative_server | confidential | allowed | security_standard | registry |
| authorization.enforcement_point | string | conditional | authorization_context | authoritative_server | internal | allowed | security_standard | registry |
| authorization.decision_reason | string | conditional | authorization_context | authoritative_server | restricted | conditionally_allowed | security_standard | registry |
| authorization.resource_context.type | string | conditional | authorization_context | authoritative_server | restricted | allowed | security_standard | stable |
| authorization.resource_context.id | string | conditional | authorization_context | authoritative_server | restricted | transform_required | security_standard | stable |
| authorization.tenant_context.effective_tenant_id | string | conditional | authorization_context | authoritative_server | restricted | transform_required | security_standard | stable |
| authorization.override | boolean | conditional | authorization_context | authoritative_server | restricted | allowed | security_elevated | stable |
| authorization.break_glass | boolean | conditional | authorization_context | authoritative_server | restricted | allowed | policy_governed | stable |
| authorization.policy_correlation_id | string | optional | authorization_context | authoritative_server | confidential | allowed | security_standard | additive |
| source.observed.address | string | optional | network_observation | observed_transport | restricted | transform_required | operational_short | stable |
| source.observed.port | integer | optional | network_observation | observed_transport | confidential | conditionally_allowed | operational_short | stable |
| source.observed.proxy_chain | array | optional | network_observation | observed_transport | restricted | conditionally_allowed | operational_short | stable |
| source.client_reported.user_agent_family | string | optional | claimed_identity | client_claim | restricted | conditionally_allowed | operational_short | additive |
| source.client_reported.user_agent_version | string | optional | claimed_identity | client_claim | restricted | conditionally_allowed | operational_short | additive |
| destination.service | string | conditional | network_observation | authoritative_server | internal | allowed | security_standard | registry |
| destination.address | string | optional | network_observation | observed_transport | confidential | conditionally_allowed | operational_short | stable |
| destination.port | integer | optional | network_observation | observed_transport | confidential | conditionally_allowed | operational_short | stable |
| resource.type | string | conditional | resource_context | authoritative_server | internal | allowed | security_standard | registry |
| resource.id | string | conditional | resource_context | authoritative_server | restricted | transform_required | security_standard | stable |
| resource.parent_type | string | optional | resource_context | authoritative_server | internal | allowed | security_standard | registry |
| resource.parent_id | string | optional | resource_context | authoritative_server | restricted | transform_required | security_standard | additive |
| resource.owning_tenant_id | string | conditional | resource_context | authoritative_server | restricted | transform_required | security_standard | stable |
| resource.data_classification | string | conditional | resource_context | authoritative_server | restricted | allowed | security_standard | registry |
| resource.operation_type | string | required | resource_context | authoritative_server | internal | allowed | security_standard | registry |
| resource.bulk.count | integer | optional | resource_context | authoritative_server | restricted | conditionally_allowed | security_elevated | stable |
| resource.bulk.scope | string | optional | resource_context | authoritative_server | restricted | conditionally_allowed | security_elevated | stable |
| resource.bulk.child_event_policy | string | optional | resource_context | authoritative_server | internal | allowed | security_elevated | stable |
| resource.change_categories | array | optional | resource_context | authoritative_server | restricted | conditionally_allowed | security_elevated | registry |
| resource.deletion_mode | string | optional | resource_context | authoritative_server | restricted | conditionally_allowed | security_elevated | registry |
| resource.export.destination_class | string | optional | resource_context | authoritative_server | restricted | conditionally_allowed | policy_governed | stable |
| resource.export.size_class | string | optional | resource_context | authoritative_server | restricted | conditionally_allowed | policy_governed | stable |
| resource.export.record_count | integer | optional | resource_context | authoritative_server | restricted | conditionally_allowed | policy_governed | stable |
| request.id | string | conditional | correlation_causality | authoritative_server | confidential | allowed | security_standard | stable |
| request.method | string | optional | correlation_causality | authoritative_server | internal | allowed | operational_short | additive |
| request.route | string | optional | correlation_causality | authoritative_server | confidential | conditionally_allowed | operational_short | additive |
| request.user_agent | string | optional | claimed_identity | client_claim | restricted | conditionally_allowed | operational_short | additive |
| request.message_id | string | conditional | correlation_causality | observed_transport | confidential | allowed | security_standard | stable |
| correlation.trace_id | string | optional | correlation_causality | observed_transport | confidential | allowed | security_standard | stable |
| correlation.span_id | string | optional | correlation_causality | observed_transport | confidential | allowed | security_standard | stable |
| correlation.correlation_id | string | required | correlation_causality | authoritative_server | confidential | allowed | security_standard | stable |
| correlation.causation_id | string | conditional | correlation_causality | authoritative_server | confidential | allowed | security_standard | stable |
| correlation.operation_id | string | required | correlation_causality | authoritative_server | confidential | allowed | security_standard | stable |
| correlation.transaction_id | string | conditional | correlation_causality | authoritative_server | restricted | transform_required | security_elevated | stable |
| correlation.request_id | string | conditional | correlation_causality | authoritative_server | confidential | allowed | security_standard | stable |
| correlation.message_id | string | conditional | correlation_causality | observed_transport | confidential | allowed | security_standard | stable |
| correlation.retry_attempt | integer | conditional | correlation_causality | authoritative_server | internal | allowed | operational_short | stable |
| correlation.original_event_id | string | conditional | correlation_causality | authoritative_server | confidential | allowed | security_elevated | stable |
| risk.level | string | optional | risk_enrichment | derived_server | restricted | conditionally_allowed | security_elevated | registry |
| risk.score | number | optional | risk_enrichment | derived_server | restricted | conditionally_allowed | security_elevated | stable |
| risk.reason_codes | array | optional | risk_enrichment | derived_server | restricted | conditionally_allowed | security_elevated | registry |
| risk.model.name | string | conditional | risk_enrichment | derived_server | confidential | allowed | security_elevated | stable |
| risk.model.version | string | conditional | risk_enrichment | derived_server | confidential | allowed | security_elevated | stable |
| risk.model.provenance.trust_level | string | conditional | risk_enrichment | derived_server | internal | allowed | security_elevated | stable |
| risk.model.provenance.derived_from | array | conditional | risk_enrichment | derived_server | internal | allowed | security_elevated | additive |
| data.classification | string | required | data_privacy_delivery | authoritative_server | restricted | allowed | security_standard | registry |
| data.retention_class | string | required | data_privacy_delivery | authoritative_server | restricted | allowed | security_standard | registry |
| data.field_policy_version | string | required | data_privacy_delivery | authoritative_server | internal | allowed | security_standard | stable |
| integrity.attestations | array | optional | integrity_metadata | authoritative_server | restricted | conditionally_allowed | security_elevated | additive |
| integrity.transport_authentication.method | string | optional | integrity_metadata | observed_transport | restricted | allowed | security_elevated | additive |
| integrity.transport_authentication.verified | boolean | optional | integrity_metadata | observed_transport | restricted | allowed | security_elevated | additive |
| integrity.transport_authentication.peer | string | optional | integrity_metadata | observed_transport | restricted | transform_required | security_elevated | additive |

## Prohibited Data

- password
- password_verifier
- raw_token
- access_token
- refresh_token
- id_token
- api_key
- private_key
- session_cookie
- cookie
- recovery_code
- factor_content
- factor_value
- payment_card
- card_number
- raw_secret
- secret
- request_body
- response_body
- raw_body
- full_request
- full_response
- serialized_object
- connection_string
- dsn

## Transformations

| Field Family | Policy | Method | Key Scope | Plain Hash Allowed |
| --- | --- | --- | --- | --- |
| observed_ip | transform_required when exact address is unnecessary | coarsen or purpose-scoped keyed transform | tenant and purpose scoped by default | false |
| user_agent | conditionally_allowed | parse/coarsen family and major version; omit raw string by default | not applicable | false |
| email_phone | transform_required unless direct display is explicitly cataloged | purpose-scoped keyed transform or tokenization | tenant and purpose scoped by default | false |
| business_identifier | allowed only for stable opaque IDs needed by purpose | direct opaque id or purpose-scoped keyed transform | tenant and purpose scoped by default | false |
| session_credential_reference | transform_required unless server reference is non-secret and purpose-scoped | keyed fingerprint or opaque reference; never bearer value | tenant and purpose scoped by default | false |
| cross_tenant_correlation | prohibited by default | requires explicit reviewed platform-security use case | broader scope blocked pending qualified review | false |
