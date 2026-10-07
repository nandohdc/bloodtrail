# Error catalog

A failed call gives you an error code. Each entry below says what the code means, what usually causes
it, how to fix it, and which fields of the failure to read.

The catalog covers every code in the core's `SDK_ERROR_CODES` and `CONTRACT_ERROR_CODES`. No SDK call
returns the codes under "Contract codes for rules outside the SDK", because their rules apply outside
it.

Every example value in this catalog is synthetic.

## Reading a failure

**Returned failures.** These calls return an `AuditResult`, which is `{ ok: false, error }` on failure:

- every named event method, such as `sdk.sensitiveResourceViewed(...)`;
- `emit`, `redeliver` and `beginOperation`;
- `flush` and `shutdown`;
- an operation handle's `mark...` methods.

**Thrown failures.** These calls throw a `SecurityAuditSdkError` instead:

- `createNodeSecurityAuditSdk`, when the SDK is created;
- the authority constructors, such as `authoritativeTenant`;
- `sdk.runWithContext` and `createAuditContextFrame`.

The thrown error has the same `code`, `category` and `path` properties, and its `toJSON()` returns
them.

`createHttpAuditSink` throws a plain `TypeError` for invalid options. That error has no code, and its
message never contains a header name or value.

**The fields of a failure:**

- `code` names the failure. It is the heading of an entry below.
- `category` is `configuration`, `validation`, `authority`, `privacy`, `lifecycle` or `sink`.
- `path` is a JSON Pointer to the part of the event or input at fault. It is absent when the call
  fails as a whole: from `SDK_SHUTTING_DOWN`, `SDK_SHUT_DOWN` and `SDK_SHUTDOWN_TIMEOUT`, and from sink
  failures that `flush` and `shutdown` return.
- `eventName` names the event. Only sink failures from sending an event carry it.
- `eventId` is declared in the type, but no failure sets it. To connect a sink failure with its event,
  use the HTTP sink's `onOutcome` callback: it reports each request's event identifier and precise
  cause.

A failure never carries a value you passed in, a message from your sink, or a stack trace.

## SDK codes

### `SDK_INVALID_CONFIGURATION`

**Meaning.** A configuration value, or a value passed to an authority constructor, is missing or has
the wrong shape.

**Common causes.**

- `createNodeSecurityAuditSdk` got no `sink`, or a sink without an `emit` function.
- It got an empty or missing `producer.name`, `producer.version`, `service.name` or
  `environment.name`.
- `shutdownTimeoutMs` is not an integer from 0 to 60,000.
- A transformation has no `path` or `transform`, names a path the SDK cannot transform, or repeats a
  path.
- A custom provider lacks a function, such as `clock.now` or one of the `identifiers` functions.
- `authoritativeContext` holds a plain object where an authority constructor's value belongs. Per call
  or in `runWithContext`, the same mistake is `AUTHORITY_ESCALATION`.
- An authority constructor got an empty required string, such as `authoritativeTenant` with a `tenant`
  scope and an empty `effective_tenant_id`.

**Fix.** Correct the field that `path` names.

**Fields.** It is thrown when the SDK or the constructor's value is created. `category` is
`configuration`. `path` names the field, such as `/sink`, `/transformations/0/path` or
`/tenant/effective_tenant_id`.

### `SDK_INVALID_INPUT`

**Meaning.** A value is not plain data that the SDK can copy. The SDK accepts strings, finite numbers,
booleans, `null`, dense arrays and plain objects.

**Common causes.**

- A `Date`, `Map`, `Buffer`, class instance, function or symbol. A common case is a `Date` where an
  ISO timestamp string belongs.
- `NaN` or `Infinity`.
- A getter, a non-enumerable property, a symbol key, or an array with holes.
- A value that throws when it is read, such as a revoked proxy.
- A transformation hook that returns `null`. See `SDK_HOOK_FAILURE`.

**Fix.** Pass plain data. Convert a date with `toISOString()`, and copy a class instance into a plain
object.

**Fields.** `category` is `validation`. `path` names where the value was passed in, not the field that
holds it:

- `/` for a named method's input or an event;
- `/operation` for `beginOperation`;
- `/context` for a context frame;
- the field for an authority constructor, such as `/tenant`. Constructors throw it.

### `FIELD_SERIALIZATION_FAILED`

**Meaning.** A value cannot be converted to JSON, so the SDK cannot produce the event's canonical form.

**Common causes.**

- A `BigInt` anywhere in the input.
- An object that contains itself.

**Fix.** Convert a `BigInt` to a number or a string, and remove the self-reference.

**Fields.** `category` is `validation`. As for `SDK_INVALID_INPUT`, `path` names where the value was
passed in, not the field that holds it.

### `SDK_UNSUPPORTED_CONTRACT_VERSION`

**Meaning.** The configuration's `contractVersion` is not the contract version that this SDK implements.
Each SDK build supports exactly one contract version.

**Common causes.**

- A `contractVersion` copied from an older example.
- A configuration built at runtime or in JavaScript, where TypeScript cannot check the value.

**Fix.** Set `contractVersion` to the core's exported `CONTRACT_VERSION`.

**Fields.** It is thrown when the SDK is created. `category` is `configuration`, and `path` is
`/contractVersion`.

### `SDK_MISSING_AUTHORITATIVE_CONTEXT`

**Meaning.** This code is reserved, and this SDK version never returns it.

**Common causes.** Missing context appears as the code for whatever is missing instead:

- `MISSING_REQUIRED_ACTOR` for an actor;
- `MISSING_TENANT_CONTEXT` for a tenant;
- `SDK_MISSING_EVENT_FIELD` for any other context.

**Fix.** If you see this code, something other than this SDK version produced it. Check which core
version resolves in your application.

