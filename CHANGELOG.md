# Changelog

## 0.1.0 (2026-08-07)


### Added

* add openspec skills for proposing, syncing, updating, and verifying changes ([a7dfa8b](https://github.com/nandohdc/bloodtrail/commit/a7dfa8b4a1207ca58e2818b6ff303b371c6afa61))
* **release:** add Release Please setup and amend the exact-commit review gate ([52987bd](https://github.com/nandohdc/bloodtrail/commit/52987bd24035367e2e4694a40068fae15ddff297))
* **release:** add Release Please, changelog, and release runbook ([b155a1e](https://github.com/nandohdc/bloodtrail/commit/b155a1e1c1170e729cd8a95a60ec1ef8a3d93dbf)), closes [#20](https://github.com/nandohdc/bloodtrail/issues/20)


### Fixed

* **release:** bootstrap the changelog and pin the initial version ([c4786de](https://github.com/nandohdc/bloodtrail/commit/c4786de17b9fb82ee371fc7bc625774791d9f31b))
* **release:** bootstrap the changelog and pin the initial version ([ad98ebc](https://github.com/nandohdc/bloodtrail/commit/ad98ebcca7091ed17d8d58b0dd95aab094fbe136)), closes [#20](https://github.com/nandohdc/bloodtrail/issues/20)


### Documentation

* **openspec:** make the exact-commit review gate satisfiable ([4ed0830](https://github.com/nandohdc/bloodtrail/commit/4ed083002c0d28f5f4b3769394e8890308b949c0)), closes [#20](https://github.com/nandohdc/bloodtrail/issues/20)
* **sdk:** document F-08 bounded identity-retention migration ([23ecf6d](https://github.com/nandohdc/bloodtrail/commit/23ecf6d4b463c2fa3845e1c257296691e3c6e3dd))
* **sdk:** document F-08 bounded identity-retention migration ([689fc39](https://github.com/nandohdc/bloodtrail/commit/689fc394e36642b814df6672b3b514ba95c27944)), closes [#28](https://github.com/nandohdc/bloodtrail/issues/28)

## Changelog

All notable changes to Bloodtrail are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). During the `0.x` series, breaking
changes ride a **minor** bump and appear under a `Breaking` sub-heading.

This file is maintained by Release Please from Conventional Commit subjects. Edit it by hand only
in the manual-fallback case described in [`RELEASING.md`](RELEASING.md).

A `vX.Y.Z` tag here versions the **repository as a milestone**. It is not a package release: every
workspace stays private and unpublished, and the SDK package version is governed separately. See
[`RELEASING.md`](RELEASING.md).

Release Please inserts each released version directly below this preamble, newest first. There is
no `Unreleased` section: unreleased work lives in the Conventional Commit history until a Release PR
collects it.

The changelog starts at `f368cb49416b2fc9bc25311871e42a7c01469a99`, the point at which release
management was introduced (`bootstrap-sha`). Earlier history is in Git and in the OpenSpec archives.
