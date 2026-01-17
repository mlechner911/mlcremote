# Makefile wrapper for Taskfile.yml
# This allows using 'make' commands that redirect to 'task'

.PHONY: all help dev build release clean icons deps docker

# Default target
all: help

help: ## Show help
	@task --list

dev: ## Run development mode
	@task dev

build: ## Build for distribution
	@task dist

release: ## Create full release
	@task release

clean: ## Clean artifacts
	@task clean

icons: ## Generate icons
	@task icons

deps: ## Install dependencies
	@task deps

docker: ## Run Docker dev
	@task docker:dev

# Catch-all to pass other targets to task
%:
	@task $@
