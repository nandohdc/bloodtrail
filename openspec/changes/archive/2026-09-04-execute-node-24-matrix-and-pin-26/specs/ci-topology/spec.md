## MODIFIED Requirements

### Requirement: The Node matrix belongs to the package

The Node version matrix SHALL be per package, not repository-wide. The SDK SHALL run its matrix on `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`), and the contract and research workspaces SHALL run on Node `>=26.5.0`, matching their declared `engines` ranges (`>=24 <25 || >=26 <27` for the SDK; `>=26.5.0` for contract and research). CI workflows SHALL pin exact declared Node versions rather than floating major tags, preventing unverified upstream runtime drift. A repository-wide matrix SHALL NOT be the ratified shape: it would either run the contract outside its declared `>=26.5.0` range or drop Node 24 from the SDK.

#### Scenario: SDK legs run both declared Node versions
- **WHEN** the SDK matrix legs execute
- **THEN** they run on exactly `24.2.0` and `26.5.0`, both inside the declared `>=24 <25 || >=26 <27` range

#### Scenario: Contract and research legs run inside their declared range
- **WHEN** the contract and research matrix legs execute
- **THEN** each runs on a Node version satisfying `>=26.5.0`

#### Scenario: A repository-wide matrix is rejected
- **WHEN** a candidate topology proposes one Node matrix for the whole repository
- **THEN** that candidate is not the ratified topology, because it must run the contract below `>=26.5.0` or drop the SDK's Node 24 matrix

#### Scenario: CI workflow pins exact declared Node versions
- **WHEN** CI workflow jobs execute for Node-dependent packages
- **THEN** they request exact pinned versions (`26.5.0` and `24.2.0`) matching `compatibility.json` rather than floating major tags