**Fields.** No call returns it, so it has no fields to read.

### `SDK_MISSING_EVENT_FIELD`

**Meaning.** The event lacks a field that its catalog entry or the contract's schema requires.

**Common causes.**

- A resource without an `id`, for `sensitiveResourceViewed`, `sensitiveResourceCreated`,
  `sensitiveResourceModified` or `sensitiveResourceDeleted`. The path is `/resource/id`.
- Authorization evidence whose `decision` is not `not_applicable` but has no `policy_id` or
  `enforcement_point`. The path is `/authorization`.
- `roleAssigned` or `roleRemoved` with a resource whose `type` is not `role`, or that has no `id`. The
  path is `/resource`.
- A named call without context that its event requires, such as `session` for
  `authenticationSucceeded`. TypeScript requires that context in the call itself, so this arises from
  JavaScript or through a cast.

**Fix.** Supply the field that `path` names through its constructor, for example `authoritativeResource`
for `/resource`, or `sessionEvidence` for `/session`. The core's `EVENT_CATALOG` lists each event's
`required_context`.

**Fields.** `category` is `validation`. `path` names the missing field, or the object that should hold
it.

### `SDK_NOT_READY`

**Meaning.** This code is reserved, and this SDK version never returns it.

**Common causes.** None. An SDK is ready as soon as `createNodeSecurityAuditSdk` returns. A call that
comes too late fails with `SDK_SHUTTING_DOWN` or `SDK_SHUT_DOWN`.

**Fix.** If you see this code, something other than this SDK version produced it. Check which core
version resolves in your application.

**Fields.** No call returns it, so it has no fields to read.

### `SDK_SHUTTING_DOWN`

**Meaning.** `shutdown()` has started, so the SDK accepts no new work.

**Common causes.** A named call, `emit`, `redeliver` or `beginOperation` arrived after `shutdown()` was
called but before it finished, for example from a request handler still running during a graceful
stop.

**Fix.** Stop making audit calls before you call `shutdown()`, for example by letting request
handlers finish first. The event was neither built nor sent. `flush()` still works while the SDK
shuts down.

**Fields.** `category` is `lifecycle`. There is no `path`.

### `SDK_SHUT_DOWN`

**Meaning.** The SDK has shut down, and it cannot be restarted.

**Common causes.**

- A call after `shutdown()` settled, including `flush()` and a second `shutdown()`. A `shutdown()`
  called while the first is still running shares the first one's result instead.
- A call after a shutdown that timed out or whose sink failed. Either still leaves the SDK shut down.

**Fix.** Create a new SDK if you need to send events again.

**Fields.** `category` is `lifecycle`. There is no `path`.

### `SDK_SCHEMA_VALIDATION_FAILED`

**Meaning.** The event breaks the contract's JSON schema in a way that no more specific code covers,
such as a value of the wrong type, outside its enumeration, of the wrong format, or an unexpected
property.

**Common causes.**

- A `producer.version` or `service.version` that is not a semantic version such as `1.0.0`. The SDK is
  created with any string there, so every event then fails, with path `/producer/version` or
  `/service/version`.
- An event built by hand and passed to `emit` or `redeliver`, with an unexpected property or a value
  of the wrong type.
- A value outside the contract's registry in a named call, from JavaScript or through a cast.

**Fix.** Compare the value at `path` with the contract's schema for that field. Named methods build
the event envelope for you, so prefer them to `emit`.

**Fields.** `category` is `validation`. `path` points at the failing value.

### `SDK_SEMANTIC_VALIDATION_FAILED`

**Meaning.** The event is well formed, but a classification value is not one that its catalog entry
allows.

**Common causes.** An `event.outcome`, `event.lifecycle_phase` or `event.commit_state` that the event
does not allow, such as `outcome: "success"` for `authorizationDenied`. TypeScript rejects most of
these, so they arise from JavaScript, through a cast, or in an event passed to `emit`.

**Fix.** Use one of the event's allowed values, which the core's `EVENT_CATALOG` lists as `outcomes`,
`phase` and `commit`, or leave the value out and let the SDK choose the default.

**Fields.** `category` is `validation`. `path` is `/event/outcome`, `/event/lifecycle_phase` or
`/event/commit_state`.

### `SDK_SINK_REJECTED`

**Meaning.** The sink refused the event. Unlike `SDK_SINK_FAILURE`, the outcome is known: the receiver
will not accept this event, so sending it again unchanged will not help.

**Common causes.**

- The HTTP sink got a 4xx status other than 408, 425 and 429, for example:
  - 400, for a body the receiver cannot read;
  - 401 or 403, for missing or wrong credentials in `headers`;
  - 404, for a wrong `path`;
  - 413, for a body over the receiver's size limit.
- Another sink's `emit` resolved with `status: "rejected"`.

**Fix.** Read the precise cause from the HTTP sink's `onOutcome` callback. It reports `http_permanent`,
the HTTP `status`, and the event's `eventId`. Then correct the request, the sink's options, or the
receiver's configuration. The SDK never redelivers the event.

**Fields.** `category` is `sink`, `path` is `/sink`, and `eventName` names the event. The result has
no event identifier, but `onOutcome` has.

### `SDK_SINK_FAILURE`

**Meaning.** The event was not delivered, and its outcome is unknown: the receiver may or may not hold
the event. Unlike `SDK_SINK_REJECTED`, nothing says the event itself is at fault, so a later attempt
may succeed.

**Common causes.** For the HTTP sink, `onOutcome` reports one of these causes:

- `http_retryable`: a 5xx status, or 408, 425 or 429;
- `timeout`: no response within `timeoutMs`;
- `transport_failure`: no exchange took place, for example because `origin` is wrong or the receiver
  is not running;
