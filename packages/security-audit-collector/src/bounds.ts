// Derived bounds from the frozen contract. These constants are generated from
// contracts/security-audit/source/contract.source.json (bounds block) by
// scripts/generate-bounds.mjs; they are never configured locally (F3 of the
// #107 plan).

export {
  EVENT_MAX_BYTES,
  OBJECT_MAX_DEPTH,
  DEFAULT_STRING_MAX,
  DISPLAY_STRING_MAX,
  MESSAGE_STRING_MAX,
  ARRAY_MAX_ITEMS,
  EXTENSION_MAX_NAMESPACES,
  CLOCK_SKEW_MAX_SECONDS,
  RETRY_ATTEMPT_MAX,
} from "./generated/bounds.generated.js";
