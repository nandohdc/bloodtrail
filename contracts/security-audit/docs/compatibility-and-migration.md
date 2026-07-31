# Compatibility And Migration

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Change | Classification | Producer | Consumer |
| --- | --- | --- | --- |
| documentation or test correction without accepted-data or interpretation change | patch | compatible | compatible |
| optional field with absence meaning, new catalog entry, new reason/action, non-breaking mapping extension | minor | compatible when producer declares version | compatible only through unsupported-event handling for new events |
| required field addition, narrowed value, type or authority change, privacy weakening, removal or semantic reuse | major | breaking | breaking |
| deprecation without removal | minor | compatible during support window | must preserve original meaning and replacement guidance |
| unknown or unsupported schema version | unsupported | reject | reject_or_quarantine |

TypeScript generation strategy: later SDK work may generate types from `schema/security-audit-event.schema.json` and constants from `catalog/catalog.json`, but generated types are compile-time help only. Runtime producer and ingestion validation remains mandatory. This package intentionally implements no SDK.