- `malformed_acknowledgment`: a 2xx response without the exact acknowledgment of this event;
- `unexpected_response`: another status, such as a redirect, which the sink never follows.

The code has causes that `onOutcome` does not report:

- A sink's `emit` resolved with `status: "unknown"`, threw, or returned a rejected promise.
- The HTTP sink had already shut down. It made no request, so `onOutcome` was not called.
- `flush()` or `shutdown()` failed because the sink's own `flush` or `shutdown` threw.

**Fix.** Read `onOutcome`'s `outcome` and `status` for the event, then act on the cause:

- check that the receiver is running and reachable at `origin`;
- raise `timeoutMs` if the receiver is slow;
- check that the receiver acknowledges each event exactly.

The SDK never redelivers, and the HTTP sink makes one delivery attempt per event, so whether to send
again is your decision. The receiver may already hold the event. A terminal success that failed here
does not count as delivered, so its operation handle can send it again.

**Fields.** `category` is `sink`. From sending an event, `path` is `/sink` and `eventName` names the
event. From `flush()` or `shutdown()`, there is no `path` and no `eventName`.

### `SDK_SHUTDOWN_TIMEOUT`

**Meaning.** `shutdown()` waited `shutdownTimeoutMs` for events still being sent, and they did not
finish. The SDK is shut down anyway.

**Common causes.**

- A sink whose `emit` never settles, or settles after the bound.
- A `shutdownTimeoutMs` shorter than the sink's own deadline, such as the HTTP sink's `timeoutMs`.

**Fix.** Set `shutdownTimeoutMs` above the sink's deadline. The default is 5,000 and the maximum is
60,000. The events that were still being sent have an unknown outcome. After a timeout, the SDK
does not call the sink's `flush` or `shutdown`.

**Fields.** `category` is `lifecycle`. There is no `path`.

### `SDK_INVALID_OPERATION_TRANSITION`

**Meaning.** An operation handle is not valid, or its state cannot change the way you asked.

**Common causes.**

- `operation` is not the exact handle that this SDK instance's `beginOperation()` returned. A snapshot,
  a spread or `structuredClone` copy, a JSON round trip, a hand-built object, and a handle from another
  SDK instance all fail. The path is `/operation`.
- A transition from the wrong state:
  - `markCommitted`, `markNotCommitted`, `markPartiallyCommitted` and `markCancelled` need a `started`
    operation;
  - `markCompensated` needs a `committed` one.

  Repeating the current state is allowed. The path is `/operation/state`.

**Fix.** Pass the handle object itself, to the SDK instance that issued it, and move it out of
`started` once.

**Fields.** `category` is `lifecycle`. `path` is `/operation` or `/operation/state`.

### `SDK_INVALID_IDENTIFIER`

**Meaning.** An identifier is malformed, or repeats one this SDK instance used recently.

**Common causes.**

- A custom `identifiers` provider whose `eventId` does not return a lowercase UUID of versions 1 to 5,
  or returns one it returned recently. The path is `/event/id`.
- `beginOperation({ operationId })` with an operation identifier that this SDK issued recently. The
  path is `/operation/operation_id`.
- A generated operation, transaction or correlation identifier that is empty, longer than 128
  characters, or not printable ASCII. The path names it under `/operation`.

**Fix.** Use the Node binding's default identifiers unless you need your own. A custom provider must
return a fresh UUID for each event. Do not reuse an operation identifier.

**Fields.** `category` is `validation`. `path` names the identifier.

### `SDK_INVALID_CLOCK`

**Meaning.** The configured clock did not return a valid `Date`.

**Common causes.** A custom `clock.now()` that returns a string, a number, or an invalid date such as
`new Date("")`.

**Fix.** Return a valid `Date` from `now()`, or use the default clock.

**Fields.** Named calls return it, since the SDK reads the clock only when it builds an event.
`category` is `configuration`, and `path` is `/clock`.

### `SDK_HOOK_FAILURE`

**Meaning.** A transformation hook failed, or produced a value that the SDK will not write into the
event.

**Common causes.**

- The hook threw.
- It returned a value that is not `undefined`, a string, or an object with a string `value`. A hook
  that returns `null` is the exception: that call fails with `SDK_INVALID_INPUT` and path `/`
  instead.
- It returned an empty value, or one longer than 512 characters.
- It returned a `key_id` that is not a string, or is longer than 80 characters. The path ends in
  `/key_id`.
- The field it transforms does not hold a string.

**Fix.** Handle every input inside the hook, catching errors there. Return a non-empty string of at
most 512 characters, or `undefined` to leave the field unchanged.

**Fields.** `category` is `privacy`. `path` points at the transformed field, such as `/actor/id`. The
hook's own error is never reported.

### `SDK_DUPLICATE_SUCCESS`

**Meaning.** This operation handle already delivered a terminal success for this event, or one is
being sent now.

**Common causes.** The same completed success sent twice with one handle, for example from a loop that
sends it again, from two code paths, or concurrently.

**Fix.** Send each terminal success once per operation. A success that the sink did not accept does not
count, so the handle can send it again. A deliberate re-attempt passes
`retry: { retry_attempt: 1, original_event_id }`, with the first attempt's event identifier.

**Fields.** `category` is `lifecycle`, and `path` is `/operation/state`. The sink was not called.

### `SDK_OPERATION_EVENT_MISMATCH`

**Meaning.** The operation handle belongs to a different event, or a redelivered event does not match
its handle.

**Common causes.**

- A handle begun with `boundEvent` set to one method, such as `"sensitiveResourceCreated"`, and passed
  to another. The path is `/operation/bound_event`.
- A named call with `redelivery: { event }`, where the event's operation, correlation or transaction
  identifier differs from the handle's. The path names that identifier under `/correlation`.

