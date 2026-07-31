# Integrity Limits

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Claim | Can Establish | Cannot Establish |
| --- | --- | --- |
| transport_authenticity | authenticated channel and receiver-side peer verification | payload facts are truthful or complete |
| producer_identity | authenticated workload/service plus registry | authorized compromised producer behaved correctly |
| event_byte_integrity | canonicalization plus signature, MAC, or hash verification | correctness of pre-signing state or timestamp |
| storage_integrity | access controls, immutable storage, checksums, and attestation | records omitted before storage |
| completeness | bounded reconciliation against independent authoritative sequence/outbox | global completeness under compromised producer |
| ordering | per-producer sequence or transaction/queue scope | global causal or wall-clock total order |
| truthful_application_state | independent state reconciliation and trustworthy producer logic | truth by signing alone |
| non_repudiation | legal identity key-control process outside this contract | legal non-repudiation from contract conformance alone |
