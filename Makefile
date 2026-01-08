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

.PHONY: help backend frontend run docs install connect clean desktop-dev desktop-build desktop-dist desktop-dist-zip dist docker-build docker-run test-env-up test-env-down build-linux backend-linux-payload prepare-payload

# ... (help targets omitted) ...

help: ## Show this help
	@$(HELP_CMD)

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
	cd $(DESKTOP_DIR)/wails && wails build
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
	cd $(DESKTOP_DIR)/wails && wails build -s -tags "desktop,production"
	@echo "Packaging desktop artifacts into dist/"
	@mkdir -p dist
	OSNAME=`uname -s | tr '[:upper:]' '[:lower:]'` || OSNAME=unknown; \
	ARCH=`uname -m` || ARCH=unknown; \
	OUTDIR=dist/desktop-$${OSNAME}-$${ARCH}; \
	mkdir -p $$OUTDIR; \
	# copy Wails build output (default: build/bin or build/ for some setups)
	if [ -d "$(DESKTOP_DIR)/wails/build/bin" ]; then cp -r $(DESKTOP_DIR)/wails/build/bin/* $$OUTDIR/; fi; \
	if [ -d "$(DESKTOP_DIR)/wails/build" ]; then cp -r $(DESKTOP_DIR)/wails/build/* $$OUTDIR/; fi; \
	@echo "Packaged to $$OUTDIR"

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
## installer - Build Windows Installer using NSIS (Windows Only)
installer: prepare-payload
	@echo "Building Windows Installer (NSIS)..."
	set "PATH=%PATH%;C:\Program Files (x86)\NSIS" && cd $(DESKTOP_DIR)/wails && wails build -nsis
	@echo "Installer created in $(DESKTOP_DIR)/wails/build/bin/"



# Define delete command
# Define delete command
RM_RF = rm -rf

## clean - Remove build artifacts
clean:
	@rm -f $(BIN_DIR)/dev-server
	@$(RM_RF) $(STATIC_DIR)
	@$(RM_RF) build/dist
	@echo "Cleaned build artifacts"

.PHONY: dist
## dist - Package full distribution (icons, backend, frontend) into build/dist
dist: icons backend frontend
	@echo "Packaging distribution into build/dist"
	@powershell -noprofile -ExecutionPolicy Bypass -File scripts/dist.ps1
	@echo "Packaged distribution to build/dist"

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
