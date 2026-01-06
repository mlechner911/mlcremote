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
    EXT = .exe
    ENSURE_BIN = if not exist $(BIN_DIR) mkdir $(BIN_DIR)
    SERVER_BIN = .\$(BIN_DIR)\dev-server.exe
    ICON_GEN_BIN = .\$(BIN_DIR)\icon-gen.exe
    
    # Payload Utilities
    MKDIR_PAYLOAD = if not exist $(DESKTOP_DIR)\wails\assets\payload mkdir $(DESKTOP_DIR)\wails\assets\payload
    # Note: Use set "VAR=val" to avoid trailing spaces
    BUILD_LINUX_CMD = cd $(BACKEND_DIR) && set "GOOS=linux" && set "GOARCH=amd64" && go build
    
    # Cleanup and Copy for Windows
    # We use powershell for reliable recursive copy/delete to avoid cmd.exe intricacies with xcopy/rmdir checks
    CLEAN_PAYLOAD_FRONTEND = powershell -noprofile -command "if (Test-Path $(DESKTOP_DIR)/wails/assets/payload/frontend-dist) { Remove-Item -Recurse -Force $(DESKTOP_DIR)/wails/assets/payload/frontend-dist }"
    MKDIR_PAYLOAD_FRONTEND = if not exist $(DESKTOP_DIR)\wails\assets\payload\frontend-dist mkdir $(DESKTOP_DIR)\wails\assets\payload\frontend-dist
    COPY_PAYLOAD_FRONTEND = powershell -noprofile -command "Copy-Item -Recurse -Force $(FRONTEND_DIR)/dist/* $(DESKTOP_DIR)/wails/assets/payload/frontend-dist/"
    
    # Copy frontend to desktop public/ide for local serving
    CLEAN_DESKTOP_IDE = powershell -noprofile -command "if (Test-Path $(DESKTOP_DIR)/wails/frontend/public/ide) { Remove-Item -Recurse -Force $(DESKTOP_DIR)/wails/frontend/public/ide }"
    MKDIR_DESKTOP_IDE = if not exist $(DESKTOP_DIR)\wails\frontend\public\ide mkdir $(DESKTOP_DIR)\wails\frontend\public\ide
    COPY_DESKTOP_IDE = powershell -noprofile -command "Copy-Item -Recurse -Force $(FRONTEND_DIR)/dist/* $(DESKTOP_DIR)/wails/frontend/public/ide/"
else
    EXT =
    ENSURE_BIN = mkdir -p $(BIN_DIR)
    SERVER_BIN = ./$(BIN_DIR)/dev-server
    ICON_GEN_BIN = ./$(BIN_DIR)/icon-gen
    
    # Payload Utilities
    MKDIR_PAYLOAD = mkdir -p $(DESKTOP_DIR)/wails/assets/payload
    BUILD_LINUX_CMD = cd $(BACKEND_DIR) && GOOS=linux GOARCH=amd64 go build
    
    CLEAN_PAYLOAD_FRONTEND = rm -rf $(DESKTOP_DIR)/wails/assets/payload/frontend-dist
    MKDIR_PAYLOAD_FRONTEND = mkdir -p $(DESKTOP_DIR)/wails/assets/payload/frontend-dist
    COPY_PAYLOAD_FRONTEND = cp -r $(FRONTEND_DIR)/dist/* $(DESKTOP_DIR)/wails/assets/payload/frontend-dist/
    
    CLEAN_DESKTOP_IDE = rm -rf $(DESKTOP_DIR)/wails/frontend/public/ide
    MKDIR_DESKTOP_IDE = mkdir -p $(DESKTOP_DIR)/wails/frontend/public/ide
    COPY_DESKTOP_IDE = cp -r $(FRONTEND_DIR)/dist/* $(DESKTOP_DIR)/wails/frontend/public/ide/
endif

.PHONY: help backend frontend run docs install connect clean desktop-dev desktop-build desktop-dist desktop-dist-zip dist docker-build docker-run test-env-up test-env-down build-linux backend-linux-payload prepare-payload

# ... (help targets omitted) ...

backend:
	@$(ENSURE_BIN)
	cd $(BACKEND_DIR) && go mod download
	cd $(BACKEND_DIR) && go build -ldflags "-s -w" -o ../$(BIN_DIR)/dev-server$(EXT) ./cmd/dev-server
	@echo "Built $(BIN_DIR)/dev-server$(EXT)"

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

backend-windows-payload:
	@echo "Building Windows (amd64) backend..."
	@$(MKDIR_PAYLOAD)/windows/amd64
	cd $(BACKEND_DIR) && set "GOOS=windows" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/windows/amd64/dev-server.exe ./cmd/dev-server

backend-darwin-amd64-payload:
	@echo "Building MacOS (amd64) backend..."
	@$(MKDIR_PAYLOAD)/darwin/amd64
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=amd64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/amd64/dev-server ./cmd/dev-server

backend-darwin-arm64-payload:
	@echo "Building MacOS (arm64) backend..."
	@$(MKDIR_PAYLOAD)/darwin/arm64
	cd $(BACKEND_DIR) && set "GOOS=darwin" && set "GOARCH=arm64" && go build -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/darwin/arm64/dev-server ./cmd/dev-server

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

desktop-dev: prepare-payload
	cd $(DESKTOP_DIR)/wails && wails dev -tags desktop

.PHONY: debug
debug: desktop-dev

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


# Define delete command
# Define delete command
RM_RF = rm -rf

clean:
	@rm -f $(BIN_DIR)/dev-server
	@$(RM_RF) $(STATIC_DIR)
	@$(RM_RF) build/dist
	@echo "Cleaned build artifacts"

.PHONY: dist
dist: icons backend frontend
	@echo "Packaging distribution into build/dist"
	@powershell -noprofile -ExecutionPolicy Bypass -File scripts/dist.ps1
	@echo "Packaged distribution to build/dist"

# Docker Targets
.PHONY: icons
icons:
	@echo "Generating icons..."
	cd cmd/icon-gen && go run . --manifest ../../icons/icons.yml --raw ../../icons/raw --out ../../frontend/src/generated
docker-build:
	docker build -t mlcremote .

docker-run: docker-build
	docker run -p $(PORT):$(PORT) -v "$(HOME):/data" mlcremote

docker-dev: frontend
	docker build --target dev -t mlcremote-dev .
	docker run -p $(PORT):$(PORT) -v "$(CURDIR)/backend:/app/backend" -v "$(CURDIR)/frontend/dist:/app/frontend/dist" -v "$(CURDIR)/tmp/data:/data" mlcremote-dev

test-env-up:
	docker-compose up -d

test-env-down:
	docker-compose down

build-linux:
	mkdir -p dist/linux
	docker build -t mlcremote-builder -f docker/build-linux/Dockerfile .
	docker run --rm -v "$(PWD):/app" -v "$(PWD)/dist/linux:/out" mlcremote-builder