**Fix.** Bind a handle only to the method that completes its operation, and redeliver an event with the
handle that produced it.

**Fields.** `category` is `lifecycle`. `path` is `/operation/bound_event`, or an identifier under
`/correlation`.

### `SDK_UNSUPPORTED_HOOK_RESULT`

**Meaning.** A transformation hook returned a promise. Hooks must be synchronous.

**Common causes.** An `async` hook, or one that returns a promise, for example to fetch a key.

**Fix.** Make `transform` synchronous. Load keys and other material before you create the SDK.

**Fields.** `category` is `privacy`. `path` points at the transformed field.

## Contract codes

### `MISSING_REQUIRED_ACTOR`

**Meaning.** The event needs an actor that it does not have, or needs an actor of a particular type.

**Common causes.**

- No actor was supplied. The SDK reads an actor from the same three places as a tenant: see
  `MISSING_TENANT_CONTEXT`. TypeScript requires `actor` in the call itself for every event except
  `sessionCreated`, so `sessionCreated` is where a missing actor usually appears. The path is
  `/actor`.
- An administrator event, such as `roleAssigned`, `roleRemoved` or `impersonationStarted`, with an
  actor that is not an administrator, such as one from `authenticatedHumanActor`. The path is
  `/actor/type`.
- An event passed to `emit` whose actor is not anonymous, has no `id`, and is not marked
  `authoritative_server` in `provenance.trust_level`.

**Fix.** Pass an actor from an actor constructor. For an administrator event, use
`administratorActor`.

**Fields.** `category` is `validation`. `path` is `/actor` or `/actor/type`.

### `MISSING_TENANT_CONTEXT`

**Meaning.** The event has no usable tenant. Every event needs one: an event outside any tenant says
so with the `tenantless` or `platform` scope.

**Common causes.**

- No tenant was supplied in any of the three places the SDK reads it:
  1. per call: the named method's `tenant` input;
  2. context scope: `tenant` in the frame that `sdk.runWithContext(frame, callback)` sets for calls
     made inside the callback;
  3. configuration: `tenant` in the `authoritativeContext` that the SDK was created with.

  When more than one supplies a tenant, the per-call one wins, then the context scope's, then the
  configuration's.
- A call to an event whose TypeScript input does not require a tenant: `authenticationSucceeded`,
  `authenticationFailed`, `passwordResetRequested` or `impersonationEnded`. Leaving the tenant out of
  all three places compiles, and fails here. Every other event requires `tenant` in the call itself,
  and that per-call tenant overrides the other two.
- A call made outside the `runWithContext` callback that set the tenant.
- `tenantContextViolationDetected` without a claimed tenant from `claimedTenant(...)`. The path is
  `/tenant/claimed_tenant_id`.
- An event passed to `emit` whose tenant has a `tenant` or `cross_tenant` scope but lacks
  `effective_tenant_id` or `resource_tenant_id`. `authoritativeTenant` refuses that value, so only an
  event built by hand can have it.

**Fix.** Supply a tenant from `authoritativeTenant` in one of the three places. A request-scoped tenant
usually belongs in the context scope, and a single-tenant service's in the configuration. For an event
outside any tenant, pass `authoritativeTenant({ scope: "tenantless" })`, or the `platform` scope,
whichever the event allows. `authenticationSucceeded`, `authenticationFailed` and
`passwordResetRequested` allow `tenantless`, for a request that no tenant can be attributed to.

**Fields.** `category` is `validation`. `path` is `/tenant` or `/tenant/claimed_tenant_id`.

### `TENANT_RESOURCE_CONFLICT`

**Meaning.** The event's tenant values contradict each other, or break the event's tenant rule.

**Common causes.**

- A scope that the event does not allow. For example, `sensitiveResourceCreated`,
  `sensitiveResourceModified` and `sensitiveResourceDeleted` allow only the `tenant` scope. The path is
  `/tenant/scope`.
- A claimed tenant that differs from the effective tenant, under the `tenant` scope. Report that
  situation with `tenantContextViolationDetected` instead. The path is `/tenant/claimed_tenant_id`.
- An actor whose `tenant_id` differs from the tenant's `actor_tenant_id`. The path is
  `/actor/tenant_id`.
- A resource whose `owning_tenant_id` differs from the tenant's `resource_tenant_id`, or from its
  `effective_tenant_id` under the `tenant` scope. The path is `/resource/owning_tenant_id`.
- Authorization evidence whose `tenant_context.effective_tenant_id` differs from the tenant's. The path
  is `/authorization/tenant_context/effective_tenant_id`.
- A `cross_tenant` scope without an authorization decision. The path is `/authorization/decision`.

**Fix.** Make the value at `path` agree with the tenant. The contract's event catalog states each
event's tenant rule.

**Fields.** `category` is `validation`. `path` names the value that disagrees.

### `UNKNOWN_CATALOG_VALUE`

**Meaning.** A value is not in the contract's event catalog or registries.

**Common causes.**

- `beginOperation({ boundEvent })` with an event name, such as
  `"bloodtrail.audit.data.sensitive_resource.modified"`, where the method name belongs, such as
  `"sensitiveResourceModified"`. The path is `/operation/bound_event`.
- An event passed to `emit` whose `event.name` is not in the catalog, or whose `category`, `action` or
  `delivery_class` differs from its catalog entry. The path names the field under `/event`.
- A named call with `redelivery: { event }`, where the event is of another kind. The path is
  `/event/name`.
- An unregistered member or value in `client_evidence`. The path is under `/client_evidence`.

**Fix.** Use the named methods, which take these values from the catalog. For `boundEvent`, pass the
method's name.

**Fields.** `category` is `validation`. `path` names the value.

### `UNSUPPORTED_SCHEMA_VERSION`

