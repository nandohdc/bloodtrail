## ADDED Requirements

### Requirement: Scope verification classifies every platform coupling against a declared policy

Scope verification SHALL inspect every code artifact under the SDK source root, including generated
artifacts and artifacts in CommonJS module format, and SHALL classify every module specifier the
artifact references and every identifier the artifact references without binding it in the artifact's
own lexical scope.

Classification SHALL be keyed to the artifact's role, distinguishing authored source from generated
source, and SHALL admit only what a declared coupling policy names for that role: the language
globals available to every role, the host globals declared for that role with the reason each is
admitted, and the module specifiers declared for that role. Identifiers referenced only in type
position SHALL NOT be classified as coupling.

Verification SHALL fail when it can assign a reference to no declared boundary, SHALL fail when a
source artifact cannot be read, SHALL fail when the parser cannot return a syntax tree, and SHALL
fail when it inspects no artifact. Verification SHALL NOT fail on an identifier that the artifact
binds in its own lexical scope.

Diagnostics for coupling SHALL name the artifact, the identifier or specifier, and the violated
class; SHALL be bounded in count and length; SHALL NOT include artifact source content; and SHALL
remain distinguishable from the production-integration diagnostics this verification already emits.

On the passing path, verification SHALL report the declared coupling inventory it classified, per
role.

The coupling policy bounds which host capabilities the sources use and not where they are used, and
it does not classify member access on host objects. Neither limit is a claim about runtime
portability.

#### Scenario: Declared coupling set passes and is reported
- **WHEN** scope verification runs against the SDK source root as it stands
- **THEN** verification passes and reports, per role, the artifacts inspected, the references
  classified, and the host couplings exercised

#### Scenario: Undeclared host global in authored source is rejected
- **WHEN** an authored source artifact references a host global the policy does not declare for the
  authored role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared host global in generated source is rejected
- **WHEN** a generated source artifact references a host global the policy declares for another role
  but not for the generated role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared module specifier in generated source is rejected
- **WHEN** a generated source artifact references a module specifier the policy does not declare for
  the generated role
- **THEN** verification fails and the diagnostic names that artifact and that specifier

#### Scenario: Locally bound identifier is not coupling
- **WHEN** a source artifact binds an identifier in its own lexical scope whose name matches a host
  global the policy does not declare
- **THEN** verification does not report that identifier as coupling

#### Scenario: Type-position reference is not coupling
- **WHEN** a source artifact references a name only in type position
- **THEN** verification does not report that name as coupling

#### Scenario: Unreadable or unparseable artifact fails closed
- **WHEN** a source artifact cannot be read, or the parser cannot return a syntax tree for it
- **THEN** verification fails rather than skipping that artifact

#### Scenario: Empty inspection set fails closed
- **WHEN** scope verification finds no code artifact under the SDK source root
- **THEN** verification fails rather than reporting a pass

#### Scenario: Production-integration diagnostics remain distinguishable
- **WHEN** a forbidden production-integration filename is added to the SDK source root
- **THEN** verification fails with the existing production-integration diagnostic and emits no
  coupling diagnostic for it
