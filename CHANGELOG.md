# Changelog

All notable changes to Bloodtrail are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). During the `0.x` series, breaking
changes ride a **minor** bump and appear under a `Breaking` sub-heading.

This file is maintained by Release Please from Conventional Commit subjects. Edit it by hand only
in the manual-fallback case described in [`RELEASING.md`](RELEASING.md).

A `vX.Y.Z` tag here versions the **repository as a milestone**. It is not a package release: every
workspace stays private and unpublished, and the SDK package version is governed separately. See
[`RELEASING.md`](RELEASING.md).

## 1.0.0 (2026-08-07)


### Added

* add openspec skills for proposing, syncing, updating, and verifying changes ([a7dfa8b](https://github.com/nandohdc/bloodtrail/commit/a7dfa8b4a1207ca58e2818b6ff303b371c6afa61))
* **ci:** add Codecov Test Analytics via JUnit XML upload ([72a72f2](https://github.com/nandohdc/bloodtrail/commit/72a72f291c2c49369108cab32c0de776a39451a1))
* **ci:** add Codecov Test Analytics via JUnit XML upload ([ddfb9e2](https://github.com/nandohdc/bloodtrail/commit/ddfb9e2422683e4d2f0720988775fd1e889a346f))
* **ci:** adopt gh-pipelines reusable CI with SonarQube quality gate ([7428fb3](https://github.com/nandohdc/bloodtrail/commit/7428fb391f2aaaf25ba8140375ec388626052992))
* **ci:** adopt gh-pipelines reusable CI with SonarQube quality gate ([80fe324](https://github.com/nandohdc/bloodtrail/commit/80fe324be9999c83464e76417013c8728e15bccc)), closes [#2](https://github.com/nandohdc/bloodtrail/issues/2)
* **ci:** restore sonar-project.properties for SonarQube integration ([d31a60b](https://github.com/nandohdc/bloodtrail/commit/d31a60b710a7be5185fe79cebe208a3b62c594c6))
* **contract:** define security audit event model ([b0e41af](https://github.com/nandohdc/bloodtrail/commit/b0e41affc83b79db0e599a1e3be168c3e9876b79))
* **contract:** define security audit event model ([8c5992b](https://github.com/nandohdc/bloodtrail/commit/8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993))
* **docs:** add comprehensive guidelines for SonarQube MCP usage and repository structure ([9224b5f](https://github.com/nandohdc/bloodtrail/commit/9224b5f117b49663967fd2429867b296395ad144))
* **release:** add Release Please setup and amend the exact-commit review gate ([52987bd](https://github.com/nandohdc/bloodtrail/commit/52987bd24035367e2e4694a40068fae15ddff297))
* **release:** add Release Please, changelog, and release runbook ([b155a1e](https://github.com/nandohdc/bloodtrail/commit/b155a1e1c1170e729cd8a95a60ec1ef8a3d93dbf)), closes [#20](https://github.com/nandohdc/bloodtrail/issues/20)
* **sdk:** implement authoritative event builders and validation ([529de90](https://github.com/nandohdc/bloodtrail/commit/529de906255d65a4d43b9e7a6976b8c9bf46f5d4))
* **sdk:** implement security audit SDK core ([86bf25d](https://github.com/nandohdc/bloodtrail/commit/86bf25d459d909d4fbdd151fb23c3c159ba1f365))
* **sdk:** scaffold audit SDK and generate contract types ([2703b6a](https://github.com/nandohdc/bloodtrail/commit/2703b6a65bd2b83bef1d3b90c6083f2f8a38e4e3))


### Fixed

* **ci:** add job-level permissions and pin to v1.6.2 tag ([d42666d](https://github.com/nandohdc/bloodtrail/commit/d42666db8292afee29897925df855fcd9d219317)), closes [#2](https://github.com/nandohdc/bloodtrail/issues/2)
* **ci:** align Sonar bundle contract and project config ([b32b5c8](https://github.com/nandohdc/bloodtrail/commit/b32b5c8c48872342ea05ff9d70a0404407c1253b))
* **ci:** match risk-analyzer direct Sonar workflow ([e3486d2](https://github.com/nandohdc/bloodtrail/commit/e3486d2cb7dca3c0a62340799c1ad10d6f3e5fc2))
* **ci:** remove sonar URL inputs not accepted by v1.6.2 ([da16cd1](https://github.com/nandohdc/bloodtrail/commit/da16cd16d042e1e8f00d58a1bcb4ffe48d84a8cd)), closes [#2](https://github.com/nandohdc/bloodtrail/issues/2)
* **ci:** resolve startup_failure by aligning with v1.6.2 contract ([4a873a2](https://github.com/nandohdc/bloodtrail/commit/4a873a246f0ca5ad809fd8e58786766607df3d6f))
* **ci:** upload research coverage and test results to Codecov ([ac2c30e](https://github.com/nandohdc/bloodtrail/commit/ac2c30ef583667a091ac3789e0ea1226ec8b6892))
* isolate the reviewed-paths verification suite, and put the SDK under CI ([838a13d](https://github.com/nandohdc/bloodtrail/commit/838a13d966a3878fa80c9cba31f806ade32d741b))
* **openspec:** reconcile F-08 retention semantics ([2f5787b](https://github.com/nandohdc/bloodtrail/commit/2f5787bb6120aa72d2cbd063fd963c5e23435e88))
* **openspec:** reconcile F-08 retention semantics ([66bf3b7](https://github.com/nandohdc/bloodtrail/commit/66bf3b721e604e715dbaae2a98888ddc1e6ff7fe))
* **sdk:** bound retained audit state ([0df6668](https://github.com/nandohdc/bloodtrail/commit/0df66687f93cfd85963bd00706d5d014d7bc6adf))
* **sdk:** distinguish redelivery from re-execution ([4bc39d7](https://github.com/nandohdc/bloodtrail/commit/4bc39d7ec7168b08ae1ad0d2ba879dcbac810bae))
* **sdk:** make terminal completion atomic ([e5137c6](https://github.com/nandohdc/bloodtrail/commit/e5137c6782fd5d936a5c173e8a4bc4e9b82d2393))
* **sdk:** normalize hostile input failures ([fcad895](https://github.com/nandohdc/bloodtrail/commit/fcad895f6d984ec3d9c55cc71dc95b8f98219131))
* **sdk:** preserve caller-owned collaborators ([a20e812](https://github.com/nandohdc/bloodtrail/commit/a20e812aeff2ecb9d73b1e78f476ab08ebadde14))
* **sdk:** release shutdown timeout resources ([d9f07b8](https://github.com/nandohdc/bloodtrail/commit/d9f07b88aa5f62e2b400dbf383971b5482ea7c52))
* **sdk:** require issued operation evidence ([0e0aec2](https://github.com/nandohdc/bloodtrail/commit/0e0aec21ec840443f66487ea61b92c6bcffb623f))
* **sdk:** validate hook paths at construction ([9349ecd](https://github.com/nandohdc/bloodtrail/commit/9349ecdcd5e6e030abb7b81544f30ef6d1508c72))
* **security-audit-sdk-core:** remediate adversarial review findings ([131a19b](https://github.com/nandohdc/bloodtrail/commit/131a19bf461c31e8304e941a0d6e188300aa0409))
* **verification:** allow reviewed new SDK sources ([8f7856e](https://github.com/nandohdc/bloodtrail/commit/8f7856ed4b40e1bd5f20366f2db9ba5e699c612a))
* **verification:** allow sequential remediation task progress ([b5e9daa](https://github.com/nandohdc/bloodtrail/commit/b5e9daac5543d602aef356c233710497c9d9de0a))
* **verification:** close SDK guardrail gaps ([e7bf031](https://github.com/nandohdc/bloodtrail/commit/e7bf0315c59d16e158128a443e3048a9d093a507))
* **verification:** detect an actual NUL byte in reviewed source paths ([685957d](https://github.com/nandohdc/bloodtrail/commit/685957d62e338e5accb9a25df1135950d0aadc4d))
* **verification:** harden archive lifecycle checks ([452a443](https://github.com/nandohdc/bloodtrail/commit/452a443cba81f485c81726815acbc3b21cf1d867))
* **verification:** harden archive lifecycle checks ([c2b1057](https://github.com/nandohdc/bloodtrail/commit/c2b10575085ead832d33c728e58288961509587c))
* **verification:** isolate owner binding fixture ([278c672](https://github.com/nandohdc/bloodtrail/commit/278c6721ea4eb2214062a33e289d54605bf9333b))
* **verification:** isolate reviewed-paths suite onto a disposable clone ([f0fbbd9](https://github.com/nandohdc/bloodtrail/commit/f0fbbd98a8d6d43c5b4b4ff55a9cfd2b748fceb2))
* **verification:** make task mutations state-independent ([e2f8a97](https://github.com/nandohdc/bloodtrail/commit/e2f8a97133be0620088d8365ec1cc1f0cabe8285))
* **verification:** model owner governance states ([9fc0d3e](https://github.com/nandohdc/bloodtrail/commit/9fc0d3ea63c8c54ba31c1d7e97367ff0052fdb89))
* **verification:** support governed and archived SDK lifecycle ([ab54f8c](https://github.com/nandohdc/bloodtrail/commit/ab54f8c56c19f7243f1407018ba2c3cd7eed4952))


### Documentation

* add .hermes.md repository guidance ([7555681](https://github.com/nandohdc/bloodtrail/commit/7555681d89b026d3bc4b897f8c57f2a6b1b9a07c))
* add .hermes.md repository guidance ([d265b79](https://github.com/nandohdc/bloodtrail/commit/d265b796204b08d74a505eb686170ebc7546bb8c))
* **governance:** adopt project-owner review model ([b6bb577](https://github.com/nandohdc/bloodtrail/commit/b6bb577b1fda865610ef93ec8ef31527046c3c44))
* **governance:** approve security audit event contract ([59d0db4](https://github.com/nandohdc/bloodtrail/commit/59d0db450c481da703d651e5cb3b4d841df43a8c))
* **governance:** approve security audit SDK core ([1f35896](https://github.com/nandohdc/bloodtrail/commit/1f35896d6a51e759806ad5da0f0c56e17c7e065a))
* **governance:** reconcile completed review status ([dab658a](https://github.com/nandohdc/bloodtrail/commit/dab658ae598fadfbc21f21139e7c30e2836d9b95))
* **governance:** record archive-verifier owner decision ([11cb2c7](https://github.com/nandohdc/bloodtrail/commit/11cb2c7b889bb2af68d35cad17d34a7da08b71b3))
* **governance:** record archive-verifier technical review ([eefec5d](https://github.com/nandohdc/bloodtrail/commit/eefec5d5b239044c6403bcee87161a7c9eba1fdb))
* **governance:** record final browser telemetry decision ([f9c6485](https://github.com/nandohdc/bloodtrail/commit/f9c64858006a913be0911e133a0e099bd232216d))
* **governance:** record project-owner decision ([757412c](https://github.com/nandohdc/bloodtrail/commit/757412c23075e5d8ec33fe2bcb5c36fa1f1b997c))
* **governance:** record project-owner reviews ([e3f2f1f](https://github.com/nandohdc/bloodtrail/commit/e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f))
* **governance:** record renewed technical review ([d05ef82](https://github.com/nandohdc/bloodtrail/commit/d05ef82d17a167b0aa49732c66820caf1871054f))
* **governance:** record technical review ([0f2cd27](https://github.com/nandohdc/bloodtrail/commit/0f2cd27277966a8a2eb15bbe34e6c6884de3abe1))
* **openspec:** archive browser telemetry research ([95fec81](https://github.com/nandohdc/bloodtrail/commit/95fec813433e76cc0b15c4a245849ed1c0f8c4a5))
* **openspec:** archive security audit event contract ([648fa8c](https://github.com/nandohdc/bloodtrail/commit/648fa8c7190997b4b748787e76d0bb64e0ca4f66))
* **openspec:** archive security audit SDK core ([482bc95](https://github.com/nandohdc/bloodtrail/commit/482bc9593e13f01b0e8dd278ad5ff52203997249))
* **openspec:** harden design-pattern governance proposal ([2fabbed](https://github.com/nandohdc/bloodtrail/commit/2fabbed06233c8f913ece51f8d3a2930ad229954))
* **openspec:** link SDK adversarial remediation issues ([71cabfe](https://github.com/nandohdc/bloodtrail/commit/71cabfe50e18af9f242ec9cd8b4aee33632e5792))
* **openspec:** make the exact-commit review gate satisfiable ([4ed0830](https://github.com/nandohdc/bloodtrail/commit/4ed083002c0d28f5f4b3769394e8890308b949c0)), closes [#20](https://github.com/nandohdc/bloodtrail/issues/20)
* **openspec:** propose browser telemetry research ([98126ed](https://github.com/nandohdc/bloodtrail/commit/98126ed403a2c6459b63dae2add58c59c0aea65a))
* **openspec:** propose design-pattern governance ([a17eb79](https://github.com/nandohdc/bloodtrail/commit/a17eb79a2dd0172bb888278a39ad898280a2f59a))
* **openspec:** propose SDK adversarial remediation ([b4206f9](https://github.com/nandohdc/bloodtrail/commit/b4206f92fc92c7355efaa80d9f878353cf794452))
* **openspec:** propose security audit event contract ([d09efa2](https://github.com/nandohdc/bloodtrail/commit/d09efa2b4955943b99555ec514bb4d13bb4dcbe8))
* **openspec:** propose security audit SDK core ([94dc6e3](https://github.com/nandohdc/bloodtrail/commit/94dc6e3bcc74beecd1fca2832948b139167fdd3b))
* **openspec:** record F-08 merge execution without inferring approval ([eb9c3a0](https://github.com/nandohdc/bloodtrail/commit/eb9c3a0ad4b2c1923a6464df4c312e0d3f3dd98b))
* **research:** materialize browser telemetry evidence ([095c1b2](https://github.com/nandohdc/bloodtrail/commit/095c1b2618ff4ab388f73b8d255d867bee4cbbb0))
* **research:** materialize browser telemetry evidence ([2f315b5](https://github.com/nandohdc/bloodtrail/commit/2f315b56bc9b93e9f84bb7cf24c6b3916a624938))
* **sdk:** complete audit SDK core verification and guidance ([21c5c98](https://github.com/nandohdc/bloodtrail/commit/21c5c98503205257be87cb977b131b4a81ac430a))
* **sdk:** document F-08 bounded identity-retention migration ([23ecf6d](https://github.com/nandohdc/bloodtrail/commit/23ecf6d4b463c2fa3845e1c257296691e3c6e3dd))
* **sdk:** document F-08 bounded identity-retention migration ([689fc39](https://github.com/nandohdc/bloodtrail/commit/689fc394e36642b814df6672b3b514ba95c27944)), closes [#28](https://github.com/nandohdc/bloodtrail/issues/28)

## [Unreleased]
