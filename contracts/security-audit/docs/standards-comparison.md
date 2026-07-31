# Standards Comparison

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

Statuses are evidence labels, not external mandates.

| Bloodtrail Semantic | NIST | OCSF | OpenTelemetry | CloudEvents | W3C Trace Context | JSON Schema | SemVer | OWASP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| server authoritative audit boundary | partial | partial | application_defined | application_defined | not_applicable | partial | not_applicable | partial |
| tenant authority and claimed tenant separation | application_defined | partial | application_defined | application_defined | not_applicable | partial | not_applicable | partial |
| actor subject principal delegation credential separation | partial | partial | application_defined | application_defined | not_applicable | partial | not_applicable | partial |
| authorization decision separated from business outcome | partial | partial | application_defined | application_defined | not_applicable | partial | not_applicable | partial |
| occurrence observed time and trace correlation | partial | partial | defines | partial | defines | partial | not_applicable | partial |
| privacy prohibited data and transformations | partial | partial | application_defined | application_defined | partial | partial | not_applicable | partial |
| delivery classes and failure posture | partial | application_defined | application_defined | application_defined | not_applicable | partial | not_applicable | partial |
| versioned schema compatibility | not_applicable | partial | partial | partial | not_applicable | defines | defines_terms | not_applicable |
| OCSF export mapping | not_applicable | defines_target | not_applicable | not_applicable | not_applicable | partial | partial | partial |
| OpenTelemetry transport mapping | not_applicable | not_applicable | defines_target | not_applicable | defines | partial | partial | partial |
| CloudEvents optional envelope mapping | not_applicable | not_applicable | not_applicable | defines_target | partial | partial | partial | partial |