**Meaning.** The event's `schema` is not the one that this SDK validates: its `version` or its
`name` is wrong. The code says version even when only the name is wrong.

**Common causes.**

- A wrong `schema.name`. When the name is a string of an allowed length, the path is still
  `/schema/version`, so it does not point at the name.
- An event built for another contract version, and passed to `emit`, `redeliver` or `redelivery`.

**Fix.** Check both fields, whatever the path says. They must equal the core's exported
`CONTRACT_SCHEMA_NAME` and `CONTRACT_VERSION`. Named methods set both.

**Fields.** `category` is `validation`. `path` is usually `/schema/version`, even for a wrong name. It
is `/schema/name` only for a name that the schema itself rejects: one that is empty, too long, or not
a string.

### `PROHIBITED_DATA`

**Meaning.** The input holds data that audit events must never carry, such as a credential, a secret
or a raw body.

**Common causes.**

- A property named after a prohibited item, such as `password`, `cookie`, `access_token`, `api_key`,
  `secret` or `request_body`. The core exports the full list as `PROHIBITED_DATA_KEYS`. A name that
  contains an item next to an underscore, hyphen or space counts too, such as `user_password` or
  `cookie-consent`.
- A string that looks like a secret: one containing the word "secret" in any case, a `Bearer` token,
  an `sk-` key, or a private-key marker. Any string field counts, including a request identifier.
- The same object at two places in one input. The SDK reads the second occurrence as a possible cycle.

**Fix.** Remove the value. Reference a credential by its identifier, through `credentialReference`,
never by its content. Rename a field whose name only resembles a prohibited item. For a string that
looks like a secret, find where the text comes from. Copy an object before you reuse it.

**Fields.** `category` is `privacy`. `path` points at the property or value. The value itself is never
reported.

### `FIELD_LIMIT_EXCEEDED`

**Meaning.** A value is well formed but bigger than the contract allows.

**Common causes.**

- A whole event over 65,536 bytes of JSON. The path is `/`.
- A string over 8,192 bytes, or over its field's own limit, such as an identifier's.
- An array of more than 32 items, or objects nested more than 8 levels deep.
- A number above its field's maximum, such as `retry_attempt`.
- An extension over its namespace's size limit, or a `client_evidence` member with a wrong type,
  length or format.

**Fix.** Shorten or summarize the value at `path`. For example, record a count instead of a list.

**Fields.** `category` is `validation`. `path` points at the value, or is `/` for the whole event.

### `AUTHORITY_ESCALATION`

**Meaning.** A value claims authority that it does not have. The SDK trusts a context value only when it
is the exact object that an authority constructor returned.

**Common causes.**

- A plain object where an authority constructor's value belongs, such as
  `tenant: { scope: "tenant", ... }` instead of `tenant: authoritativeTenant({ ... })`. TypeScript
  accepts the plain object, because the named methods' input types describe the event's fields, so the
  mistake shows only at runtime. The path names the field, such as `/tenant` or `/actor`.
- A copy of a constructor's value: a spread, `structuredClone`, or a JSON round trip. The authority
  belongs to the object that the constructor returned.
- An actor from `claimedActor` that is not anonymous. A client's claim cannot identify an actor. The
  path is `/actor/provenance/trust_level`.
- An anonymous actor together with an authenticated principal. The path is `/authenticated_principal`.

`request` and `correlation` take plain objects. Every other context field needs its constructor's
value.

**Fix.** Build each context value with its constructor, such as `authoritativeTenant`,
`authenticatedHumanActor` or `authorizationEvidence`, and pass the returned object unchanged. If the
value came from a second installed copy of the core, the code is `DUPLICATE_AUTHORITY` instead.

**Fields.** `category` is `authority`. `path` names the field.

- Named calls return it.
- `runWithContext` and `createAuditContextFrame` throw it.
- The same mistake in `authoritativeContext` throws `SDK_INVALID_CONFIGURATION` when the SDK is created,
  with the same path.

### `PREMATURE_SUCCESS`

**Meaning.** A transaction-bound event reports success before its operation committed. The
transaction-bound events are those whose `commit` values in `EVENT_CATALOG` include `committed`.

**Common causes.**

- **No `operation` handle was passed.** This is the most common cause, and the code's name hides it:
  the success is not early, the handle is missing. Of the transaction-bound events, only
  `sensitiveResourceCreated`, `sensitiveResourceModified` and `sensitiveResourceDeleted` require
  `operation` in their TypeScript input. The others, such as `roleAssigned`, `mfaEnrolled` and
  `securityConfigurationChanged`, compile without it. Their default outcome is `success`, so the call
  fails here. The path is `/operation/state`.
- A handle passed before its `markCommitted()` call. The path is `/operation/state`.
- `event.commit_state` set to a terminal state such as `committed`. Only a handle's transition can
  establish one. The path is `/event/commit_state`.
- An event passed to `emit` with outcome `success` and commit state `pending`, or without a commit
  state that its event allows. The path is `/event/commit_state`.

**Fix.**

1. Call `sdk.beginOperation()` before the business operation.
2. Call the handle's `markCommitted()` once the operation commits, or `markNotCommitted()` if it
   fails. After `markNotCommitted()`, the SDK reports a `failure` outcome.
3. Pass the handle as `operation`.

**Fields.** `category` is `validation`. `path` is `/operation/state` or `/event/commit_state`. The
sink was not called.

### `AUTHORIZATION_OUTCOME_CONFLICT`

**Meaning.** The event's outcome contradicts its authorization decision.

**Common causes.**

- Outcome `denied`, as for `authorizationDenied`, with authorization evidence whose `decision` is
  `allow`.
- Outcome `success` with a `decision` of `deny`.

Often, one evidence object was built once and reused on both branches of an access check.

