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

.PHONY: help backend frontend run docs install connect clean desktop-dev desktop-build

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

clean:
	@rm -f $(BIN_DIR)/dev-server
	@rm -rf $(STATIC_DIR)
	@echo "Cleaned build artifacts"
