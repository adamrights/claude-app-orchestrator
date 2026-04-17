# claude-app-orchestrator Makefile
# Cheap, discoverable entry points for the common operations.

.PHONY: help install uninstall validate build audit check refs

help: ## Show this help
	@echo "Recipes:"
	@echo "  install                          Install slash commands (~/.claude/commands)"
	@echo "  uninstall                        Remove slash commands"
	@echo "  validate BLUEPRINT=<path>        Validate one blueprint"
	@echo "  build BLUEPRINT=<path> OUT=<dir> Print the slash command to build (build itself runs in Claude Code)"
	@echo "  audit                            Print the slash command to audit (run in app dir)"
	@echo "  check                            Validate every blueprint in blueprints/examples/ and examples/built/"
	@echo "  refs                             Lint cross-references between agents, skills, templates, blueprints"
	@echo ""
	@echo "Examples:"
	@echo "  make install"
	@echo "  make validate BLUEPRINT=examples/built/helpdesk/blueprint.yaml"
	@echo "  make build BLUEPRINT=examples/built/helpdesk/blueprint.yaml OUT=./helpdesk"
	@echo "  make check"

install:
	@./install.sh

uninstall:
	@./install.sh --uninstall

validate:
	@if [ -z "$(BLUEPRINT)" ]; then \
		echo "error: BLUEPRINT is required (e.g., make validate BLUEPRINT=path/to/blueprint.yaml)"; \
		exit 2; \
	fi
	@node scripts/validate-blueprint.mjs $(BLUEPRINT)

build:
	@if [ -z "$(BLUEPRINT)" ]; then \
		echo "error: BLUEPRINT is required (e.g., make build BLUEPRINT=path OUT=./out)"; \
		exit 2; \
	fi
	@echo "Open Claude Code and run:"
	@echo "  /orchestrate $(BLUEPRINT) $(if $(OUT),$(OUT),)"
	@echo ""
	@echo "(Building runs interactively inside Claude Code; this Makefile target is a discoverability shortcut.)"

audit:
	@echo "Open Claude Code in your app directory and run:"
	@echo "  /audit"

check:
	@status=0; \
	for f in blueprints/examples/*.yaml examples/built/*/blueprint.yaml; do \
		[ -e "$$f" ] || continue; \
		echo "validating $$f"; \
		node scripts/validate-blueprint.mjs "$$f" || status=1; \
	done; \
	exit $$status

refs:
	@node scripts/check-references.mjs