**Fix.** Build the authorization evidence from the decision that was actually made, and choose the
event method from the same decision.

**Fields.** `category` is `validation`, and `path` is `/authorization/decision`.

### `BAD_CAUSALITY`

**Meaning.** The event's correlation values do not describe a possible chain of events.

**Common causes.**

- A successful `accountRegistrationCompleted` or `passwordResetCompleted` without `causation_id` and
  `original_event_id`. These completions must point at the event that started them. The path is
  `/correlation`.
- A re-execution, whose `retry_attempt` is above zero, without `original_event_id`. The path is
  `/correlation/original_event_id`.
- A `causation_id` or `original_event_id` equal to the event's own identifier. The path is
  `/correlation/causation_id`.
- An event passed to `emit` without the `correlation_id` and `operation_id` that its event requires.
  The path is `/correlation`.

**Fix.** For a completion, pass the starting event's identifier as
`correlation: { causation_id, original_event_id }`. A named call's result does not include the
identifier of the event it sent, but the HTTP sink's `onOutcome` reports it. For a re-execution, pass
`retry: { retry_attempt, original_event_id }`.

**Fields.** `category` is `validation`. `path` is `/correlation`, or a field under it.

### `INVALID_DELEGATION`

**Meaning.** The event involves delegation or impersonation, but it has no delegation, or its delegation
lacks `mode`, `principal_id` or `expires_at`.

**Common causes.**

- Authentication evidence with `delegated: true` or `impersonated: true`, and no delegation. TypeScript
  accepts this.
- `privilegeElevated` or `impersonationStarted` without a delegation. TypeScript requires the
  `delegation` property in the call itself for both, but it accepts `undefined` as its value, for
  example from a variable that holds a delegation for some requests only.
- An event passed to `emit` whose delegation lacks `mode`, `principal_id` or `expires_at`.
  `delegationContext` refuses such a value with `SDK_INVALID_CONFIGURATION`, so only an event built by
  hand can have it.

The SDK checks that `expires_at` is present, not that it is still in the future, so it accepts an
expired delegation.

**Fix.** Supply a delegation from `delegationContext` or `impersonationContext`. To supply an actor
together with its delegation, spread the result of `delegatedActorContext` or
`impersonatingActorContext` into the call. The SDK reads a delegation from the same three places as a
tenant: see `MISSING_TENANT_CONTEXT`.

**Fields.** `category` is `validation`, and `path` is `/delegation`. The path does not name the missing
member.

### `UNKNOWN_EXTENSION`

**Meaning.** The event's `extensions` holds a namespace that the contract does not register, or a value
that the registered namespace does not allow. The code says unknown even when the namespace is
registered and only a value inside it is wrong. The contract registers the namespace
`bloodtrail.audit.enrichment.v1`, and the core exports the registry as `EXTENSION_NAMESPACES`.

**Common causes.**

- An unregistered namespace, such as `com.example.enrichment.v1`. TypeScript rejects an object whose
  only namespace is unregistered, but it accepts a variable that holds the registered namespace as well.
  The path is `/extensions`, and it does not name the namespace.
- A value in `bloodtrail.audit.enrichment.v1` that the namespace's schema does not allow. The path
  points at the value, or at the object that lacks a member. For example:
  - a member that the namespace does not define;
  - a missing `provenance`, or a `provenance` without `trust_level`, `source` or `version`;
  - a `provenance.trust_level` other than `downstream_enrichment`;
  - a `provenance.version` that is not a semantic version such as `1.0.0`;
  - a `risk.level` outside the contract's risk levels, or `risk.reason_codes` with more than 16 codes
    or with a code outside the contract's reason codes.

Three problems inside an extension have their own codes instead:

- an array of more than 32 items, or a namespace over 4,096 bytes of JSON: `FIELD_LIMIT_EXCEEDED`;
- a plain object where `registeredEnrichmentExtension`'s value belongs: `AUTHORITY_ESCALATION`;
- prohibited data: `PROHIBITED_DATA`.

**Fix.** Build the extensions with `registeredEnrichmentExtension`, use only the registered namespace,
and compare the value at `path` with the namespace's schema. The namespace carries downstream
enrichment, so its `provenance.trust_level` is always `downstream_enrichment`.

**Fields.** `category` is `validation`. `path` is `/extensions`, or points into
`/extensions/bloodtrail.audit.enrichment.v1`.

### `DUPLICATE_AUTHORITY`

**Meaning.** A context value came from a second installed copy of the core package. Authority from one
copy is not valid in another. The contract's own validator also uses this code for an OpenTelemetry
mapping whose attributes repeat an authority field, such as `event.id` or `actor.id`. No SDK call
reports that meaning, because the SDK does not map events to OpenTelemetry.

**Common causes.** Two copies of `@bloodtrail/security-audit-sdk-core` resolve in your application.
The value was built with one copy's constructor and passed to an SDK from the other. This can happen
when your application depends on the core directly and the Node binding resolves a different copy.

**Fix.**

1. Run `npm ls @bloodtrail/security-audit-sdk-core` to find every copy.
2. Make exactly one copy resolve, by aligning the dependency or pinning it with `overrides`.
3. Build the values again with that copy's constructors.

**Fields.** `category` is `authority`, and `path` names the field. It surfaces in the same places as
`AUTHORITY_ESCALATION`. When it is thrown, its `message` states the fix.

## Derived-field provenance codes

These codes concern `risk`, which any event may carry. An event with `risk` must say where the risk
came from, in `risk.model.provenance`:

- `trust_level` is the trust that the risk claims. It must be `derived_server` or a less trusted level,
  and no more trusted than the least trusted input.
