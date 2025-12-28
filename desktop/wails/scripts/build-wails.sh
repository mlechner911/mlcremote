#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# build frontend with desktop entry
echo "Building frontend..."
cd frontend
npm ci
npm run build:desktop
cd ..
# build wails app
echo "Building Wails app..."
wails build
echo "Done"
