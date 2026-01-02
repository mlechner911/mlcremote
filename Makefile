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

backend-linux-payload:
	@echo "Building Linux backend for payload..."
	@$(MKDIR_PAYLOAD)
	$(BUILD_LINUX_CMD) -ldflags "-s -w" -o ../$(DESKTOP_DIR)/wails/assets/payload/dev-server ./cmd/dev-server

prepare-payload: backend-linux-payload
	@echo "Building frontend for payload..."
	cd $(FRONTEND_DIR) && npm run build
	@echo "Updating payload assets..."
	@$(CLEAN_PAYLOAD_FRONTEND)
	@$(MKDIR_PAYLOAD_FRONTEND)
	@$(COPY_PAYLOAD_FRONTEND)
	@echo "Payload prepared."

desktop-dev: prepare-payload
	cd $(DESKTOP_DIR)/wails && wails dev -tags desktop

.PHONY: debug
debug: desktop-dev

desktop-build:
	cd $(FRONTEND_DIR) && npm run build
	cd $(DESKTOP_DIR)/wails && wails build

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

clean:
	@rm -f $(BIN_DIR)/dev-server
	@rm -rf $(STATIC_DIR)
	@rm -rf build/dist
	@echo "Cleaned build artifacts"

.PHONY: dist
dist: icons-gen backend frontend
	@echo "Packaging distribution into build/dist"
	@rm -rf build/dist
	@mkdir -p build/dist/bin
	@mkdir -p build/dist/frontend
	@cp -r $(BIN_DIR)/dev-server build/dist/bin/ || true
	@cp -r $(BIN_DIR)/icon-gen build/dist/bin/ || true
	@# Copy frontend static output
	@if [ -d "$(FRONTEND_DIR)/dist" ]; then cp -r $(FRONTEND_DIR)/dist/* build/dist/frontend/; else echo "No frontend dist found; run make frontend"; exit 1; fi
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