- `derived_from` lists the inputs: from 1 to 32 distinct strings in ascending code-point order, each of
  at most 256 characters. An input names a canonical field in dot notation, such as `event.name`, or a
  whole registered extension namespace, such as `extensions.bloodtrail.audit.enrichment.v1`.

The core exports the canonical fields, with each field's trust, as `FIELD_POLICY`, and the trust levels,
from most to least trusted, as `REGISTRIES.trust_levels`.

Pass `risk` from `riskContext`. The SDK reads it from the same three places as a tenant: see
`MISSING_TENANT_CONTEXT`. TypeScript cannot check most of these rules. The schema check catches a
malformed input, but the other rules run after the event's other validation, so these codes usually
appear only once the rest of the event is valid.

### `DERIVED_FROM_MALFORMED_INPUT`

**Meaning.** `derived_from` is not a list of inputs: it is not an array, or an input is not a
non-empty string of at most 256 characters.

**Common causes.**

- A single input given as a string, such as `derived_from: "event.name"`. TypeScript rejects this, so
  it arises from JavaScript or through a cast. The path is `/risk/model/provenance/derived_from`.
- An input that is empty, longer than 256 characters, or not a string. The path ends with the input's
  position, such as `/risk/model/provenance/derived_from/0`.

More than 32 inputs, or an input over 8,192 bytes, gives `FIELD_LIMIT_EXCEEDED` instead, because the
SDK's general limits on arrays and strings apply first.

**Fix.** Pass an array with one dot-notation string per input.

**Fields.** `category` is `validation`. `path` is `/risk/model/provenance/derived_from`, or points at
one of its inputs.

### `DERIVED_FROM_DUPLICATE_INPUT`

**Meaning.** An input appears more than once in `derived_from`.

**Common causes.** The same input listed twice, for example when the inputs are gathered from two
sources and joined. A list that repeats an input and is also out of order reports this code, not
`DERIVED_FROM_NONCANONICAL_ORDER`.

**Fix.** Remove the repeated inputs, for example by collecting them in a `Set`, then sort them.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`. It does not
say which input repeats.

### `DERIVED_FROM_NONCANONICAL_ORDER`

**Meaning.** `derived_from` is not in ascending code-point order.

**Common causes.** Inputs listed in the order that the risk model used them, such as
`["event.outcome", "event.name"]`, and never sorted.

**Fix.** Sort the inputs by code point. Canonical field names and namespace names contain only ASCII
characters, and for those JavaScript's default `sort()` gives code-point order.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`.

### `DERIVED_FROM_UNRESOLVABLE_INPUT`

**Meaning.** An input names neither a canonical field nor a registered extension namespace.

**Common causes.**

- A misspelled input, or one in another notation, such as the JSON Pointer `/event/name` or the
  camel-case `eventName`.
- An input that names no field in `FIELD_POLICY`, such as `event`, which names an object rather than a
  field.
- An input below an extension namespace, such as `extensions.bloodtrail.audit.enrichment.v1.risk.level`,
  or one that names an unregistered namespace. An extension input names the whole namespace.

**Fix.** Write each field input exactly as that field's `path` in `FIELD_POLICY`, and each extension
input as `extensions.` followed by the registered namespace.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`. It does not
say which input fails.

### `DERIVED_FROM_ABSENT_INPUT`

**Meaning.** An input names a real field or namespace, but this event does not carry it.

**Common causes.**

- A field that this event leaves out, such as `subject.display_name` on an event without a subject
  display name. A list of inputs shared by several events often names a field that one of them lacks.
- `extensions.bloodtrail.audit.enrichment.v1` on an event without that extension.

**Fix.** List only the inputs that this event carries, or add the missing field to the event.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`. It does not
say which input is absent.

### `DERIVED_FROM_EMPTY_INPUT`

**Meaning.** `derived_from` is an empty array.

**Common causes.** A list of inputs that was created but never filled, or a risk value that does not
depend on the event at all.

