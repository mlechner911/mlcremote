# Lightweight Remote Dev Environment - Makefile

# Paths
FRONTEND_DIR := frontend
BACKEND_DIR  := backend
DESKTOP_DIR  := desktop
BIN_DIR      := bin
STATIC_DIR   := $(FRONTEND_DIR)/dist

# Defaults
HOME ?= $(USERPROFILE)
PORT ?= 8443
ROOT ?= $(HOME)
SERVER ?=
DOCS_SPEC := $(PWD)/docs/openapi.yaml

# OS-Specific Configuration
ifeq ($(OS),Windows_NT)
    include Makefile.win
else
    include Makefile.unix
endif

.PHONY: help backend frontend run docs install connect clean desktop-dev desktop-build desktop-dist desktop-dist-zip dist docker-build docker-run test-env-up test-env-down build-linux backend-linux-payload prepare-payload desktop-deps remote-xpra

# ... (help targets omitted) ...

help: ## Show this help
	@grep -h '^##' Makefile Makefile.win Makefile.unix | sed "s/^## //g"

## backend - Build the Go backend
backend:
	@$(ENSURE_BIN)
	cd $(BACKEND_DIR) && go mod download
	cd $(BACKEND_DIR) && go build -ldflags "-s -w" -o ../$(BIN_DIR)/dev-server$(EXT) ./cmd/dev-server
	@echo "Built $(BIN_DIR)/dev-server$(EXT)"

## frontend - Build the React frontend
frontend: icons
	cd $(FRONTEND_DIR) && npm install
	cd $(FRONTEND_DIR) && npm run build
	@echo "Built $(STATIC_DIR)"

# ... (icons-gen, run, docs, swagger-gen, install, connect kept as is) ...

# Build Targets for Payload
backend-linux-payload:
	@echo "Building Linux (amd64) backend..."
	@$(MKDIR_PAYLOAD)/linux/amd64
	$(BUILD_LINUX_CMD) -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/linux/amd64/dev-server ./cmd/dev-server
	$(BUILD_LINUX_CMD) -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/linux/amd64/md5-util ./cmd/md5-util

backend-windows-payload:
	@echo "Building Windows (amd64) backend..."
	@$(MKDIR_PAYLOAD)/windows/amd64
	cd $(BACKEND_DIR) && set "GOOS=windows" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/windows/amd64/dev-server.exe ./cmd/dev-server
	cd $(BACKEND_DIR) && set "GOOS=windows" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/windows/amd64/md5-util.exe ./cmd/md5-util

backend-darwin-amd64-payload:
	@echo "Building MacOS (amd64) backend..."
	@$(MKDIR_PAYLOAD)/darwin/amd64
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/amd64/dev-server ./cmd/dev-server
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/amd64/md5-util ./cmd/md5-util

backend-darwin-arm64-payload:
	@echo "Building MacOS (arm64) backend..."
	@$(MKDIR_PAYLOAD)/darwin/arm64
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=arm64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/arm64/dev-server ./cmd/dev-server
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=arm64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/arm64/md5-util ./cmd/md5-util

## prepare-payload - Build all payload assets (backend binaries for all OS + frontend)
prepare-payload: backend-linux-payload backend-windows-payload backend-darwin-amd64-payload backend-darwin-arm64-payload
	@echo "Building frontend for payload..."
	cd $(FRONTEND_DIR) && npm run build
	@echo "Updating payload assets..."
	@$(CLEAN_PAYLOAD_FRONTEND)
	@$(MKDIR_PAYLOAD_FRONTEND)
	@$(COPY_PAYLOAD_FRONTEND)

	@echo "Updating desktop local IDE assets..."
	@$(CLEAN_DESKTOP_IDE)
	@$(MKDIR_DESKTOP_IDE)
	@$(COPY_DESKTOP_IDE)

	@echo "Building verification tool..."
	@$(ENSURE_BIN)
	@cd $(BACKEND_DIR) && go build -o ../$(BIN_DIR)/build-util$(EXT) ./cmd/build-util
	@echo "Payload prepared. Contents:"
	@$(BIN_DIR)/build-util$(EXT) ls-r $(DESKTOP_DIR)/wails/assets/payload

## desktop-dev - Run the desktop app in dev mode (wails dev)
desktop-dev: prepare-payload
	cd $(DESKTOP_DIR)/wails && wails dev -tags desktop

.PHONY: debug
debug: desktop-dev

