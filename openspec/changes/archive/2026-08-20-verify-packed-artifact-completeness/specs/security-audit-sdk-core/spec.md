## ADDED Requirements

### Requirement: Package verification proves the packed artifact is complete and fails on an incomplete one

Package verification SHALL pack the package, apply its file allowlist to that same pack output,
install that exact tarball into a disposable consumer with production-only dependency installation,
and import every entry point declared in the package export map by package specifier before
reporting a pass.

Verification SHALL establish that each imported entry point resolves from the disposable consumer's
own installed dependency tree, and SHALL fail when an entry point resolves from anywhere else.

Verification SHALL fail when the packed inventory omits a module the entry points load, and SHALL
fail when a packed artifact references an identifier the packed artifact does not define.
Diagnostics SHALL name the entry point and the unresolved module or identifier, SHALL be bounded in
count and length, and SHALL NOT include artifact source content.

The packed tarball and the disposable consumer SHALL be created outside the package root and SHALL
be removed when verification ends, on both the passing and the failing path.

Verification controls for this behaviour SHALL include a deterministic failing mutation for each
failure class named above, applied to a package copy rather than to the working tree, and SHALL
include an unmutated control that passes in the same harness.

#### Scenario: Approved tarball installs, resolves, and validates
- **WHEN** package verification runs against the built package
- **THEN** the allowlist passes, every declared entry point imports from the disposable consumer's
  own dependency tree, a canonical event validates, and the reported inventory is the same pack
  output the allowlist inspected

#### Scenario: Packed inventory omitting a loaded module is rejected
- **WHEN** the packed inventory excludes a module that a declared entry point loads, while every
  individually required path remains present
- **THEN** verification fails and the diagnostic names the entry point and the unresolved module

#### Scenario: Packed artifact missing a bundled runtime helper is rejected
- **WHEN** a packed artifact references an identifier that the packed artifact does not define
- **THEN** verification fails and the diagnostic names the failing entry point

#### Scenario: Entry point resolved outside the disposable consumer is rejected
- **WHEN** a declared entry point resolves from a dependency tree other than the disposable
  consumer's own
- **THEN** verification fails rather than reporting a pass

#### Scenario: Temporary artifacts are discarded on both paths
- **WHEN** package verification ends, whether it passed or failed
- **THEN** the packed tarball and the disposable consumer are removed, and neither was created
  inside the package root