**Fix.** List at least one input. If the risk does not come from any of the event's fields, leave
`risk` out.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`.

### `DERIVED_FROM_NON_DERIVED`

**Meaning.** `trust_level` claims more trust than a derived value can have. The most that risk can
claim is `derived_server`.

**Common causes.** A `trust_level` of `authoritative_server`, `verified_assertion` or
`observed_transport`, for example because the server computed the risk, or because the level was copied
from the actor's provenance.

**Fix.** Set `trust_level` to `derived_server`, or to a less trusted level when an input is less
trusted. See `DERIVED_FROM_TRUST_FLOOR_EXCEEDED`.

**Fields.** `category` is `validation`. `path` is `/risk/model/provenance/derived_from`, although the
value at fault is `trust_level`.

### `DERIVED_FROM_CYCLE`

**Meaning.** An input names part of the risk itself: a field under `risk.`, such as `risk.level`, or
`risk.model.provenance.derived_from` itself.

**Common causes.** A risk field listed as an input to the risk, for example `risk.score` when the model
derives the level from the score.

**Fix.** List the event fields that the risk was computed from, not the risk's own fields.

**Fields.** `category` is `validation`, and `path` is `/risk/model/provenance/derived_from`.

### `DERIVED_FROM_MISSING`

**Meaning.** The event carries `risk`, but not its provenance: `trust_level` or `derived_from` is
missing.

**Common causes.**

- A `risk` without `model` or `model.provenance`, such as `riskContext({ level: "low" })`. The path is
  `/risk/model/provenance/trust_level`.
- A provenance without `trust_level`. The path is `/risk/model/provenance/trust_level`.
- A provenance without `derived_from`. The path is `/risk/model/provenance/derived_from`.

**Fix.** Supply both `trust_level` and `derived_from`, or leave `risk` out.

**Fields.** `category` is `validation`. `path` names the missing field. When both are missing, it names
`trust_level`.

### `DERIVED_FROM_TRUST_FLOOR_EXCEEDED`

**Meaning.** `trust_level` claims more trust than the least trusted input has. A value derived from a
client's claim, for example, cannot be more trusted than that claim.

**Common causes.**

- `derived_server` with an input that the client supplies, such as `request.user_agent` or
  `subject.display_name`, whose trust is `client_claim`.
- `derived_server` with an extension namespace as an input. Its trust is `downstream_enrichment`.

**Fix.** Lower `trust_level` to the least trusted input's level, such as `client_claim`, or remove that
input if the risk does not depend on it. `FIELD_POLICY` gives each field's trust, and
`EXTENSION_NAMESPACES` gives each namespace's.

**Fields.** `category` is `validation`. `path` ends with the position of the first input with the
lowest trust, such as `/risk/model/provenance/derived_from/1`.

## Contract codes for rules outside the SDK

The contract defines these codes for rules that apply outside the SDK: mapping an event to CloudEvents,
OpenTelemetry or OCSF, a consumer's supported versions, and the delivery of `policy_critical` events.
No SDK call returns them. Each entry says what the code means in the contract, and what to check if
another component reports it.

### `ENVELOPE_PAYLOAD_CONFLICT`

**Meaning.** A CloudEvents envelope disagrees with the canonical event that it carries; CloudEvents
envelopes are planned, so only a consumer builds one today. The event in `data` is authoritative, and
the envelope may only repeat it.

**Common causes.** In the contract's rules, an envelope conflicts when it has no `data`, or when one of
these attributes differs from the event:

- `id` from `event.id`, for example an identifier generated anew for each delivery;
- `type` from `event.name`;
- `time` from `event.timestamp`, for example the time of sending;
- `dataschema` from the contract's schema identifier.

**Fix.** Derive the envelope from the event: copy `id`, `type` and `time` from `event.id`, `event.name`
and `event.timestamp`, set `dataschema` to the core's exported `CONTRACT_SCHEMA_ID`, and put the event
unchanged in `data`.

**Fields.** No call returns it, so it has no fields to read.

### `UNSUPPORTED_MAPPING_VERSION`

**Meaning.** A mapping targets a version of an external standard other than the one that the contract
pins: CloudEvents 1.0.2, OpenTelemetry 1.59.0 with Semantic Conventions 1.43.0, and OCSF 1.8.0.

**Common causes.**

- A mapping written for a newer release of the standard.
- A CloudEvents `specversion` of `1.0.2`. The attribute names only the major and minor version, `1.0`.

**Fix.** Map to the pinned version. The contract supports no other.

**Fields.** No call returns it, so it has no fields to read.

### `PROHIBITED_BODY_ATTRIBUTES`

**Meaning.** An OpenTelemetry log record that carries an event holds prohibited data in its body or
attributes, or has a body over the contract's size limit.

**Common causes.**

- A body or attribute that holds a credential or a secret, such as a raw token.
- A body over 4,096 characters of JSON, for example a whole request copied into it.

**Fix.** Put only the canonical event in the body, and nothing that the event itself may not carry.

**Fields.** No call returns it, so it has no fields to read.

### `MISSING_NATIVE_MAPPING`

**Meaning.** An OpenTelemetry log record lacks a native field that the contract maps an event value to.
The native fields are the timestamp, the observed timestamp, the event name, the trace and span
identifiers, the resource and the instrumentation scope.

**Common causes.** A record without one of these fields, for example with the event's timestamp in
its attributes instead.

**Fix.** Fill each native field from the event, and keep the attributes for values without a native
field.

**Fields.** No call returns it, so it has no fields to read.

### `MAPPING_SCOPE_OVERCLAIM`

**Meaning.** An OCSF mapping claims more than the contract allows. The contract allows a claim of OCSF
compatibility only for version 1.8.0, for tested catalog events and selected classes and profiles, and
with Bloodtrail's extension losses stated.

**Common causes.**

- A mapping status other than `exact`, `transformed`, `extended`, `unmapped` or `lossy`.
- A claim of full OCSF compatibility.

**Fix.** Give each event's mapping one of the five statuses, and claim compatibility for each mapped
event only.

**Fields.** No call returns it, so it has no fields to read.

### `UNAPPROVED_POLICY_CRITICAL_POSTURE`

**Meaning.** A `policy_critical` event is delivered without a failure posture that its policy owner
approved: whether a delivery failure lets the business operation continue, stops it, or defers its
completion. The `policy_critical` events are those whose `delivery` in `EVENT_CATALOG` is
`policy_critical`: the events of `privilegeElevated`, `impersonationStarted`, `impersonationEnded` and
`sensitiveDataExported`.

**Common causes.** The contract uses this code in its delivery scenarios, for a `policy_critical` event
with no approved posture. The SDK sends these events like any other and checks no posture. The
contract blocks their production use until a reviewed policy exists.

**Fix.** Nothing in a call changes it. Before these events are relied on outside evaluation, their
policy owner must approve how a delivery failure affects the business operation.

**Fields.** No call returns it, so it has no fields to read.

### `UNSUPPORTED_COMPATIBILITY_VERSION`

**Meaning.** An event's schema version is one that its consumer does not support. The contract's
compatibility policy has the producer reject such an event, and the consumer reject or quarantine it.

**Common causes.** A consumer that receives events of a newer contract version than it supports. In the
SDK, the same mismatch reports `UNSUPPORTED_SCHEMA_VERSION` for an event passed to `emit`, and
`SDK_UNSUPPORTED_CONTRACT_VERSION` for the configuration.

**Fix.** Produce and consume the same contract version, or upgrade the consumer. For the version that
the SDK supports, see `SDK_UNSUPPORTED_CONTRACT_VERSION`.

**Fields.** No call returns it, so it has no fields to read.
