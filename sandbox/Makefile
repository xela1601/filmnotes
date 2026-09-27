# filmnotes sandbox - the host-side handgrips around Docker Sandboxes (sbx).
# Run from this directory: make -C sandbox <target>, or cd sandbox && make <target>.
# Tasks *inside* the sandbox stay in ../mise.toml (sandbox/mise run <task>).
#
# sbxenv.yaml (one level up) knows no user: the home directory arrives as the argument
# "home" (the deploy key lives under it), the Expo host port as "expoPort".

SHELL := /bin/bash
SANDBOX := filmnotes
ENV_DIR := ..
TEMPLATE := filmnotes-sbx:latest
EXPO_PORT ?= 8082
SBX_ENV_ARGS = --env-arg home=$(HOME) --env-arg expoPort=$(EXPO_PORT)
EXEC := sbx exec $(SANDBOX) -- sh -lc

# Bitwarden: "sbx env create" runs sandbox/host/bw-github-token.sh on the host and inherits
# this recipe shell's environment, so the vault is unlocked here first when needed. A
# separate "make bw-unlock" could not hand BW_SESSION back to the caller's shell.
BW_SESSION_CMD = if [ "$$(bw status 2>/dev/null | jq -r .status)" != "unlocked" ]; then \
	echo "Bitwarden: unlocking the vault (master password) ..."; BW_SESSION="$$(bw unlock --raw)" || exit 1; export BW_SESSION; fi

.DEFAULT_GOAL := help
.PHONY: help sbx-build sbx-plan sbx-create sbx-attach sbx-rm sbx-recreate skills-import doctor shell ports

help: ## This overview
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# sandboxd has its own image store; images built in Docker Desktop are invisible to it.
sbx-build: ## Build the template image and load it into the sbx VM (again after Dockerfile changes)
	docker build -t $(TEMPLATE) .
	docker save $(TEMPLATE) | sbx template load -
	sbx template ls | grep -q "$(TEMPLATE)" && echo "template loaded: $(TEMPLATE)"

sbx-plan: ## Show what "make sbx-create" would create (mounts, args, ports)
	sbx env plan $(ENV_DIR) $(SBX_ENV_ARGS)

# sbx hides the output of a failing secret command ("exit status 1"), so the token script
# runs once beforehand where its message is visible; only the length is printed.
BW_PREFLIGHT = set -o pipefail; n=$$(./host/bw-github-token.sh | wc -c | tr -d " ") || exit 1; \
	[ "$$n" -gt 0 ] || { echo "Bitwarden delivered an empty GitHub token."; exit 1; }; echo "Bitwarden: GitHub token found ($$n characters)."

sbx-create: ## Create the sandbox "filmnotes" (reads the GitHub token from Bitwarden)
	@$(BW_SESSION_CMD); $(BW_PREFLIGHT); sbx env create -y $(ENV_DIR) $(SBX_ENV_ARGS)

# Entering the sandbox is plain sbx, not make: "sbx tui" (dashboard; the session entered from
# there shows the changes pane) or "sbx run --name filmnotes" (direct attach).
sbx-attach: ## Attach to the sandbox directly and start Claude Code (sbx run --name)
	sbx run --name $(SANDBOX)

# Tolerant: a missing sandbox is not an error, so sbx-recreate also works the first time.
sbx-rm: ## Remove the sandbox and everything it provisioned
	@if sbx ls 2>/dev/null | awk 'NR>1 {print $$1}' | grep -qx "$(SANDBOX)"; then sbx env rm $(ENV_DIR) $(SBX_ENV_ARGS); \
	else echo "Sandbox $(SANDBOX) does not exist - nothing to remove."; fi

# Kit changes only take effect in a new sandbox; "sbx env plan" compares the environment
# file, not the kit's content.
sbx-recreate: sbx-rm sbx-create ## Recreate after changes to the kit or the environment

# The sbx skills store is shared by every sandbox and mounted read-only at
# ~/.claude/skills. It is filled from the host's ~/.claude/skills by this import; run it
# again after editing a skill there. A running sandbox sees the store live.
skills-import: ## Copy ~/.claude/skills into the sbx skills store (all sandboxes)
	sbx skills import --force

doctor: ## Self-test inside the running sandbox: tools, mounts, network, git
	@$(EXEC) 'command -v sandbox-doctor >/dev/null || { echo "sandbox-doctor missing: the sandbox predates this kit - make sbx-recreate"; exit 1; }; sandbox-doctor'

shell: ## Shell in the running sandbox, without the agent
	sbx exec -it $(SANDBOX) bash -l

ports: ## Published ports of the running sandbox
	sbx ports $(SANDBOX)
