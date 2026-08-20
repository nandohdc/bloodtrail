## ADDED Requirements

### Requirement: Dependency verification inspects module imports in shipped artifacts

Dependency verification SHALL inspect every shipped JavaScript and TypeScript artifact and SHALL classify every module specifier the artifact references, in ESM import and export positions and in CommonJS `require()` position.

A specifier SHALL be permitted only when it is relative to the artifact, an approved Node built-in for that artifact's role, a declared runtime dependency of the package, or a self-reference whose subpath is a declared package export. Every other specifier SHALL fail verification, including a specifier that is not a literal string and a Node built-in referenced without its `node:` prefix.

Verification SHALL fail when it inspects no shipped artifact, SHALL fail when a shipped artifact cannot be read, and SHALL fail when the parser cannot return a syntax tree. A returned syntax tree is error-tolerant and does not establish syntax validity; syntax validation remains the responsibility of the build, typecheck, and runtime gates.

Diagnostics SHALL name the artifact path, the module specifier, and the violated class, SHALL be bounded in count and length, and SHALL NOT include artifact source content.

#### Scenario: Approved shipped output passes
- **WHEN** dependency verification inspects the built package whose shipped artifacts reference only approved Node built-ins, declared package exports, and relative modules
- **THEN** verification passes and reports the number of artifacts and specifiers inspected

#### Scenario: Undeclared external module is rejected
- **WHEN** a shipped artifact requires `ajv/dist/runtime/ucs2length` while the package declares no runtime dependencies
- **THEN** verification fails and the diagnostic names that artifact and that module

#### Scenario: Declared runtime dependency is accepted
- **WHEN** a shipped artifact imports a module whose package is declared in the package manifest's runtime dependencies
- **THEN** verification accepts that specifier as a declared dependency

#### Scenario: Bundled module contributes no specifier
- **WHEN** a shipped artifact embeds third-party code instead of importing it
- **THEN** the artifact contributes no external specifier and verification passes

#### Scenario: Unprefixed or unapproved built-in is rejected
- **WHEN** a shipped artifact references a Node built-in without the `node:` prefix, or references a built-in that is not approved for that artifact's role
- **THEN** verification fails and names the artifact and the module

#### Scenario: Dynamic specifier is rejected
- **WHEN** a shipped artifact calls `import()` or `require()` with an argument that is not a literal string
- **THEN** verification fails and reports the artifact and the unclassifiable import form

#### Scenario: Empty inspection set fails closed
- **WHEN** dependency verification finds no shipped JavaScript or TypeScript artifact to inspect
- **THEN** verification fails rather than reporting a pass
