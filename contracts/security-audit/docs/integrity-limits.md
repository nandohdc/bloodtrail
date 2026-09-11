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
| client_evidence_origin | an authenticated producer relayed one bounded v1 interaction reference at client_claim trust | that a real browser produced it, that the interaction occurred, or that the producer did not fabricate it |
| keyed_transformation | a bounded transform output and key identifier are present and well formed | that the declared HMAC or keyed transform actually ran, or ran with the named key |
