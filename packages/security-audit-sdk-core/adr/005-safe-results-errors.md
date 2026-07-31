# ADR-SDK-005: Safe results and errors

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

Initialization/configuration programmer errors throw `SecurityAuditSdkError`. Event validation, lifecycle, and sink outcomes return a discriminated `AuditResult<T>`. All errors use stable codes, category, and bounded canonical path; serialization omits raw values, full events, request/response bodies, stacks, arbitrary causes, and sink messages. Unknown causes map to bounded SDK codes. Error-code additions are minor-compatible; removals or meaning changes are breaking.

## Alternatives

Throwing for every expected validation outcome was rejected as harder to compose safely. Returning raw AJV or sink errors was rejected because they may echo sensitive data.
