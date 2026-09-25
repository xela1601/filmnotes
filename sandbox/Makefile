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
.PHONY: help sbx-build sbx-plan sbx-create sbx-run sbx-rm sbx-recreate skills-import doctor shell ports

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

sbx-create: ## Create the sandbox "filmnotes" (reads the GitHub token from Bitwarden)
	@$(BW_SESSION_CMD); sbx env create -y $(ENV_DIR) $(SBX_ENV_ARGS)

sbx-run: ## Start Claude Code in the sandbox (creates it when missing)
	@$(BW_SESSION_CMD); sbx env run $(ENV_DIR) $(SBX_ENV_ARGS)

sbx-rm: ## Remove the sandbox and everything it provisioned
	sbx env rm $(ENV_DIR) $(SBX_ENV_ARGS)

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
