## ADDED Requirements

### Requirement: The authoritativeTenant input type encodes the tenant-scope rule

The input type of the `authoritativeTenant` constructor SHALL be a union that encodes the constructor's existing runtime rule:

- When the scope is `tenant` or `cross_tenant`, the type SHALL require both the effective and the resource tenant identifiers.
- The `platform` and `tenantless` scopes SHALL keep their existing optional fields.

The following SHALL be unchanged:

- the constructor's runtime validation;
- the errors it throws, and their codes and paths;
- the branded value it returns;
- every exported type name.

`tenant` SHALL remain optional in the named-method input types, because it may come from a context scope or from the SDK configuration.

#### Scenario: A call that satisfies the rule compiles
- **WHEN** `authoritativeTenant` is called with scope `tenant` or `cross_tenant` and both the effective and the resource tenant identifiers, or with scope `platform` or `tenantless`
- **THEN** strict type-checking passes and the constructor returns the same branded value it returned before this change

#### Scenario: A call that violates the rule does not compile
- **WHEN** `authoritativeTenant` is called with scope `tenant` or `cross_tenant` and either identifier is missing
- **THEN** strict type-checking fails, and the same input, forced past the type checker, still throws exactly as before

#### Scenario: Named-method tenant input stays optional
- **WHEN** a named event method is called without `tenant` while a context scope or the configuration supplies the authoritative tenant
- **THEN** the call type-checks and the event carries the supplied tenant, exactly as before this change