## desktop-build - Build the desktop app (wails build)
desktop-build: prepare-payload
	@$(ENSURE_BIN)
	cd $(BACKEND_DIR) && go build -o ../$(BIN_DIR)/build-util$(EXT) ./cmd/build-util
	cd $(FRONTEND_DIR) && npm run build
	cd $(DESKTOP_DIR)/wails && (wails build -tags webkit2_41 || wails build -tags webkit2 || wails build)
	@echo "---------------------------------------------------"
	@$(BIN_DIR)/build-util$(EXT) size $(DESKTOP_DIR)/wails/build/bin/MLCRemote$(EXT)
	@echo "---------------------------------------------------"

.PHONY: desktop-upgrade-wails
desktop-upgrade-wails:
	@echo "Upgrading wails to latest in $(DESKTOP_DIR)"
	cd $(DESKTOP_DIR) && go get github.com/wailsapp/wails/v2@latest && go mod tidy
	@echo "Upgrade complete. Review and commit changes in $(DESKTOP_DIR)"

.PHONY: desktop-dist
## desktop-dist - Build and package desktop app for distribution
desktop-dist:
	@echo "Building frontend and desktop (wails build)"
	cd $(FRONTEND_DIR) && npm run build
	cd $(DESKTOP_DIR)/wails && (wails build -s -tags "desktop,production,webkit2_41" || wails build -s -tags "desktop,production,webkit2" || wails build -s -tags "desktop,production")
	@echo "Packaging desktop artifacts into dist/"
	@mkdir -p $(OUTDIR)
	@if [ -d "$(DESKTOP_DIR)/wails/build/bin" ]; then \
		cp -r "$(DESKTOP_DIR)/wails/build/bin"/* "$(OUTDIR)/"; \
	elif [ -d "$(DESKTOP_DIR)/wails/build" ]; then \
		cp -r "$(DESKTOP_DIR)/wails/build"/* "$(OUTDIR)/"; \
	fi
	@echo "Packaged to $(OUTDIR)"

.PHONY: desktop-dist-zip
## desktop-dist-zip - Create a zip archive of the desktop distribution
desktop-dist-zip:
ifeq ($(OS),Windows_NT)
	@echo "Running Windows build script..."
	powershell -ExecutionPolicy Bypass -File desktop/build-windows.ps1
else
	$(MAKE) desktop-dist
	@echo "Zipping desktop distribution"
	OSNAME=`uname -s | tr '[:upper:]' '[:lower:]'` || OSNAME=unknown; \
	ARCH=`uname -m` || ARCH=unknown; \
	OUTDIR=dist/desktop-$${OSNAME}-$${ARCH}; \
	ZIPNAME=dist/mlcremote-desktop-$${OSNAME}-$${ARCH}.zip; \
	if [ -d "$$OUTDIR" ]; then tar -a -c -f $$ZIPNAME -C $$OUTDIR .; else echo "No desktop build found in $$OUTDIR"; exit 1; fi; \
	@echo "Created $$ZIPNAME"
endif

.PHONY: desktop-installer
## desktop-installer - Package the installer (PowerShell script) (Windows Only)
desktop-installer:
ifeq ($(OS),Windows_NT)
	@echo "Packaging installer..."
	@powershell -ExecutionPolicy Bypass -File desktop/wails/scripts/package.ps1
else
	@echo "Installer generation is currently Windows-only."
endif

.PHONY: installer
installer:
	@echo "Building Windows Installer (NSIS)..."
	@powershell -ExecutionPolicy Bypass -File desktop/wails/scripts/build-installer.ps1
	@if not exist dist mkdir dist
	@powershell -noprofile -command "Copy-Item -Force $(DESKTOP_DIR)/wails/build/bin/*installer.exe dist/"
	@echo "Installer available in dist/"



## clean - Remove build artifacts
clean:
	-$(RM_F) $(BIN_DIR)\dev-server$(EXT)
	-$(RM_RF) $(STATIC_DIR)
	-$(RM_RF) build/dist
	@echo "Cleaned build artifacts"

.PHONY: dist
## dist - Package full distribution (icons, backend, frontend) into build/dist
dist: icons backend frontend
	@echo "Packaging distribution into build/dist"

ifeq ($(OS),Windows_NT)
	@powershell -noprofile -ExecutionPolicy Bypass -File scripts/dist.ps1
else
	@rm -rf build/dist
	@mkdir -p build/dist/bin build/dist/frontend
	@echo "Copying binaries"
	@if [ -f "$(BIN_DIR)/dev-server$(EXT)" ]; then cp -f "$(BIN_DIR)/dev-server$(EXT)" build/dist/bin/; else echo "Warning: dev-server binary not found at $(BIN_DIR)/dev-server$(EXT)"; fi
	@if [ -f "$(BIN_DIR)/icon-gen$(EXT)" ]; then cp -f "$(BIN_DIR)/icon-gen$(EXT)" build/dist/bin/; fi
	@echo "Copying frontend"
	@if [ -d "$(FRONTEND_DIR)/dist" ]; then cp -r "$(FRONTEND_DIR)/dist"/* build/dist/frontend/; else echo "Error: No frontend dist found at $(FRONTEND_DIR)/dist"; exit 1; fi
endif
	@echo "Packaged distribution to build/dist"

## remote-xpra - Start xpra on remote Linux and print SSH tunnel/attach commands
remote-xpra:
	@if [ -z "$(REMOTE)" ]; then echo "Set REMOTE=user@host (e.g., make remote-xpra REMOTE=user@server)"; exit 1; fi
	@echo "Starting xpra on $(REMOTE) (display :100, TCP 127.0.0.1:10000)"
	@ssh $(REMOTE) 'set -e; \
		RDIR="$(if $(REMOTE_DIR),$(REMOTE_DIR),$(PWD))"; \
		APP_PATH=$$(ls -1 "$${RDIR}/dist/desktop-linux-"*"/MLCRemote" 2>/dev/null | head -n1); \
		if [ -z "$$APP_PATH" ]; then echo "App not found under $$RDIR/dist"; exit 1; fi; \
		command -v xpra >/dev/null 2>&1 || { echo "xpra not installed. Install with: sudo apt install xpra xvfb (Debian/Ubuntu)"; exit 1; }; \
		xpra stop :100 >/dev/null 2>&1 || true; \
		BINDADDR="$(if $(REMOTE_BIND),$(REMOTE_BIND),127.0.0.1:10000)"; \
		xpra start :100 --start-child="$$APP_PATH" --bind-tcp="$$BINDADDR" --exit-with-children'
	@echo "----------------------------------------"
	@echo "Bind address: $(if $(REMOTE_BIND),$(REMOTE_BIND),127.0.0.1:10000)"
	@echo "If bound to localhost, open SSH tunnel on Windows:"
	@echo "  ssh -L 10000:127.0.0.1:10000 $(REMOTE)"
	@echo "  xpra.exe attach tcp:localhost:10000"
	@echo "If bound to 0.0.0.0 (no tunnel), attach directly:"
	@echo "  xpra.exe attach tcp:<remote-host>:<port>  (use the port from REMOTE_BIND, default 10000)"
	@echo "Security note: direct TCP exposes the session; prefer SSH tunnel or restrict with firewall."

.PHONY: desktop-deps
## desktop-deps - Install desktop build dependencies for your OS
desktop-deps:
ifeq ($(OS),Windows_NT)
	@echo "Windows: Install WebView2 runtime and Wails CLI. See desktop/BUILD.md."
else
	@echo "Installing Linux desktop build dependencies..."
	@if [ $$(id -u) -ne 0 ]; then sudo desktop/wails/scripts/install-linux-deps.sh; else desktop/wails/scripts/install-linux-deps.sh; fi
endif

# Docker Targets
.PHONY: icons
## icons - Generate icons from raw assets
icons:
	@echo "Generating icons..."
	cd cmd/icon-gen && go run . --manifest ../../icons/icons.yml --raw ../../icons/raw --out ../../frontend/src/generated
## docker-build - Build the main Docker image
docker-build:
	docker build -t mlcremote .

## docker-run - Run the application in Docker
docker-run: docker-build
	docker run -p $(PORT):$(PORT) -v "$(HOME):/data" mlcremote

## docker-dev - Run the application in Docker (dev mode)
docker-dev: frontend
	docker build --target dev -t mlcremote-dev .
	docker run -p $(PORT):$(PORT) -v "$(CURDIR)/backend:/app/backend" -v "$(CURDIR)/frontend/dist:/app/frontend/dist" -v "$(CURDIR)/tmp/data:/data" mlcremote-dev

## test-env-up - Start test environment (docker-compose up)
test-env-up:
	docker-compose up -d

## test-env-down - Stop test environment (docker-compose down)
test-env-down:
	docker-compose down

## build-linux - Build Linux binary using Docker
build-linux:
	$(ENSURE_DIST_LINUX)
	docker build -t mlcremote-builder -f docker/build-linux/Dockerfile .
	docker run --rm -v "$(CURDIR):/app" -v "$(CURDIR)/dist/linux:/out" mlcremote-builder
