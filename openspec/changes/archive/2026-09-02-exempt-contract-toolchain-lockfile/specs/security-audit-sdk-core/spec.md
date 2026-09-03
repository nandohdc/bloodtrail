## ADDED Requirements

### Requirement: Changed-path verification exempts declared contract build-toolchain files

Changed-path verification SHALL treat a protected contract prefix as covering every path
beneath it except those named in a declared build-toolchain exemption list. An exempted
path SHALL remain classified and reported under the event-contract classification, and
SHALL NOT be counted as a violation.

An exemption entry SHALL be an exact repository-relative file path. An entry that names a
directory, contains glob characters, contains path traversal, contains a NUL byte, uses
backslashes, or is absolute SHALL be rejected.

An exemption entry SHALL lie inside a protected contract prefix, and SHALL NOT name a path
declared by the contract provenance manifest, whether as a declared path or beneath a
declared directory. Verification SHALL reject the configuration rather than skip the entry.

The canonical event contract SHALL remain immutable independently of this list: contract
immutability verification SHALL continue to bind every path the provenance manifest
declares, and SHALL NOT consult the exemption list.

#### Scenario: An exempted toolchain file may change

- **WHEN** changed-path verification runs against a repository in which a declared
  build-toolchain exemption file inside a protected contract prefix has been modified
- **THEN** the file is reported under the event-contract classification and changed-path
  verification passes

#### Scenario: A non-exempted contract path still fails

- **WHEN** changed-path verification runs against a repository in which a path inside a
  protected contract prefix that is not on the exemption list has been modified
- **THEN** changed-path verification fails and identifies that path

#### Scenario: An exemption cannot name declared contract content

- **WHEN** an exemption entry names a path the contract provenance manifest declares, or a
  path beneath a declared directory
- **THEN** verification fails and reports that the entry is declared contract content

#### Scenario: An exemption cannot be a directory or a pattern

- **WHEN** an exemption entry names a directory, contains glob characters, contains path
  traversal, or is an absolute path
- **THEN** verification fails and identifies the malformed entry

#### Scenario: An exemption cannot reach outside a protected prefix

- **WHEN** an exemption entry names a path that lies outside every protected contract prefix
- **THEN** verification fails and reports that the entry is outside every protected prefix
