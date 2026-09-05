.DEFAULT_GOAL := test

.PHONY: test runtime-gates governance-gates sdk contract research help

test: runtime-gates

runtime-gates:
	@echo "Running fast product test loop across all workspaces (~18s)..."
	npm run test:matrix --prefix packages/security-audit-sdk-core
	npm run validate --prefix contracts/security-audit
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Product test loop passed across all three workspaces (~18s)."
	@echo "Notice: Full governance-gate chains (~291s) were NOT run. Run 'make governance-gates' before pushing."

governance-gates:
	@echo "Running full governance-gate chains (~291s across workspaces; dominant cost is SDK gate mutation testing ~254s)..."
	npm run validate --prefix packages/security-audit-sdk-core
	npm run validate --prefix contracts/security-audit
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Full governance-gate chains passed across all three workspaces (~291s)."

sdk:
	@echo "Running SDK product loop (~15s)..."
	npm run test:matrix --prefix packages/security-audit-sdk-core
	@echo "Notice: Partial run completed. Exercised SDK product loop only; contracts/security-audit and research/browser-telemetry were NOT run."

contract:
	@echo "Running contract validation (~1.5s)..."
	npm run validate --prefix contracts/security-audit
	@echo "Notice: Partial run completed. Exercised contract workspace only; packages/security-audit-sdk-core and research/browser-telemetry were NOT run."

research:
	@echo "Running research harness checks (~15s)..."
	npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry
	@echo "Notice: Partial run completed. Exercised research workspace only; packages/security-audit-sdk-core and contracts/security-audit were NOT run."

help:
	@echo "Bloodtrail command surface (delegating to workspace scripts):"
	@echo "  make (or make test)   Run fast product test loop across all three workspaces (~18s)"
	@echo "  make runtime-gates    Alias for make test (~18s)"
	@echo "  make governance-gates Run full governance-gate chains (~291s; states cost upfront)"
	@echo "  make sdk              Run SDK product test loop only (partial run)"
	@echo "  make contract         Run contract validation only (partial run)"
	@echo "  make research         Run research checks only (partial run)"
