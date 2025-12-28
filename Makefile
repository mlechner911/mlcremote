# Lightweight Remote Dev Environment - Makefile

# Paths
FRONTEND_DIR := frontend
BACKEND_DIR  := backend
DESKTOP_DIR  := desktop
BIN_DIR      := bin
STATIC_DIR   := $(FRONTEND_DIR)/dist

# Defaults
PORT ?= 8443
ROOT ?= $(HOME)
SERVER ?=
DOCS_SPEC := $(PWD)/docs/openapi.yaml

.PHONY: help backend frontend run docs install connect clean desktop-dev desktop-build desktop-dist desktop-dist-zip

help:
	@echo "Targets:"
	@echo "  backend       - Build Go backend to bin/dev-server"
	@echo "  frontend      - Install deps and build frontend to frontend/dist"
	@echo "  run           - Start backend serving frontend/dist (port $(PORT))"
	@echo "  docs          - Start backend with OpenAPI served at /openapi.yaml and Swagger UI at /docs"
	@echo "  install       - Deploy backend as SystemD user service to $$SERVER"
	@echo "  connect       - Open SSH tunnel to $$SERVER and launch browser"
	@echo "  desktop-dev   - Run Wails dev (hot reload)"
	@echo "  desktop-build - Build Wails desktop app"
	@echo "  clean         - Remove build artifacts"

backend:
	@mkdir -p $(BIN_DIR)
	cd $(BACKEND_DIR) && go mod download
	cd $(BACKEND_DIR) && go build -ldflags "-s -w" -o ../$(BIN_DIR)/dev-server ./cmd/dev-server
	@echo "Built $(BIN_DIR)/dev-server"

frontend:
	cd $(FRONTEND_DIR) && npm install
	cd $(FRONTEND_DIR) && npm run build
	@echo "Built $(STATIC_DIR)"

run:
	@echo "Starting backend on 127.0.0.1:$(PORT) serving $(STATIC_DIR)"
	./$(BIN_DIR)/dev-server --port $(PORT) --root $(ROOT) --static-dir "$(PWD)/$(STATIC_DIR)"

docs:
	@echo "Starting backend on 127.0.0.1:$(PORT) with API docs"
	./$(BIN_DIR)/dev-server --port $(PORT) --root $(ROOT) --openapi "$(DOCS_SPEC)"

install:
	@if [ -z "$(SERVER)" ]; then echo "Usage: make install SERVER=user@remote"; exit 1; fi
	./scripts/install.sh $(SERVER)

connect:
	@if [ -z "$(SERVER)" ]; then echo "Usage: make connect SERVER=user@remote"; exit 1; fi
	./scripts/connect.sh $(SERVER)

desktop-dev:
	cd $(FRONTEND_DIR) && npm run dev &
	cd $(DESKTOP_DIR) && wails dev

desktop-build:
	cd $(FRONTEND_DIR) && npm run build
	cd $(DESKTOP_DIR) && wails build

.PHONY: desktop-dist
desktop-dist:
	@echo "Building frontend and desktop (wails build)"
	cd $(FRONTEND_DIR) && npm run build
	cd $(DESKTOP_DIR) && wails build
	@echo "Packaging desktop artifacts into dist/"
	@mkdir -p dist
	OSNAME=`uname -s | tr '[:upper:]' '[:lower:]'` || OSNAME=unknown; \
	ARCH=`uname -m` || ARCH=unknown; \
	OUTDIR=dist/desktop-$${OSNAME}-$${ARCH}; \
	mkdir -p $$OUTDIR; \
	# copy Wails build output (default: build/bin or build/ for some setups)
	if [ -d "$(DESKTOP_DIR)/build/bin" ]; then cp -r $(DESKTOP_DIR)/build/bin/* $$OUTDIR/; fi; \
	if [ -d "$(DESKTOP_DIR)/build" ]; then cp -r $(DESKTOP_DIR)/build/* $$OUTDIR/; fi; \
	@echo "Packaged to $$OUTDIR"

.PHONY: desktop-dist-zip
desktop-dist-zip: desktop-dist
	@echo "Zipping desktop distribution"
	OSNAME=`uname -s | tr '[:upper:]' '[:lower:]'` || OSNAME=unknown; \
	ARCH=`uname -m` || ARCH=unknown; \
	OUTDIR=dist/desktop-$${OSNAME}-$${ARCH}; \
	ZIPNAME=dist/mlcremote-desktop-$${OSNAME}-$${ARCH}.zip; \
	if [ -d "$$OUTDIR" ]; then (cd $$OUTDIR && zip -r ../../$$ZIPNAME .); else echo "No desktop build found in $$OUTDIR"; exit 1; fi; \
	@echo "Created $$ZIPNAME"

clean:
	@rm -f $(BIN_DIR)/dev-server
	@rm -rf $(STATIC_DIR)
	@echo "Cleaned build artifacts"
