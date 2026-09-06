// GENERATED FILE. DO NOT EDIT.
// Sources: contracts/security-audit/source/contract.source.json (bounds and schema version).
export const EVENT_MAX_BYTES = 65536 as const;
export const OBJECT_MAX_DEPTH = 8 as const;
export const DEFAULT_STRING_MAX = 256 as const;
export const DISPLAY_STRING_MAX = 128 as const;
export const MESSAGE_STRING_MAX = 512 as const;
export const ARRAY_MAX_ITEMS = 32 as const;
export const EXTENSION_MAX_NAMESPACES = 4 as const;
export const CLOCK_SKEW_MAX_SECONDS = 300 as const;
export const RETRY_ATTEMPT_MAX = 1000 as const;

// The explicitly enumerated finite supported set for the collector-side version stage,
// per the ratified asymmetric version policy (#75/#76): the producer binds EXACT_ONE while
// a separately authorized collector MAY support an explicit finite set for migration.
export const SUPPORTED_CONTRACT_VERSIONS: readonly string[] = [
  "1.0.0",
];
