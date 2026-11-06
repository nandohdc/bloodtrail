// Test support: aggregated exports for copies test doubles (#839, Q185).
export {
  classifyHttpStatus,
  createBoundedDeliveryBackpressure,
  createBoundedDeliveryRetry,
  createDeliveryShutdown,
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  isAbsolutePathString,
  isBoundedBackpressureCapacity,
  isBoundedRetryAttempts,
  isFunction,
  isNonNegativeSafeInteger,
  isObject,
  isOriginString,
  isPositiveSafeInteger,
  nodeTimers,
  requireOption,
} from "./copies-fake-binding.mjs";

export {
  SecurityAuditSdkError,
  buildMappedEvent,
  createNodeSecurityAuditSdk,
  fakeCore,
  fakeSdkNode,
  mapActor,
  recordedCall,
  testSenderSdk,
  validateSdkConfig,
} from "./copies-fake-sdk.mjs";

export {
  createRehearsalEnv,
  makeFakeSpawn,
  runRehearsal,
} from "./copies-fake-roles.mjs";
