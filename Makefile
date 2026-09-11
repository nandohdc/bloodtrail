.DEFAULT_GOAL := test

# Cost figures.
#
# Each cost is defined once here and referenced everywhere it is stated, so a
# recipe and `make help` cannot disagree about the same target: they expand from
# the same variable. They did disagree once — `help` described `runtime-gates` as
# 26s while the recipe echoed 34s — and `.github/scripts/check-package-discovery.mjs`
# now rejects a cost figure typed by hand anywhere else in this file.
#
# Measured 2026-09-10 with `time make <target>` on an Apple Silicon workstation
# (Darwin arm64, node v26.8.1, npm 11.19.0), warm, dependencies already installed.
# These are guidance for deciding whether to run a chain before pushing, not
# thresholds a run must meet: the same unchanged `test:verification` step measured
# 258s and 1234s on two green `main` runs, a spread driven by CI runner shape
# (#306). Do not estimate CI wall-clock from them. CLAUDE.md records how to
# re-derive both a local and a CI figure.
COST_RUNTIME_GATES := ~45s local, 2026-09-10
COST_GOVERNANCE_GATES := ~13-20min local, 2026-09-10
COST_SDK := ~40s local, 2026-09-10
COST_CONTRACT := ~1s local, 2026-09-10
COST_RESEARCH := ~3s local, 2026-09-10

.PHONY: test runtime-gates governance-gates sdk contract research help

test: runtime-gates

runtime-gates:
	@echo "Running fast product test loop across all workspaces ($(COST_RUNTIME_GATES))..."
	npm run test:matrix --prefix packages/security-audit-sdk-core
	npm run validate --prefix packages/security-audit-sdk-node
	npm run validate --prefix packages/client-evidence-browser
	npm run validate --prefix packages/security-audit-collector
	npm run validate --prefix contracts/security-audit
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Product test loop passed across every declared workspace ($(COST_RUNTIME_GATES))."
	@echo "Notice: Full governance-gate chains ($(COST_GOVERNANCE_GATES)) were NOT run. Run 'make governance-gates' before pushing."

governance-gates:
	@echo "Running full governance-gate chains ($(COST_GOVERNANCE_GATES) across workspaces; dominant cost is SDK gate mutation testing, test:verification)..."
	npm run validate --prefix packages/security-audit-sdk-core
	npm run validate --prefix packages/security-audit-sdk-node
	npm run validate --prefix packages/client-evidence-browser
	npm run validate --prefix packages/security-audit-collector
	npm run validate --prefix contracts/security-audit
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Full governance-gate chains passed across every declared workspace ($(COST_GOVERNANCE_GATES))."

sdk:
	@echo "Running SDK product loop ($(COST_SDK))..."
	npm run test:matrix --prefix packages/security-audit-sdk-core
	npm run validate --prefix packages/security-audit-sdk-node
	@echo "Notice: Partial run completed. Exercised SDK product loop only; packages/client-evidence-browser, packages/security-audit-collector, contracts/security-audit and research/browser-telemetry were NOT run."

contract:
	@echo "Running contract validation ($(COST_CONTRACT))..."
	npm run validate --prefix contracts/security-audit
	@echo "Notice: Partial run completed. Exercised contract workspace only; packages/security-audit-sdk-core, packages/security-audit-sdk-node, packages/client-evidence-browser, packages/security-audit-collector, and research/browser-telemetry were NOT run."

research:
	@echo "Running research harness checks ($(COST_RESEARCH))..."
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Notice: Partial run completed. Exercised research workspace only; packages/security-audit-sdk-core, packages/security-audit-sdk-node, packages/client-evidence-browser, packages/security-audit-collector, and contracts/security-audit were NOT run."

help:
	@echo "Bloodtrail command surface (delegating to workspace scripts):"
	@echo "  make (or make test)   Run fast product test loop across every declared workspace ($(COST_RUNTIME_GATES))"
	@echo "  make runtime-gates    Alias for make test ($(COST_RUNTIME_GATES))"
	@echo "  make governance-gates Run full governance-gate chains ($(COST_GOVERNANCE_GATES); states cost upfront)"
	@echo "  make sdk              Run SDK product test loop only ($(COST_SDK); partial run)"
	@echo "  make contract         Run contract validation only ($(COST_CONTRACT); partial run)"
	@echo "  make research         Run research checks only ($(COST_RESEARCH); partial run)"
	@echo "Costs are measured figures with their provenance, not thresholds. See CLAUDE.md."
