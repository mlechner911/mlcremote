#!/usr/bin/env bash
set -euo pipefail

# Install Wails build dependencies for Linux.
# Supports: Ubuntu/Debian, Fedora, Arch. Falls back to printing instructions for others.

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (e.g., sudo $0)"
  exit 1
fi

OS_ID=""
if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID=${ID:-}
fi

case "$OS_ID" in
  ubuntu|debian)
    apt-get update
    apt-get install -y build-essential pkg-config libgtk-3-dev || true
    # Prefer 4.1 dev; if not available, fallback to 4.0
    if apt-get install -y libwebkit2gtk-4.1-dev; then
      echo "Installed libwebkit2gtk-4.1-dev"
      echo "Use: wails build -tags webkit2_41"
    else
      echo "libwebkit2gtk-4.1-dev not available; installing 4.0 dev"
      apt-get install -y libwebkit2gtk-4.0-dev
      echo "Use: wails build -tags webkit2"
    fi
    ;;
  fedora)
    dnf install -y @development-tools gcc-c++ pkgconf-pkg-config gtk3-devel webkit2gtk3-devel || true
    echo "Installed GTK + WebKitGTK dev packages on Fedora"
    echo "Use: wails build"
    ;;
  arch)
    pacman -Sy --noconfirm --needed base-devel pkgconf gtk3 webkit2gtk
    echo "Installed GTK + WebKitGTK dev packages on Arch"
    echo "Use: wails build"
    ;;
  *)
    echo "Unsupported distro ($OS_ID). Please install GTK3 + WebKitGTK dev packages, pkg-config, and build tools."
    echo "Examples:"
    echo "  - Debian/Ubuntu: build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev (or libwebkit2gtk-4.0-dev)"
    echo "  - Fedora: @development-tools gcc-c++ pkgconf-pkg-config gtk3-devel webkit2gtk3-devel"
    echo "  - Arch: base-devel pkgconf gtk3 webkit2gtk"
    ;;
esac

echo "All set. You can verify with: wails doctor"
